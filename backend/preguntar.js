// preguntar.js mejorado para contexto acumulado (texto libre) y búsqueda en todos los namespaces
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
let historialMensajes = [];
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
    historialMensajes.push(mensaje);

    // Armar el contexto del usuario con historial completo
    const contextoUsuario = historialMensajes.slice(-5).join("\n");

    // Obtener embedding del contexto acumulado del usuario
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: contextoUsuario,
    });

    const userEmbedding = embeddingResponse.data[0].embedding;

    let todosLosMatches = [];
    for (const ns of listaNamespaces) {
      const result = await index.namespace(ns).query({
        vector: userEmbedding,
        topK: 5,
        includeMetadata: true,
      });
      (result.matches || []).forEach((match) => {
        match.namespace = ns;
        todosLosMatches.push(match);
      });
    }

    todosLosMatches.sort((a, b) => b.score - a.score);
    const scoreMinimo = 0.75;
    const relevantes = todosLosMatches.filter((m) => m.score >= scoreMinimo);

    let contexto = "";
    if (relevantes.length) {
      ultimoMetadata = relevantes[0]?.metadata;
      contexto = relevantes
        .map((match) => {
          const desc = match.metadata?.descripcion || match.metadata?.texto || "";
          const ref = match.metadata?.referencia || match.id || "";
          return `Namespace: ${match.namespace}\nReferencia: ${ref}\nDescripción: ${desc}`;
        })
        .join("\n\n");
    }

    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: relevantes.length > 0
        ? `Conversación del usuario:\n${contextoUsuario}\n\nContexto obtenido:\n${contexto}\n\nResponde con precisión usando el contexto si aplica.`
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
