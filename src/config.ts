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

const groupIdList = commaList.pipe(
  z
    .array(z.string())
    .superRefine((groups, ctx) => {
      const placeholders = new Set(["grupo-1@g.us", "grupo-2@g.us"]);

      groups.forEach((groupId, index) => {
        if (placeholders.has(groupId.toLowerCase())) {
          ctx.addIssue({
            code: "custom",
            message: "Substitua o valor de exemplo pelo JID real do grupo da Wasender.",
            path: [index],
          });
        }

        if (!/^[A-Za-z0-9._:-]+@g\.us$/.test(groupId)) {
          ctx.addIssue({
            code: "custom",
            message: "Use um ID de grupo valido no formato 123456789012345@g.us.",
            path: [index],
          });
        }
      });
    }),
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
  WASENDER_BASE_URL: z.string().url().default("https://www.wasenderapi.com"),
  WASENDER_ACCESS_TOKEN: z.string().min(1),
  WASENDER_GROUP_IDS: groupIdList,
  WASENDER_GROUPS_PATH: z.string().default("/api/groups"),
  WASENDER_SEND_TEXT_PATH: z.string().default("/api/send-message"),
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
