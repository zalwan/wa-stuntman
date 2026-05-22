import "dotenv/config";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type AppConfig = {
  authDir: string;
  dataDir: string;
  dbPath: string;
  escalationKeywords: string[];
  escalateNewContacts: boolean;
  ignoreGroupMessages: boolean;
  maxHistoryMessages: number;
  openaiApiKey: string;
  openaiModel: string;
  port: number;
  profilePath: string;
  telegramBotToken?: string;
  telegramChatId?: string;
};

export function loadConfig(): AppConfig {
  const dataDir = resolve(process.env.DATA_DIR ?? "./data");
  const authDir = resolve(process.env.AUTH_DIR ?? "./auth");
  const profilePath = resolve(process.env.PROFILE_PATH ?? "./config/profile.txt");
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();

  if (!openaiApiKey || openaiApiKey === "sk-...") {
    throw new Error("OPENAI_API_KEY must be set in .env");
  }

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(authDir, { recursive: true });

  return {
    authDir,
    dataDir,
    dbPath: resolve(process.env.DB_PATH ?? `${dataDir}/wa-bot.db`),
    escalationKeywords: parseCsv(process.env.ESCALATION_KEYWORDS ?? "urgent,emergency,important"),
    escalateNewContacts: parseBoolean(process.env.ESCALATE_NEW_CONTACTS, true),
    ignoreGroupMessages: parseBoolean(process.env.IGNORE_GROUP_MESSAGES, true),
    maxHistoryMessages: parseInteger(process.env.MAX_HISTORY_MESSAGES, 20),
    openaiApiKey,
    openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o",
    port: parseInteger(process.env.PORT, 3000),
    profilePath,
    telegramBotToken: emptyToUndefined(process.env.TELEGRAM_BOT_TOKEN),
    telegramChatId: emptyToUndefined(process.env.TELEGRAM_CHAT_ID),
  };
}

export function loadOwnerProfile(profilePath: string) {
  if (!existsSync(profilePath)) {
    throw new Error(`Owner profile file not found: ${profilePath}`);
  }

  const profile = readFileSync(profilePath, "utf8").trim();
  if (!profile) {
    throw new Error(`Owner profile file is empty: ${profilePath}`);
  }

  return profile;
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function emptyToUndefined(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
