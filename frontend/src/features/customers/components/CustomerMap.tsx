import { useEffect } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils/cn';
import { isPlottableCoord, toLatLng } from '@/lib/utils/geo';

export interface MapPin {
  id: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
}

const TBILISI: [number, number] = [41.7151, 44.8271];

function FitPins({ positions }: { positions: [number, number][] }) {
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

interface CustomerMapProps {
  pins: MapPin[];
  heightClass?: string;
  onPinClick?: (id: string) => void;
  selectedId?: string;
}

export function CustomerMap({ pins, heightClass = 'h-72', onPinClick, selectedId }: CustomerMapProps) {
  const positions = pins
    .filter((p) => isPlottableCoord(p.latitude, p.longitude))
    .map((p) => ({
      ...p,
      latlng: toLatLng(p.latitude as string, p.longitude as string),
    }));

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
        <FitPins positions={positions.map((p) => p.latlng)} />
        {positions.map((pin) => (
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
        ))}
      </MapContainer>
    </div>
  );
}
