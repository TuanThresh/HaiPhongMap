import type { Feature, LineString } from 'geojson';

export interface RouteOption {
  id: string;
  distanceMeters: number;
  geometry: Feature<LineString>;
}

export interface RouteResult extends RouteOption {
  alternatives: RouteOption[];
}

export interface RoadDistanceResult<TDestination> {
  destination: TDestination;
  distanceMeters: number | null;
}
