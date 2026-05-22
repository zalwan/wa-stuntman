# Changelog

All notable changes to this project will be documented in this file.

The format follows a simple date-based structure.

## 2026-05-22

### Added

- Implemented WhatsApp personal assistant MVP from `PRD.md`.
- Added Baileys WhatsApp client with terminal QR authentication.
- Added Hono server with `GET /health` and `GET /status`.
- Added OpenAI reply generation using owner profile and recent per-contact chat history.
- Added SQLite persistence with Drizzle schema for contacts, messages, and escalations.
- Added automatic message history storage for incoming WhatsApp messages and bot replies.
- Added escalation detection for:
  - OpenAI `[ESCALATE]` marker.
  - Configured sensitive keywords.
  - New contacts when enabled.
- Added Telegram escalation notifications.
- Added Telegram commands:
  - `/approve [id]`
  - `/override [id] message`
  - `/skip [id]`
  - `/pause`
  - `/resume`
  - `/status`
- Added Docker support with `Dockerfile` and `docker-compose.yml`.
- Added `.env.example`, `.gitignore`, `.dockerignore`, and starter `config/profile.txt`.
- Added `README.md` with local and Docker setup instructions.

### Verified

- `npm install`
- `npm run typecheck`
- `npm run build`
- `docker compose config`
- `docker build -t whatsapp-personal-assistant:local .`
