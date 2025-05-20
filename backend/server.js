// server.js (coloca este archivo en la raiz de tu proyecto)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { OpenAI } from "openai";
import { buscarEnWeb } from './buscarEnWeb.js';


// Cargar variables de entorno desde .env
dotenv.config();
console.log("✅ KEY:", process.env.OPENAI_API_KEY);
console.log("✅ ASSISTANT:", process.env.ASSISTANT_ID);


const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🧠 Diccionario para guardar los threads por usuario temporalmente
const userThreads = {}; // Idealmente esto debería estar en una base de datos real

app.post("/buscar-ceratizit", async (req, res) => {
  const { consulta } = req.body;
  if (!consulta) {
    return res.status(400).json({ error: "Consulta vacía" });
  }

  try {
    const resultado = await buscarEnWeb(consulta);
    res.json({ resultado });
  } catch (err) {
    console.error("❌ Error en /buscar-ceratizit:", err);
    res.status(500).json({ error: "Fallo al buscar en Ceratizit" });
  }
});

app.post("/preguntar", async (req, res) => {
  const { mensaje, userId = "default" } = req.body;

  try {
    // Crear un thread si no existe para este usuario
    if (!userThreads[userId]) {
      const thread = await openai.beta.threads.create();
      userThreads[userId] = thread.id;
      console.log("Nuevo thread creado para:", userId);
    }

    const threadId = userThreads[userId];

    // Agregar el mensaje del usuario al thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: mensaje,
    });

    // Ejecutar el asistente sobre ese thread
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    // Esperar a que termine la ejecución
    let runStatus;
    do {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    } while (runStatus.status !== "completed");

    // Obtener la respuesta del asistente
    const messages = await openai.beta.threads.messages.list(threadId);
    const respuesta = messages.data[0].content[0].text.value;

    res.json({ respuesta });
  } catch (error) {
    console.error("❌ Error al consultar el asistente:", error);
    res.status(500).json({ error: "Hubo un problema al procesar la consulta." });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`\u2705 Backend corriendo en http://localhost:${PORT}`);
});
