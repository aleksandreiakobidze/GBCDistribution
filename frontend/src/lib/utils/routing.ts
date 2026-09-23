import { haversineKm, type LatLng } from './geo';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const TIMEOUT_MS = 6000;
/** City streets are longer than the straight line, and average speed is low. */
const DETOUR_FACTOR = 1.3;
const CITY_SPEED_KMH = 25;

export type RouteMode = 'road' | 'straight';

export interface RouteLeg {
  km: number;
  min: number;
}

export interface RouteShape {
  mode: RouteMode;
  geometry: LatLng[];
  legs: RouteLeg[];
  totalKm: number;
  totalMin: number;
}

export function straightRoute(points: LatLng[]): RouteShape {
  const legs: RouteLeg[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const km = haversineKm(points[i - 1], points[i]) * DETOUR_FACTOR;
    legs.push({ km, min: (km / CITY_SPEED_KMH) * 60 });
  }

  return {
    mode: 'straight',
    geometry: points,
    legs,
    totalKm: legs.reduce((sum, leg) => sum + leg.km, 0),
    totalMin: legs.reduce((sum, leg) => sum + leg.min, 0),
  };
}

interface OsrmLeg {
  distance?: number;
  duration?: number;
}

interface OsrmRoute {
  distance?: number;
  duration?: number;
  legs?: OsrmLeg[];
  geometry?: { coordinates?: [number, number][] };
}

/** Road geometry from the public OSRM service. Returns null when it is unreachable. */
export async function fetchRoadRoute(points: LatLng[]): Promise<RouteShape | null> {
  if (points.length < 2) {
    return null;
  }
  const path = points.map(([lat, lng]) => `${lng},${lat}`).join(';');
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${OSRM_BASE}/${path}?overview=full&geometries=geojson`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { code?: string; routes?: OsrmRoute[] };
    const route = payload.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (payload.code !== 'Ok' || !route || !coordinates || coordinates.length < 2) {
      return null;
    }

    const legs: RouteLeg[] = (route.legs ?? []).map((leg) => ({
      km: (leg.distance ?? 0) / 1000,
      min: (leg.duration ?? 0) / 60,
    }));

    return {
      mode: 'road',
      geometry: coordinates.map(([lng, lat]) => [lat, lng] as LatLng),
      legs,
      totalKm: (route.distance ?? 0) / 1000,
      totalMin: (route.duration ?? 0) / 60,
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export function formatKm(km: number): string {
  if (km < 10) {
    return km.toFixed(1);
  }
  return String(Math.round(km));
}

export function formatMin(min: number): string {
  return String(Math.max(1, Math.round(min)));
}

/** Google keeps up to 9 intermediate waypoints on a directions link. */
export function googleMapsRouteUrl(origin: LatLng | null, stops: LatLng[]): string {
  if (stops.length === 0) {
    return 'https://www.google.com/maps';
  }
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1).slice(0, 9);
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination[0]},${destination[1]}`,
    travelmode: 'driving',
  });
  if (origin) {
    params.set('origin', `${origin[0]},${origin[1]}`);
  }
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map(([lat, lng]) => `${lat},${lng}`).join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
