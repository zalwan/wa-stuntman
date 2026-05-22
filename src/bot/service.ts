import { randomUUID } from "node:crypto";
import { hasEscalationMarker, stripEscalationMarker } from "../ai/context.js";
import type { OpenAiReplyGenerator } from "../ai/openai.js";
import type { AppConfig } from "../config/loader.js";
import type { Queries } from "../db/queries.js";

export type IncomingWhatsAppMessage = {
  contactId: string;
  contactName: string | null;
  messageId: string;
  text: string;
};

export type SendWhatsAppText = (contactId: string, text: string) => Promise<string | undefined>;
export type NotifyEscalation = (input: {
  contactName: string;
  draftReply: string;
  escalationId: number;
  incomingMessage: string;
}) => Promise<void>;

export class BotService {
  private paused = false;

  constructor(
    private readonly config: AppConfig,
    private readonly ownerProfile: string,
    private readonly queries: Queries,
    private readonly replyGenerator: OpenAiReplyGenerator,
    private readonly sendWhatsAppText: SendWhatsAppText,
    private readonly notifyEscalation: NotifyEscalation,
  ) {}

  async handleIncomingMessage(input: IncomingWhatsAppMessage) {
    const text = input.text.trim();
    if (!text) {
      return;
    }

    if (this.queries.getMessage(input.messageId)) {
      return;
    }

    const now = unixNow();
    const contactName = input.contactName || input.contactId;
    const { isNew } = this.queries.upsertContact(input.contactId, input.contactName, now);

    if (this.paused) {
      this.queries.insertMessage({
        id: input.messageId,
        contactId: input.contactId,
        role: "user",
        content: text,
        escalated: 0,
        createdAt: now,
      });
      return;
    }

    const history = this.queries.getRecentMessages(input.contactId, this.config.maxHistoryMessages);
    const rawDraft = await this.createDraftReply({
      contactName,
      history,
      latestMessage: text,
    });

    const markerEscalation = hasEscalationMarker(rawDraft);
    const draftReply = stripEscalationMarker(rawDraft) || fallbackDraftReply;
    const shouldEscalate =
      markerEscalation ||
      this.containsSensitiveKeyword(text) ||
      (this.config.escalateNewContacts && isNew);

    this.queries.insertMessage({
      id: input.messageId,
      contactId: input.contactId,
      role: "user",
      content: text,
      escalated: shouldEscalate ? 1 : 0,
      createdAt: now,
    });

    if (shouldEscalate) {
      const escalationId = this.queries.createEscalation(input.messageId, draftReply);
      await this.notifyEscalation({
        contactName,
        draftReply,
        escalationId,
        incomingMessage: text,
      });
      return;
    }

    const sentMessageId = await this.sendWhatsAppText(input.contactId, draftReply);
    this.queries.insertMessage({
      id: sentMessageId || `assistant-${randomUUID()}`,
      contactId: input.contactId,
      role: "assistant",
      content: draftReply,
      escalated: 0,
      createdAt: unixNow(),
    });
  }

  async approveEscalation(id?: number) {
    const pending = this.queries.getPendingEscalation(id);
    if (!pending) {
      return id ? `No pending escalation found for #${id}.` : "No pending escalation found.";
    }

    const sentMessageId = await this.sendWhatsAppText(pending.contactId, pending.draftReply);
    this.queries.insertMessage({
      id: sentMessageId || `assistant-${randomUUID()}`,
      contactId: pending.contactId,
      role: "assistant",
      content: pending.draftReply,
      escalated: 0,
      createdAt: unixNow(),
    });
    this.queries.resolveEscalation(pending.id, "approved", unixNow());

    return `Approved escalation #${pending.id} and sent the draft.`;
  }

  async overrideEscalation(message: string, id?: number) {
    const trimmed = message.trim();
    if (!trimmed) {
      return "Usage: /override [optional_id] message";
    }

    const pending = this.queries.getPendingEscalation(id);
    if (!pending) {
      return id ? `No pending escalation found for #${id}.` : "No pending escalation found.";
    }

    const sentMessageId = await this.sendWhatsAppText(pending.contactId, trimmed);
    this.queries.insertMessage({
      id: sentMessageId || `assistant-${randomUUID()}`,
      contactId: pending.contactId,
      role: "assistant",
      content: trimmed,
      escalated: 0,
      createdAt: unixNow(),
    });
    this.queries.resolveEscalation(pending.id, "overridden", unixNow());

    return `Overrode escalation #${pending.id} and sent your message.`;
  }

  async skipEscalation(id?: number) {
    const pending = this.queries.getPendingEscalation(id);
    if (!pending) {
      return id ? `No pending escalation found for #${id}.` : "No pending escalation found.";
    }

    this.queries.resolveEscalation(pending.id, "skipped", unixNow());
    return `Skipped escalation #${pending.id}.`;
  }

  pause() {
    this.paused = true;
    return "Auto-reply is paused.";
  }

  resume() {
    this.paused = false;
    return "Auto-reply is active.";
  }

  getStatus() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return {
      paused: this.paused,
      handledToday: this.queries.countHandledSince(Math.floor(startOfToday.getTime() / 1000)),
    };
  }

  private async createDraftReply(input: {
    contactName: string;
    history: ReturnType<Queries["getRecentMessages"]>;
    latestMessage: string;
  }) {
    try {
      return await this.replyGenerator.generateReply({
        contactName: input.contactName,
        history: input.history,
        latestMessage: input.latestMessage,
        ownerProfile: this.ownerProfile,
      });
    } catch (error) {
      console.error("Failed to generate OpenAI reply", error);
      return `[ESCALATE] ${fallbackDraftReply}`;
    }
  }

  private containsSensitiveKeyword(message: string) {
    const normalized = message.toLowerCase();
    return this.config.escalationKeywords.some((keyword) => normalized.includes(keyword));
  }
}

const fallbackDraftReply = "Sorry, I am tied up right now and will get back to you soon.";

function unixNow() {
  return Math.floor(Date.now() / 1000);
}
