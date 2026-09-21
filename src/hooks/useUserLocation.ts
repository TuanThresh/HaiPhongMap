import { useCallback, useState } from 'react';
import type { LatLon } from '../types/poi';
import { getCurrentGpsPosition, isGeolocationSupported } from '../services/geolocationService';

interface UserLocationState {
  position: LatLon | null;
  isLoading: boolean;
  errorMessage: string | null;
  isSupported: boolean;
}

export function useUserLocation() {
  const [state, setState] = useState<UserLocationState>({
    position: null,
    isLoading: false,
    errorMessage: null,
    isSupported: isGeolocationSupported(),
  });

  const requestLocation = useCallback(async () => {
    setState((current) => ({
      ...current,
      isLoading: true,
      errorMessage: null,
    }));

    try {
      const position = await getCurrentGpsPosition();
      setState((current) => ({
        ...current,
        position,
        isLoading: false,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoading: false,
        errorMessage:
          error instanceof Error ? error.message : 'Could not read browser location',
      }));
    }
  }, []);

  return {
    ...state,
    requestLocation,
  };
}
