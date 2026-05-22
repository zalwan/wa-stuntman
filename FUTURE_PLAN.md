# Future Plan

This document tracks possible future improvements for the WhatsApp Personal Assistant project.

## Near-Term Priorities

These are the highest-value next improvements.

### Telegram Monitoring

- Add `/pending` to list unresolved escalations.
- Add `/recent` to show recently handled WhatsApp messages.
- Add `/logs` to show recent errors and system events.
- Add richer `/status` output with WhatsApp connection state, pending escalation count, and Telegram status.

### Contact Controls

- Add contact allowlist and blocklist.
- Add `/block [contact]` and `/allow [contact]` Telegram commands.
- Add per-contact reply mode:
  - Auto-reply
  - Draft-only
  - Never reply
- Add first-contact review mode for new contacts.

### Safer AI Replies

- Replace plain-text reply parsing with structured AI output:
  - `reply`
  - `confidence`
  - `should_escalate`
  - `escalation_reason`
- Add confidence threshold configuration.
- Add stronger escalation reasons for sensitive or uncertain messages.
- Auto-detect message language and reply in the same language.

## Reliability

- Add retry logic for OpenAI failures.
- Add retry logic for Telegram API failures.
- Add retry logic for WhatsApp send failures.
- Add persistent file logging.
- Add Docker healthcheck.
- Add better startup validation for `.env` and `config/profile.txt`.
- Track WhatsApp connection state in memory and expose it through `/status`.
- Add graceful shutdown handling for WhatsApp and Telegram polling.

## Privacy & Safety

- Add configurable message retention policy.
- Add automatic cleanup for old chat history.
- Add sensitive keyword redaction before sending context to OpenAI.
- Add per-contact setting to never send messages to OpenAI.
- Add optional SQLite encryption.
- Limit OpenAI history context by token budget instead of only message count.
- Add emergency pause when repeated escalations happen in a short time window.

## Telegram Command Ideas

- `/pending` — show pending escalations.
- `/recent` — show recent handled messages.
- `/contact [name_or_id]` — show latest contact history.
- `/block [contact]` — block bot replies for a contact.
- `/allow [contact]` — allow bot replies for a contact.
- `/mode [contact] [auto|draft|off]` — set per-contact reply mode.
- `/keywords` — list escalation keywords.
- `/addkeyword [word]` — add escalation keyword.
- `/removekeyword [word]` — remove escalation keyword.
- `/summary` — show daily message and escalation summary.

## Data & Analytics

- Add message search.
- Add conversation export to Markdown.
- Add conversation export to CSV.
- Add per-contact notes.
- Add daily summary:
  - Messages handled
  - Replies sent
  - Escalations created
  - Escalations approved
  - Escalations skipped
- Add basic analytics:
  - Top contacts
  - Busiest hours
  - Escalation rate
  - Average response time

## Product Features

- Add local web dashboard for profile, contacts, logs, and settings.
- Add mobile-friendly local admin page.
- Add multiple owner profiles, such as work mode and personal mode.
- Add quiet hours schedule.
- Add auto-reply templates for common questions.
- Add calendar-aware replies.
- Add voice note transcription.
- Add image and document caption understanding.
- Add manual broadcast or saved reply snippets.

## Developer Experience

- Add test suite for:
  - Bot service logic
  - Escalation handling
  - Telegram command parsing
  - Context builder
  - Database queries
- Add Drizzle migration files instead of boot-time schema creation.
- Add CLI setup wizard for `.env` and `profile.txt`.
- Add mock mode for testing without WhatsApp.
- Add mock mode for testing without OpenAI.
- Add structured logs with message IDs and escalation IDs.
- Add linting and formatting scripts.

## Suggested Milestones

### M4 — Monitoring & Contact Control

- `/pending`
- `/recent`
- `/logs`
- Contact allowlist/blocklist
- Per-contact reply mode

### M5 — Safer AI Pipeline

- Structured AI response
- Confidence threshold
- Better escalation reasons
- Token-budgeted history
- Sensitive data redaction

### M6 — Reliability & Operations

- Retry logic
- File logging
- Docker healthcheck
- Better `/status`
- Backup and restore documentation

### M7 — Local Admin UI

- Web dashboard
- Contact management
- Profile editor
- Escalation review page
- Message history search
