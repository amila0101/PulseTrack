# PulseTrack — Weekly Work Reports & Team Insights 🚀

PulseTrack is a full-stack web application that lets engineering teams submit structured weekly work reports and gives managers real-time dashboards, compliance tracking, and an AI-powered chat assistant to analyze team performance.

---

## 📁 Project Structure

```text
PulseTrack/
├── frontend/                   # React 19 · Vite · TypeScript · TanStack Router
│   ├── src/
│   │   ├── components/         # Reusable UI components (AppShell, ChatWidget, etc.)
│   │   ├── lib/                # API service layer, auth context, utilities
│   │   ├── routes/             # File-based pages (auth, app/index, dashboard, team, projects)
│   │   └── integrations/       # Supabase client & generated type definitions
│   ├── .env.example            # Frontend environment variable template
│   └── package.json
│
├── backend/                    # Python · FastAPI · Supabase
│   ├── routers/                # API route handlers (users, projects, reports, chat)
│   ├── main.py                 # FastAPI app entry point, CORS, router registration
│   ├── models.py               # Pydantic request/response models
│   ├── dependencies.py         # Auth guards, JWT verification, RBAC helpers
│   ├── database.py             # Supabase client initialization
│   ├── requirements.txt        # Python dependencies
│   └── .env.example            # Backend environment variable template
│
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19, Vite 8, TypeScript 5 |
| **Routing** | TanStack Router (file-based, SSR-ready) |
| **Styling** | Tailwind CSS v4 with OKLCH color palette |
| **UI Components** | Radix UI primitives + shadcn/ui |
| **Data Fetching** | TanStack Query (server state, caching) |
| **Charts** | Recharts (line, bar, pie) |
| **Backend** | Python 3.11+, FastAPI |
| **Database** | PostgreSQL via Supabase |
| **Auth** | Supabase Auth (email/password) with JWT verification |
| **RBAC** | Row Level Security (RLS) + custom `user_roles` table |
| **AI Chat** | Google Gemini / OpenAI (configurable, optional) |

---

## ⚙️ Setup Instructions

> **Prerequisites:** Node.js ≥ 18, Python ≥ 3.11, a free [Supabase](https://supabase.com) account.  
> Run the **frontend** and **backend** in **two separate terminals**.

---

### Step 1 — Database Setup (Supabase)

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Open **SQL Editor** in your Supabase dashboard.
3. Run the following SQL to create all required tables and RLS policies:

```sql
-- ── Extensions ────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enums ─────────────────────────────────────────────────────────────────
create type public.app_role     as enum ('member', 'manager');
create type public.report_status as enum ('submitted', 'pending');

-- ── profiles ──────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users can read all profiles"  on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on sign up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── user_roles ────────────────────────────────────────────────────────────
create table public.user_roles (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role not null default 'member',
  created_at timestamptz default now(),
  unique(user_id)
);
alter table public.user_roles enable row level security;
create policy "Users can read own role"     on public.user_roles for select using (auth.uid() = user_id);
create policy "Managers can read all roles" on public.user_roles for select using (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'manager')
);

-- Auto-assign 'member' role on sign up
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'member');
  return new;
end;
$$;
create trigger on_auth_user_role_created
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- ── projects ──────────────────────────────────────────────────────────────
create table public.projects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.projects enable row level security;
create policy "All authenticated users can read projects"
  on public.projects for select to authenticated using (true);
create policy "Only managers can insert projects"
  on public.projects for insert to authenticated
  with check (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'manager'));
create policy "Only managers can update projects"
  on public.projects for update to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'manager'));
create policy "Only managers can delete projects"
  on public.projects for delete to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'manager'));

-- ── reports ───────────────────────────────────────────────────────────────
create table public.reports (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  project_id       uuid references public.projects(id) on delete set null,
  week_start_date  date not null,
  tasks_completed  text,
  tasks_planned    text,
  blockers         text,
  hours_worked     numeric(5,1) check (hours_worked >= 0 and hours_worked <= 168),
  notes            text,
  status           public.report_status not null default 'submitted',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table public.reports enable row level security;
create policy "Members can read own reports"
  on public.reports for select to authenticated using (auth.uid() = user_id);
create policy "Managers can read all reports"
  on public.reports for select to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'manager'));
create policy "Members can insert own reports"
  on public.reports for insert to authenticated with check (auth.uid() = user_id);
create policy "Members can update own reports"
  on public.reports for update to authenticated using (auth.uid() = user_id);
create policy "Members can delete own reports"
  on public.reports for delete to authenticated using (auth.uid() = user_id);
create policy "Managers can update any report"
  on public.reports for update to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'manager'));
create policy "Managers can delete any report"
  on public.reports for delete to authenticated
  using (exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'manager'));
