export type LatLng = [number, number];

export function isPlottableCoord(latitude?: string | null, longitude?: string | null): boolean {
  if (latitude == null || longitude == null || latitude === '' || longitude === '') {
    return false;
  }
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return false;
  }
  return lat !== 0 && lon !== 0;
}

export function toLatLng(latitude: string, longitude: string): LatLng {
  return [Number(latitude), Number(longitude)];
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const earthKm = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function googleMapsDirectionsUrl(latitude: string, longitude: string): string {
  const [lat, lng] = toLatLng(latitude, longitude);
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export interface RoutePoint {
  latitude: string | null;
  longitude: string | null;
}

/** Nearest pinned stop from the origin, then the nearest remaining stop, then unpinned rows. */
export function nearestNeighborOrder<T extends RoutePoint>(origin: LatLng, stops: T[]): T[] {
  const pinned: T[] = [];
  const unpinned: T[] = [];
  for (const stop of stops) {
    if (isPlottableCoord(stop.latitude, stop.longitude)) {
      pinned.push(stop);
    } else {
      unpinned.push(stop);
    }
  }

  const remaining = pinned.slice();
  const ordered: T[] = [];
  let current = origin;
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i += 1) {
      const point = remaining[i];
      const distance = haversineKm(
        current,
        toLatLng(point.latitude as string, point.longitude as string),
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    const next = remaining.splice(bestIndex, 1)[0];
    ordered.push(next);
    current = toLatLng(next.latitude as string, next.longitude as string);
  }

  return [...ordered, ...unpinned];
}
