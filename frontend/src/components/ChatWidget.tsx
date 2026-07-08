import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Bot, MessageCircle, Send, X, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { chatApi, type ChatMessage } from "@/lib/apiService";
import { cn } from "@/lib/utils";

// ── Suggested quick-questions for the manager ─────────────────────────────────
const SUGGESTIONS = [
  "Summarise this week's team activity",
  "Who has open blockers?",
  "Which project has the highest workload?",
  "Who hasn't submitted a report yet?",
];

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm your PulseTrack AI assistant. I can answer questions about your team's real report data — try one of the suggestions below or ask anything.",
};

export function ChatWidget() {
  const [open, setOpen]   = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy]   = useState(false);
  // Bug Fix #4: track full conversation history for multi-turn context
  const [msgs, setMsgs]   = useState<ChatMessage[]>([WELCOME]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [msgs, open, busy]);

  // Reset conversation
  function clearChat() {
    setMsgs([WELCOME]);
    setInput("");
  }

  async function send(question?: string) {
    const q = (question ?? input).trim();
    if (!q || busy) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: q };
    // Optimistically add the user message
    setMsgs((prev) => [...prev, userMsg]);
    setBusy(true);

    try {
      // Bug Fix #4: pass full history (excluding the welcome message) for context
      const history = msgs.filter((m) => m !== WELCOME);
      const answer = await chatApi.ask(q, [...history, userMsg]);
      setMsgs((prev) => [...prev, { role: "assistant", content: answer }]);
    } catch (err) {
      // Bug Fix #5: show error as a chat bubble instead of silently disappearing
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setMsgs((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Error: ${message}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-hero-gradient text-white shadow-lifted transition-transform hover:scale-105 active:scale-95"
        aria-label={open ? "Close chat" : "Open AI assistant"}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <Card className="fixed bottom-24 right-6 z-50 flex h-[560px] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0 shadow-lifted">

          {/* Header */}
          <div className="flex items-center gap-3 border-b bg-hero-gradient p-4 text-white">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">PulseTrack Assistant</p>
              <p className="flex items-center gap-1 text-xs text-white/80">
                <Sparkles className="h-3 w-3" />
                Answers from real team data
              </p>
            </div>
            {/* Clear / reset conversation */}
            <button
              onClick={clearChat}
              title="Clear conversation"
              className="ml-auto rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto p-4"
          >
            {msgs.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "assistant" && (
                  <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[82%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : m.content.startsWith("⚠️")
                        ? "rounded-tl-sm bg-destructive/10 text-destructive"
                        : "rounded-tl-sm bg-muted text-foreground",
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Thinking indicator */}
            {busy && (
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                </div>
                <span className="text-xs text-muted-foreground">Thinking…</span>
              </div>
            )}

            {/* Suggestion chips — only shown when no user messages yet */}
            {msgs.length === 1 && !busy && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-medium text-muted-foreground">Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2 border-t p-3"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your team…"
              disabled={busy}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </Card>
      )}
    </>
  );
}
