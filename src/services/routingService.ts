import type { LineString } from 'geojson';
import { API_CONFIG } from '../config/apiConfig';
import {
  HAI_PHONG_FULL_BOUNDS,
  type MapBounds,
} from '../config/mapConfig';
import type { LatLon } from '../types/poi';
import type { RoadDistanceResult, RouteOption, RouteResult } from '../types/route';

interface OsrmRouteResponse {
  code: string;
  routes?: Array<{
    distance: number;
    geometry: LineString;
  }>;
  message?: string;
}

interface OsrmTableResponse {
  code: string;
  distances?: Array<Array<number | null>>;
  message?: string;
}

interface OsrmNearestResponse {
  code: string;
  waypoints?: Array<{
    distance: number;
    location: [number, number];
  }>;
  message?: string;
}

function toCoordPath(position: LatLon) {
  return `${position.lon},${position.lat}`;
}

function buildUrl(path: string, params: Record<string, string>) {
  const url = new URL(`${API_CONFIG.osrm}${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

async function fetchOsrmRoutes(
  coordinates: LatLon[],
  alternatives: string
): Promise<NonNullable<OsrmRouteResponse['routes']>> {
  const path = `/route/v1/driving/${coordinates.map(toCoordPath).join(';')}`;
  const url = buildUrl(path, {
    overview: 'full',
    geometries: 'geojson',
    alternatives,
    steps: 'false',
  });

  const response = await fetch(url);
  assertOk(response, 'OSRM route');

  const data = (await response.json()) as OsrmRouteResponse;

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error(data.message || 'OSRM route did not return a usable road route');
  }

  return data.routes;
}

function assertOk(response: Response, serviceName: string) {
  if (!response.ok) {
    throw new Error(`${serviceName} request failed with ${response.status}`);
  }
}

export function isWithinBounds(position: LatLon, bounds: MapBounds) {
  return (
    position.lat >= bounds.south &&
    position.lat <= bounds.north &&
    position.lon >= bounds.west &&
    position.lon <= bounds.east
  );
}

export function isWithinHaiPhongBounds(position: LatLon) {
  return (
    position.lat >= HAI_PHONG_FULL_BOUNDS.south &&
    position.lat <= HAI_PHONG_FULL_BOUNDS.north &&
    position.lon >= HAI_PHONG_FULL_BOUNDS.west &&
    position.lon <= HAI_PHONG_FULL_BOUNDS.east
  );
}

export function getDistanceMeters(start: LatLon, end: LatLon) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(end.lat - start.lat);
  const dLon = toRadians(end.lon - start.lon);
  const startLat = toRadians(start.lat);
  const endLat = toRadians(end.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(startLat) *
      Math.cos(endLat) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  includeAlternatives = true
): Promise<RouteResult> {
  const start = { lat: startLat, lon: startLon };
  const end = { lat: endLat, lon: endLon };
  const routes = await fetchOsrmRoutes(
    [start, end],
    includeAlternatives ? '3' : 'false'
  );
  const extraRoutes = includeAlternatives
    ? await getDetourRoutes(start, end, routes[0].distance)
    : [];

  const alternatives: RouteOption[] = [...routes, ...extraRoutes]
    .sort((a, b) => a.distance - b.distance)
    .filter(
      (route, index, sortedRoutes) =>
        sortedRoutes.findIndex(
          (item) => Math.abs(item.distance - route.distance) < 10
        ) === index
    )
    .slice(0, 4)
    .map((route, index) => ({
      id: `route-${index + 1}`,
      distanceMeters: route.distance,
      geometry: {
        type: 'Feature',
        properties: {
          routeIndex: index,
          distanceMeters: route.distance,
          isPrimary: index === 0,
        },
        geometry: route.geometry,
      },
    }));
  const bestRoute = alternatives[0];

  return {
    id: bestRoute.id,
    distanceMeters: bestRoute.distanceMeters,
    geometry: bestRoute.geometry,
    alternatives,
  };
}

async function getDetourRoutes(
  start: LatLon,
  end: LatLon,
  bestDistanceMeters: number
) {
  const midpoint = {
    lat: (start.lat + end.lat) / 2,
    lon: (start.lon + end.lon) / 2,
  };
  const offsets = [
    { lat: 0.012, lon: 0 },
    { lat: -0.012, lon: 0 },
    { lat: 0, lon: 0.015 },
    { lat: 0, lon: -0.015 },
    { lat: 0.016, lon: 0.018 },
    { lat: -0.016, lon: -0.018 },
    { lat: 0.022, lon: -0.012 },
    { lat: -0.022, lon: 0.012 },
    { lat: 0.03, lon: 0 },
    { lat: 0, lon: 0.03 },
  ];
  const routes: NonNullable<OsrmRouteResponse['routes']> = [];

  for (const offset of offsets) {
    const via = {
      lat: midpoint.lat + offset.lat,
      lon: midpoint.lon + offset.lon,
    };

    if (!isWithinHaiPhongBounds(via)) {
      continue;
    }

    try {
      const [route] = await fetchOsrmRoutes([start, via, end], 'false');

      if (
        route.distance > bestDistanceMeters + 50 &&
        route.distance < bestDistanceMeters * 5
      ) {
        routes.push(route);
      }
    } catch {
      continue;
    }

    if (routes.length >= 3) {
      break;
    }
  }

  return routes;
}

export async function getRoadDistances<TDestination extends LatLon>(
  start: LatLon,
  destinations: TDestination[]
): Promise<Array<RoadDistanceResult<TDestination>>> {
  if (destinations.length === 0) {
    return [];
  }

  const coordinates = [start, ...destinations].map(toCoordPath).join(';');
  const destinationIndexes = destinations
    .map((_, index) => String(index + 1))
    .join(';');
  const path = `/table/v1/driving/${coordinates}`;
  const url = buildUrl(path, {
    sources: '0',
    destinations: destinationIndexes,
    annotations: 'distance',
  });

  const response = await fetch(url);
  assertOk(response, 'OSRM table');

  const data = (await response.json()) as OsrmTableResponse;
  const distances = data.distances?.[0];

  if (data.code !== 'Ok' || !distances) {
    throw new Error(data.message || 'OSRM table did not return road distances');
  }

  return destinations.map((destination, index) => ({
    destination,
    distanceMeters: distances[index] ?? null,
  }));
}

export async function snapToRoad(position: LatLon): Promise<{
  position: LatLon;
  snapDistanceMeters: number;
}> {
  const path = `/nearest/v1/driving/${toCoordPath(position)}`;
  const url = buildUrl(path, { number: '1' });

  const response = await fetch(url);
  assertOk(response, 'OSRM nearest');

  const data = (await response.json()) as OsrmNearestResponse;
  const waypoint = data.waypoints?.[0];

  if (data.code !== 'Ok' || !waypoint) {
    throw new Error(data.message || 'OSRM nearest did not return a road point');
  }

  const snapped = {
    lon: waypoint.location[0],
    lat: waypoint.location[1],
  };

  if (!isWithinHaiPhongBounds(snapped)) {
    throw new Error('OSRM nearest returned a point outside Hai Phong bounds');
  }

  return {
    position: snapped,
    snapDistanceMeters: waypoint.distance,
  };
}
