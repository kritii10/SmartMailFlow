# ReachInbox Email Scheduler

Production-oriented full-stack email scheduler built for the ReachInbox assignment.

Tech stack:

- Backend: TypeScript, Express, Prisma, PostgreSQL, Redis, BullMQ, Nodemailer, Google OAuth
- Frontend: React, TypeScript, Tailwind CSS, React Router, Axios
- Infra: Docker Compose for PostgreSQL and Redis

## Project structure

```text
.
├── backend
├── frontend
├── docker-compose.yml
├── .env.example
└── README.md
```

## Environment setup

1. Copy the root env template:

```bash
cp .env.example .env
```

2. Copy the frontend env template:

```bash
cp frontend/.env.example frontend/.env
```

3. Fill the required values in `.env`.

## Ethereal Email setup

The worker sends mail through Ethereal SMTP for development/demo purposes.

1. Create an Ethereal account or test SMTP credentials.
2. Put the SMTP values into the root `.env`.
3. Restart the backend worker after changing SMTP variables.

Required SMTP env variables:

```bash
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-username
SMTP_PASS=your-ethereal-password
```

When an email is sent successfully, the worker logs the Ethereal preview URL so it can be shown in the demo.

## Google OAuth setup

1. Create a Google OAuth 2.0 Web Application in Google Cloud.
2. Add `http://localhost:4000/api/auth/google/callback` as an authorized redirect URI.
3. Add the credentials to `.env`.
4. Keep `FRONTEND_URL=http://localhost:5173` for local development unless you intentionally change the frontend origin.
5. For production, add your deployed backend callback URL in the form `https://<backend-service>.onrender.com/api/auth/google/callback`.

Required auth env variables:

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

## Run backend

Open three terminals from the repository root.

Terminal 1:

```bash
docker compose up -d
npm install
npm run prisma:generate
npm run prisma:migrate --workspace backend
npm run dev:backend
```

Terminal 2:

```bash
npm run worker
```

Backend services:

- Express API: `http://localhost:4000`
- Health check: `GET http://localhost:4000/api/health`

## Run frontend

Terminal 3:

```bash
npm run dev:frontend
```

Frontend app:

- React dashboard: `http://localhost:5173`

Frontend env:

```bash
VITE_API_URL=http://localhost:4000
```

## Architecture overview

High-level flow:

`Controller -> Service -> Queue -> Worker -> SMTP`

Main pieces:

- Express controllers stay thin and validate/forward requests.
- Business logic lives in backend services.
- PostgreSQL is the source of truth for users, senders, sessions, and email state.
- BullMQ delayed jobs in Redis are used for scheduling.
- A separate BullMQ worker processes queued emails.
- Nodemailer with Ethereal SMTP handles delivery.

## How scheduling works

1. The authenticated user submits a batch through `POST /api/emails/schedule`.
2. The backend validates subject, body, recipients, start time, delay, and optional hourly limit.
3. A database `Email` row is created per recipient with a unique idempotency key.
4. The scheduler service calculates each row's initial `scheduledAt`.
5. A BullMQ delayed job is created for each email using the database email ID as the stable job identity.
6. The BullMQ job ID is stored back in PostgreSQL.
7. The HTTP request returns without sending directly.

## How persistence on restart is handled

Persistence is based on PostgreSQL plus Redis/BullMQ, not on in-memory state.

1. Email rows remain persisted in PostgreSQL.
2. Delayed BullMQ jobs remain persisted in Redis.
3. Restarting the API or worker does not recreate all jobs on startup.
4. The worker verifies database state before sending, so already `SENT` emails are not sent again.
5. A narrow reconciliation pass repairs only inconsistent `SCHEDULED` or `PROCESSING` rows when queue state and database state disagree.

## How rate limiting and concurrency are implemented

Concurrency:

- `WORKER_CONCURRENCY` controls how many BullMQ jobs one worker processes in parallel.

Minimum send delay:

- `MIN_EMAIL_DELAY_MS` enforces a global minimum spacing between SMTP send start times.
- Coordination is Redis-backed, so multiple workers/instances do not rely on local timestamps.

Hourly rate limit:

- `MAX_EMAILS_PER_HOUR` is configurable through env.
- Rate limiting is sender-scoped and hour-scoped with Redis atomic operations.
- Redis keys use the pattern `email-rate:{senderId}:{YYYY-MM-DD-HH}`.
- If a sender's hour is full, the worker does not fail the email. It returns the row to `SCHEDULED` and reschedules the BullMQ job for the next available hour.

## Features implemented

Backend:

- Prisma schema for `User`, `Sender`, `Email`, and authenticated sessions
- PostgreSQL persistence for email state
- BullMQ delayed scheduling
- Separate worker process with graceful shutdown
- Idempotent email processing and atomic `SCHEDULED -> PROCESSING` claiming
- Ethereal SMTP sending via Nodemailer
- Configurable worker concurrency
- Redis-backed minimum send delay coordination
- Redis-backed hourly rate limiting with atomic reservation
- Rescheduling after rate-limit exhaustion
- Restart resilience using persisted DB rows and BullMQ jobs
- Google OAuth login and cookie-backed authenticated sessions
- API pagination, validation, and health checks
- Load-test script for 1000+ scheduled emails without sending 1000 real Ethereal messages
- Automated tests for scheduling, claiming, idempotency, rate limiting, rescheduling, API validation, and auth middleware

