# PRD — WhatsApp Bot Personal Assistant

**Version:** 1.0  
**Status:** Draft  
**Last updated:** May 2026  
**Scope:** Local deployment (single user)

---

## 1. Background

Manually replying to WhatsApp messages takes significant time and attention, especially when focused on work or simply unavailable. This project aims to build an AI-powered WhatsApp bot that automatically replies to messages on behalf of the owner, using a personalized tone and context, with an escalation mechanism for cases where the bot is not confident in its response.

---

## 2. Goals

- The bot replies to WhatsApp messages automatically in a tone that closely resembles the owner.
- The owner can define their identity and context through a manually written profile.
- The bot notifies the owner when it encounters a message it cannot confidently handle.
- The entire system runs locally with no dependency on external cloud infrastructure (except the OpenAI and Telegram APIs).

---

## 3. Non-Goals

- No multi-user or multi-account WhatsApp support.
- No web UI or dashboard (MVP is CLI and config-file based).
- No transaction, order, or external system integrations.
- No use of the official WhatsApp Business API (Baileys is used as the WA client).

---

## 4. User

A single person (the bot owner) who wants to delegate WhatsApp replies to an AI.

---

## 5. Tech Stack

| Component                | Technology                                   |
| ------------------------ | -------------------------------------------- |
| WA Client                | Baileys (unofficial WA multi-device library) |
| Backend                  | Hono + `@hono/node-server` (TypeScript)      |
| AI                       | OpenAI API — model `gpt-4o`                  |
| Database                 | SQLite via `better-sqlite3`                  |
| ORM / Query              | Drizzle ORM                                  |
| Escalation notifications | Telegram Bot API                             |
| Runtime                  | Node.js ≥ 20                                 |
| Language                 | TypeScript                                   |

---

## 6. System Architecture

```
WA Contact
    │
    ▼
[Baileys WA Client]  ←──── One-time QR scan on setup
    │
    ▼
[Hono Server — Message Handler]
    │
    ├── Load owner profile (from config/profile.txt)
    ├── Load chat history for this contact (from SQLite)
    │
    ▼
[Context Builder]
    │  Assembles system prompt + conversation history
    ▼
[OpenAI API — gpt-4o]
    │
    ▼
[Confidence Check]
    ├── Confident → Send reply via Baileys
    └── Unsure / sensitive keyword → Escalate to Telegram
```

---

## 7. Core Features

### 7.1 Auto-Reply

The bot receives all incoming WhatsApp messages and generates replies using OpenAI GPT-4o.

**Flow:**

1. Incoming message is received by Baileys.
2. Chat history for that contact (up to N most recent messages) is fetched from SQLite.
3. The Context Builder assembles the prompt: system prompt (owner profile) + chat history + latest message.
4. OpenAI generates a reply.
5. The bot sends the reply to the contact.
6. Both the incoming message and the reply are saved to SQLite.

### 7.2 Owner Profile (Manual Bio)

The owner writes their profile as a plain text file (`config/profile.txt`), loaded at server start. This profile is injected directly into the system prompt for every OpenAI request.

**Recommended profile contents:**

- Name and occupation
- Communication style (formal/casual, language used)
- Topics commonly discussed
- Things that must never be disclosed to anyone
- Typical active hours
- How to decline invitations or unwanted requests

### 7.3 Per-Contact Chat History

Every incoming message and bot reply is stored in SQLite, keyed by contact. When building the prompt, the bot fetches the N most recent messages (default: 20) to provide relevant conversational context.

### 7.4 Escalation Mechanism

The bot escalates to the owner (via Telegram) in the following situations:

