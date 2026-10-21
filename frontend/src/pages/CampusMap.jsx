import { useCallback, useEffect, useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { LocateFixed, Navigation, X } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const BUK_CENTER = [11.9758, 8.4203];
const DEFAULT_ZOOM = 16;

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

function LocateButton({ onLocate }) {
  return (
    <button
      type="button"
      onClick={onLocate}
      className="absolute right-3 top-3 z-[400] flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-md transition hover:bg-blue-50"
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
}) {
  const [destination, setDestination] = useState(null);
  const [routeOrigin, setRouteOrigin] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
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

    if (userPosition) {
      setRouteOrigin(userPosition);
      setMessage(`Calculating route to ${location.name}...`);
      return;
    }

    if (!navigator.geolocation) {
      setRouteLoading(false);
      setMessage("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = [position.coords.latitude, position.coords.longitude];
        setUserPosition(origin);
        setRouteOrigin(origin);
        setMessage(`Calculating route to ${location.name}...`);
      },
      (error) => {
        setRouteLoading(false);
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location access was denied. Allow it in browser settings to get walking directions."
            : "Could not determine your location. Check location services and try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }, [stopFollowing, userPosition]);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setMessage("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition([position.coords.latitude, position.coords.longitude]);
        setMessage("Your location is shown on the map.");
      },
      (error) => setMessage(
        error.code === error.PERMISSION_DENIED
          ? "Location access was denied. Allow it in browser settings."
          : "Could not get your location. Check that location services are enabled.",
      ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
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
    if (route) setMessage("Walking route ready. Start navigation when you are ready.");
  }, []);

  const startFollowing = () => {
    if (!routeDetails?.steps.length) return;
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
        const currentPosition = [position.coords.latitude, position.coords.longitude];
        setUserPosition(currentPosition);

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
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
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
                ? "border-blue-100 bg-blue-50 text-blue-800"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {routeLoading && (
              <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent align-[-2px]" />
            )}
            {message}
          </div>
        )}

        {selectedLocation && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-blue-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">{selectedLocation.name}</p>
              <p className="mt-0.5 text-sm text-slate-500">
                {selectedLocation.description || "Campus destination"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDirections(selectedLocation)}
              disabled={routeLoading}
              className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            >
              <Navigation className="h-4 w-4" />
              {routeLoading ? "Finding walking route..." : "Get walking directions"}
            </button>
          </div>
        )}

        <div className={routeDetails ? "grid grid-cols-1 gap-4 lg:grid-cols-3" : ""}>
          {routeDetails && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 lg:col-span-1 lg:col-start-3 lg:row-start-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-800">Directions to {destinationName}</h3>
                <p className="text-xs text-slate-500">
                  Walking · {formatDistance(routeDetails.distance)} · {formatDuration(routeDetails.duration)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-700">
                  {following ? "Navigating" : activeStep < 0 ? "Ready" : `Step ${activeStep + 1}/${routeDetails.steps.length}`}
                </span>
                <button
                  type="button"
                  onClick={clearRoute}
                  className="rounded-lg p-1 text-slate-500 transition hover:bg-white hover:text-slate-800"
                  aria-label="Clear directions"
                  title="Clear directions"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {activeStep >= 0 && routeDetails.steps[activeStep] && (
              <div className="mt-3 rounded-xl border border-blue-300 bg-white p-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Current direction
                </p>
                <p className="mt-1 text-base font-semibold text-slate-800">
                  {routeDetails.steps[activeStep].instruction}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Segment distance: {formatDistance(routeDetails.steps[activeStep].distance)}
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={followPreviousStep}
                disabled={activeStep <= 0 || following}
                className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={following ? stopFollowing : startFollowing}
                className={`rounded-lg px-3 py-2 text-xs font-medium text-white transition ${
                  following
                    ? "bg-slate-600 hover:bg-slate-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {following ? "Stop live navigation" : "Start live navigation"}
              </button>
              <button
                type="button"
                onClick={followNextStep}
                disabled={activeStep >= routeDetails.steps.length - 1}
                className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {activeStep < 0 ? "Show first step" : "Next direction"}
              </button>
            </div>

            <ol className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1" aria-label="Route steps">
              {routeDetails.steps.map((step, index) => (
                <li
                  key={`${step.instruction}-${index}`}
                  className={`rounded-lg transition ${
                    activeStep === index
                      ? "border border-blue-300 bg-blue-100 shadow-sm"
                      : "bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectStep(index)}
                    className="flex w-full items-start gap-3 p-2.5 text-left"
                    aria-label={`Show route step ${index + 1}`}
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-slate-700">{step.instruction}</span>
                    <span className="whitespace-nowrap text-xs font-medium text-blue-700">
                      {formatDistance(step.distance)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            </div>
          )}

        <div className={`relative h-[55dvh] min-h-[320px] max-h-[560px] overflow-hidden rounded-xl sm:h-[min(65vh,600px)] ${routeDetails ? "lg:col-span-2 lg:col-start-1 lg:row-start-1" : ""}`}>
          <LocateButton onLocate={handleLocate} />
          <MapContainer
            center={BUK_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: "100%", width: "100%" }}
          >
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
                eventHandlers={{ click: () => handleSelect(location) }}
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
            {userPosition && (
              <CircleMarker
                center={userPosition}
                radius={8}
                pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
              >
                <Popup>Your current location</Popup>
              </CircleMarker>
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
