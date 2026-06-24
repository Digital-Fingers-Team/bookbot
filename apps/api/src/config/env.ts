import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const rootEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../.env");

dotenv.config({ path: rootEnvPath });
dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/bookbotd"),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
  ADMIN_API_KEY: z.string().optional(),
  AUTH_JWT_SECRET: z.string().min(16).default("change-me-bookbot-auth-secret"),
  DEFAULT_ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  DEFAULT_ADMIN_PASSWORD: z.string().min(6).default("admin123"),
  OPENROUTER_EMBEDDING_MODEL: z.string().default("openai/text-embedding-3-small"),
  OPENROUTER_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  ATLAS_VECTOR_INDEX_NAME: z.string().default("chunk_embedding_vector_index"),
  VECTOR_CANDIDATE_MAX: z.coerce.number().int().positive().default(300),
  VECTOR_NUM_CANDIDATES_MULTIPLIER: z.coerce.number().int().positive().default(20),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4o-mini"),
  PDF_STORAGE_DIR: z.string().default("storage/pdfs"),
  UPLOAD_MAX_MB: z.coerce.number().int().positive().default(25),
  UPLOAD_MAX_FILES: z.coerce.number().int().positive().default(10)
});

export const env = schema.parse(process.env);
