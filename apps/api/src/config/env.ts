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
  VECTOR_NUM_CANDIDATES_MULTIPLIER: z.coerce.number().int().positive().default(10),
  OPENROUTER_API_KEY: z.string().optional(),
  // Base URL for the chat + embedding API. Point this at a regional or
  // self-hosted OpenAI-compatible endpoint for data residency / sovereignty.
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4o-mini"),
  OCR_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value !== "false" && value !== "0"),
  OCR_PROVIDER: z.enum(["auto", "openrouter", "local"]).default("auto"),
  OCR_LOCAL_LANGS: z.string().default("ara+eng"),
  OCR_VISION_MODEL: z.string().default("google/gemini-2.5-flash"),
  OCR_MIN_TEXT_SCORE: z.coerce.number().int().min(0).max(100).default(65),
  OCR_RENDER_SCALE: z.coerce.number().positive().max(5).default(2),
  OCR_MAX_PAGES: z.coerce.number().int().positive().default(600),
  OCR_CONCURRENCY: z.coerce.number().int().positive().max(32).default(6),
  OCR_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(4096),
  PROCESSING_CONCURRENCY: z.coerce.number().int().positive().max(8).default(2),
  PDF_STORAGE_DIR: z.string().default("storage/pdfs"),
  UPLOAD_MAX_MB: z.coerce.number().int().positive().default(25),
  UPLOAD_MAX_FILES: z.coerce.number().int().positive().default(10),
  // --- OMP (Open Monograph Press) integration ---
  // Base URL of the OMP install whose catalog/API we read from.
  OMP_BASE_URL: z.string().url().default("http://localhost:8091"),
  // Press path inside OMP ("index" = site-wide; otherwise the press's path).
  OMP_CONTEXT_PATH: z.string().default("index"),
  // API token generated in OMP (admin Profile → API Key). Optional until set.
  OMP_API_TOKEN: z.string().optional(),
  // Secret used to encrypt the OMP password we store per user (AES-256-GCM).
  OMP_USER_SECRET: z.string().min(16).default("change-me-omp-user-secret-key"),
  // Shared secret for signing one-time SSO login tokens handed to OMP's
  // token-login handler. MUST match `bookbot_sso_secret` in OMP's config.
  OMP_SSO_SECRET: z.string().min(16).default("change-me-omp-sso-shared-secret"),
  // Default country (ISO) used when registering an OMP author for users whose
  // country we don't collect in bookbot.
  OMP_DEFAULT_COUNTRY: z.string().length(2).default("EG"),
  // Push processed books into OMP as submissions when true.
  OMP_PUSH_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value !== "false" && value !== "0"),
  // OMP genre id used for the uploaded manuscript file (1 = first/manuscript genre).
  OMP_SUBMISSION_GENRE_ID: z.coerce.number().int().positive().default(1)
});

export const env = schema.parse(process.env);
