import { and, desc, eq, gte } from "drizzle-orm";
import type { AppDatabase } from "./database.js";
import { contacts, escalations, type EscalationStatus, type Message, messages, type NewMessage } from "./schema.js";

export type PendingEscalation = {
  id: number;
  messageId: string;
  contactId: string;
  contactName: string | null;
  incomingMessage: string;
  draftReply: string;
};

export class Queries {
  constructor(private readonly db: AppDatabase["orm"]) {}

  getContact(contactId: string) {
    return this.db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1).get();
  }

  upsertContact(contactId: string, name: string | null, createdAt: number) {
    const existing = this.getContact(contactId);

    if (existing) {
      if (name && name !== existing.name) {
        this.db.update(contacts).set({ name }).where(eq(contacts.id, contactId)).run();
      }

      return { contact: existing, isNew: false };
    }

    const contact = { id: contactId, name, createdAt };
    this.db.insert(contacts).values(contact).run();
    return { contact, isNew: true };
  }

  getMessage(messageId: string) {
    return this.db.select().from(messages).where(eq(messages.id, messageId)).limit(1).get();
  }

  insertMessage(message: NewMessage) {
    const result = this.db.insert(messages).values(message).onConflictDoNothing().run();
    return result.changes > 0;
  }

  getRecentMessages(contactId: string, limit: number): Message[] {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.contactId, contactId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .all()
      .reverse();
  }

  createEscalation(messageId: string, draftReply: string) {
    const [row] = this.db
      .insert(escalations)
      .values({ messageId, draftReply, status: "pending" })
      .returning({ id: escalations.id })
      .all();

    if (!row) {
      throw new Error("Failed to create escalation");
    }

    return row.id;
  }

  getPendingEscalation(id?: number): PendingEscalation | undefined {
    const rows = this.db
      .select({
        id: escalations.id,
        messageId: escalations.messageId,
        contactId: messages.contactId,
        contactName: contacts.name,
        incomingMessage: messages.content,
        draftReply: escalations.draftReply,
      })
      .from(escalations)
      .innerJoin(messages, eq(escalations.messageId, messages.id))
      .innerJoin(contacts, eq(messages.contactId, contacts.id))
      .where(
        id
          ? and(eq(escalations.id, id), eq(escalations.status, "pending"))
          : eq(escalations.status, "pending"),
      )
      .orderBy(desc(escalations.id))
      .limit(1)
      .all();

    return rows[0];
  }

  resolveEscalation(id: number, status: Exclude<EscalationStatus, "pending">, resolvedAt: number) {
    this.db.update(escalations).set({ status, resolvedAt }).where(eq(escalations.id, id)).run();
  }

  countHandledSince(timestamp: number) {
    const rows = this.db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.role, "user"), gte(messages.createdAt, timestamp)))
      .all();

    return rows.length;
  }
}
