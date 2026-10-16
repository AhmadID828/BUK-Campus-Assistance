import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-hot-toast";
import { Calendar, Clock, MapPin, Search, Star } from "lucide-react";

const categories = ["All", "Academic", "Social", "Sports", "Admin", "General"];

const formatDate = (eventDate) => {
  if (!eventDate) return "Date TBA";

  return new Date(`${eventDate}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const EventsPage = () => {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rsvpLoading, setRsvpLoading] = useState(null);
  const [rsvpStatus, setRsvpStatus] = useState({});

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError("");

      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(
          `${API_BASE_URL}/events/?upcoming_only=true`,
          { headers }
        );

        if (!response.ok) throw new Error("Failed to load events");

        const data = await response.json();
        setEvents(data.events ?? []);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [token]);

  const filteredEvents = events.filter((event) => {
    const matchesCategory =
      category === "All" ||
      event.category?.toLowerCase() === category.toLowerCase();
    const searchTerm = search.trim().toLowerCase();
    const matchesSearch =
      !searchTerm ||
      event.title?.toLowerCase().includes(searchTerm) ||
      event.location?.toLowerCase().includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  const handleRSVP = async (eventId, status) => {
    setRsvpLoading(eventId);

    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/rsvp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error("RSVP failed");

      toast.success(`RSVP updated to ${status.replace("_", " ")}`);
      setRsvpStatus((current) => ({ ...current, [eventId]: status }));
    } catch (rsvpError) {
      toast.error(rsvpError.message);
    } finally {
      setRsvpLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Campus Events
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Upcoming events and announcements at BUK
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                category === item
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-10 text-center text-gray-500 dark:text-gray-400">
          No upcoming events found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-gray-800 dark:text-white line-clamp-2">
                  {event.title}
                </h3>
                {event.is_featured && (
                  <Star className="w-4 h-4 text-blue-500 flex-shrink-0" />
                )}
              </div>

              <span className="inline-block text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full mb-3">
                {event.category || "General"}
              </span>

              <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(event.event_date)}</span>
                </div>
                {event.start_time && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>
                      {event.start_time}
                      {event.end_time ? ` - ${event.end_time}` : ""}
                    </span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{event.location}</span>
                  </div>
                )}
              </div>

              {event.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                  {event.description}
                </p>
              )}

              <div className="flex gap-2">
                {[
                  ["going", "Going", "bg-green-500 hover:bg-green-600"],
                  ["maybe", "Maybe", "bg-blue-500 hover:bg-blue-600"],
                  ["not_going", "Can't Go", "bg-gray-400 hover:bg-gray-500"],
                ].map(([status, label, color]) => (
                  <button
                    key={status}
                    onClick={() => handleRSVP(event.id, status)}
                    disabled={rsvpLoading === event.id}
                    className={`flex-1 px-3 py-1.5 ${color} disabled:opacity-50 text-white text-xs rounded-lg transition ${
                      rsvpStatus[event.id] === status ? "ring-2 ring-slate-900 ring-offset-1" : ""
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsPage;
