import { API_CONFIG } from '../config/apiConfig';
import {
  type MapBounds,
  getEffectiveSpawnBounds,
} from '../config/mapConfig';
import { FIXED_ADDRESS_POINTS } from '../data/fixedAddresses';
import type { GameSettings } from '../types/game';
import type { LatLon, Poi } from '../types/poi';
import { getDistanceMeters, isWithinBounds } from './routingService';

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: LatLon;
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

const addressCache = new Map<string, Poi[]>();

function normalizedText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getBoundsKey(bounds: MapBounds) {
  return [
    bounds.south.toFixed(4),
    bounds.west.toFixed(4),
    bounds.north.toFixed(4),
    bounds.east.toFixed(4),
  ].join(',');
}

function getAddressOverpassQuery(bounds: MapBounds) {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;

  return `
    [out:json][timeout:25];
    (
      node["addr:housenumber"]["addr:street"](${bbox});
      node["addr:housenumber"]["addr:place"](${bbox});
    );
    out body 900;
  `;
}

function getAddressName(tags: Record<string, string>) {
  const houseNumber = tags['addr:housenumber'];
  const street = tags['addr:street'] ?? tags['addr:place'];

  if (houseNumber && street) {
    return `${houseNumber} ${street}`;
  }

  return null;
}

function getStreetOrPlaceName(tags: Record<string, string>) {
  return tags.name ?? tags['name:vi'] ?? tags.official_name ?? tags.alt_name ?? null;
}

function getCategory(tags: Record<string, string>) {
  if (tags['addr:housenumber']) {
    return 'osm-address';
  }

  if (tags.highway) {
    return 'osm-street';
  }

  return tags.amenity ?? tags.shop ?? tags.office ?? tags.tourism ?? tags.leisure ?? 'osm-place';
}

function toPoi(element: OverpassElement): Poi | null {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  const tags = element.tags ?? {};
  const addressName = getAddressName(tags);
  const fallbackName = getStreetOrPlaceName(tags);
  const name = addressName ?? fallbackName;

  if (typeof lat !== 'number' || typeof lon !== 'number' || !name) {
    return null;
  }

  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    lat,
    lon,
    category: getCategory(tags),
    source: 'overpass',
    coordinateAccuracy: addressName ? 'osm-exact' : 'catalog-estimate',
    tags,
  };
}

function dedupePois(pois: Poi[]) {
  const result: Poi[] = [];

  for (const poi of pois) {
    const key = normalizedText(poi.name);
    const hasDuplicate = result.some(
      (existing) =>
        normalizedText(existing.name) === key &&
        getDistanceMeters(existing, poi) <= 80
    );

    if (!hasDuplicate) {
      result.push(poi);
    }
  }

  return result;
}

function sortAddressFirst(pois: Poi[]) {
  return [...pois].sort((a, b) => {
    const aAddress =
      a.category === 'fixed-address' || a.category === 'osm-address' ? 0 : 1;
    const bAddress =
      b.category === 'fixed-address' || b.category === 'osm-address' ? 0 : 1;

    if (aAddress !== bAddress) {
      return aAddress - bAddress;
    }

    return a.name.localeCompare(b.name);
  });
}

export async function getCandidatePois(settings: GameSettings): Promise<Poi[]> {
  const bounds = getEffectiveSpawnBounds(
    settings.spawnZoneId,
    settings.customBounds
  );
  const fixedAddresses = sortAddressFirst(
    FIXED_ADDRESS_POINTS.filter((poi) => isWithinBounds(poi, bounds))
  );

  if (fixedAddresses.length > 0) {
    return fixedAddresses;
  }

  const boundsKey = getBoundsKey(bounds);

  if (addressCache.has(boundsKey)) {
    return addressCache.get(boundsKey) ?? [];
  }

  const fetchPois = async (query: string) => {
    const response = await fetch(API_CONFIG.overpass, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({ data: query }),
    });

    if (!response.ok) {
      throw new Error(`Overpass address request failed with ${response.status}`);
    }

    const data = (await response.json()) as OverpassResponse;

    return (data.elements ?? [])
      .map(toPoi)
      .filter((poi): poi is Poi => poi !== null)
      .filter((poi) => isWithinBounds(poi, bounds));
  };

  const pois = sortAddressFirst(
    dedupePois(await fetchPois(getAddressOverpassQuery(bounds)))
  );

  if (pois.length === 0) {
    throw new Error('No fixed address points found in the selected zone');
  }

  addressCache.set(boundsKey, pois);
  return pois;
}

export function isCuratedPoi(_position: LatLon) {
  return false;
}
