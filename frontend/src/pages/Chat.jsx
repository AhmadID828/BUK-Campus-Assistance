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
} from "lucide-react";
import { toast } from "react-hot-toast";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";

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
  const [provider, setProvider] = useState("ollama");
  const [model, setModel] = useState("gemma2:2b");
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [showRecent, setShowRecent] = useState(false);
  const bottomRef = useRef(null);
  const requestControllerRef = useRef(null);

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
    setLoading(true);
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 300000);

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

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to get response");

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
      if (chatError.name === "AbortError") return;
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
    <div className="max-w-6xl mx-auto px-4 py-6 h-[calc(100vh-80px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">AI Assistant</h1>
          <p className="text-sm text-slate-500">Academic help + Campus information</p>
        </div>

        {/* Mode switcher */}
        <div className="flex items-center gap-2">
          <select
            value={provider}
            onChange={(e) => {
              const nextProvider = e.target.value;
              setProvider(nextProvider);
              setModel(nextProvider === "groq" ? "openai/gpt-oss-20b" : "gemma2:2b");
            }}
            disabled={loading}
            className="rounded-xl border border-blue-100 bg-white px-2 py-2 text-sm text-slate-700"
            aria-label="AI provider"
          >
            <option value="ollama">Ollama</option>
            <option value="groq">Groq</option>
          </select>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
            className="rounded-xl border border-blue-100 bg-white px-2 py-2 text-sm text-slate-700"
            aria-label="AI model"
          >
            {provider === "groq" ? (
              <option value="openai/gpt-oss-20b">GPT OSS 20B</option>
            ) : (
              <option value="gemma2:2b">Gemma 2 2B</option>
            )}
          </select>
          <button
            type="button"
            onClick={() => setShowRecent((value) => !value)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            <MessageSquare size={15} />
            Recent
          </button>
          <button
            type="button"
            onClick={startNewChat}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={15} />
            New
          </button>
        </div>
        <div className="flex bg-blue-50 rounded-xl p-1">
          {[
            { id: "mixed", label: "All", icon: null },
            { id: "academic", label: "Study", icon: <BookOpen size={14} /> },
            { id: "campus", label: "Campus", icon: <MapPin size={14} /> },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                mode === m.id
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-600 hover:bg-blue-100"
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {showRecent && (
        <div className="mb-4 rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Recent conversations</h2>
            <button type="button" onClick={startNewChat} className="text-xs text-blue-600 hover:underline">
              Start new chat
            </button>
          </div>
          {sessions.length === 0 ? (
            <p className="py-3 text-sm text-slate-500">No saved conversations yet.</p>
          ) : (
            <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => openSession(session.id)}
                  className={`rounded-lg border px-3 py-2 text-left hover:bg-blue-50 ${
                    session.id === sessionId ? "border-blue-500 bg-blue-50" : "border-slate-200"
                  }`}
                >
                  <span className="block truncate text-sm font-medium text-slate-700">{session.title}</span>
                  <span className="text-xs capitalize text-slate-400">{session.session_type} · {session.message_count} messages</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                <Bot size={18} />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-white border border-blue-100 text-slate-700 rounded-bl-md shadow-sm"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <details className="group mt-3 border-t border-blue-100 pt-2 text-xs text-slate-600">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium text-blue-700 hover:text-blue-800">
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
                        <p className="font-medium text-slate-700">
                          {source.title || source.filename || source.name || "Study material"}
                          {source.subject ? ` · ${source.subject}` : ""}
                        </p>
                        {source.excerpt && (
                          <p className="mt-0.5 text-slate-500">{source.excerpt}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0">
                <User size={18} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center">
              <Bot size={18} />
            </div>
            <div className="bg-white border border-blue-100 rounded-2xl px-4 py-3 shadow-sm">
              <Loader2 className="animate-spin text-blue-600" size={18} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your notes, registration, locations, emergencies..."
          className="w-full pl-5 pr-14 py-4 rounded-2xl border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none shadow-sm"
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
    </div>
  );
}