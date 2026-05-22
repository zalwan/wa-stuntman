import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WAMessage,
  type WASocket,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { mkdirSync } from "node:fs";
import pino from "pino";
import qrcode from "qrcode-terminal";
import type { AppConfig } from "../config/loader.js";
import type { IncomingWhatsAppMessage } from "../bot/service.js";

export type IncomingMessageHandler = (message: IncomingWhatsAppMessage) => Promise<void>;

export class WhatsAppClient {
  private socket?: WASocket;
  private starting = false;

  constructor(
    private readonly config: AppConfig,
    private readonly onIncomingMessage: IncomingMessageHandler,
  ) {}

  async start() {
    if (this.starting) {
      return;
    }

    this.starting = true;
    mkdirSync(this.config.authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(this.config.authDir);
    const { version } = await fetchLatestBaileysVersion();
    const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL ?? "silent" });

    this.socket = makeWASocket({
      auth: state,
      browser: ["Personal Assistant", "Chrome", "1.0.0"],
      logger,
      markOnlineOnConnect: false,
      version,
    });

    this.socket.ev.on("creds.update", saveCreds);
    this.socket.ev.on("connection.update", async (update) => {
      if (update.qr) {
        console.log("Scan this WhatsApp QR code:");
        qrcode.generate(update.qr, { small: true });
      }

      if (update.connection === "open") {
        console.log("WhatsApp client connected.");
      }

      if (update.connection === "close") {
        const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
          ?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.warn(`WhatsApp connection closed. Reconnect: ${shouldReconnect}`);
        this.starting = false;

        if (shouldReconnect) {
          await this.start();
        }
      }
    });

    this.socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") {
        return;
      }

      for (const message of messages) {
        await this.handleBaileysMessage(message);
      }
    });
  }

  async sendText(contactId: string, text: string) {
    if (!this.socket) {
      throw new Error("WhatsApp client is not connected");
    }

    const result = await this.socket.sendMessage(contactId, { text });
    return result?.key.id ?? undefined;
  }

  private async handleBaileysMessage(message: WAMessage) {
    if (message.key.fromMe || !message.key.remoteJid) {
      return;
    }

    const contactId = message.key.remoteJid;
    if (contactId === "status@broadcast") {
      return;
    }

    if (this.config.ignoreGroupMessages && contactId.endsWith("@g.us")) {
      return;
    }

    const text = extractText(message);
    if (!text) {
      return;
    }

    await this.onIncomingMessage({
      contactId,
      contactName: message.pushName ?? null,
      messageId: message.key.id || `${contactId}-${Date.now()}`,
      text,
    });
  }
}

function extractText(message: WAMessage) {
  const content = unwrapMessage(message.message);
  if (!content) {
    return null;
  }

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedDisplayText ||
    content.listResponseMessage?.title ||
    null
  );
}

function unwrapMessage(message: WAMessage["message"]) {
  return (
    message?.ephemeralMessage?.message ||
    message?.viewOnceMessage?.message ||
    message?.viewOnceMessageV2?.message ||
    message?.documentWithCaptionMessage?.message ||
    message
  );
}
