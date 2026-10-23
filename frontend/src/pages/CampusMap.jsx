import { useCallback, useEffect, useState } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { LocateFixed, MapPin, Navigation, X } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const BUK_CENTER = [11.9758, 8.4203];
const DEFAULT_ZOOM = 16;
const TARGET_LOCATION_ACCURACY = 20;
const MAX_LOCATION_ACCURACY = 50;
const LOCATION_TIMEOUT_MS = 20000;

async function getLocationErrorMessage(error) {
  if (!window.isSecureContext) {
    return "Location requires a secure connection. Open this map over HTTPS (or localhost) and try again.";
  }

  if (error?.code === 1) {
    let permissionState;
    try {
      const permission = await navigator.permissions?.query({ name: "geolocation" });
      permissionState = permission?.state;
    } catch (permissionError) {
      console.warn("Unable to inspect the browser's location permission state.", permissionError);
    }

    if (permissionState === "granted") {
      return "Your browser reports location access as allowed, but the device or browser could not provide it. Check your operating system's location services and this site's permission for the current address, then try again.";
    }
    if (permissionState === "prompt") {
      return "Allow location access in the browser prompt for this exact site, then request directions again.";
    }
    return "The browser denied location access for this site. Check the permission for the current site address, allow location, and reload the page. If it is already allowed, check device location services and try again.";
  }

  if (error?.code === 2) {
    return "Your device could not determine a location. Turn on device location services, move somewhere with a clearer GPS signal, and try again.";
  }
  if (error?.code === 3) {
    return "The location request timed out. Check device location services and try again somewhere with a clearer GPS signal.";
  }

  return error?.message || "Could not determine your location. Check that location services are enabled and try again.";
}

function getAccuratePosition() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error("Location requires a secure connection. Open this map over HTTPS (or localhost) and try again."));
      return;
    }

    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    let watchId;
    let bestPosition = null;
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      callback(value);
    };

    const timeoutId = window.setTimeout(() => {
      if (bestPosition) {
        finish(resolve, bestPosition);
        return;
      }
      finish(
        reject,
        new Error("Could not determine your location. Check location services and try again."),
      );
    }, LOCATION_TIMEOUT_MS);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (
          !Number.isFinite(position.coords.latitude) ||
          !Number.isFinite(position.coords.longitude) ||
          !Number.isFinite(position.coords.accuracy)
        ) {
          return;
        }
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }
        if (position.coords.accuracy <= TARGET_LOCATION_ACCURACY) {
          finish(resolve, position);
        }
      },
      (error) => {
        if (error.code === 1) finish(reject, error);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: LOCATION_TIMEOUT_MS },
    );
  });
}

function formatAccuracy(accuracy) {
  return accuracy >= 1000
    ? `±${(accuracy / 1000).toFixed(accuracy >= 10000 ? 0 : 1)} km`
    : `±${Math.round(accuracy)} m`;
}

// Restore Leaflet's default marker assets for Vite builds.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function ChangeView({ location }) {
  const map = useMap();
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  useEffect(() => {
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      map.flyTo([latitude, longitude], 17, { duration: 0.8 });
    }
  }, [latitude, longitude, map]);

  return null;
}

function UserLocationView({ position, following }) {
  const map = useMap();

  useEffect(() => {
    if (position && following) map.panTo(position, { animate: true, duration: 0.4 });
  }, [position, following, map]);

  return null;
}

function MapOriginPicker({ enabled, onPick }) {
  useMapEvents({
    click(event) {
      if (enabled) onPick([event.latlng.lat, event.latlng.lng]);
    },
  });

  return null;
}

function LocateButton({ onLocate }) {
  return (
    <button
      type="button"
      onClick={onLocate}
      className="absolute right-2 top-2 z-[400] flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-md transition hover:bg-blue-50 sm:right-3 sm:top-3"
    >
      <LocateFixed className="h-4 w-4 text-blue-600" />
      My location
    </button>
  );
}

function RouteStepFocus({ step }) {
  const map = useMap();

  useEffect(() => {
    if (step?.location) map.flyTo(step.location, Math.max(map.getZoom(), 17), { duration: 0.5 });
  }, [map, step]);

  return null;
}

