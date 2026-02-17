import Fastify from "fastify";
import cors from "@fastify/cors";
import { ensureCollections } from "./services/vectordb.js";
import { queryRoutes } from "./routes/query.js";
import { ingestRoutes } from "./routes/ingest.js";
import { healthRoutes } from "./routes/health.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

await app.register(queryRoutes);
await app.register(ingestRoutes);
await app.register(healthRoutes);

try {
  await ensureCollections();
  console.log("Qdrant collections ready.");
} catch (err) {
  console.error("Failed to initialize Qdrant collections:", err);
  process.exit(1);
}

await app.listen({ port: 3200, host: "0.0.0.0" });
console.log("API server running on http://0.0.0.0:3200");
