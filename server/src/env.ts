import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  HOST_PASSWORD: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  CORS_ORIGIN: z.string().default("*"),
  PORT: z.coerce.number().default(4000),
});
export const env = schema.parse(process.env);
