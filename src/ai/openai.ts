import OpenAI from "openai";
import type { Message } from "../db/schema.js";
import { buildConversationMessages } from "./context.js";

export type GenerateReplyInput = {
  contactName: string;
  history: Message[];
  latestMessage: string;
  ownerProfile: string;
};

export class OpenAiReplyGenerator {
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateReply(input: GenerateReplyInput) {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.5,
      messages: buildConversationMessages(input),
    });

    const reply = completion.choices[0]?.message.content?.trim();
    if (!reply) {
      throw new Error("OpenAI returned an empty reply");
    }

    return reply;
  }
}
