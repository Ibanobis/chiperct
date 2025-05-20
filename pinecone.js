import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Cargar .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  controllerHostUrl: process.env.PINECONE_HOST,
});
const index = pinecone.index("prueba1");

export default pinecone;
