import { useState, useRef, useEffect } from "react";
import {
  Send,
  Bot,
  User,
  BookOpen,
  MapPin,
  Loader2,
  MessageSquare,
  Plus,
  Square,
  ChevronDown,
  Settings2,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";

function readableChatText(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, "\n\n")
    .replace(/<(?:p|div|li|h[1-6])(?:\s[^<>]*)?>/gi, "")
    .replace(/<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?\/?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n")
    .trim();
}

export default function Chat() {
  const { token } = useAuth();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I’m the BUK Campus Assistant System. Ask me anything about your courses or campus (locations, FAQs, emergencies, events).",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("mixed"); // mixed | academic | campus
  const [provider, setProvider] = useState("groq");
  const [model, setModel] = useState("openai/gpt-oss-20b");
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [showRecent, setShowRecent] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef(null);
  const requestControllerRef = useRef(null);
  const abortReasonRef = useRef(null);
  const inputRef = useRef(null);

  const loadSessions = async () => {
    if (!token) return;
    const response = await fetch(`${API_BASE_URL}/chat/sessions`, {
      headers: { Authorization: "Bearer " + token },
    });
    if (response.ok) setSessions((await response.json()).sessions || []);
  };

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/chat/sessions`, {
      headers: { Authorization: "Bearer " + token },
    })
      .then((response) => (response.ok ? response.json() : { sessions: [] }))
      .then((data) => setSessions(data.sessions || []));
  }, [token]);

  const openSession = async (id) => {
    const response = await fetch(`${API_BASE_URL}/chat/sessions/${id}`, {
      headers: { Authorization: "Bearer " + token },
    });
    if (!response.ok) return;
    const data = await response.json();
    setSessionId(data.id);
    setMode(data.session_type || "mixed");
    setMessages(data.messages || []);
    setShowRecent(false);
  };

  const startNewChat = () => {
    abortReasonRef.current = "cancelled";
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setLoading(false);
    setSessionId(null);
    setMessages([
      {
        role: "assistant",
        content: "Hello! I’m the BUK Campus Assistant System. Ask me anything about your courses or campus (locations, FAQs, emergencies, events).",
      },
    ]);
    setShowRecent(false);
  };

  const stopGenerating = () => {
    abortReasonRef.current = "stopped";
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setLoading(false);
    toast("Response stopped");
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "48px";
    setLoading(true);
    const controller = new AbortController();
    requestControllerRef.current = controller;
    abortReasonRef.current = null;
    const timeout = window.setTimeout(() => {
      abortReasonRef.current = "timeout";
      controller.abort();
    }, 300000);

    try {
      const response = await fetch(`${API_BASE_URL}/chat/ask`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({
          content: userMsg.content,
          session_type: mode,
          provider,
          model,
          ...(sessionId ? { session_id: sessionId } : {}),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || `Failed to get response (${response.status})`);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        },
      ]);
      setSessionId(data.session_id);
      await loadSessions();
    } catch (chatError) {
      if (chatError.name === "AbortError") {
        if (abortReasonRef.current === "timeout") {
          const errorMessage = "That question took too long to answer. Please try again.";
          toast.error(errorMessage);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: errorMessage },
          ]);
        }
        return;
      }
      const errorMessage = chatError.message || "Failed to get response";
      toast.error(errorMessage);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `I could not complete that request: ${errorMessage}` },
      ]);
    } finally {
      window.clearTimeout(timeout);
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl min-w-0 flex-col px-2 pb-[env(safe-area-inset-bottom)] pt-2 sm:px-4 sm:py-4">
      {/* Header */}
      <div className="mb-2 shrink-0 space-y-2 border-b border-blue-100 pb-2 dark:border-slate-700 sm:mb-4 sm:space-y-3 sm:border-0 sm:pb-0">
        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-800 dark:text-white sm:text-xl">AI Assistant</h1>
            <p className="hidden truncate text-xs text-slate-500 dark:text-slate-400 sm:block sm:text-sm">
              Academic help + Campus information
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowRecent(true)}
              className="flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-50 px-2.5 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/70 sm:px-3"
              aria-label="Open recent conversations"
            >
              <MessageSquare size={16} />
              <span className="hidden sm:inline">History</span>
            </button>
            <button
              type="button"
              onClick={startNewChat}
              className="flex min-h-10 items-center gap-1 rounded-xl bg-blue-600 px-2.5 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:gap-1.5 sm:px-3"
            >
              <Plus size={16} />
              <span>New</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="flex min-h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-white text-slate-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:hidden"
              aria-label="Chat settings"
            >
              <Settings2 size={18} />
            </button>
          </div>
        </div>

        <div className="flex w-full rounded-xl bg-blue-50 p-1 dark:bg-slate-800 sm:w-fit">
          {[
            { id: "mixed", label: "All", icon: null },
            { id: "academic", label: "Study", icon: <BookOpen size={14} /> },
            { id: "campus", label: "Campus", icon: <MapPin size={14} /> },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition sm:flex-initial ${
                mode === m.id
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-600 hover:bg-blue-100 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <select
            value={provider}
            onChange={(e) => {
              const nextProvider = e.target.value;
              setProvider(nextProvider);
              setModel(nextProvider === "groq" ? "openai/gpt-oss-20b" : "gemma2:2b");
            }}
            disabled={loading}
            className="min-h-10 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            aria-label="AI provider"
          >
            <option value="ollama">Ollama</option>
            <option value="groq">Groq</option>
          </select>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
            className="min-h-10 rounded-xl border border-blue-100 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            aria-label="AI model"
          >
            {provider === "groq" ? (
              <option value="openai/gpt-oss-20b">GPT OSS 20B</option>
            ) : (
              <option value="gemma2:2b">Gemma 2 2B</option>
            )}
          </select>
        </div>
      </div>

      {showRecent && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-3"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowRecent(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="recent-conversations-title"
            className="max-h-[80dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-blue-100 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="recent-conversations-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Recent conversations
              </h2>
              <div className="flex items-center gap-3">
                <button type="button" onClick={startNewChat} className="text-xs font-medium text-blue-600 hover:underline">
                  Start new chat
                </button>
                <button
                  type="button"
                  onClick={() => setShowRecent(false)}
                  aria-label="Close recent conversations"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {sessions.length === 0 ? (
              <p className="py-3 text-sm text-slate-500 dark:text-slate-400">No saved conversations yet.</p>
            ) : (
              <div className="grid max-h-[60dvh] gap-2 overflow-y-auto sm:max-h-40 sm:grid-cols-2">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => openSession(session.id)}
                    className={`min-h-14 rounded-lg border px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-slate-800 ${
                      session.id === sessionId ? "border-blue-500 bg-blue-50 dark:bg-blue-950/50" : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">{session.title}</span>
                    <span className="text-xs capitalize text-slate-400">{session.session_type} · {session.message_count} messages</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Messages */}
      <div className="mb-2 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-0.5 pr-1 sm:mb-4 sm:space-y-4 sm:px-1 sm:pr-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex min-w-0 items-end gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white sm:h-9 sm:w-9">
                <Bot size={16} className="sm:h-[18px] sm:w-[18px]" />
              </div>
            )}

            <div
              className={`min-w-0 max-w-[calc(100%-2.5rem)] break-words [overflow-wrap:anywhere] rounded-2xl px-3 py-2.5 text-sm leading-relaxed sm:max-w-[80%] sm:px-4 sm:py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "border border-blue-100 bg-white text-slate-700 rounded-bl-md shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              <p className="whitespace-pre-wrap">
                {msg.role === "assistant" ? readableChatText(msg.content) : msg.content}
              </p>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <details className="group mt-3 border-t border-blue-100 pt-2 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200">
                    <span>View retrieved study material ({msg.sources.length})</span>
                    <ChevronDown
                      size={15}
                      className="shrink-0 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {msg.sources.map((source, sourceIndex) => (
                      <li key={`${source.title || source.name || source.type}-${sourceIndex}`}>
                        <p className="font-medium text-slate-700 dark:text-slate-200">
                          {source.title || source.filename || source.name || "Study material"}
                          {source.subject ? ` · ${source.subject}` : ""}
                        </p>
                        {source.excerpt && (
                          <p className="mt-0.5 text-slate-500 dark:text-slate-400">{source.excerpt}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200 sm:h-9 sm:w-9">
                <User size={16} className="sm:h-[18px] sm:w-[18px]" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex min-w-0 items-end gap-2 sm:gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white sm:h-9 sm:w-9">
              <Bot size={16} className="sm:h-[18px] sm:w-[18px]" />
            </div>
            <div
              role="status"
              aria-live="polite"
              className="flex min-w-0 items-center gap-2 rounded-2xl border border-blue-100 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:gap-3 sm:px-4 sm:py-3"
            >
              <Loader2 className="animate-spin text-blue-600" size={18} />
              <span className="text-sm text-slate-600 dark:text-slate-300">AI is thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="relative shrink-0 pb-2 sm:pb-0">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight, 128)}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ask your study or campus question..."
          aria-label="Ask your study or campus question"
          className="max-h-32 min-h-12 w-full resize-none overflow-y-auto rounded-2xl border border-blue-200 bg-white py-3 pl-3 pr-14 text-base leading-6 text-slate-900 outline-none shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-blue-900 sm:pl-5"
        />
        {loading ? (
          <button
            type="button"
            onClick={stopGenerating}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition"
            title="Stop response"
            aria-label="Stop response"
          >
            <Square size={16} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition"
            title="Send question"
            aria-label="Send question"
          >
            <Send size={18} />
          </button>
        )}
      </form>

      {showSettings && (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-slate-950/40 p-3 sm:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowSettings(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-settings-title"
            className="max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl dark:bg-slate-900"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="chat-settings-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                Chat settings
              </h2>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                aria-label="Close chat settings"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                AI provider
                <select
                  value={provider}
                  onChange={(e) => {
                    const nextProvider = e.target.value;
                    setProvider(nextProvider);
                    setModel(nextProvider === "groq" ? "openai/gpt-oss-20b" : "gemma2:2b");
                  }}
                  disabled={loading}
                  className="mt-1.5 min-h-12 w-full rounded-xl border border-blue-100 bg-white px-3 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="ollama">Ollama</option>
                  <option value="groq">Groq</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                AI model
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={loading}
                  className="mt-1.5 min-h-12 w-full rounded-xl border border-blue-100 bg-white px-3 text-base text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {provider === "groq" ? (
                    <option value="openai/gpt-oss-20b">GPT OSS 20B</option>
                  ) : (
                    <option value="gemma2:2b">Gemma 2 2B</option>
                  )}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="min-h-12 w-full rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}