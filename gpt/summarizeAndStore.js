import { callGPT } from "./openaiClient";
import { db } from "../firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function summarizeAndStore(messages, userEmail) {
  const resumenPrompt = [
    {
      role: "system",
      content: "Eres un asistente que resume conversaciones técnicas de mecanizado.",
    },
    {
      role: "user",
      content: `Resume esta conversación de forma técnica y organizada para almacenarla como memoria del usuario:\n\n${messages.map(m => `${m.isBot ? 'Bot' : 'Usuario'}: ${m.text}`).join('\n')}`,
    },
  ];

  const resumenTexto = await callGPT(resumenPrompt);

  // 🧠 Guardamos en Firestore dentro de la colección "resumenes"
  try {
    await addDoc(collection(db, "usuarios", userEmail, "resumenes"), {
      texto: resumenTexto,
      fecha: serverTimestamp(),
      raw: messages,
    });
    console.log("✅ Resumen guardado en Firestore para:", userEmail);
  } catch (error) {
    console.error("❌ Error guardando en Firestore:", error);
  }

  return resumenTexto;
}
