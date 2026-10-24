# BUK Campus Assistant

A student support platform for Bayero University Kano. It brings AI study tools
and campus information together in one responsive web app.

## What you can do

- Chat with an AI assistant and ask questions about uploaded course materials.
- Summarize study materials, build a study plan, and generate quizzes.
- Register courses, upload materials under course codes, and schedule topics
  against optional exam dates.
- Track account approval, profile changes, quiz completions, overdue study tasks,
  and reminders for events marked as going in the notification bell. Chat and
  uploaded-material activity are intentionally excluded.
- Find campus places on the map and browse frequently asked questions. Walking
  directions require a usable location fix; if GPS is too imprecise, choose your
  starting point on the map instead.
- Manage student approvals and campus events with an administrator account.

## Technology

- Frontend: React, Vite, Tailwind CSS, and Leaflet
- Backend: Python and FastAPI
- Data: PostgreSQL and ChromaDB
- AI: configurable language-model and embedding providers

## Run locally

You will need Python, Node.js, PostgreSQL, and a configured AI provider.

1. Create `backend/.env` with a local `DATABASE_URL` and the backend AI settings.
   Keep API keys and database credentials in environment files, not source code.
   For local password-reset testing without SMTP, set
   `APP_ENV=development`, `RESET_EMAIL_MODE=console`, and
   `FRONTEND_URL=http://localhost:5173` in `backend/.env`. The local forgot
   password page then displays a reset link directly; this mode is only exposed
   to loopback requests and must not be enabled in production. Restart the
   backend after changing these settings. To send real approval and reset
   emails instead, configure `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_FROM`;
   leave `RESET_EMAIL_MODE` unset or set it to `smtp`.
2. In `backend`, install `requirements.txt` and start the API:

   ```powershell
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

3. Set `VITE_API_URL=http://localhost:8000` in `frontend/.env`.
4. In `frontend`, install dependencies and start the app:

   ```powershell
   npm install
   npm run dev
   ```

Open the local URL printed by Vite. The API health check is available at
`/health`. Uploaded materials are limited to 2 MB per file.

### Test location on a phone

For GPS testing, open the deployed frontend over HTTPS on the phone and allow
precise location access. The frontend must be configured with the deployed
backend URL in `VITE_API_URL`. Local development over an ordinary LAN address
does not provide HTTPS geolocation on most phones; when testing locally, use
**Choose start on map** to set the route origin instead.

Use the floating appearance button to choose Light, Dark, or System. The
preference is saved in the browser; System follows the device's current
appearance setting.

Study chat uses the semantic index when the configured embedding provider is
available. If semantic indexing or its stored full-text index fails after an
upload, the saved material remains available through on-demand PostgreSQL
full-text search; the upload notice reports that it is ready for AI study chat.
Administrators can check the backend embedding-provider configuration to
restore semantic indexing.

## Deployment

Deploy the `frontend` directory to Vercel and the `backend` directory to a
Python host such as Render. Configure the frontend API URL, database, allowed
frontend origins, email, `FRONTEND_URL`, and AI providers in the hosting
dashboards. For email, configure `RESEND_API_KEY` and `MAIL_FROM` (or
`RESEND_FROM_EMAIL`) on the Render backend service only. Resend is preferred
automatically when its API key is configured. Verify your sender domain in
Resend before using an address such as
`BUK Campus Assistant <noreply@your-verified-domain>`. The Resend test sender
`onboarding@resend.dev` is limited to Resend's test-recipient rules and is not
the production sender for arbitrary student addresses.

For optional Gmail fallback, also configure `MAIL_USERNAME`,
`MAIL_PASSWORD` (a Gmail App Password), and optionally `MAIL_FROM_GMAIL`.
Resend is attempted first; if it fails, the backend attempts Gmail when these
SMTP settings are present. For SMTP-only mode, set `EMAIL_PROVIDER=smtp`.
Never put the Resend API key in Vercel or a `VITE_` frontend variable. The
backend calls Resend's HTTPS API through the existing `httpx` dependency; the
Resend Python SDK is not required.

For local email testing, place `RESEND_API_KEY`, `MAIL_FROM` (or
`RESEND_FROM_EMAIL`), and optional Gmail fallback credentials in
`backend/.env`, then restart the backend. Leave `RESET_EMAIL_MODE` unset (or
set it to `smtp`) to send email. `APP_ENV=development` together with
`RESET_EMAIL_MODE=console` enables the loopback-only local reset-link display
instead of sending an email.

`FRONTEND_URL` must be the public frontend address so approval and password
reset links return to the deployed app. The backend start command is
`uvicorn main:app --host 0.0.0.0 --port $PORT`. Password-reset emails are
queued after the API responds; a successful reset-request response means the
request was queued, not that the provider confirmed delivery. Check the Render
web-service logs and the Resend email logs for delivery failures or bounces.

Use separate local and hosted databases and credentials. Hosted services
cannot use an Ollama instance running on a developer's computer; configure an
AI provider that the deployed backend can reach. Groq is the default hosted
provider; configure `GROQ_API_KEY` on the backend. Frontend `VITE_` settings are
embedded at build time, so rebuild and redeploy after changing them. Back up
production data before database changes, and use reviewed migrations for schema
updates. Apply `backend/migrations/003_link_materials_to_courses.sql` before
deploying the course-linked materials and planner changes, and
`backend/migrations/004_add_old_campus_location.sql` to add the BUK Old Campus
map marker, and `backend/migrations/005_add_notifications.sql` to create the
notification table. The notification bell shows unread counts and supports
marking individual notifications or all notifications as read.

## Accounts and access

Students sign up and wait for an administrator to approve their account.
Administrators use the same login page. Creating additional administrators is
restricted to the designated chief administrator. Admin recovery and database
maintenance scripts are operational tools: review them carefully, back up the
target database, and never run a hosted-database script against local data.

The campus map and FAQs are available without signing in. Chat, quizzes,
materials, and planning tools require an approved student account.
