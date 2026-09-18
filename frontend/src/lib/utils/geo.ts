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

export function toLatLng(latitude: string, longitude: string): [number, number] {
  return [Number(latitude), Number(longitude)];
}