- OpenAI returns a reply containing the special marker `[ESCALATE]`, as instructed in the system prompt.
- The incoming message contains sensitive keywords defined in the config (e.g. "urgent", "emergency", a specific person's name).
- A new contact appears for the first time (optional, configurable).

**Telegram notification format:**

```
⚠️ Escalation from: [Contact Name]
Message: "[incoming message]"
Bot draft: "[bot's draft reply]"

Reply /approve to send this draft
Reply /override [new message] to send manually
Reply /skip to ignore
```

### 7.5 Telegram Controls

The owner can control the bot through Telegram:

| Command               | Function                                                 |
| --------------------- | -------------------------------------------------------- |
| `/approve`            | Send the bot's draft reply                               |
| `/override [message]` | Send a manual reply, replacing the bot's draft           |
| `/skip`               | Ignore — send no reply                                   |
| `/pause`              | Temporarily disable auto-reply                           |
| `/resume`             | Re-enable auto-reply                                     |
| `/status`             | Check bot status (active/paused, messages handled today) |

---

## 8. Data Schema (SQLite)

### Table `contacts`

| Column       | Type      | Description                        |
| ------------ | --------- | ---------------------------------- |
| `id`         | TEXT (PK) | WA number (Baileys JID)            |
| `name`       | TEXT      | Contact name from WA               |
| `created_at` | INTEGER   | Unix timestamp of first appearance |

### Table `messages`

| Column       | Type      | Description                |
| ------------ | --------- | -------------------------- |
| `id`         | TEXT (PK) | Message ID from Baileys    |
| `contact_id` | TEXT (FK) | Reference to `contacts.id` |
| `role`       | TEXT      | `user` or `assistant`      |
| `content`    | TEXT      | Message body               |
| `escalated`  | INTEGER   | 0 or 1                     |
| `created_at` | INTEGER   | Unix timestamp             |

### Table `escalations`

| Column        | Type         | Description                                    |
| ------------- | ------------ | ---------------------------------------------- |
| `id`          | INTEGER (PK) | Auto-increment                                 |
| `message_id`  | TEXT (FK)    | The escalated message                          |
| `draft_reply` | TEXT         | Bot's draft reply                              |
| `status`      | TEXT         | `pending`, `approved`, `overridden`, `skipped` |
| `resolved_at` | INTEGER      | Resolution timestamp                           |

---

## 9. Configuration (`.env` + `config/`)

### `.env` file

```
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...        # Owner's Telegram chat ID
ESCALATION_KEYWORDS=urgent,emergency,important
MAX_HISTORY_MESSAGES=20
ESCALATE_NEW_CONTACTS=true  # Escalate if contact is new
PORT=3000
```

### `config/profile.txt`

Free-form text describing the owner. Injected directly into the system prompt at runtime.

---

## 10. System Prompt Template

```
You are an AI assistant responsible for replying to WhatsApp messages on behalf of [owner name].
Reply to all messages as if you are [owner name] yourself.

Owner profile:
---
{PROFILE_TXT_CONTENT}
---

Important instructions:
- Use language and tone consistent with the owner's communication style.
- If a question is outside your knowledge or involves sensitive/personal matters,
  begin your response with "[ESCALATE]" and include a polite draft reply.
- Never reveal that you are an AI or a bot.
- Keep replies natural and concise, appropriate for WhatsApp conversation.

Previous conversation history:
{HISTORY}

Latest message from {CONTACT_NAME}:
{MESSAGE}
```

---

## 11. Project Directory Structure

```
wa-bot/
├── src/
│   ├── index.ts              # Entry point, Hono server init
│   ├── wa/
│   │   └── client.ts         # Baileys client setup & event listener
│   ├── ai/
│   │   ├── openai.ts         # OpenAI API call
│   │   └── context.ts        # Context builder (profile + history → prompt)
│   ├── db/
│   │   ├── schema.ts         # Drizzle schema
│   │   └── queries.ts        # Query helpers
│   ├── telegram/
│   │   └── notifier.ts       # Send notifications & handle /approve /override /skip
│   └── config/
│       └── loader.ts         # Load .env and profile.txt
├── config/
│   └── profile.txt           # Owner bio (plain text)
├── data/
│   └── wa-bot.db             # SQLite database (auto-created)
├── auth/                     # Baileys session folder (auto-generated)
├── .env
├── package.json
└── tsconfig.json
```

---

## 12. First-Run Setup

1. Clone the repo and install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in all keys.
3. Write your profile in `config/profile.txt`.
4. Run: `npm run dev`
5. Scan the QR code shown in the terminal using WhatsApp on your phone.
6. The bot is now active and will start handling incoming messages.

---

## 13. Milestones & Priorities

### M1 — Core (1–2 weeks)

- Set up Baileys and connect to WhatsApp.
- Hono server receives and handles message events.
- OpenAI integration with a base system prompt.
- Save messages to SQLite.
- End-to-end auto-reply working.

### M2 — Escalation (1 week)

- Detect `[ESCALATE]` marker in OpenAI responses.
- Detect sensitive keywords from config.
- Send Telegram notifications.
- Handle `/approve`, `/override`, `/skip` commands.

### M3 — Polish (optional)

- `/pause` and `/resume` via Telegram.
- `/status` command.
- Auto-escalation for new contacts.
- Retry logic if OpenAI fails.
- Log all activity to a file.

---

## 14. Risks & Mitigation

| Risk                               | Impact | Mitigation                                                       |
| ---------------------------------- | ------ | ---------------------------------------------------------------- |
| Baileys account banned by WhatsApp | High   | Use a dedicated WA account (not your primary number) for the bot |
| OpenAI failure / timeout           | Medium | Fallback: send "Busy right now, will reply soon"                 |
| Bot replies with wrong context     | Medium | Write a detailed profile; review logs regularly                  |
| Sensitive message data sent to AI  | Medium | Avoid sensitive names/data in history; add keyword filters       |
| Telegram notification delay        | Low    | Use aggressive polling timeout for Telegram                      |

---

## 15. Constraints & Assumptions

- The bot only runs while the laptop/PC is on — no 24/7 uptime unless deployed on a local server such as a Raspberry Pi.
- One WhatsApp account per bot instance.
- The owner's profile must be manually updated whenever their context changes.
- The bot does not read WhatsApp group messages by default (personal chats only) — this can be made configurable.

---

_This is a living document and will be updated as development progresses._
