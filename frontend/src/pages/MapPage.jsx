import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Building2, Home, MapPin, Search, X } from "lucide-react";
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
  const mapSectionRef = useRef(null);

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
  const searchMatches =
    searchTerm &&
    selectedLocation?.name?.toLowerCase() !== searchTerm
      ? filteredLocations.slice(0, 6)
      : [];

  const focusLocation = (location) => {
    setSelectedLocation(location);
    setSearch(location.name);
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const visibleLocations = selectedLocation ? [selectedLocation] : filteredLocations;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-2 py-3 pb-24 text-slate-800 dark:text-slate-100 sm:px-4 sm:py-6">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
          <MapPin className="text-blue-600" size={26} />
          Campus Map
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              isOnline
                ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
            }`}
          >
            {isOnline ? "Online" : "Offline mode"}
          </span>
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Find departments, hostels, and important places around BUK
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Map tiles are cached only for the BUK campus area as you view them online.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="relative z-[500] mb-4 rounded-2xl border border-blue-100 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:mb-5 sm:p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            role="combobox"
            aria-expanded={searchMatches.length > 0}
            aria-controls="campus-location-search-results"
            aria-autocomplete="list"
            type="text"
            placeholder="Search for a building or place..."
            value={search}
            onChange={(event) => {
              const nextSearch = event.target.value;
              const exactMatch = locations.find(
                (location) =>
                  location.name?.trim().toLowerCase() ===
                  nextSearch.trim().toLowerCase(),
              );
              setSearch(nextSearch);
              setSelectedLocation(exactMatch || null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && searchMatches.length > 0) {
                event.preventDefault();
                focusLocation(searchMatches[0]);
              }
              if (event.key === "Escape") setSearch("");
            }}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-11 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-blue-900 sm:text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelectedLocation(null);
              }}
              aria-label="Clear campus location search"
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <X size={16} />
            </button>
          )}
          {searchMatches.length > 0 && (
            <div
              id="campus-location-search-results"
              role="listbox"
              className="absolute left-0 right-0 top-full z-[600] mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            >
              {searchMatches.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  role="option"
                  aria-selected={selectedLocation?.id === location.id}
                  onClick={() => focusLocation(location)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-slate-800"
                >
                  <MapPin size={17} className="shrink-0 text-blue-600" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {location.name}
                    </span>
                    <span className="block truncate text-xs capitalize text-slate-500 dark:text-slate-400">
                      {location.category || "Campus location"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
                selectedCategory === category.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-blue-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={mapSectionRef} className="mb-5 scroll-mt-4 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {loading ? (
          <div className="flex h-[min(52dvh,440px)] min-h-[280px] items-center justify-center text-slate-500 dark:text-slate-400 sm:h-[min(65vh,600px)]">
            Loading map...
          </div>
        ) : (
          <CampusMap
            locations={visibleLocations}
            selectedLocation={selectedLocation}
            onSelectLocation={setSelectedLocation}
            onClearSelection={() => {
              setSelectedLocation(null);
              setSearch("");
            }}
          />
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-blue-50 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {selectedLocation
                ? "Selected location"
                : `Available locations (${filteredLocations.length})`}
            </h2>
          </div>
          <div className="grid grid-cols-1 divide-y divide-slate-50 dark:divide-slate-800 md:grid-cols-2 lg:grid-cols-3">
            {!loading && visibleLocations.length === 0 ? (
              <p className="col-span-full py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No locations found
              </p>
            ) : (
              visibleLocations.map((location) => {
                const Icon =
                  categoryIcons[location.category?.toLowerCase()] || MapPin;

                return (
                  <button
                    key={location.id}
                    onClick={() => focusLocation(location)}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-blue-50 dark:hover:bg-slate-800 ${
                      selectedLocation?.id === location.id ? "bg-blue-50 dark:bg-blue-950/50" : ""
                    }`}
                    aria-pressed={selectedLocation?.id === location.id}
                  >
                    <Icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {location.name}
                      </span>
                      <span className="mt-0.5 block text-xs capitalize text-slate-500 dark:text-slate-400">
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
