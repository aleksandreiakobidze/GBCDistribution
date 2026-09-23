import { useEffect, useRef } from 'react';
import { divIcon, type Map as LeafletMap } from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils/cn';
import { isPlottableCoord, toLatLng, type LatLng } from '@/lib/utils/geo';
import { googleMapsRouteUrl } from '@/lib/utils/routing';
import type { RouteDirections } from '@/hooks/useRouteDirections';
import { DirectionsPanel } from './DirectionsPanel';

export interface MapPin {
  id: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
  order?: number;
}

export interface VisitMapPin {
  id: string;
  name: string;
  latitude: string;
  longitude: string;
  label: string;
  status: 'open' | 'arrived' | 'missed';
}

const TBILISI: LatLng = [41.7151, 44.8271];

function fitMap(map: LeafletMap, positions: LatLng[]) {
  if (positions.length === 0) {
    map.setView(TBILISI, 8);
    return;
  }
  if (positions.length === 1) {
    map.setView(positions[0], 14);
    return;
  }
  map.fitBounds(positions, { padding: [28, 28], maxZoom: 15 });
}

function FitPins({ positions, mapRef }: { positions: LatLng[]; mapRef: React.MutableRefObject<LeafletMap | null> }) {
  const map = useMap();
  const key = positions.map((p) => `${p[0]},${p[1]}`).join('|');

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  useEffect(() => {
    fitMap(map, positions);
    // positions is represented by key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

function stopIcon(order: number, done: boolean, active: boolean) {
  const background = done ? '#16a34a' : active ? '#1d4ed8' : '#2563eb';
  const size = active ? 26 : 22;
  return divIcon({
    className: 'route-stop-marker',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${background};color:#fff;font:700 11px/1 sans-serif;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)">${order}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface CustomerMapProps {
  pins: MapPin[];
  heightClass?: string;
  onPinClick?: (id: string) => void;
  selectedId?: string;
  route?: LatLng[];
  origin?: { position: LatLng; label: string } | null;
  visitPins?: VisitMapPin[];
  directions?: RouteDirections | null;
  className?: string;
}

export function CustomerMap({
  pins,
  heightClass = 'h-72',
  onPinClick,
  selectedId,
  route,
  origin,
  visitPins = [],
  directions,
  className,
}: CustomerMapProps) {
  const { t } = useTranslation();
  const mapRef = useRef<LeafletMap | null>(null);

  const positions = pins
    .filter((p) => isPlottableCoord(p.latitude, p.longitude))
    .map((p) => ({
      ...p,
      latlng: toLatLng(p.latitude as string, p.longitude as string),
    }));

  const visits = visitPins
    .filter((pin) => isPlottableCoord(pin.latitude, pin.longitude))
    .map((pin) => ({ ...pin, latlng: toLatLng(pin.latitude, pin.longitude) }));

  const directionStops = directions?.stops ?? [];
  const line = directions?.shape?.geometry ?? route;
  const originPoint = origin ?? (directions?.origin
    ? { position: directions.origin, label: t('directions.youAreHere', 'You are here') }
    : null);

  const fitPositions = [
    ...(originPoint ? [originPoint.position] : []),
    ...(line && line.length > 0 ? line : positions.map((p) => p.latlng)),
    ...visits.map((pin) => pin.latlng),
    ...directionStops.map((stop) => stop.position),
  ];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-[var(--color-border)]',
        heightClass,
        className,
      )}
    >
      <MapContainer center={TBILISI} zoom={8} scrollWheelZoom className="h-full w-full" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitPins positions={fitPositions} mapRef={mapRef} />
        {line && line.length > 1 ? (
          <>
            <Polyline positions={line} pathOptions={{ color: '#1d4ed8', weight: 7, opacity: 0.18 }} />
            <Polyline
              positions={line}
              pathOptions={{
                color: '#1d4ed8',
                weight: 4,
                opacity: 0.9,
                dashArray: directions?.mode === 'straight' ? '7 7' : undefined,
              }}
            />
          </>
        ) : null}
        {visits.map((pin) => (
          <CircleMarker
            key={`visit-${pin.id}`}
            center={pin.latlng}
            radius={11}
            pathOptions={{
              color: pin.status === 'missed' ? '#b45309' : pin.status === 'open' ? '#1d4ed8' : '#15803d',
              fillColor: pin.status === 'missed' ? '#f59e0b' : pin.status === 'open' ? '#3b82f6' : '#22c55e',
              fillOpacity: 0.95,
              weight: 2,
            }}
            eventHandlers={{ click: () => onPinClick?.(pin.id) }}
          >
            <Popup>
              <span className="block text-sm font-medium">{pin.label}</span>
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-[var(--color-primary)]"
                onClick={() =>
                  window.open(googleMapsRouteUrl(null, [pin.latlng]), '_blank', 'noopener,noreferrer')
                }
              >
                {t('directions.open', 'Directions')}
              </button>
            </Popup>
          </CircleMarker>
        ))}
        {originPoint ? (
          <CircleMarker
            center={originPoint.position}
            radius={8}
            pathOptions={{ color: '#15803d', fillColor: '#22c55e', fillOpacity: 0.95, weight: 2 }}
          >
            <Tooltip permanent direction="top" offset={[0, -6]}>
              {originPoint.label}
            </Tooltip>
          </CircleMarker>
        ) : null}
        {directionStops.map((stop) => (
          <Marker
            key={`stop-${stop.id}`}
            position={stop.position}
            icon={stopIcon(stop.order, stop.done, stop.id === selectedId)}
            eventHandlers={{ click: () => onPinClick?.(stop.id) }}
          >
            <Popup>
              <button
                type="button"
                className="block text-left text-sm font-medium text-[var(--color-primary)]"
                onClick={() => onPinClick?.(stop.id)}
              >
                {stop.order}. {stop.name}
              </button>
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-[var(--color-primary)]"
                onClick={() =>
                  window.open(
                    googleMapsRouteUrl(directions?.origin ?? null, [stop.position]),
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                {t('directions.open', 'Directions')}
              </button>
            </Popup>
          </Marker>
        ))}
        {directionStops.length === 0 &&
          positions.map((pin) =>
            pin.order != null ? (
              <Marker
                key={pin.id}
                position={pin.latlng}
                icon={stopIcon(pin.order, false, pin.id === selectedId)}
                eventHandlers={{ click: () => onPinClick?.(pin.id) }}
              >
                <Popup>
                  <button
                    type="button"
                    className="text-left text-sm font-medium text-[var(--color-primary)]"
                    onClick={() => onPinClick?.(pin.id)}
                  >
                    {pin.order}. {pin.name}
                  </button>
                </Popup>
              </Marker>
            ) : (
              <CircleMarker
                key={pin.id}
                center={pin.latlng}
                radius={pin.id === selectedId ? 10 : 8}
                pathOptions={{
                  color: pin.id === selectedId ? '#1d4ed8' : '#2563eb',
                  fillColor: pin.id === selectedId ? '#1d4ed8' : '#3b82f6',
                  fillOpacity: 0.9,
                  weight: 2,
                }}
                eventHandlers={{ click: () => onPinClick?.(pin.id) }}
              >
                <Popup>
                  <button
                    type="button"
                    className="block text-left text-sm font-medium text-[var(--color-primary)]"
                    onClick={() => onPinClick?.(pin.id)}
                  >
                    {pin.name}
                  </button>
                  <button
                    type="button"
                    className="mt-1 text-xs font-semibold text-[var(--color-primary)]"
                    onClick={() =>
                      window.open(googleMapsRouteUrl(null, [pin.latlng]), '_blank', 'noopener,noreferrer')
                    }
                  >
                    {t('directions.open', 'Directions')}
                  </button>
                </Popup>
              </CircleMarker>
            ),
          )}
      </MapContainer>
      {directions && directions.stops.length > 0 ? (
        <DirectionsPanel
          directions={directions}
          activeId={selectedId}
          onStopClick={onPinClick}
          onRecenter={() => {
            if (mapRef.current) {
              fitMap(mapRef.current, fitPositions);
            }
          }}
        />
      ) : null}
    </div>
  );
}
