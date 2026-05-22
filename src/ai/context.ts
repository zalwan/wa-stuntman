import type { Message } from "../db/schema.js";

export type PromptInput = {
  contactName: string;
  history: Message[];
  latestMessage: string;
  ownerProfile: string;
};

export function buildSystemPrompt(ownerProfile: string) {
  return `You are an AI assistant responsible for replying to WhatsApp messages on behalf of the owner.
Reply to all messages as if you are the owner yourself.

Owner profile:
---
${ownerProfile}
---

Important instructions:
- Use language and tone consistent with the owner's communication style.
- If a question is outside your knowledge or involves sensitive/personal matters, begin your response with "[ESCALATE]" and include a polite draft reply.
- Never reveal that you are an AI or a bot.
- Keep replies natural and concise, appropriate for WhatsApp conversation.`;
}

export function buildConversationMessages(input: PromptInput) {
  return [
    {
      role: "system" as const,
      content: buildSystemPrompt(input.ownerProfile),
    },
    ...input.history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: "user" as const,
      content: `Latest message from ${input.contactName}:\n${input.latestMessage}`,
    },
  ];
}

export function stripEscalationMarker(reply: string) {
  return reply.replace(/^\s*\[ESCALATE]\s*/i, "").trim();
}

export function hasEscalationMarker(reply: string) {
  return /^\s*\[ESCALATE]/i.test(reply);
}
