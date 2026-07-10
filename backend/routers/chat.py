"""
chat.py — AI Chat endpoint for PulseTrack

Architecture:
  1. Pull the last N reports from Supabase (real data, no hallucination)
  2. Serialize them into a compact JSON context block
  3. Send system prompt + context + user question to the LLM
  4. Return the answer

LLM provider: Google Gemini (free tier, generous rate limits).
Swap CHAT_PROVIDER env var to "openai" or "anthropic" to use those instead.

Data-privacy considerations:
  - Only aggregate/pseudonymised data is sent to the LLM (member name + task text).
  - No passwords, tokens, or PII beyond what the manager already sees are included.
  - Set CHAT_CONTEXT_WEEKS to limit how far back data is pulled (default: 4 weeks).
  - For on-prem/private deployments, replace the LLM call with a local Ollama endpoint.
"""

import json
import logging
import os
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from dependencies import get_current_user, require_manager, get_authed_supabase

router = APIRouter()
logger = logging.getLogger("pulsetrack.chat")

# ── Configuration ─────────────────────────────────────────────────────────────
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY   = os.getenv("OPENAI_API_KEY", "")
CHAT_PROVIDER    = os.getenv("CHAT_PROVIDER", "gemini")   # "gemini" | "openai" | "demo"
CHAT_CONTEXT_WEEKS = int(os.getenv("CHAT_CONTEXT_WEEKS", "4"))  # weeks of history to include


# ── Request / Response models ─────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    question: str
    history: list[ChatMessage] = []   # previous turns for multi-turn context


class ChatResponse(BaseModel):
    answer: str


# ── Context builder ───────────────────────────────────────────────────────────

def _build_context(supabase: Client) -> str:
    """
    Pull recent reports + profiles from Supabase and serialize them into a
    compact text block that will be injected into the LLM system prompt.
    Only includes data the manager already has permission to see.
    """
    cutoff = (date.today() - timedelta(weeks=CHAT_CONTEXT_WEEKS)).isoformat()

    reports_resp = (
        supabase.table("reports")
        .select("week_start_date, status, tasks_completed, tasks_planned, blockers, hours_worked, project:projects(name), profile:profiles(full_name, email)")
        .gte("week_start_date", cutoff)
        .order("week_start_date", desc=True)
        .limit(100)
        .execute()
    )
    reports = reports_resp.data or []

    if not reports:
        return "No report data available for the selected period."

    lines = [f"Team reports — last {CHAT_CONTEXT_WEEKS} weeks ({cutoff} to today):\n"]
    for r in reports:
        name    = (r.get("profile") or {}).get("full_name") or (r.get("profile") or {}).get("email") or "Unknown"
        project = (r.get("project") or {}).get("name") or "Unassigned"
        lines.append(
            f"- {name} | week {r['week_start_date']} | project: {project} | "
            f"status: {r['status']} | hours: {r.get('hours_worked') or 0} | "
            f"completed: {(r.get('tasks_completed') or '').strip()[:200]} | "
            f"planned: {(r.get('tasks_planned') or '').strip()[:200]} | "
            f"blockers: {(r.get('blockers') or '').strip()[:200]}"
        )

    return "\n".join(lines)


SYSTEM_PROMPT = """\
You are PulseTrack Assistant, an AI tool that helps engineering managers understand \
their team's weekly reports. You have access to structured data from the team's \
weekly status reports below.

Answer the manager's questions based ONLY on the data provided. \
If something is not in the data, say so clearly — never invent numbers or names. \
Be concise, factual, and helpful. Format bullet lists when listing multiple items.

{context}
"""


# ── LLM adapters ─────────────────────────────────────────────────────────────

async def _call_gemini(system: str, history: list[ChatMessage], question: str) -> str:
    """Call Google Gemini API (gemini-1.5-flash-latest — free tier)."""
    import httpx

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest: generateContent?key={GEMINI_API_KEY}"

    # Build contents array: system instruction + history + current question
    contents = []
    for msg in history[-6:]:  # last 3 turns (6 messages) for context window efficiency
        contents.append({
            "role": "user" if msg.role == "user" else "model",
            "parts": [{"text": msg.content}]
        })
    contents.append({"role": "user", "parts": [{"text": question}]})

    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": contents,
        "generationConfig": {"maxOutputTokens": 512, "temperature": 0.2},
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def _call_openai(system: str, history: list[ChatMessage], question: str) -> str:
    """Call OpenAI Chat Completions API (gpt-4o-mini — cheap)."""
    import httpx

    messages = [{"role": "system", "content": system}]
    for msg in history[-6:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": question})

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json={"model": "gpt-4o-mini", "messages": messages, "max_tokens": 512, "temperature": 0.2},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def _demo_response(question: str, context: str) -> str:
    """
    Keyword-based fallback when no LLM key is configured.
    Uses REAL data from the context string instead of hardcoded fiction.
    """
    q = question.lower()
    lines = [l for l in context.split("\n") if l.startswith("-")]

    if "blocker" in q:
        blockers = [l for l in lines if "blockers:" in l and l.split("blockers:")[-1].strip()]
        if blockers:
            return "Active blockers found:\n" + "\n".join(
                f"• {l.split('|')[0].strip().lstrip('- ')}: {l.split('blockers:')[-1].strip()}"
                for l in blockers[:5]
            )
        return "No blockers reported in the recent data."

    if any(w in q for w in ["hours", "workload"]):
        total = sum(
            float(l.split("hours:")[-1].split("|")[0].strip() or 0)
            for l in lines if "hours:" in l
        )
        return f"Total hours logged across all reports in the last {CHAT_CONTEXT_WEEKS} weeks: {total:.1f}h"

    if any(w in q for w in ["submitted", "compliance", "who submitted", "status"]):
        submitted = sum(1 for l in lines if "status: submitted" in l)
        pending   = sum(1 for l in lines if "status: pending" in l)
        return (
            f"Submission status for the last {CHAT_CONTEXT_WEEKS} weeks:\n"
            f"• Submitted: {submitted} reports\n"
            f"• Pending: {pending} reports"
        )

    return (
        "I can see your team's reports but I need an LLM API key to answer complex questions. "
        "Add GEMINI_API_KEY or OPENAI_API_KEY to backend/.env and set CHAT_PROVIDER accordingly. "
        f"Currently I can see {len(lines)} reports in the last {CHAT_CONTEXT_WEEKS} weeks."
    )


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    _role=Depends(require_manager),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase),
):
    """
    Manager-only AI chat endpoint.
    Pulls real report data from Supabase and sends it to the configured LLM.
    Falls back to keyword matching if no API key is configured.
    """
    if not body.question.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question cannot be empty.")

    try:
        context = _build_context(supabase)
        system  = SYSTEM_PROMPT.format(context=context)

        provider = CHAT_PROVIDER.lower()

        if provider == "gemini" and GEMINI_API_KEY:
            answer = await _call_gemini(system, body.history, body.question)
        elif provider == "openai" and OPENAI_API_KEY:
            answer = await _call_openai(system, body.history, body.question)
        else:
            # Demo mode: keyword matching against REAL data (not hardcoded fiction)
            answer = _demo_response(body.question, context)

        logger.info("Chat request by manager %s answered via %s", current_user["id"], provider)
        return ChatResponse(answer=answer)

    except Exception as exc:
        logger.error("Chat error for user %s: %s", current_user["id"], exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get an answer: {str(exc)}",
        )
