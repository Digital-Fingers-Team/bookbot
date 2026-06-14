import dotenv from "dotenv";
import { z } from "zod";

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
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openai/gpt-4o-mini"),
  UPLOAD_MAX_MB: z.coerce.number().int().positive().default(25)
});

export const env = schema.parse(process.env);
