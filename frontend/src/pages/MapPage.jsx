import { useEffect, useState } from "react";
import { AlertTriangle, Building2, Home, MapPin, Search } from "lucide-react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";
import CampusMap from "./CampusMap";

const categoryIcons = {
  faculty: Building2,
  department: Building2,
  hostel: Home,
  emergency: AlertTriangle,
};

const categories = [
  { id: "all", label: "All" },
  { id: "faculty", label: "Faculty" },
  { id: "department", label: "Departments" },
  { id: "hostel", label: "Hostels" },
  { id: "emergency", label: "Emergency" },
  { id: "admin", label: "Administration" },
  { id: "other", label: "Facilities" },
];

const MapPage = () => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const { token } = useAuth();
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchLocations = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/campus/locations`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) throw new Error("Failed to load campus locations");

        const data = await response.json();
        setLocations(data.locations ?? []);
      } catch (fetchError) {
        setError(fetchError.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, [token]);

  const searchTerm = search.trim().toLowerCase();
  const filteredLocations = locations.filter((location) => {
    const matchesCategory =
      selectedCategory === "all" ||
      location.category?.toLowerCase() === selectedCategory;
    const matchesSearch =
      !searchTerm ||
      location.name?.toLowerCase().includes(searchTerm) ||
      location.description?.toLowerCase().includes(searchTerm) ||
      location.category?.toLowerCase().includes(searchTerm);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-2 py-3 pb-24 sm:px-4 sm:py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <MapPin className="text-blue-600" size={26} />
          Campus Map
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              isOnline
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {isOnline ? "Online" : "Offline mode"}
          </span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Find departments, hostels, and important places around BUK
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Map tiles are cached only for the BUK campus area as you view them online.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-blue-100 bg-white p-3 shadow-sm sm:mb-5 sm:p-4">
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search for a building or place..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
                selectedCategory === category.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-blue-50"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 bg-white rounded-2xl border border-blue-100 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex h-[min(52dvh,440px)] min-h-[280px] items-center justify-center text-slate-500 sm:h-[min(65vh,600px)]">
            Loading map...
          </div>
        ) : (
          <CampusMap
            locations={filteredLocations}
            selectedLocation={selectedLocation}
            onSelectLocation={setSelectedLocation}
          />
        )}
      </div>

      <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-50">
            <h2 className="font-semibold text-slate-800 text-sm">
              Available locations ({filteredLocations.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 divide-y divide-slate-50 md:grid-cols-2 lg:grid-cols-3">
            {!loading && filteredLocations.length === 0 ? (
              <p className="col-span-full text-center text-sm text-slate-500 py-10">
                No locations found
              </p>
            ) : (
              filteredLocations.map((location) => {
                const Icon =
                  categoryIcons[location.category?.toLowerCase()] || MapPin;

                return (
                  <button
                    key={location.id}
                    onClick={() => setSelectedLocation(location)}
                    className={`w-full text-left px-4 py-3.5 hover:bg-blue-50 transition flex items-start gap-3 ${
                      selectedLocation?.id === location.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <Icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">
                        {location.name}
                      </span>
                      <span className="block text-xs text-slate-500 capitalize mt-0.5">
                        {location.category}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
      </div>

    </div>
  );
};

export default MapPage;
