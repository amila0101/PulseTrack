# PulseTrack — Weekly Work Reports & Team Insights 🚀

PulseTrack is a beautiful, modern full-stack web application designed for engineering teams to submit structured weekly work reports and for managers to analyze team performance through real-time dashboards and key metrics.

---

## 📁 Monorepo Structure

```text
PulseTrack/
├── frontend/          # React (Vite + TypeScript + TanStack Router & Start)
├── backend/           # Python (FastAPI) [Planned/Phase 2]
└── README.md          # Setup & developer documentation
```

---

## 🛠️ Tech Stack & Features

### Frontend (Phase 1)
- **Framework & Routing:** React 19, Vite, TanStack Router (SSR-ready with TanStack Start)
- **Styling:** Tailwind CSS (v4) with OKLCH theme color palettes
- **UI Components:** Radix UI primitives with custom-styled shadcn/ui layouts
- **State Management:** TanStack Query (`@tanstack/react-query`) for responsive API caching
- **Data Visualization:** Recharts for active progress lines, workload distribution, and blocker counts
- **Authentication & API Layer:** Supabase Client integration with custom Role-Based Access Control (RBAC)

### Backend & Database (Planned / Phase 2)
- **API Framework:** Python (FastAPI) with RESTful endpoints
- **Database:** PostgreSQL (managed on Supabase)
- **Role-Based Security:** Row Level Security (RLS) policies on user roles and reports

---

## ⚙️ Setup & Installation Instructions

This project uses an organized monorepo structure. You can run operations either from the **Workspace Root** or from the individual **frontend** directory.

### 1. Database Setup (Supabase PostgreSQL)
Before running the frontend, set up your Supabase database schema and authentication:
1. Sign up/Log in to [Supabase](https://supabase.com).
2. Create a new project.
3. Open the **SQL Editor** in your Supabase dashboard.
4. Navigate to `/PulseTrack/frontend/supabase/migrations/` in the codebase.
5. Copy the SQL migration scripts and execute them in your Supabase SQL Editor. This initializes the required tables:
   - `users` / `profiles` (User metadata)
   - `projects` (Active project tracking)
   - `reports` (Weekly status, plans, blockers, hours worked)
   - `user_roles` (Role-Based Access Control: `member` vs. `manager`)
6. Row Level Security (RLS) policies will automatically protect member data while permitting managers to see team-wide activity logs.

---

### 2. Frontend Setup

#### Option A: Running from the Workspace Root (Recommended)
You can control the frontend right from the workspace root folder using root scripts:

1. **Install All Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file inside `PulseTrack/frontend/` with your Supabase details:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```

3. **Start the Development Server:**
   ```bash
   npm run dev
   ```

4. **Build the Application:**
   ```bash
   npm run build
   ```

---

#### Option B: Running from the Frontend Directory
If you prefer running commands directly within the frontend:

1. **Navigate to the Frontend Directory:**
   ```bash
   cd PulseTrack/frontend
   ```

2. **Install Frontend Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the frontend root:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```

4. **Launch Vite Development Server:**
   ```bash
   npm run dev
   ```

5. **Build for Production:**
   ```bash
   npm run build
   ```

---

### 3. Backend Setup (Phase 2 Placeholder)
When starting Phase 2 (Python FastAPI application):

1. **Navigate to the Backend Directory:**
   ```bash
   cd PulseTrack/backend
   ```

2. **Initialize a Virtual Environment:**
   - **On macOS/Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   - **On Windows (PowerShell):**
     ```bash
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```

3. **Install Python Packages:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the FastAPI Development Server:**
   ```bash
   uvicorn main:app --reload
   ```

---

## 👥 Role-Based Access Control (RBAC) Testing

New sign-ups default to the **Team Member** role. To test manager dashboards, analytical charts, and the AI Assistant chat sidebar, manually elevate your user role:

1. Register a new user in the application UI.
2. Go to your **Supabase SQL Editor** and execute:
   ```sql
   UPDATE public.user_roles 
   SET role = 'manager' 
   WHERE user_id = 'YOUR_NEW_USER_UUID';
   ```
3. Refresh the app to unlock the comprehensive manager dashboards and insights workspace.

---

## ✨ Primary Workflows Implemented

1. **User Sign Up / Sign In:** Secure email/password and OAuth flows using Supabase Auth.
2. **Weekly Submission Engine:** Clean form layouts with validation to capture weekly tasks, upcoming plans, active projects, blockers, and total hours.
3. **Manager Workcenter:** Fully responsive grids rendering weekly summaries, real-time workload trendlines, and category distribution charts using Recharts.
4. **Historical Archive Search:** Powerful filtering allowing managers to search reports across users, projects, and specific week boundaries.
5. **PulseTrack Chatbot Widget:** Integrates an ambient assistant side-panel to assist managers in queries (mock demo mode).
