import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  name: text("name"),
  createdAt: integer("created_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  escalated: integer("escalated").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const escalations = sqliteTable("escalations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id),
  draftReply: text("draft_reply").notNull(),
  status: text("status", {
    enum: ["pending", "approved", "overridden", "skipped"],
  })
    .notNull()
    .default("pending"),
  resolvedAt: integer("resolved_at"),
});

export type Contact = typeof contacts.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type EscalationStatus = "pending" | "approved" | "overridden" | "skipped";
