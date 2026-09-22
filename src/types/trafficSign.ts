import type { LatLon } from './poi';

export interface RoadSelection {
  id: string;
  name: string;
  className: string | null;
  layerId: string;
  position: LatLon;
  properties: Record<string, string | number | boolean | null>;
}

export interface TrafficSign extends LatLon {
  id: string;
  label: string;
  value: string | null;
  distanceMeters: number;
  source: 'mapped-sign' | 'road-rule';
  tags: Record<string, string>;
}
