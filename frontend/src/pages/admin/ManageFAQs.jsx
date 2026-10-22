import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../context/AuthContext";

const emptyForm = { question: "", answer: "", category: "general", is_active: true };
const categories = [
  "general",
  "registration",
  "hostel",
  "academic",
  "student_affairs",
  "navigation",
  "emergency",
];

export default function ManageFAQs() {
  const { token } = useAuth();
  const [faqs, setFaqs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/admin/faqs/`, {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to load FAQs");
      setFaqs(data.faqs || []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load FAQs");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const startEditing = (faq) => {
    setMessage("");
    setError("");
    setEditing(faq);
    setForm({
      question: faq.question || "",
      answer: faq.answer || "",
      category: faq.category || "general",
      is_active: faq.is_active !== false,
    });
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      formRef.current?.querySelector("input")?.focus({ preventScroll: true });
    });
  };

  const cancelEditing = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/faqs${editing ? `/${editing.id}` : "/"}`,
        {
          method: editing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: JSON.stringify(form),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to save FAQ");
      setMessage(editing ? "FAQ updated successfully." : "FAQ added successfully.");
      cancelEditing();
      await load();
    } catch (saveError) {
      setError(saveError.message || "Unable to save FAQ");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (faq) => {
    if (!window.confirm(`Delete this FAQ: "${faq.question}"?`)) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/admin/faqs/${faq.id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to delete FAQ");
      setMessage("FAQ deleted.");
      await load();
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete FAQ");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-800 via-blue-700 to-cyan-700 p-6 text-white shadow-lg sm:p-8">
        <div className="flex items-center gap-4">
          <span className="rounded-2xl bg-white/15 p-3">
            <BookOpen className="h-7 w-7" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-100">Campus knowledge</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Manage FAQs</h1>
            <p className="mt-1 text-sm text-blue-100">Create and maintain answers students can quickly find.</p>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </div>
      )}

      <section ref={formRef} className="scroll-mt-6 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
            {editing ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">{editing ? "Edit FAQ" : "Add a question and answer"}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-300">FAQs marked visible will appear on the student FAQ page.</p>
          </div>
        </div>
        <form onSubmit={save} className="space-y-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Question
            <input
              required
              value={form.question}
              onChange={(event) => setForm({ ...form, question: event.target.value })}
              className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
            Answer
            <textarea
              required
              rows={5}
              value={form.answer}
              onChange={(event) => setForm({ ...form, answer: event.target.value })}
              className="mt-1.5 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Category
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 pb-3 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Visible to students
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
            >
              {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Saving..." : editing ? "Update FAQ" : "Add FAQ"}
            </button>
            {editing && (
              <button type="button" onClick={cancelEditing} disabled={saving} className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Published FAQ records</h2>
            <p className="text-sm text-gray-500 dark:text-gray-300">{faqs.length} total</p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">Loading FAQs...</div>
        ) : faqs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-12 text-center text-sm text-gray-500 dark:border-gray-600">
            No FAQs have been added yet.
          </div>
        ) : (
          <div className="space-y-3">
            {faqs.map((faq) => (
              <article key={faq.id} className="rounded-xl border border-gray-100 p-4 transition hover:border-blue-200 hover:shadow-sm dark:border-gray-700 dark:hover:border-blue-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{faq.question}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium capitalize text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                        {faq.category?.replaceAll("_", " ") || "general"}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 font-medium ${faq.is_active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                        {faq.is_active ? "Visible" : "Hidden"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => startEditing(faq)} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-900/20">
                      <Pencil className="h-4 w-4" /> Edit
                    </button>
                    <button type="button" onClick={() => remove(faq)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-900/20">
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-300">{faq.answer}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
