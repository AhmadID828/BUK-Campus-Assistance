import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../config";
import {
  Phone,
  Mail,
  MapPin,
  Search,
  Shield,
  Heart,
  Flame,
  Building,
  AlertTriangle,
} from "lucide-react";

const categories = ["All", "Security", "Medical", "Fire", "Admin", "Other"];

const categoryIcons = {
  Security: Shield,
  Medical: Heart,
  Fire: Flame,
  Admin: Building,
  Other: AlertTriangle,
};

const categoryColors = {
  Security: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Medical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  Fire: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Other: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const EmergencyContacts = () => {
  const { token } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchContacts = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/emergency/contacts`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) throw new Error("Failed to load emergency contacts");

        const data = await response.json();
        setContacts(Array.isArray(data) ? data : data.contacts ?? []);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [token]);

  const filteredContacts = contacts.filter((contact) => {
    const matchesCategory =
      activeCategory === "All" ||
      contact.category?.toLowerCase() === activeCategory.toLowerCase();
    const searchTerm = search.trim().toLowerCase();
    const matchesSearch =
      !searchTerm ||
      contact.name?.toLowerCase().includes(searchTerm) ||
      contact.phone?.toLowerCase().includes(searchTerm) ||
      contact.alternative_phone?.toLowerCase().includes(searchTerm) ||
      contact.location?.toLowerCase().includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Emergency Contacts
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Important contacts for safety and support on campus
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              activeCategory === category
                ? "bg-amber-500 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {filteredContacts.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-10 text-center text-gray-500 dark:text-gray-400">
          No emergency contacts found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => {
            const Icon = categoryIcons[contact.category] || AlertTriangle;
            const colorClass =
              categoryColors[contact.category] || categoryColors.Other;

            return (
              <div
                key={contact.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:shadow-md transition"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className={`p-2.5 rounded-xl ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 dark:text-white truncate">
                      {contact.name}
                    </h3>
                    {contact.category && (
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
                        {contact.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 text-sm">
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 transition"
                    >
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">{contact.phone}</span>
                    </a>
                  )}

                  {contact.alternative_phone && (
                    <a
                      href={`tel:${contact.alternative_phone}`}
                      className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-amber-600 transition"
                    >
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{contact.alternative_phone}</span>
                    </a>
                  )}

                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-amber-600 transition"
                    >
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{contact.email}</span>
                    </a>
                  )}

                  {contact.location && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{contact.location}</span>
                    </div>
                  )}

                  {contact.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                      {contact.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmergencyContacts;
