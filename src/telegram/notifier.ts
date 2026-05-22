import type { BotService } from "../bot/service.js";
import type { AppConfig } from "../config/loader.js";

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: { id: number | string };
    text?: string;
  };
};

type TelegramResponse<T> = {
  ok: boolean;
  result: T;
  description?: string;
};

export class TelegramNotifier {
  private offset = 0;
  private running = false;
  private botService?: BotService;

  constructor(private readonly config: AppConfig) {}

  setBotService(botService: BotService) {
    this.botService = botService;
  }

  start() {
    if (!this.isEnabled() || this.running) {
      if (!this.isEnabled()) {
        console.warn("Telegram is disabled. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable escalations.");
      }
      return;
    }

    this.running = true;
    void this.pollLoop();
  }

  stop() {
    this.running = false;
  }

  async sendEscalation(input: {
    contactName: string;
    draftReply: string;
    escalationId: number;
    incomingMessage: string;
  }) {
    if (!this.isEnabled()) {
      console.warn(`Escalation #${input.escalationId} created but Telegram is not configured.`);
      return;
    }

    await this.sendMessage(
      [
        `Escalation #${input.escalationId} from: ${input.contactName}`,
        `Message: "${input.incomingMessage}"`,
        `Bot draft: "${input.draftReply}"`,
        "",
        `Reply /approve ${input.escalationId} to send this draft`,
        `Reply /override ${input.escalationId} [new message] to send manually`,
        `Reply /skip ${input.escalationId} to ignore`,
      ].join("\n"),
    );
  }

  async sendMessage(text: string) {
    if (!this.isEnabled()) {
      return;
    }

    const response = await fetch(this.apiUrl("sendMessage"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: this.config.telegramChatId,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed: ${response.status} ${await response.text()}`);
    }
  }

  private async pollLoop() {
    while (this.running) {
      try {
        const updates = await this.getUpdates();
        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (error) {
        console.error("Telegram polling failed", error);
        await sleep(3000);
      }
    }
  }

  private async getUpdates() {
    const url = new URL(this.apiUrl("getUpdates"));
    url.searchParams.set("timeout", "25");
    url.searchParams.set("offset", String(this.offset));
    url.searchParams.set("allowed_updates", JSON.stringify(["message"]));

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Telegram getUpdates failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as TelegramResponse<TelegramUpdate[]>;
    if (!body.ok) {
      throw new Error(body.description || "Telegram getUpdates returned ok=false");
    }

    return body.result;
  }

  private async handleUpdate(update: TelegramUpdate) {
    const text = update.message?.text?.trim();
    const chatId = update.message?.chat.id;

    if (!text || String(chatId) !== this.config.telegramChatId || !this.botService) {
      return;
    }

    const response = await this.dispatchCommand(text);
    if (response) {
      await this.sendMessage(response);
    }
  }

  private async dispatchCommand(text: string) {
    const [command, ...rest] = text.split(/\s+/);
    const args = rest.join(" ");

    switch (command) {
      case "/approve": {
        return this.botService?.approveEscalation(parseOptionalId(args));
      }
      case "/override": {
        const { id, message } = parseOptionalIdAndMessage(args);
        return this.botService?.overrideEscalation(message, id);
      }
      case "/skip": {
        return this.botService?.skipEscalation(parseOptionalId(args));
      }
      case "/pause": {
        return this.botService?.pause();
      }
      case "/resume": {
        return this.botService?.resume();
      }
      case "/status": {
        const status = this.botService?.getStatus();
        if (!status) {
          return "Bot service is not ready.";
        }

        return `Status: ${status.paused ? "paused" : "active"}\nMessages handled today: ${status.handledToday}`;
      }
      default:
        return "Unknown command. Use /approve, /override, /skip, /pause, /resume, or /status.";
    }
  }

  private apiUrl(method: string) {
    return `https://api.telegram.org/bot${this.config.telegramBotToken}/${method}`;
  }

  private isEnabled() {
    return Boolean(this.config.telegramBotToken && this.config.telegramChatId);
  }
}

function parseOptionalId(input: string) {
  const id = Number.parseInt(input.trim(), 10);
  return Number.isFinite(id) ? id : undefined;
}

function parseOptionalIdAndMessage(input: string) {
  const trimmed = input.trim();
  const firstSpace = trimmed.indexOf(" ");
  const firstToken = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
  const maybeId = Number.parseInt(firstToken, 10);

  if (Number.isFinite(maybeId)) {
    return {
      id: maybeId,
      message: firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1).trim(),
    };
  }

  return { id: undefined, message: trimmed };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
