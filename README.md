# WhatsApp Personal Assistant

Local single-user WhatsApp auto-reply bot using Baileys, Hono, OpenAI, SQLite, Drizzle, and Telegram escalation controls.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in `.env`:

   ```bash
   OPENAI_API_KEY=sk-...
   TELEGRAM_BOT_TOKEN=...
   TELEGRAM_CHAT_ID=...
   ```

4. Edit `config/profile.txt` with your identity, tone, sensitive topics, and reply preferences.

5. Start locally:

   ```bash
   npm run dev
   ```

6. Scan the WhatsApp QR code printed in the terminal.

## Docker

Build and run with Compose:

```bash
docker compose up --build
```

The Compose setup mounts these host folders into the container:

- `./auth` keeps the Baileys WhatsApp session, so you do not need to scan every restart.
- `./data` keeps the SQLite database.
- `./config` keeps `profile.txt`.

## Telegram Commands

- `/approve [id]` sends the bot draft for a pending escalation.
- `/override [id] message` sends your manual replacement.
- `/skip [id]` resolves the escalation without replying.
- `/pause` disables auto-replies.
- `/resume` enables auto-replies.
- `/status` returns active/paused state and messages handled today.

If no escalation id is provided, the latest pending escalation is used.

## HTTP Endpoints

- `GET /health`
- `GET /status`

## Notes

- Group messages are ignored by default. Set `IGNORE_GROUP_MESSAGES=false` to process them.
- New contacts escalate by default. Set `ESCALATE_NEW_CONTACTS=false` to auto-reply immediately.
- Telegram is optional at boot, but escalations will only be logged to the console until both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are configured.