```

4. From **Project Settings → API**, copy your:
   - **Project URL** → used as `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - **anon public key** → used as `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **JWT Secret** → used as `SUPABASE_JWT_SECRET` (recommended for production)

---

### Step 2 — Backend Setup (FastAPI)

Open **Terminal 1** and run the following:

```powershell
# 1. Navigate to the backend directory
cd PulseTrack\backend

# 2. Create a Python virtual environment
python -m venv venv

# 3. Activate the virtual environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# 4. Install all Python dependencies
pip install -r requirements.txt
```

> **macOS / Linux** — activate with `source venv/bin/activate` instead.

**Configure environment variables:**

```powershell
# Copy the example file
copy .env.example .env
```

Open `backend\.env` and fill in your values:

```env
# Required
SUPABASE_URL="https://your-project-id.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your-anon-key"

# Recommended — enables fast offline JWT verification
SUPABASE_JWT_SECRET="your-jwt-secret"

# CORS — comma-separated list of your frontend URL(s)
ALLOWED_ORIGINS="http://localhost:5173"

# AI Chat (optional — set to "demo" to skip, or "gemini" with a free API key)
CHAT_PROVIDER="demo"
GEMINI_API_KEY=""
```

**Start the backend development server:**

```powershell
uvicorn main:app --reload --port 8000
```

The backend API is now running at **http://localhost:8000**  
Interactive API docs available at **http://localhost:8000/docs**

---

### Step 3 — Frontend Setup (React + Vite)

Open **Terminal 2** and run the following:

```powershell
# 1. Navigate to the frontend directory
cd PulseTrack\frontend

# 2. Install Node.js dependencies
npm install
```

**Configure environment variables:**

```powershell
# Copy the example file
copy .env.example .env
```

Open `frontend\.env` and fill in your values:

```env
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_API_BASE_URL="http://localhost:8000"
```

**Start the frontend development server:**

```powershell
npm run dev
```

The app is now running at **http://localhost:5173** 🎉

---

### Step 4 — Verify Everything Is Running

| Service | URL | Expected |
|---|---|---|
| **Frontend** | http://localhost:5173 | PulseTrack login page |
| **Backend API** | http://localhost:8000/health | `{"status": "ok"}` |
| **API Docs** | http://localhost:8000/docs | Swagger UI |

---

## 👥 Role-Based Access Control (RBAC)

New sign-ups are automatically assigned the **Member** role.  
To test the Manager dashboard, promote a user in the Supabase SQL Editor:

```sql
-- Replace with the actual UUID from your auth.users table
UPDATE public.user_roles
SET role = 'manager'
WHERE user_id = 'YOUR_USER_UUID_HERE';
```

Then refresh the app — the Manager dashboard, Team Reports, Projects page, and AI Chat assistant will become available.

**Role capabilities at a glance:**

| Feature | Member | Manager |
|---|---|---|
| Submit weekly report | ✅ | — |
| Edit / delete own reports | ✅ | ✅ |
| View own report history | ✅ | — |
| View **all** team reports | — | ✅ |
| Review full report detail modal | — | ✅ |
| Dashboard & charts | — | ✅ |
| Manage projects | — | ✅ |
| AI Chat assistant | — | ✅ |

---

## 🤖 AI Chat Assistant (Optional)

The AI assistant is **manager-only** and answers questions about real team data pulled live from Supabase.

**To enable real AI responses (free):**

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) → **Create API key** (30 seconds, no credit card).
2. Add to `backend\.env`:
   ```env
   CHAT_PROVIDER="gemini"
   GEMINI_API_KEY="your-key-here"
   ```
3. Restart the backend server.

**Without an API key**, the assistant still works in **demo mode** — it does keyword matching against your real Supabase data, so answers are always grounded in actual report content (not hardcoded fiction).

---

## ✨ Features Implemented

| # | Feature | Role |
|---|---|---|
| 1 | Sign up / Sign in (email + password via Supabase Auth) | All |
| 2 | Personal weekly report — create, edit, submit, view history | Member |
| 3 | Team Dashboard — compliance rate, blocker count, trend charts, activity feed | Manager |
| 4 | Team Reports — filter by week / member / project / date range, full detail modal | Manager |
| 5 | Projects management — add, edit, delete with linked report count | Manager |
| 6 | AI Chat assistant — real data context, multi-turn conversation, Gemini / OpenAI | Manager |

---

## 📊 Database Design (ER Diagram)

This Entity Relationship Diagram illustrates how users, roles, projects, and reports relate to one another within the PulseTrack database.

**[🔗 Click here to view the Professional ER Diagram (Crow's Foot Notation)](https://tinyurl.com/pulsetrack-er)**

**[🔗 Click here to view the Professional ER Diagram (Chen's Notation)](https://tinyurl.com/pulsetrack-erd)**