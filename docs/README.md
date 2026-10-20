# BUK Campus Assistant System

A final year project for Bayero University Kano (BUK) that combines intelligent academic support with campus information and location assistance.

## Features
- AI Chatbot (Academic + Campus queries)
- Lecture notes summarization and Q&A
- Adaptive study planner
- Campus information system
- Interactive BUK campus map with location assistance
- Quiz generator

## Tech Stack
- **Backend**: Python + FastAPI
- **AI**: Ollama (Llama 3.2) + LangChain
- **Frontend**: Vite + React + Tailwind CSS + Leaflet.js
- **Database**: PostgreSQL
- **Vector DB**: ChromaDB

## Run locally

1. Start PostgreSQL and Ollama on your computer. Pull the configured Ollama models if needed:
   `ollama pull gemma2:2b` and `ollama pull nomic-embed-text`.
2. In `backend/.env`, set `DATABASE_URL` to your local PostgreSQL database and keep
   `LLM_PROVIDER=ollama`, `OLLAMA_BASE=http://localhost:11434`, and
   `OLLAMA_MODEL=gemma2:2b`.
3. From the `backend` directory, activate your Python environment, install
   `requirements.txt`, and run `uvicorn main:app --reload --port 8000`.
4. In `frontend/.env`, set `VITE_API_URL=http://localhost:8000`. From `frontend`,
   run `npm install` and `npm run dev`, then open `http://localhost:5173`.

## Deploy with Vercel and Render

1. Deploy the `frontend` directory to Vercel and configure `VITE_API_URL` with
   the public URL of your backend. The Vercel configuration includes a fallback
   for client-side routes, so refreshing a page such as `/locations` loads the
   app rather than returning a 404.
2. Deploy the `backend` directory to Render with the start command
   `uvicorn main:app --host 0.0.0.0 --port $PORT`. Configure its database,
   allowed frontend origins, mail, and AI provider through the hosting
   dashboard. Keep credentials and private service URLs out of source control.
   Set the health-check path to `/health`.
3. Local and hosted environments use their own configured databases. Back up
   hosted data before making operational changes; schema changes should be
   applied through a reviewed migration process.
4. Hosted services cannot access Ollama running on a developer's computer.
   Configure reachable AI and embedding providers for deployed features. Keep
   provider keys on the backend, never in frontend build variables.
5. Vercel embeds `VITE_API_URL` when building, so redeploy after changing it.

## Approve student registrations

Students register with the signup page and wait for administrator approval.
Sign in with an admin account, open **Pending Approvals**, and select **Approve**
or **Reject** for each registration. Approved students receive access to
protected study features. The backend sends an approval email when mail
configuration is available.

## Administrator access

Administrators can sign in at `/admin/login`. Admin registration is intentionally
not public: only the signed-in chief administrator can register additional
administrators at `/admin/register`. Administrators can review student requests
from **Pending Approvals**.

## Public campus map and FAQ access

Campus locations are available without signing in at `/locations`; the campus
map and FAQs are linked from the welcome, login, signup, and authenticated
navigation. The FAQ page includes a back button to return to the previous page.
Students register through signup and require administrator approval to access
protected study features. Administrators can manage approvals and, where
authorized, create additional administrator accounts from the admin interface. The chief
administrator can remove another administrator's access or restore it later;
the account's existing records are retained. The chief administrator account
cannot be removed through the application.

The optional [campus-location replacement script](../backend/scripts/replace_online_campus_locations.sql)
deletes every existing row in `campus_locations` before inserting the listed
locations. Back up the target database and review the rows before running it;
the transaction does not preserve deleted data after it commits.
