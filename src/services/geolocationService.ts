import type { LatLon } from '../types/poi';

export function isGeolocationSupported() {
  return 'geolocation' in navigator;
}

export function getCurrentGpsPosition(): Promise<LatLon> {
  if (!isGeolocationSupported()) {
    return Promise.reject(new Error('Browser geolocation is not supported'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      }
    );
  });
}
