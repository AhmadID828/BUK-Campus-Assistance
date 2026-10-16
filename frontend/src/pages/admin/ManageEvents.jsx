/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../config";
import {
  Calendar,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Search,
  X,
  MapPin,
  Clock,
  Star,
} from "lucide-react";

const ManageEvents = () => {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [rsvpEvent, setRsvpEvent] = useState(null);
  const [rsvps, setRsvps] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "General",
    location: "",
    event_date: "",
    start_time: "",
    end_time: "",
    organizer: "",
    is_featured: false,
  });
  const [imageFile, setImageFile] = useState(null);

  const categories = ["General", "Academic", "Social", "Sports", "Admin"];

  const formatApiError = (detail, fallback) => {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          const location = Array.isArray(item.loc) ? item.loc.join(" > ") : "";
          return `${location ? `${location}: ` : ""}${item.msg || "Invalid value"}`;
        })
        .join("; ");
    }
    if (detail && typeof detail === "object") {
      return Object.entries(detail)
        .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
        .join("; ");
    }
    return fallback;
  };

  const fetchEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/events/?upcoming_only=false`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load events");
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [token]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      category: "General",
      location: "",
      event_date: "",
      start_time: "",
      end_time: "",
      organizer: "",
      is_featured: false,
    });
    setImageFile(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("event_date", form.event_date);
      formData.append("description", form.description || "");
      formData.append("category", form.category);
      formData.append("location", form.location || "");
      formData.append("start_time", form.start_time || "");
      formData.append("end_time", form.end_time || "");
      formData.append("organizer", form.organizer || "");
      formData.append("is_featured", form.is_featured);
      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response = await fetch(`${API_BASE_URL}/events/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(formatApiError(errData.detail, "Failed to create event"));
      }

      setSuccess("Event created successfully");
      resetForm();
      setShowForm(false);
      fetchEvents();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    setForm({
      title: event.title || "",
      description: event.description || "",
      category: event.category || "General",
      location: event.location || "",
      event_date: event.event_date || "",
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      organizer: event.organizer || "",
      is_featured: event.is_featured || false,
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingEvent) return;

    setActionLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_BASE_URL}/events/${editingEvent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(formatApiError(errData.detail, "Failed to update event"));
      }

      setSuccess("Event updated successfully");
      setShowEditModal(false);
      setEditingEvent(null);
      fetchEvents();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;

    setActionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/events/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to delete event");

      setSuccess("Event deleted successfully");
      fetchEvents();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const viewRsvps = async (event) => {
    setRsvpEvent(event);
    setRsvps(null);
    const response = await fetch(`${API_BASE_URL}/events/${event.id}/rsvps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      setError(typeof data.detail === "string" ? data.detail : "Failed to load RSVPs");
      return;
    }
    setRsvps(data);
  };

  const filtered = events.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.category?.toLowerCase().includes(search.toLowerCase()) ||
      e.location?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Manage Events
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create and manage campus events & announcements
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchEvents}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-xl text-sm">
          {success}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-4">Create New Event</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Title *</label>
              <input type="text" name="title" value={form.title} onChange={handleChange} required
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Category</label>
              <select name="category" value={form.category} onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Event Date *</label>
              <input type="date" name="event_date" value={form.event_date} onChange={handleChange} required
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Location</label>
              <input type="text" name="location" value={form.location} onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Time</label>
              <input type="time" name="start_time" value={form.start_time} onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">End Time</label>
              <input type="time" name="end_time" value={form.end_time} onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Organizer</label>
              <input type="text" name="organizer" value={form.organizer} onChange={handleChange}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Image (Optional)</label>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows="3"
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input type="checkbox" name="is_featured" checked={form.is_featured} onChange={handleChange}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
              <label className="text-sm text-gray-600 dark:text-gray-400">Featured Event</label>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={actionLoading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                {actionLoading ? "Creating..." : "Create Event"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                className="px-5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" placeholder="Search events..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Events List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-10 text-center text-gray-500 dark:text-gray-400">
          No events found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((event) => (
            <div key={event.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition">
              {event.image_url ? (
                <img src={`${API_BASE_URL}/${event.image_url}`} alt={event.title}
                  className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Calendar className="w-10 h-10 text-white/80" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-gray-800 dark:text-white line-clamp-1">
                      {event.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {event.category} • {event.event_date}
                    </p>
                    {event.location && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {event.location}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditModal(event)}
                      className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => viewRsvps(event)}
                      className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" title="View RSVPs">
                      <span className="text-xs font-bold">RSVP</span>
                    </button>
                    <button onClick={() => handleDelete(event.id)} disabled={actionLoading}
                      className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {rsvpEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRsvpEvent(null)} />
          <div className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 dark:text-white">RSVPs: {rsvpEvent.title}</h3>
              <button onClick={() => setRsvpEvent(null)}><X className="w-5 h-5" /></button>
            </div>
            {!rsvps ? <p className="text-sm text-gray-500">Loading responses...</p> : (
              <>
                <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
                  {Object.entries(rsvps.counts).map(([key, count]) => (
                    <div key={key} className="rounded-lg bg-blue-50 p-2 text-blue-700">
                      <strong className="block text-lg">{count}</strong>{key.replace("_", " ")}
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {rsvps.rsvps.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3 text-sm dark:border-gray-700">
                      <div className="font-medium">{item.user.full_name}</div>
                      <div className="text-xs text-gray-500">{item.user.registration_number || item.user.email} · {item.status.replace("_", " ")}</div>
                    </div>
                  ))}
                  {rsvps.rsvps.length === 0 && <p className="text-sm text-gray-500">No responses yet.</p>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-800 dark:text-white">Edit Event</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Title *</label>
                <input type="text" name="title" value={form.title} onChange={handleChange} required
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Category</label>
                <select name="category" value={form.category} onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Event Date *</label>
                <input type="date" name="event_date" value={form.event_date} onChange={handleChange} required
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Location</label>
                <input type="text" name="location" value={form.location} onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Time</label>
                <input type="time" name="start_time" value={form.start_time} onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">End Time</label>
                <input type="time" name="end_time" value={form.end_time} onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Description</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows="3"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <input type="checkbox" name="is_featured" checked={form.is_featured} onChange={handleChange}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" />
                <label className="text-sm text-gray-600 dark:text-gray-400">Featured Event</label>
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={actionLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition">
                  {actionLoading ? "Updating..." : "Update Event"}
                </button>
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="px-5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageEvents;
