import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { OpenAiReplyGenerator } from "./ai/openai.js";
import { BotService } from "./bot/service.js";
import { loadConfig, loadOwnerProfile } from "./config/loader.js";
import { createDatabase } from "./db/database.js";
import { Queries } from "./db/queries.js";
import { TelegramNotifier } from "./telegram/notifier.js";
import { WhatsAppClient } from "./wa/client.js";

async function main() {
  const config = loadConfig();
  const ownerProfile = loadOwnerProfile(config.profilePath);
  const database = createDatabase(config.dbPath);
  const queries = new Queries(database.orm);
  const replyGenerator = new OpenAiReplyGenerator(config.openaiApiKey, config.openaiModel);
  const telegram = new TelegramNotifier(config);

  let whatsAppClient: WhatsAppClient | undefined;
  const botService = new BotService(
    config,
    ownerProfile,
    queries,
    replyGenerator,
    async (contactId, text) => whatsAppClient?.sendText(contactId, text),
    (input) => telegram.sendEscalation(input),
  );

  telegram.setBotService(botService);

  const app = new Hono();
  app.get("/health", (context) =>
    context.json({
      ok: true,
      service: "whatsapp-personal-assistant",
    }),
  );
  app.get("/status", (context) => context.json(botService.getStatus()));

  serve(
    {
      fetch: app.fetch,
      port: config.port,
    },
    (info) => {
      console.log(`Hono server listening on http://localhost:${info.port}`);
    },
  );

  whatsAppClient = new WhatsAppClient(config, (message) => botService.handleIncomingMessage(message));
  await whatsAppClient.start();
  telegram.start();

  const shutdown = () => {
    telegram.stop();
    database.sqlite.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
