/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config";
import { useAuth } from "../../context/AuthContext";

const empty = { question: "", answer: "", category: "general", is_active: true };

export default function ManageFAQs() {
  const { token } = useAuth();
  const [faqs, setFaqs] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const load = () => fetch(`${API_BASE_URL}/admin/faqs/`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.json()).then((d) => setFaqs(d.faqs || []));
  useEffect(() => { load(); }, [token]);
  const save = async (event) => {
    event.preventDefault();
    const response = await fetch(`${API_BASE_URL}/admin/faqs${editing ? `/${editing.id}` : "/"}`, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    if (!response.ok) { setMessage(data.detail || "Unable to save FAQ"); return; }
    setMessage(editing ? "FAQ updated." : "FAQ added.");
    setForm(empty); setEditing(null); load();
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this FAQ?")) return;
    await fetch(`${API_BASE_URL}/admin/faqs/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  };
  return <div className="max-w-5xl mx-auto">
    <h1 className="text-2xl font-bold mb-1">Manage FAQs</h1>
    <p className="text-sm text-gray-500 mb-6">Add answers students can search from the FAQ page.</p>
    {message && <p className="mb-4 p-3 rounded-lg bg-blue-50 text-blue-700">{message}</p>}
    <form onSubmit={save} className="bg-white rounded-xl border p-5 space-y-3 mb-6">
      <input required placeholder="Question" value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="w-full border rounded-lg p-2.5" />
      <textarea required placeholder="Answer" rows="4" value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} className="w-full border rounded-lg p-2.5" />
      <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="border rounded-lg p-2.5">
        {["general", "registration", "hostel", "academic", "student_affairs", "navigation", "emergency"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
      </select>
      <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Visible to students</label>
      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">{editing ? "Update FAQ" : "Add FAQ"}</button>
      {editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }} className="ml-2 px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>}
    </form>
    <div className="space-y-3">{faqs.map((faq) => <div key={faq.id} className="bg-white rounded-xl border p-4">
      <div className="flex justify-between gap-3"><div><h2 className="font-semibold">{faq.question}</h2><p className="text-xs text-blue-600">{faq.category} · {faq.is_active ? "Visible" : "Hidden"}</p></div>
        <div className="flex gap-2"><button onClick={() => { setEditing(faq); setForm(faq); }} className="text-blue-600 text-sm">Edit</button><button onClick={() => remove(faq.id)} className="text-red-600 text-sm">Delete</button></div></div>
      <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{faq.answer}</p>
    </div>)}</div>
  </div>;
}
