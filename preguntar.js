import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import { OpenAI } from "openai";
import { Pinecone } from "@pinecone-database/pinecone";

dotenv.config();

const app = express();
const port = 5000;
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

const index = pinecone.index("chiperct");
const namespace = "referencias y texto catalogo ct";

let ultimoMetadata = null; 

app.post("/preguntar", async (req, res) => {
  try {
    const { mensaje } = req.body;
    console.log("🗨️ Mensaje recibido:", mensaje);

    const consulta = mensaje.toLowerCase().trim();
    const esSaludo = ["hola", "buenas", "hey", "holi", "saludos"].includes(consulta);

    if (esSaludo) {
      return res.json({ respuesta: "¡Hola! ¿En qué puedo ayudarte hoy con herramientas Ceratizit?" });
    }

    const referenciaMatch = mensaje.match(/\b\d{8,10}\b/);
    const pideReferencia = consulta.includes("referencia") || consulta.includes("número") || consulta.includes("numero");
    const pideDescripcion = consulta.includes("descripción") || consulta.includes("descripcion") || consulta.includes("herramienta") || consulta.includes("hta");

    let contexto = "";
    let relevantes = [];
    let desdeFiltro = false;

    if (referenciaMatch) {
      const ref = referenciaMatch[0];
      const dummyVector = Array(1536).fill(0);
      const filtroReferencia = { referencia: { $eq: Number(ref) } };

      console.log("🔍 Buscando por referencia:", ref);
      console.log("📤 Filtro aplicado:", filtroReferencia);

      const result = await index.namespace(namespace).query({
        vector: dummyVector,
        topK: 1,
        includeMetadata: true,
        filter: filtroReferencia
      });

      if (result.matches?.length) {
        console.log("📦 Resultado exacto:", result.matches[0].metadata);
        relevantes = result.matches;
        desdeFiltro = true;
      }

      const metadata = relevantes[0]?.metadata;
      if (metadata) {
        ultimoMetadata = metadata;

        if (consulta.includes('precio')) {
          return res.json({ respuesta: `💶 Precio unitario: ${metadata.precio_unitario} EUR` });
        }
        if (consulta.includes('pg') || consulta.includes('grupo')) {
          return res.json({ respuesta: `🏷 Grupo de descuento (PG): ${metadata.pg}` });
        }
        if (consulta.includes('descripcion') || consulta.includes('descripción')) {
          return res.json({ respuesta: `📄 Descripción: ${metadata.descripcion}` });
        }
        if (consulta.includes('referencia')) {
          return res.json({ respuesta: `🔢 Referencia: ${metadata.referencia}` });
        }
        if (consulta.includes('categoria') || consulta.includes('herramienta')) {
          return res.json({ respuesta: `🛠 Herramienta/Categoría: ${metadata.categoria}` });
        }
      } else {
        return res.json({ respuesta: "🔍 Referencia no encontrada en el catálogo." });
      }
    }

    if (!referenciaMatch && ultimoMetadata) {
      console.log("ℹ️ Usando último metadata recordado:", ultimoMetadata);

      if (consulta.includes('precio')) {
        return res.json({ respuesta: `💶 Precio unitario: ${ultimoMetadata.precio_unitario} EUR` });
      }
      if (consulta.includes('pg') || consulta.includes('grupo')) {
        return res.json({ respuesta: `🏷 Grupo de descuento (PG): ${ultimoMetadata.pg}` });
      }
      if (consulta.includes('descripcion') || consulta.includes('descripción')) {
        return res.json({ respuesta: `📄 Descripción: ${ultimoMetadata.descripcion}` });
      }
      if (consulta.includes('referencia')) {
        return res.json({ respuesta: `🔢 Referencia: ${ultimoMetadata.referencia}` });
      }
      if (consulta.includes('categoria') || consulta.includes('herramienta')) {
        return res.json({ respuesta: `🛠 Herramienta/Categoría: ${ultimoMetadata.categoria}` });
      }
    }

    // Buscar por embeddings
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: mensaje,
    });

    const userEmbedding = embeddingResponse.data[0].embedding;

    const result = await index.namespace(namespace).query({
      vector: userEmbedding,
      topK: 5,
      includeMetadata: true,
    });

    const scoreMinimo = 0.75;
    const matches = result.matches || [];
    const scoreMasAlto = matches.length ? matches[0].score.toFixed(3) : "N/A";
    console.log(`🔎 Pinecone devolvió ${matches.length} coincidencias, score más alto: ${scoreMasAlto}`);

    relevantes = matches.filter((m) => m.score > scoreMinimo);

    if (relevantes.length === 0) {
      console.log("🚫 Pinecone no devolvió nada relevante.");

      if (!referenciaMatch && !ultimoMetadata) {
        console.log("🤖 Enviando pregunta directamente a OpenAI sin contexto.");

        const thread = await openai.beta.threads.create();
        await openai.beta.threads.messages.create(thread.id, {
          role: "user",
          content: mensaje,
        });

        const run = await openai.beta.threads.runs.create(thread.id, {
          assistant_id: process.env.ASSISTANT_ID,
        });

        let status = "queued";
        while (status === "queued" || status === "in_progress") {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const updatedRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
          status = updatedRun.status;
        }

        const messages = await openai.beta.threads.messages.list(thread.id);
        const respuesta = messages.data[0].content[0].text.value;

        return res.json({ respuesta });
      }

      return res.json({ respuesta: "No se ha encontrado ninguna información relevante sobre tu mensaje." });
    }

    console.log("✅ Metadata relevante encontrada:", relevantes[0].metadata);

    contexto = relevantes
      .map((match) => {
        const desc = match.metadata?.descripcion || "";
        const ref = match.metadata?.referencia || "";
        return pideDescripcion
          ? `Referencia: ${ref} → Descripción: ${desc}`
          : `${desc} → Referencia: ${ref}`;
      })
      .join("\n");

    ultimoMetadata = relevantes[0]?.metadata;

    const thread = await openai.beta.threads.create();
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Mensaje del usuario: ${mensaje}\n\nContexto disponible:\n${contexto}\n\nTu tarea es interpretar su intención y responder correctamente según el contexto. Si no hay coincidencia clara, responde con: "No encontrada".`,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    let status = "queued";
    while (status === "queued" || status === "in_progress") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const updatedRun = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      status = updatedRun.status;
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const respuesta = messages.data[0].content[0].text.value;

    res.json({ respuesta });
  } catch (error) {
    console.error("❌ Error en backend:", error.message);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${port}`);
});
