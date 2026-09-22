import { useEffect } from 'react';
import { divIcon } from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils/cn';
import { isPlottableCoord, toLatLng, type LatLng } from '@/lib/utils/geo';

export interface MapPin {
  id: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
  order?: number;
}

const TBILISI: LatLng = [41.7151, 44.8271];

function FitPins({ positions }: { positions: LatLng[] }) {
  const map = useMap();
  const key = positions.map((p) => `${p[0]},${p[1]}`).join('|');

  useEffect(() => {
    if (positions.length === 0) {
      map.setView(TBILISI, 8);
      return;
    }
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    map.fitBounds(positions, { padding: [28, 28], maxZoom: 15 });
    // positions is represented by key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}

function stopIcon(order: number) {
  return divIcon({
    className: 'route-stop-marker',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:#1d4ed8;color:#fff;font:700 11px/1 sans-serif;border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.25)">${order}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

interface CustomerMapProps {
  pins: MapPin[];
  heightClass?: string;
  onPinClick?: (id: string) => void;
  selectedId?: string;
  route?: LatLng[];
  origin?: { position: LatLng; label: string } | null;
}

export function CustomerMap({
  pins,
  heightClass = 'h-72',
  onPinClick,
  selectedId,
  route,
  origin,
}: CustomerMapProps) {
  const positions = pins
    .filter((p) => isPlottableCoord(p.latitude, p.longitude))
    .map((p) => ({
      ...p,
      latlng: toLatLng(p.latitude as string, p.longitude as string),
    }));

  const fitPositions = [
    ...(origin ? [origin.position] : []),
    ...(route && route.length > 0 ? route : positions.map((p) => p.latlng)),
  ];

  return (
    <div className={cn('overflow-hidden rounded-xl border border-[var(--color-border)]', heightClass)}>
      <MapContainer
        center={TBILISI}
        zoom={8}
        scrollWheelZoom
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitPins positions={fitPositions} />
        {route && route.length > 1 ? (
          <Polyline positions={route} pathOptions={{ color: '#1d4ed8', weight: 3, opacity: 0.85 }} />
        ) : null}
        {origin ? (
          <CircleMarker
            center={origin.position}
            radius={8}
            pathOptions={{ color: '#15803d', fillColor: '#22c55e', fillOpacity: 0.95, weight: 2 }}
          >
            <Tooltip permanent direction="top" offset={[0, -6]}>
              {origin.label}
            </Tooltip>
          </CircleMarker>
        ) : null}
        {positions.map((pin) =>
          pin.order != null ? (
            <Marker
              key={pin.id}
              position={pin.latlng}
              icon={stopIcon(pin.order)}
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
              eventHandlers={{
                click: () => onPinClick?.(pin.id),
              }}
            >
              <Popup>
                <button
                  type="button"
                  className="text-left text-sm font-medium text-[var(--color-primary)]"
                  onClick={() => onPinClick?.(pin.id)}
                >
                  {pin.name}
                </button>
              </Popup>
            </CircleMarker>
          ),
        )}
      </MapContainer>
    </div>
  );
}