function formatDistance(distance) {
  if (distance < 1000) return `${Math.max(10, Math.round(distance / 10) * 10)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

function formatDuration(duration) {
  const minutes = Math.max(1, Math.round(duration / 60));
  return `${minutes} min`;
}

function getStepInstruction(step) {
  const maneuver = step.maneuver || {};
  const modifier = maneuver.modifier?.replace("-", " ");
  const road = step.name ? ` onto ${step.name}` : "";

  if (maneuver.type === "depart") {
    return `Start${modifier ? ` by heading ${modifier}` : ""}${road}`;
  }
  if (maneuver.type === "arrive") return "You have arrived at your destination";
  if (maneuver.type === "roundabout" || maneuver.type === "rotary") {
    return `${maneuver.exit ? `At the roundabout, take exit ${maneuver.exit}` : "At the roundabout, continue"}${road}`;
  }
  if (maneuver.type === "turn") return `Turn ${modifier || "ahead"}${road}`;
  if (maneuver.type === "continue") return `Continue ${modifier || "straight"}${road}`;
  if (maneuver.type === "merge") return `Merge ${modifier || "ahead"}${road}`;
  if (maneuver.type === "fork") return `Keep ${modifier || "ahead"}${road}`;
  return `${modifier ? `Go ${modifier}` : "Continue"}${road}`;
}

function MapSizeInvalidator() {
  const map = useMap();

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
    });
    resizeObserver.observe(map.getContainer());
    map.invalidateSize({ pan: false });

    return () => resizeObserver.disconnect();
  }, [map]);

  return null;
}

function RoutingControl({ from, to, onError, onRoute }) {
  const map = useMap();

  useEffect(() => {
    if (!from || !to) return;

    const controller = new AbortController();
    let routeLine;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20000);

    const loadRoute = async () => {
      try {
        const coordinates = `${from[1]},${from[0]};${to[1]},${to[0]}`;
        const response = await fetch(
          `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`,
          { signal: controller.signal },
        );

        if (!response.ok) throw new Error("Unable to calculate a route.");

        const data = await response.json();
        if (data.code !== "Ok") {
          throw new Error(data.message || "No walkable route was found.");
        }
        const geometry = data.routes?.[0]?.geometry;
        if (!geometry) throw new Error("No walking route was found.");
        const route = data.routes[0];
        const steps = route.legs?.flatMap((leg) => leg.steps || []) || [];
        if (steps.length === 0) throw new Error("The walking service returned no route instructions.");
        onRoute({
          distance: route.distance,
          duration: route.duration,
          steps: steps.map((step) => ({
            distance: step.distance,
            instruction: getStepInstruction(step),
            location: step.maneuver?.location
              ? [step.maneuver.location[1], step.maneuver.location[0]]
              : null,
          })),
        });

        routeLine = L.geoJSON(geometry, {
          style: { color: "#2563eb", weight: 5, opacity: 0.8 },
        }).addTo(map);
        map.fitBounds(routeLine.getBounds(), { padding: [24, 24] });
      } catch (error) {
        if (error.name !== "AbortError") {
          onRoute(null);
          onError(
            error instanceof TypeError
              ? "Walking directions are unavailable. Check your internet connection and try again."
              : error.message,
          );
        } else if (timedOut) {
          onRoute(null);
          onError("Walking route request timed out. Please try again.");
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };

    loadRoute();

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      if (routeLine) map.removeLayer(routeLine);
    };
  }, [from, to, map, onError, onRoute]);

  return null;
}

function CampusMap({
  locations = [],
  selectedLocation = null,
  onSelectLocation,
  onClearSelection,
}) {
  const [destination, setDestination] = useState(null);
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(null);
  const [manualOrigin, setManualOrigin] = useState(false);
  const [choosingOrigin, setChoosingOrigin] = useState(false);
  const [message, setMessage] = useState("");
  const [routeDetails, setRouteDetails] = useState(null);
  const [destinationName, setDestinationName] = useState("");
  const [activeStep, setActiveStep] = useState(-1);
  const [routeLoading, setRouteLoading] = useState(false);
  const [following, setFollowing] = useState(false);

  const stopFollowing = useCallback(() => {
    setFollowing(false);
  }, []);

  // The selected destination is controlled by MapPage; synchronize map-local route state when it changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    stopFollowing();
    setDestination(null);
    setRouteOrigin(null);
    setRouteDetails(null);
    setRouteLoading(false);
    setActiveStep(-1);
    setManualOrigin(false);
    setChoosingOrigin(false);
    setMessage("");
  }, [selectedLocation?.id, stopFollowing]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDirections = useCallback((location) => {
    const target = [Number(location.latitude), Number(location.longitude)];
    if (!target.every(Number.isFinite)) {
      setRouteLoading(false);
      setMessage("This location does not have valid map coordinates.");
      return;
    }

    stopFollowing();
    setRouteDetails(null);
    setRouteLoading(true);
    setRouteOrigin(null);
    setActiveStep(-1);
    setDestinationName(location.name);
    setDestination(target);
    setUserPosition(null);
    setUserAccuracy(null);
    setManualOrigin(false);
    setChoosingOrigin(false);

    getAccuratePosition().then(
      (position) => {
        const origin = [position.coords.latitude, position.coords.longitude];
        setUserPosition(origin);
        setUserAccuracy(position.coords.accuracy);
        setRouteOrigin(origin);
        setMessage(
          `Using available location (${formatAccuracy(position.coords.accuracy)} accuracy). Calculating route to ${location.name}...`,
        );
      },
      async (error) => {
        setRouteLoading(false);
        setMessage(await getLocationErrorMessage(error));
      },
    );
  }, [stopFollowing]);

  const handleLocate = () => {
    setMessage("Getting a precise GPS fix...");
    getAccuratePosition().then(
      (position) => {
        setUserPosition([position.coords.latitude, position.coords.longitude]);
        setUserAccuracy(position.coords.accuracy);
        setMessage(`Your location is shown on the map (accuracy ${formatAccuracy(position.coords.accuracy)}).`);
      },
      async (error) => setMessage(await getLocationErrorMessage(error)),
    );
  };

  const handleRouteError = useCallback((error) => {
    setRouteLoading(false);
    setMessage(error);
  }, []);

  const handleRoute = useCallback((route) => {
    setRouteLoading(false);
    setRouteDetails(route);
    setActiveStep(-1);
    if (route) {
      setMessage(
        manualOrigin
          ? "Walking route ready from your selected start point. Follow the steps manually."
          : "Walking route ready. Start navigation when you are ready.",
      );
    }
  }, [manualOrigin]);

  const handleManualOriginPick = useCallback((origin) => {
    stopFollowing();
    setUserPosition(origin);
    setUserAccuracy(null);
    setRouteOrigin(origin);
    setManualOrigin(true);
    setChoosingOrigin(false);
    setRouteDetails(null);
    setRouteLoading(true);
    setActiveStep(-1);
    setMessage("Start point selected. Calculating walking directions...");
  }, [stopFollowing]);

  const handleManualOriginDrag = (event) => {
    const { lat, lng } = event.target.getLatLng();
    handleManualOriginPick([lat, lng]);
    setMessage("Start point moved. Recalculating walking directions...");
  };

  const chooseManualOrigin = (location) => {
    const target = [Number(location.latitude), Number(location.longitude)];
    if (!target.every(Number.isFinite)) {
      setMessage("This location does not have valid map coordinates.");
      return;
    }

    stopFollowing();
    setRouteOrigin(null);
    setRouteDetails(null);
    setRouteLoading(false);
    setActiveStep(-1);
    setUserPosition(null);
    setUserAccuracy(null);
    setManualOrigin(false);
    setDestination(target);
    setDestinationName(location.name);
    setChoosingOrigin(true);
    setMessage("Click your starting point on the map. You can drag its marker to adjust it.");
  };

  const startFollowing = () => {
    if (!routeDetails?.steps.length) return;
    if (manualOrigin) {
      setActiveStep((step) => (step < 0 ? 0 : step));
      setMessage("This route starts from a manually selected point. Follow the directions below.");
      return;
    }
    if (userAccuracy > MAX_LOCATION_ACCURACY) {
      setActiveStep((step) => (step < 0 ? 0 : step));
      setMessage("Location accuracy is low. Follow the route steps manually, or select a start point on the map for a more useful route.");
      return;
    }
    if (!navigator.geolocation) {
      setActiveStep((step) => (step < 0 ? 0 : step));
      setMessage("Live navigation needs browser location access. You can still follow the steps manually.");
      return;
    }

    setActiveStep((step) => (step < 0 ? 0 : step));
    setFollowing(true);
    setMessage("Live walking navigation started. Keep this page open while you walk.");
  };

  useEffect(() => {
    if (!following || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (position.coords.accuracy > MAX_LOCATION_ACCURACY) return;
        const currentPosition = [position.coords.latitude, position.coords.longitude];
        setUserPosition(currentPosition);
        setUserAccuracy(position.coords.accuracy);

        if (!routeDetails?.steps.length || activeStep < 0) return;
        const isFinalStep = activeStep >= routeDetails.steps.length - 1;
        const nextIndex = activeStep + 1;
        const nextLocation = isFinalStep
          ? destination
          : routeDetails.steps[nextIndex]?.location;
        if (!nextLocation) return;

        const toRadians = (degrees) => (degrees * Math.PI) / 180;
        const [lat1, lon1] = currentPosition.map(toRadians);
        const [lat2, lon2] = nextLocation.map(toRadians);
        const deltaLat = lat2 - lat1;
        const deltaLon = lon2 - lon1;
        const haversine =
          Math.sin(deltaLat / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
        const distance = 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

        if (distance <= 30) {
          if (isFinalStep) {
            setFollowing(false);
            setMessage("You have arrived at your destination.");
          } else {
            setActiveStep(nextIndex);
            setMessage(routeDetails.steps[nextIndex].instruction);
          }
        }
      },
      (error) => {
        setFollowing(false);
        setActiveStep((step) => (step < 0 ? 0 : step));
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location access was denied. Continue using the directions manually."
            : "Live location was lost. Continue using the directions manually.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeStep, destination, following, routeDetails]);

  const followNextStep = () => {
    if (!routeDetails?.steps?.length) return;
    const nextStep = Math.min(activeStep + 1, routeDetails.steps.length - 1);
    setActiveStep(nextStep);
    setMessage(routeDetails.steps[nextStep].instruction);
  };

  const followPreviousStep = () => {
    if (!routeDetails?.steps?.length) return;
    const previousStep = Math.max(activeStep - 1, 0);
    setActiveStep(previousStep);
    setMessage(routeDetails.steps[previousStep].instruction);
  };

  const selectStep = (index) => {
    setActiveStep(index);
    setMessage(routeDetails.steps[index].instruction);
  };

  const clearRoute = () => {
    stopFollowing();
    setRouteOrigin(null);
    setDestination(null);
    setRouteDetails(null);
    setRouteLoading(false);
    setActiveStep(-1);
    setManualOrigin(false);
    setChoosingOrigin(false);
    if (manualOrigin) {
      setUserPosition(null);
      setUserAccuracy(null);
    }
    setMessage("");
  };

  const handleSelect = (location) => {
    onSelectLocation?.(location);
  };

  return (
    <section className="app-card">
      <div className="panel-card">
        {message && (
          <div
            role="status"
            className={`mb-3 rounded-xl border px-4 py-3 text-sm ${
              routeLoading
                ? "border-blue-100 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200"
                : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {routeLoading && (
              <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent align-[-2px]" />
            )}
            {message}
          </div>
        )}

        {selectedLocation && (
          <div className="mb-3 flex min-w-0 flex-col gap-3 rounded-xl border border-blue-100 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{selectedLocation.name}</p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {selectedLocation.description || "Campus destination"}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => handleDirections(selectedLocation)}
                disabled={routeLoading}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 sm:px-4"
              >
                <Navigation className="h-4 w-4" />
                {routeLoading ? "Finding route..." : "Get directions"}
              </button>
              <button
                type="button"
                onClick={() => chooseManualOrigin(selectedLocation)}
                disabled={routeLoading}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-blue-300 dark:hover:bg-slate-800 sm:px-4"
              >
                <MapPin className="h-4 w-4" />
                Choose start on map
              </button>
              <button
                type="button"
                onClick={() => {
                  clearRoute();
                  onClearSelection?.();
                }}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:px-4"
              >
                <X className="h-4 w-4" />
                Show all places
              </button>
            </div>
          </div>
        )}

        <div className={routeDetails ? "grid grid-cols-1 gap-4 lg:grid-cols-3" : ""}>
          {routeDetails && (
            <div className="order-2 min-w-0 rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-slate-700 dark:bg-slate-800 sm:p-4 lg:order-2 lg:col-span-1 lg:col-start-3 lg:row-start-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Directions to {destinationName}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Walking · {formatDistance(routeDetails.distance)} · {formatDuration(routeDetails.duration)}
                  {manualOrigin
                    ? " · Selected start point"
                    : userAccuracy != null && ` · GPS ${formatAccuracy(userAccuracy)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-slate-900 dark:text-blue-300">
                  {following ? "Navigating" : activeStep < 0 ? "Ready" : `Step ${activeStep + 1}/${routeDetails.steps.length}`}
                </span>
                <button
                  type="button"
                  onClick={clearRoute}
                  className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                  aria-label="Clear directions"
                  title="Clear directions"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {activeStep >= 0 && routeDetails.steps[activeStep] && (
              <div className="mt-3 rounded-xl border border-blue-300 bg-white p-3 shadow-sm dark:border-blue-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Current direction
                </p>
                <p className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">
                  {routeDetails.steps[activeStep].instruction}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Segment distance: {formatDistance(routeDetails.steps[activeStep].distance)}
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={followPreviousStep}
                disabled={activeStep <= 0 || following}
                className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={following ? stopFollowing : startFollowing}
                disabled={manualOrigin && following}
                className={`rounded-lg px-3 py-2 text-xs font-medium text-white transition ${
                  following
                    ? "bg-slate-600 hover:bg-slate-700"
                    : "bg-blue-600 hover:bg-blue-700"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {following ? "Stop live navigation" : manualOrigin ? "Follow directions" : "Start live navigation"}
              </button>
              <button
                type="button"
                onClick={followNextStep}
                disabled={activeStep >= routeDetails.steps.length - 1}
                className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {activeStep < 0 ? "Show first step" : "Next direction"}
              </button>
            </div>

            <ol className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1 sm:max-h-56" aria-label="Route steps">
              {routeDetails.steps.map((step, index) => (
                <li
                  key={`${step.instruction}-${index}`}
                  className={`rounded-lg transition ${
                    activeStep === index
                    ? "border border-blue-300 bg-blue-100 shadow-sm dark:border-blue-700 dark:bg-blue-950/60"
                    : "bg-white dark:bg-slate-900"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectStep(index)}
                    className="flex w-full items-start gap-3 p-2.5 text-left"
                    aria-label={`Show route step ${index + 1}`}
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-slate-700 dark:text-slate-200">{step.instruction}</span>
                    <span className="whitespace-nowrap text-xs font-medium text-blue-700 dark:text-blue-300">
                      {formatDistance(step.distance)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            </div>
          )}

        <div className={`relative order-1 h-[min(52dvh,440px)] min-h-[280px] w-full min-w-0 overflow-hidden rounded-xl sm:h-[min(65vh,600px)] ${routeDetails ? "lg:order-1 lg:col-span-2 lg:col-start-1 lg:row-start-1" : ""}`}>
          <LocateButton onLocate={handleLocate} />
          {choosingOrigin && (
            <div className="absolute left-2 top-2 z-[400] max-w-[calc(100%-4.5rem)] rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-md dark:bg-slate-900 dark:text-slate-200 sm:left-3 sm:top-3">
              Click the map to choose your start point
              <button
                type="button"
                onClick={() => {
                  setChoosingOrigin(false);
                  setMessage("");
                }}
                className="ml-2 font-semibold text-blue-700 underline dark:text-blue-300"
              >
                Cancel
              </button>
            </div>
          )}
          <MapContainer
            center={BUK_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: "100%", width: "100%" }}
          >
            <MapSizeInvalidator />
            <MapOriginPicker enabled={choosingOrigin} onPick={handleManualOriginPick} />
            {selectedLocation && <ChangeView location={selectedLocation} />}
            <UserLocationView position={userPosition} following={following} />
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {locations.map((location) => (
              <Marker
                key={location.id}
                position={[parseFloat(location.latitude), parseFloat(location.longitude)]}
                eventHandlers={{
                  click: (event) => choosingOrigin
                    ? handleManualOriginPick([event.latlng.lat, event.latlng.lng])
                    : handleSelect(location),
                }}
              >
                <Popup>
                  <strong>{location.name}</strong><br />
                  <span>{location.category}</span><br />
                  <button type="button" className="secondary" onClick={() => handleSelect(location)}>
                    Select destination
                  </button>
                </Popup>
              </Marker>
            ))}
            {userPosition && userAccuracy != null && (
              <Circle
                center={userPosition}
                radius={userAccuracy}
                pathOptions={{
                  color: "#2563eb",
                  weight: 1,
                  fillColor: "#3b82f6",
                  fillOpacity: 0.12,
                }}
              />
            )}
            {userPosition && (
              manualOrigin ? (
                <Marker
                  position={userPosition}
                  draggable
                  eventHandlers={{ dragend: handleManualOriginDrag }}
                >
                  <Popup>Selected start point · drag to adjust</Popup>
                </Marker>
              ) : (
                <CircleMarker
                  center={userPosition}
                  radius={8}
                  pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
                >
                  <Popup>
                    Your current location
                    {userAccuracy != null && <><br />Reported accuracy: {formatAccuracy(userAccuracy)}</>}
                  </Popup>
                </CircleMarker>
              )
            )}
            {destination && (
              <Marker position={destination}>
                <Popup>{destinationName}</Popup>
              </Marker>
            )}
            <RoutingControl
              from={routeOrigin}
              to={destination}
              onError={handleRouteError}
              onRoute={handleRoute}
            />
            {activeStep >= 0 && routeDetails?.steps[activeStep] && (
              <RouteStepFocus step={routeDetails.steps[activeStep]} />
            )}
          </MapContainer>
        </div>
        </div>
      </div>
    </section>
  );
}
export default CampusMap;
