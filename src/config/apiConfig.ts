export const API_CONFIG = {
  openFreeMapStyle: 'https://tiles.openfreemap.org/styles/liberty',
  overpass: import.meta.env.DEV
    ? '/overpass/api/interpreter'
    : 'https://overpass.openstreetmap.fr/api/interpreter',
  osrm: 'https://router.project-osrm.org',
};
