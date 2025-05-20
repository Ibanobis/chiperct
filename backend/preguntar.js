// preguntar.js completo con soporte para múltiples namespaces y persistencia
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
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

let ultimoMetadata = null;
const namespaceFile = path.join("./", "namespaces.json");
let listaNamespaces = new Set();

if (fs.existsSync(namespaceFile)) {
  const data = fs.readFileSync(namespaceFile, "utf-8");
  try {
    const arr = JSON.parse(data);
    arr.forEach((ns) => listaNamespaces.add(ns));
  } catch (e) {
    console.error("❌ Error al leer namespaces.json:", e.message);
  }
} else {
  listaNamespaces.add("referencias y texto catalogo ct");
  fs.writeFileSync(namespaceFile, JSON.stringify(Array.from(listaNamespaces)));
}

function guardarNamespaces() {
  fs.writeFileSync(namespaceFile, JSON.stringify(Array.from(listaNamespaces), null, 2));
}

app.get("/namespaces", (req, res) => {
  res.json(Array.from(listaNamespaces));
});

app.post("/subir", async (req, res) => {
  try {
    const { id, texto, namespace } = req.body;
    if (!id || !texto || !namespace) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    listaNamespaces.add(namespace);
    guardarNamespaces();

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: texto,
    });

    const embedding = embeddingResponse.data[0].embedding;

    await index.namespace(namespace).upsert([
      {
        id,
        values: embedding,
        metadata: { texto },
      },
    ]);

    res.json({ ok: true, mensaje: "Subido correctamente" });
  } catch (error) {
    console.error("❌ Error al subir a Pinecone:", error.message);
    res.status(500).json({ error: "Error al subir los datos" });
  }
});

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
    const namespace = "referencias y texto catalogo ct";

    if (referenciaMatch) {
      const ref = referenciaMatch[0];
      const dummyVector = Array(1536).fill(0);
      const filtroReferencia = { referencia: { $eq: Number(ref) } };

      console.log("🔍 Buscando por referencia:", ref);
      const result = await index.namespace(namespace).query({
        vector: dummyVector,
        topK: 1,
        includeMetadata: true,
        filter: filtroReferencia,
      });

      if (result.matches?.length) {
        console.log("📦 Resultado exacto:", result.matches[0].metadata);
        relevantes = result.matches;
      }

      const metadata = relevantes[0]?.metadata;
      if (metadata) {
        ultimoMetadata = metadata;

        if (consulta.includes("precio")) {
          return res.json({ respuesta: `💶 Precio unitario: ${metadata.precio_unitario} EUR` });
        }
        if (consulta.includes("pg") || consulta.includes("grupo")) {
          return res.json({ respuesta: `🏷 Grupo de descuento (PG): ${metadata.pg}` });
        }
        if (consulta.includes("descripcion") || consulta.includes("descripción")) {
          return res.json({ respuesta: `📄 Descripción: ${metadata.descripcion}` });
        }
        if (consulta.includes("referencia")) {
          return res.json({ respuesta: `🔢 Referencia: ${metadata.referencia}` });
        }
        if (consulta.includes("categoria") || consulta.includes("herramienta")) {
          return res.json({ respuesta: `🛠 Herramienta/Categoría: ${metadata.categoria}` });
        }
      } else {
        return res.json({ respuesta: "🔍 Referencia no encontrada en el catálogo." });
      }
    }

    if (!referenciaMatch && ultimoMetadata) {
      console.log("ℹ️ Usando último metadata recordado:", ultimoMetadata);

      if (consulta.includes("precio")) {
        return res.json({ respuesta: `💶 Precio unitario: ${ultimoMetadata.precio_unitario} EUR` });
      }
      if (consulta.includes("pg") || consulta.includes("grupo")) {
        return res.json({ respuesta: `🏷 Grupo de descuento (PG): ${ultimoMetadata.pg}` });
      }
      if (consulta.includes("descripcion") || consulta.includes("descripción")) {
        return res.json({ respuesta: `📄 Descripción: ${ultimoMetadata.descripcion}` });
      }
      if (consulta.includes("referencia")) {
        return res.json({ respuesta: `🔢 Referencia: ${ultimoMetadata.referencia}` });
      }
      if (consulta.includes("categoria") || consulta.includes("herramienta")) {
        return res.json({ respuesta: `🛠 Herramienta/Categoría: ${ultimoMetadata.categoria}` });
      }
    }

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

    relevantes = matches.filter((m) => m.score >= scoreMinimo);

    if (relevantes.length) {
      console.log("✅ Metadata relevante encontrada:", relevantes[0].metadata);
      ultimoMetadata = relevantes[0]?.metadata;

      contexto = relevantes
        .map((match) => {
          const desc = match.metadata?.descripcion || match.metadata?.texto || "";
          const ref = match.metadata?.referencia || match.id || "";
          return pideDescripcion
            ? `Referencia: ${ref} → Descripción: ${desc}`
            : `${desc} → Referencia: ${ref}`;
        })
        .join("\n");
    }

    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: relevantes.length > 0
        ? `Mensaje del usuario: ${mensaje}\n\nContexto disponible:\n${contexto}\n\nResponde según el contexto. Si no es útil, responde normalmente.`
        : mensaje,
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