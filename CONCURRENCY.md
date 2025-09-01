# Concurrency Control and Queueing for the WhatsApp Scraper

## Overview
This document describes the in-memory concurrency control system added to the WhatsApp business scraper. It limits the number of concurrent scraping jobs, places overflow users into a FIFO queue, and coordinates session state updates and user notifications.

- Default concurrent jobs: 3 (configurable at runtime by admin)
- Overflow users are queued FIFO
- Users are notified once when queued
- When a running slot frees, the next queued job starts automatically
- Session states are updated atomically and consistently in `sessions.json`

## Key Files
- `lib/concurrency-manager.js`: Queue and concurrency limiter implementation
- `bot.js`: WhatsApp integration, job lifecycle, session updates, and admin commands

## Features
- Limit concurrent scraping jobs to N users (default N=3)
- FIFO waiting queue for overflow jobs
- One-time queue notification: "Scraping is busy right now. You are in queue. Please wait, this may take a while."
- No extra notification when job starts
- If a queued user sends another message, they receive the same waiting message and are not re-enqueued
- Admin can dynamically change the limit with `ADMIN LIMIT <number>`
- Session states in `sessions.json` are updated as:
  - When queued: `status: "waiting"`, `currentStep: "queued_for_scraping"`
  - When started: `status: "running"`, `currentStep: "scraping_in_progress"`
  - When finished or cancelled: `status: "idle"`, `currentStep: "main_menu"`
- Atomic file operations through a serialized mutation helper to prevent stale writes

## Public API
The concurrency system exposes methods from `lib/concurrency-manager.js`:

- `getLimit()`
  - Returns the current maximum number of concurrent jobs.

- `setLimit(newLimit: number)`
  - Sets a new maximum concurrency and attempts to start queued jobs.

- `startScraping(userId: string, startFn: () => Promise<void>, hooks?: { updateSession?: (userId, partial) => void, notifyQueued?: () => Promise<void> })`
  - If capacity is available, immediately marks the user as running and calls `startFn()`.
  - If capacity is full, enqueues the user, updates their session to waiting, and sends the one-time waiting message.
  - Returns one of: `'started' | 'queued' | 'already_running' | 'already_queued'`.

- `finishScraping(userId: string)`
  - Marks the user as finished and drains the queue (starts next job if capacity allows).

- `adminCommand(command: string)`
  - Parses and executes textual admin commands. Currently supports `ADMIN LIMIT <number>`.

## WhatsApp Bot Integration (bot.js)
- On `START`, the bot calls `concurrencyManager.startScraping(jid, runScraper, { updateSession, notifyQueued })`.
  - `updateSession` safely updates `sessions.json` to set `status/currentStep`.
  - `notifyQueued` sends the one-time waiting message.
- When a job ends (success or error), the bot calls `concurrencyManager.finishScraping(jid)`.
- Queued users sending new messages get the same waiting message and remain queued.

### Admin Command
- In any chat with admin privileges: `ADMIN LIMIT <number>`
  - Example: `ADMIN LIMIT 2`
  - Changes concurrency limit immediately and starts queued jobs if capacity opens.

## Session State and Atomic Updates
To avoid race conditions and stale writes to `sessions.json`, we introduced a serialized mutation helper in `bot.js`:

- `mutateUserSession(jid, update)`
  - Reads the latest `sessions.json`, applies either a partial object or a function `(current) => next`, writes back, and returns the updated session.
  - Internally serialized with a simple promise-based mutex to ensure writes are ordered and no concurrent job can overwrite another job’s update.

### State Transitions
- Queued: `status = "waiting"`, `currentStep = "queued_for_scraping"`
- Running: `status = "running"`, `currentStep = "scraping_in_progress"`
- Finished/Cancelled/Error: `status = "idle"`, `currentStep = "main_menu"`

Additionally, the safety function `resetSessionState(jid)` now uses `mutateUserSession` to recover sessions stuck in `scraping_in_progress` when no active job exists.

## Job Lifecycle Summary
1. User completes setup and sends `START`.
2. Bot checks daily limits and validates state.
3. Bot requests `startScraping` from the concurrency manager.
   - If started: session set to running, `runScraper()` begins.
   - If queued: session set to waiting, user gets queue message.
4. Scraper runs; progress simulator handles updates.
5. On completion (or error/stop):
   - Session set to idle/main menu
   - `finishScraping` is called, which auto-starts the next queued job if any

## Testing Guide
- Set limit to 1 or 2 with `ADMIN LIMIT 1` or `ADMIN LIMIT 2`.
- Start scraping from two different WhatsApp users simultaneously.
- Expected behavior:
  - The first N users start immediately; additional users get the queue message once.
  - When a running job finishes, the next queued job starts automatically without a new message.
  - `sessions.json` shows correct transitions for each user as outlined above.
  - If a queued user sends another message, they receive the same waiting message and remain queued.

## Troubleshooting
- Stuck in `scraping_in_progress`:
  - The bot auto-resets sessions if there is no active job. If you still see stuck state, restart the bot to rebuild in-memory state, and it will repair sessions on incoming messages.
- State not returning to idle/main menu after the first job under concurrency:
  - `bot.js` already uses `mutateUserSession` in success/error/stop paths to avoid stale writes.
- Queue not draining after changing limit:
  - Use `ADMIN LIMIT <number>`; the concurrency manager’s `setLimit` triggers queue draining.

## Design Notes
- In-memory queue and sets (`activeUsers`, `queuedUsers`) provide simple, fast control.
- Single-writer semantics for `sessions.json` via `mutateUserSession` avoid stale writes across concurrent jobs.
- ES Modules are used throughout (`type: "module").

## Future Improvements
- Persist queue state to disk for crash resilience.
- Optional notifications when a queued job starts.
- Per-user/job timeouts and better cancellation reporting.
- Metrics endpoint for active/queued counts and historical run data.
