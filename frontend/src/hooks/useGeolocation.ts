import { useState, useCallback } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null, longitude: null, error: null, loading: false,
  });

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState(s => ({ ...s, error: 'Geolocation is not supported' }));
      return;
    }
    setState(s => ({ ...s, loading: true }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null, loading: false,
        });
      },
      (error) => {
        setState(s => ({ ...s, error: error.message, loading: false }));
      }
    );
  }, []);

  return { ...state, getPosition };
}
