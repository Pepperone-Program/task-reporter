import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const commaList = z
  .string()
  .optional()
  .default("")
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  TRELLO_API_KEY: z.string().min(1),
  TRELLO_API_SECRET: z.string().optional().default(""),
  TRELLO_TOKEN: z.string().min(1),
  TRELLO_BOARD_ID: z.string().min(1),
  TRELLO_DONE_LIST_NAMES: commaList,
  TRELLO_CALLBACK_URL: z.string().url().optional().or(z.literal("")).default(""),
  TRELLO_WEBHOOK_DESCRIPTION: z.string().default("task-reporter-board-webhook"),
  W_API_BASE_URL: z.string().url().default("https://api.w-api.app/v1"),
  W_API_INSTANCE_ID: z.string().min(1),
  W_API_TOKEN: z.string().optional().default(""),
  W_API_KEY: z.string().optional().default(""),
  W_API_GROUP_IDS: commaList,
  W_API_DELAY_MESSAGE: z.coerce.number().int().min(1).max(15).default(1),
  W_API_GROUPS_PATH: z.string().default("/instances/{instanceId}/groups"),
  W_API_SEND_TEXT_PATH: z.string().default("/message/send-text"),
  QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(1),
  QUEUE_RETRIES: z.coerce.number().int().min(0).default(3),
  QUEUE_RETRY_DELAY_MS: z.coerce.number().int().min(0).default(1500),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Variaveis de ambiente invalidas:\n${issues.join("\n")}`);
}

export const config = parsed.data;
