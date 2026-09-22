import type { Feature, FeatureCollection, LineString } from 'geojson';
import { API_CONFIG } from '../config/apiConfig';
import {
  HAI_PHONG_CENTER_BOUNDS,
  type MapBounds,
} from '../config/mapConfig';
import {
  ONE_WAY_WARNING_ROADS,
  type OneWayWarningRoad,
} from '../data/oneWayWarningRoads';

interface OverpassWay {
  type: 'way';
  id: number;
  geometry?: Array<{
    lat: number;
    lon: number;
  }>;
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassWay[];
}

export interface OneWayWarningRoadProperties {
  id: string;
  label: string;
  direction: string;
  scope: string;
  osmName: string;
  osmWayId: number;
}

export type OneWayWarningRoadFeature = Feature<
  LineString,
  OneWayWarningRoadProperties
>;

export type OneWayWarningRoadFeatureCollection = FeatureCollection<
  LineString,
  OneWayWarningRoadProperties
>;

const emptyOneWayWarningRoads: OneWayWarningRoadFeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

function getQueryBounds(bounds: MapBounds) {
  return `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
}

function getOneWayWarningRoadQuery(bounds: MapBounds) {
  const bbox = getQueryBounds(bounds);
  const names = ONE_WAY_WARNING_ROADS.flatMap((road) => road.matchNames);
  const clauses = names
    .map((name) => `way["highway"]["name"="${name}"](${bbox});`)
    .join('\n');

  return `
    [out:json][timeout:25];
    (
      ${clauses}
    );
    out geom tags;
  `;
}

function findRoadByOsmName(name: string | undefined): OneWayWarningRoad | null {
  if (!name) {
    return null;
  }

  return (
    ONE_WAY_WARNING_ROADS.find((road) => road.matchNames.includes(name)) ?? null
  );
}

function toFeature(way: OverpassWay): OneWayWarningRoadFeature | null {
  const road = findRoadByOsmName(way.tags?.name);
  const coordinates =
    way.geometry?.map((point) => [point.lon, point.lat] as [number, number]) ??
    [];

  if (!road || coordinates.length < 2) {
    return null;
  }

  return {
    type: 'Feature',
    properties: {
      id: road.id,
      label: road.label,
      direction: road.direction,
      scope: road.scope,
      osmName: way.tags?.name ?? road.label,
      osmWayId: way.id,
    },
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };
}

export async function getOneWayWarningRoadFeatures(
  signal?: AbortSignal
): Promise<OneWayWarningRoadFeatureCollection> {
  const response = await fetch(API_CONFIG.overpass, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: new URLSearchParams({
      data: getOneWayWarningRoadQuery(HAI_PHONG_CENTER_BOUNDS),
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Overpass one-way road request failed with ${response.status}`);
  }

  const data = (await response.json()) as OverpassResponse;
  const seen = new Set<number>();
  const features: OneWayWarningRoadFeature[] = [];

  for (const element of data.elements ?? []) {
    if (element.type !== 'way' || seen.has(element.id)) {
      continue;
    }

    seen.add(element.id);

    const feature = toFeature(element);

    if (feature) {
      features.push(feature);
    }
  }

  return {
    ...emptyOneWayWarningRoads,
    features,
  };
}

export function getEmptyOneWayWarningRoadFeatures() {
  return emptyOneWayWarningRoads;
}
