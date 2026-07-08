"""
api/index.py — Vercel Serverless Function entry point for PulseTrack FastAPI backend.

How it works:
  - Vercel detects any .py file inside the /api directory as a serverless function.
  - `mangum` acts as an ASGI adapter — it converts Vercel's Lambda-style
    (event, context) invocation into an ASGI-compatible call that FastAPI understands.
  - All routes registered in main.py (GET /api/users/me, POST /api/reports, etc.)
    are handled through this single entry point via the `vercel.json` rewrite rules.

Timeouts:
  - Vercel Hobby (free): 10 seconds max per function call.
  - Vercel Pro: 60 seconds.
  - AI chat calls to Gemini/OpenAI may be slow — upgrade to Pro if timeouts occur.
"""

import sys
import os

# Add the backend root to the Python path so imports like `from routers import ...` work.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402 — import after path fix
from mangum import Mangum  # noqa: E402

# Mangum wraps the FastAPI ASGI app into a handler Vercel (AWS Lambda-compatible) can call.
handler = Mangum(app, lifespan="off")
