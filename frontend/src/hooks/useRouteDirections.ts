import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isPlottableCoord, toLatLng, type LatLng } from '@/lib/utils/geo';
import { fetchRoadRoute, straightRoute, type RouteMode, type RouteShape } from '@/lib/utils/routing';

export interface DirectionsStopInput {
  id: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
  done?: boolean;
}

export interface DirectionsStop {
  id: string;
  name: string;
  position: LatLng;
  order: number;
  km: number | null;
  min: number | null;
  done: boolean;
}

export interface RouteDirections {
  origin: LatLng | null;
  stops: DirectionsStop[];
  shape: RouteShape | null;
  mode: RouteMode;
  requestedMode: RouteMode;
  setMode: (mode: RouteMode) => void;
  loading: boolean;
  roadUnavailable: boolean;
  totalKm: number;
  totalMin: number;
}

interface Options {
  origin: LatLng | null;
  stops: DirectionsStopInput[];
  enabled?: boolean;
}

/** Road geometry when OSRM answers, straight segments otherwise. */
export function useRouteDirections({ origin, stops, enabled = true }: Options): RouteDirections {
  const [requestedMode, setRequestedMode] = useState<RouteMode>('road');

  const plotted = useMemo(
    () => stops.filter((stop) => isPlottableCoord(stop.latitude, stop.longitude)),
    [stops],
  );

  const points = useMemo<LatLng[]>(() => {
    const list = plotted.map((stop) => toLatLng(stop.latitude as string, stop.longitude as string));
    return origin ? [origin, ...list] : list;
  }, [origin, plotted]);

  const key = points.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(';');
  const wantsRoad = enabled && requestedMode === 'road' && points.length > 1;

  const roadQuery = useQuery({
    queryKey: ['road-route', key],
    queryFn: () => fetchRoadRoute(points),
    enabled: wantsRoad,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const roadUnavailable = wantsRoad && roadQuery.isFetched && roadQuery.data == null;

  useEffect(() => {
    if (roadUnavailable) {
      setRequestedMode('straight');
    }
  }, [roadUnavailable]);

  const shape = useMemo<RouteShape | null>(() => {
    if (points.length < 2) {
      return null;
    }
    if (requestedMode === 'road' && roadQuery.data) {
      return roadQuery.data;
    }
    return straightRoute(points);
  }, [points, requestedMode, roadQuery.data]);

  const stopsWithLegs = useMemo<DirectionsStop[]>(() => {
    const legs = shape?.legs ?? [];
    const offset = origin ? 0 : 1;
    return plotted.map((stop, index) => {
      const leg = legs[index - offset];
      return {
        id: stop.id,
        name: stop.name,
        position: toLatLng(stop.latitude as string, stop.longitude as string),
        order: index + 1,
        km: leg ? leg.km : null,
        min: leg ? leg.min : null,
        done: Boolean(stop.done),
      };
    });
  }, [origin, plotted, shape]);

  return {
    origin,
    stops: stopsWithLegs,
    shape,
    mode: shape?.mode ?? 'straight',
    requestedMode,
    setMode: setRequestedMode,
    loading: roadQuery.isFetching,
    roadUnavailable,
    totalKm: shape?.totalKm ?? 0,
    totalMin: shape?.totalMin ?? 0,
  };
}
