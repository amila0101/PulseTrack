# Deploying PulseTrack on Vercel 🚀

Vercel is a fantastic platform for deploying full-stack apps. Because PulseTrack is a monorepo containing both a React frontend and a Python backend, you will create **two separate Vercel projects** linked to the same GitHub repository.

You do **not** need another provider like Railway or Render for the backend. Vercel supports Python Serverless Functions out of the box!

---

## 🛠️ Prerequisites

Before you start, make sure you have:
1. Pushed your entire `PulseTrack` code (including the `frontend` and `backend` folders) to a GitHub repository.
2. Created a free account on [Vercel](https://vercel.com).
3. Your Supabase credentials ready (`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`).

---

## 🚀 Part 1: Deploying the Backend (FastAPI)

We have already configured your backend for Vercel by adding the `mangum` adapter and creating the `backend/api/index.py` and `backend/vercel.json` files.

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New... > Project**.
2. Import your GitHub repository.
3. Configure the project settings as follows:
   - **Project Name:** `pulsetrack-backend` (or similar)
   - **Framework Preset:** `Other`
   - **Root Directory:** Click `Edit` and select the `backend` folder.
   - **Build Command:** Leave empty.
   - **Output Directory:** Leave empty.
   - **Install Command:** Leave empty (Vercel automatically handles Python `requirements.txt`).
4. **Environment Variables:** Open the Environment Variables section and add:
   - `SUPABASE_URL` (e.g., `https://your-project.supabase.co`)
   - `SUPABASE_PUBLISHABLE_KEY` (your Supabase anon key)
   - `SUPABASE_JWT_SECRET` (optional, for fast JWT validation)
   - `ALLOWED_ORIGINS` (Set this to `*` for now, or add your frontend URL later once it's deployed)
   - `CHAT_PROVIDER` (e.g., `demo` or `gemini`)
   - `GEMINI_API_KEY` (If using Gemini AI Chat)
5. Click **Deploy**.

> **Note:** Once the deployment finishes, copy the new backend domain (e.g., `https://pulsetrack-backend.vercel.app`). You will need this for the frontend! Test it by going to `https://pulsetrack-backend.vercel.app/health`.

---

## 🎨 Part 2: Deploying the Frontend (React + Vite)

Now, we will deploy the frontend as a separate Vercel project pointing to the same repository.

1. Go back to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New... > Project**.
2. Import the *exact same* GitHub repository.
3. Configure the project settings as follows:
   - **Project Name:** `pulsetrack-frontend` (or similar)
   - **Framework Preset:** `Vite` (Vercel usually auto-detects this)
   - **Root Directory:** Click `Edit` and select the `frontend` folder.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Environment Variables:** Open the Environment Variables section and add:
   - `VITE_SUPABASE_URL` (Same as backend)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (Same as backend)
   - `VITE_API_BASE_URL` (Set this to the backend URL you copied earlier, e.g., `https://pulsetrack-backend.vercel.app`)
5. Click **Deploy**.

> **Note:** Once the frontend deployment finishes, copy the new frontend domain (e.g., `https://pulsetrack-frontend.vercel.app`).

---

## 🔒 Part 3: Final Security Tweaks

To ensure maximum security and proper CORS configuration:

1. **Update Backend CORS:**
   Go to your `pulsetrack-backend` project in Vercel. Navigate to **Settings > Environment Variables**. Edit the `ALLOWED_ORIGINS` variable and set it to your new frontend URL (e.g., `https://pulsetrack-frontend.vercel.app`). Do not include a trailing slash.
   After updating, you must **Redeploy** the backend (Deployments tab > click the latest > Redeploy).

2. **Update Supabase Auth Redirects:**
   Go to your Supabase Dashboard. Navigate to **Authentication > URL Configuration**.
   Add your new frontend URL (e.g., `https://pulsetrack-frontend.vercel.app`) to the **Site URL** and **Redirect URLs**. This ensures login works correctly in production.

---

## 💡 How the Vercel Backend Works (Under the Hood)

You might wonder how a Python server runs on Vercel without a traditional VPS. 

1. **Vercel Serverless Functions:** Vercel detects the `backend/api/index.py` file because of the `backend/vercel.json` configuration. It turns this file into an AWS Lambda function.
2. **Mangum:** FastAPI is an ASGI framework, which Lambda doesn't understand natively. We installed `mangum`, which translates the Lambda events into ASGI requests for FastAPI.
3. **Cold Starts:** Because it's serverless, the backend goes to sleep when not in use. The first request after a period of inactivity might take an extra 1-2 seconds (a "cold start"). Subsequent requests are extremely fast.
