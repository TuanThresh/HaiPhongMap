export interface LatLon {
  lat: number;
  lon: number;
}

export interface Poi extends LatLon {
  id: string;
  listNumber?: number;
  name: string;
  category: string;
  source: 'overpass' | 'fallback' | 'curated';
  coordinateAccuracy?: 'osm-exact' | 'catalog-estimate';
  tags?: Record<string, string>;
}

export interface SpawnPoint extends LatLon {
  id: string;
  name?: string;
  sourcePoiId?: string;
}