Frontend:

- React + TypeScript + Tailwind app foundation
- Real Google login flow
- Protected routes
- Responsive dashboard
- Header with branding, avatar, name, email, and logout
- Compose New Email modal
- CSV/text recipient parsing
- Email detection, deduplication, and validation
- Configurable start time, delay, and hourly limit
- Scheduled Emails table
- Sent Emails table
- Loading, empty, and error states
- Reusable UI components and API services

## Rate-limit demonstration

Use the load test to demonstrate rate limiting and future-hour rescheduling without sending 1000 real Ethereal emails:

```bash
LOAD_TEST_EMAILS=1000 \
WORKER_CONCURRENCY=5 \
MAX_EMAILS_PER_HOUR=100 \
MIN_EMAIL_DELAY_MS=25 \
npm run load:test
```

What to point out:

1. `jobs_created` matches the scheduled total.
2. `sent` stops at the current hourly limit.
3. Remaining jobs are rescheduled into future hour windows.
4. Duplicate queue insert attempts do not create duplicate jobs.
5. Duplicate email sends are prevented by the worker's database claim logic.

## Assumptions, shortcuts, and trade-offs

- Multiple senders are supported as sender identity values per batch/email; the SMTP transport still uses the configured Ethereal account for actual delivery in this assignment setup.
- Ordering is best-effort when hourly rate limiting pushes emails into future hour windows.
- The system reserves throttling/rate-limit slots before send to avoid cross-worker duplication and back-to-back sends.
- If a worker crashes after reserving a slot but before sending, that reserved slot is effectively lost for that time window.
- Local development uses non-secure cookies with `COOKIE_SECURE=false`; production should set secure cookie settings and a trusted HTTPS origin.

## Useful commands

```bash
npm run build --workspace backend
npm run build --workspace frontend
npm run test --workspace backend
cd backend && npx prisma validate
```

## Deployment

Target deployment topology:

- Frontend: Render Static Site
- Backend API: Render Web Service
- Worker: Render Background Worker
- Database: Render PostgreSQL
- Queue/cache: Render Key Value
- Email transport: Ethereal SMTP
- Authentication: Google OAuth

### Production environment variables

Backend API and worker:

```bash
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://<frontend-site>.onrender.com
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
EMAIL_QUEUE_NAME=email-scheduler
WORKER_CONCURRENCY=5
MIN_EMAIL_DELAY_MS=2000
MAX_EMAILS_PER_HOUR=100
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-ethereal-username
SMTP_PASS=your-ethereal-password
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://<backend-service>.onrender.com/api/auth/google/callback
AUTH_COOKIE_NAME=reachinbox_session
OAUTH_STATE_COOKIE_NAME=reachinbox_oauth_state
OAUTH_STATE_TTL_MS=600000
SESSION_TTL_MS=604800000
COOKIE_SAME_SITE=none
COOKIE_SECURE=true
```

Frontend:

```bash
VITE_API_URL=https://<backend-service>.onrender.com
```

### Render Static Site

Frontend service configuration:

- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment variable: `VITE_API_URL=https://<backend-service>.onrender.com`
- Rewrite rule: `/* -> /index.html` with `Rewrite`

### Render Web Service

Backend API service configuration:

- Root Directory: `backend`
- Build Command: `npm install && npm run build && npm run prisma:migrate:deploy`
- Start Command: `npm run start`
- Health Check Path: `/api/health`

Notes:

- The API binds to `0.0.0.0` and respects `process.env.PORT`.
- CORS allows the configured `FRONTEND_URL` only and keeps credentials enabled.
- Google OAuth callback URL must match `GOOGLE_REDIRECT_URI`.
- Cookie settings for cross-origin frontend/backend deployment should use `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true`.

### Render Background Worker

Worker service configuration:

- Root Directory: `backend`
- Build Command: `npm install && npm run build`
- Start Command: `npm run worker`

Worker required environment variables:

- `DATABASE_URL`
- `REDIS_URL`
- `EMAIL_QUEUE_NAME`
- `WORKER_CONCURRENCY`
- `MIN_EMAIL_DELAY_MS`
- `MAX_EMAILS_PER_HOUR`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

The worker remains fully independent from Express and is not started by the API process.

### Prisma deployment flow

Production Prisma commands:

```bash
npx prisma generate
npx prisma migrate deploy
```

`prisma migrate reset` is not used in production.

### Docker

`docker-compose.yml` remains for local development only. Render deployment should use managed Render Postgres and Render Key Value instead of local Docker services.

### Deployment risks

- Cross-origin cookies require HTTPS plus the production cookie settings shown above.
- The frontend must point to the deployed backend URL through `VITE_API_URL`; otherwise browser auth/session requests will fail.
- The worker and API must share the same `DATABASE_URL`, `REDIS_URL`, queue name, and SMTP credentials.
- Ethereal is suitable for demo/staging usage, not for real production email delivery.

## Included files for submission

- `README.md`
- `.env.example`
- `frontend/.env.example`
- `docker-compose.yml`
