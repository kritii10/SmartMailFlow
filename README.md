# ReachInbox Email Scheduler

Full-stack email scheduling system built with Express, Prisma/PostgreSQL, Redis, BullMQ, Ethereal SMTP, and React.

## Services

- Backend API: Express + Prisma + BullMQ producer
- Worker: BullMQ consumer with Redis-backed send throttling
- Frontend: React + TypeScript + Tailwind dashboard with cookie-backed Google login

## Local setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and Redis with `docker compose up -d`.
3. Install dependencies with `npm install`.
4. Generate Prisma client with `npm run prisma:generate`.
5. Run Prisma migrations with `npm run prisma:migrate --workspace backend`.
6. Start backend with `npm run dev:backend`.
7. Start worker with `npm run worker`.
8. Start frontend with `npm run dev:frontend`.

## Google OAuth setup

1. Create a Google OAuth 2.0 Web application in Google Cloud.
2. Add `http://localhost:4000/api/auth/google/callback` as an authorized redirect URI.
3. Copy the Google client ID and client secret into `.env`.
4. Keep `FRONTEND_URL=http://localhost:5173` for local development unless you intentionally change the frontend origin.
5. Restart the backend after updating auth environment variables.

Required auth environment variables:

```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
AUTH_COOKIE_NAME=reachinbox_session
OAUTH_STATE_COOKIE_NAME=reachinbox_oauth_state
OAUTH_STATE_TTL_MS=600000
SESSION_TTL_MS=604800000
COOKIE_SAME_SITE=lax
COOKIE_SECURE=false
```

## Notes

- Docker Compose is included for PostgreSQL and Redis.
- Scheduled jobs use BullMQ delayed jobs only.
- Email state is stored in PostgreSQL and verified before every send.
- Google authentication uses the OAuth 2.0 authorization code flow.
- Authenticated sessions are stored in PostgreSQL and identified with HTTP-only cookies.
- `GET /api/auth/google` starts login, `GET /api/auth/google/callback` completes it, `GET /api/auth/me` restores the current session, and `POST /api/auth/logout` invalidates the session.
- `WORKER_CONCURRENCY` controls how many BullMQ jobs a worker can process in parallel.
- `MIN_EMAIL_DELAY_MS` is a global minimum spacing between SMTP send start times across all worker instances.
- `MAX_EMAILS_PER_HOUR` is a sender-scoped hourly limit enforced in Redis with atomic operations.
- The compose flow supports optional sender overrides, so a scheduled batch can use a different sender email/name while still using the configured SMTP transport.
- Hourly counters are keyed by sender and UTC hour window, following the shape `email-rate:{senderId}:{YYYY-MM-DD-HH}`.
- When an hourly limit is exhausted, the worker does not fail or drop the email. It returns the row to `SCHEDULED`, moves the active BullMQ job back to delayed, and retries at the next UTC hour boundary.
- Send throttling is coordinated in Redis, so multiple workers do not rely on local in-memory timestamps.
- Concurrency and throttling interact intentionally: several jobs may be fetched and wait for reserved send slots, but Redis ensures their actual send starts are spaced.
- Concurrency and hourly rate limiting also interact intentionally: multiple workers can compete for the final slot in an hour, but the Redis Lua reservation guarantees only one worker gets it.
- Worker restart behavior relies on persisted PostgreSQL rows plus BullMQ delayed jobs in Redis. Normal restarts do not recreate scheduled jobs from the database.
- On worker startup, a narrow reconciliation pass inspects only `SCHEDULED` and `PROCESSING` emails. It repairs inconsistent rows idempotently, such as a `PROCESSING` email whose BullMQ job is no longer active, or a `SCHEDULED` email whose queue job is missing.
- If BullMQ marks a job as stalled after a crash, the worker returns the matching email row from `PROCESSING` to `SCHEDULED` so the re-queued BullMQ job can safely claim it again.
- If a queue/job mismatch delivers a future email too early, the worker moves that BullMQ job back to delayed using the database `scheduledAt` timestamp instead of sending early.
- Completed `SENT` emails are excluded from startup reconciliation, so restarting the worker does not recreate or resend already-finished emails.
- Trade-off: reserving slots before send avoids back-to-back sends across instances, but if a worker crashes after reserving a slot, that short time window is effectively lost.
- Trade-off: when an email is rate-limited after being claimed, the worker briefly transitions it to `PROCESSING`, then returns it to `SCHEDULED` before moving the BullMQ job back to delayed. That avoids duplicate sends, but it means ordering is best-effort rather than a strict FIFO guarantee across hour boundaries.

## Restart verification

The restart path was verified against live PostgreSQL and Redis state with this flow:

1. Schedule multiple emails for future timestamps.
2. Confirm PostgreSQL rows exist in `SCHEDULED` with stable `bullJobId` values.
3. Confirm BullMQ contains matching delayed job IDs in Redis.
4. Stop both the API process and the worker process before the emails are due.
5. Wait while only PostgreSQL and Redis remain alive.
6. Confirm the same rows and delayed jobs still exist without any backend process replaying them.
7. Restart the API and worker.
8. Confirm worker startup reconciliation reports `requeued=0` for healthy delayed jobs.
9. Observe the worker send the emails at their intended scheduled times.
10. Confirm PostgreSQL transitions to `SENT`, BullMQ delayed jobs are consumed, and a subsequent worker restart reports `inspected=0` rather than recreating completed work.

## Rate-limit verification

Use the load test to verify hourly rate limiting and future-hour rescheduling without sending real Ethereal emails:

```bash
LOAD_TEST_EMAILS=1000 \
WORKER_CONCURRENCY=5 \
MAX_EMAILS_PER_HOUR=100 \
MIN_EMAIL_DELAY_MS=25 \
npm run load:test
```

Expected result:

1. `jobs_created` matches `LOAD_TEST_EMAILS`.
2. `sent` stops at the current hour limit.
3. `jobs_rescheduled` and `rescheduled_rows_in_future_windows` cover the remainder.
4. `duplicate_attempts_prevented` is greater than `0` because the script retries queue insertion with the same BullMQ job IDs.
5. `unique_email_records` and `unique_bull_job_ids` stay equal to the total scheduled count.

## Final demo

1. Copy `.env.example` to `.env` and fill in real Google OAuth and Ethereal credentials.
2. Start infrastructure with `docker compose up -d`.
3. Install dependencies with `npm install`.
4. Generate Prisma client with `npm run prisma:generate`.
5. Run migrations with `npm run prisma:migrate --workspace backend`.
6. Start the API with `npm run dev:backend`.
7. Start the worker with `npm run worker`.
8. Start the frontend with `npm run dev:frontend`.
9. Sign in with Google from the login page.
10. Open Compose New Email and optionally provide a sender email/name override.
11. Upload a CSV or paste recipients, set start time, delay, and hourly limit, then schedule the batch.
12. Confirm scheduled rows in the dashboard, sent rows after completion, and Ethereal preview URLs in the worker logs.
13. Run `npm run load:test` to demonstrate 1000+ scheduling behavior and Redis-backed rate-limit rescheduling without sending 1000 real emails.

## Frontend environment

Create `frontend/.env` with:

```bash
VITE_API_BASE_URL=http://localhost:4000/api
```
