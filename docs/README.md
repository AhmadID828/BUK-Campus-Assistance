# EduAI - AI-Powered Study and Campus Assistant

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
- **Frontend**: Next.js + React + Tailwind CSS + Leaflet.js
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

1. Deploy the `frontend` directory to Vercel. Set the Vercel environment variable
   `VITE_API_URL` to the public Render backend URL, for example
   `https://your-api.onrender.com` (no trailing slash), then redeploy the frontend.
2. Deploy the `backend` directory as a Render web service with start command
   `uvicorn main:app --host 0.0.0.0 --port $PORT`. Configure its environment
   variables in Render, including a hosted PostgreSQL `DATABASE_URL`, strong
   `SECRET_KEY` and `REFRESH_SECRET_KEY`, email SMTP settings (`MAIL_USERNAME`,
   `MAIL_PASSWORD`, and `MAIL_FROM`), and:

   `ALLOWED_ORIGINS=https://vercel.com/aid-3acb/buk-campus-assistance/CZEc8EfjhZYMjzmWb3nVsfiTrneE,http://localhost:5173,http://127.0.0.1:5173`

   Also set `FRONTEND_URL=https://your-app.vercel.app` so approval and password
   reset emails link to the deployed frontend, not localhost.
   Add your Vercel custom domain to `ALLOWED_ORIGINS` too, if you use one. The
   backend uses local development origins by default when `ALLOWED_ORIGINS` is
   unset.
   Set the Render health-check path to `/health`. The backend reports unhealthy
   when it cannot connect to PostgreSQL, while `/` reports whether it started
   in healthy or degraded mode.
3. The backend's SQLAlchemy models define the database schema. On startup,
   `Base.metadata.create_all()` creates missing tables; it does not migrate
   existing tables when model definitions change. Local and Render each use
   the database URL configured for that environment, so their data is separate
   unless both are deliberately configured to use the same PostgreSQL database.
4. A Render service cannot use Ollama running on your PC at `localhost:11434`.
   For deployed text generation, configure a reachable hosted AI provider (for
   example `LLM_PROVIDER=groq`, `QUIZ_PROVIDER=groq`, and `GROQ_API_KEY` in
   Render's environment settings). However, material indexing and retrieval
   still use Ollama embeddings in this codebase; set `OLLAMA_BASE_URL` to a
   reachable hosted Ollama service for those features, or change the embedding
   implementation to a hosted embeddings provider. Groq text generation alone
   does not replace this dependency. Keep provider keys on the backend; never
   put them in a `VITE_` variable.
5. Keep local `.env` values separate from Vercel/Render environment settings.
   Vercel embeds `VITE_API_URL` when building, so redeploy after changing it.

## Restore an administrator account

There is intentionally no public admin registration form; public signup creates
student accounts only. After confirming the intended account exists in the
correct database, promote it through the database console:

```sql
UPDATE users
SET role = 'admin', is_approved = TRUE, is_active = TRUE
WHERE LOWER(email) = LOWER('your-admin-email@example.com')
RETURNING id, email, role, is_approved, is_active;
```

Run this against the Render PostgreSQL database to restore a deployed admin
account, or your local database to restore a local account. The production and
local databases do not share accounts automatically. After changing a role,
sign out and sign back in so the app receives a token with the updated role.
