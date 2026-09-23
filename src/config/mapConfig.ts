import type { DrawMode, EditMode } from 'maplibre-gl-geo-editor';
import { API_CONFIG } from './apiConfig';

export const HAI_PHONG_CENTER_BOUNDS = {
  south: 20.77,
  north: 20.885,
  west: 106.62,
  east: 106.84,
};

export type MapBounds = typeof HAI_PHONG_CENTER_BOUNDS;

export const HAI_PHONG_FULL_BOUNDS = {
  south: 20.55,
  north: 21.12,
  west: 106.35,
  east: 107.2,
};

export const HAI_PHONG_CENTER = {
  lat: 20.829,
  lon: 106.731,
};

export const CHALLENGE_MIN_DISTANCE_METERS = 300;
export const CHALLENGE_MAX_DISTANCE_METERS = 5000;
export const CHALLENGE_COMPLETION_RADIUS = 50;
export const RECENT_CHALLENGE_HISTORY_SIZE = 5;
export const ROUTE_CANDIDATE_LIMIT = 20;
export const ROUTE_CHOICE_POOL_SIZE = 5;

export const SPAWN_ZONES = [
  {
    id: 'central',
    label: 'Trung tâm Hải Phòng',
    description: 'Khu nội đô để test loop ngắn và ổn định.',
    bounds: HAI_PHONG_CENTER_BOUNDS,
    center: HAI_PHONG_CENTER,
  },
  {
    id: 'all',
    label: 'Toàn Hải Phòng',
    description: 'Dùng toàn bộ catalog, phù hợp khi tăng distance limit.',
    bounds: HAI_PHONG_FULL_BOUNDS,
    center: HAI_PHONG_CENTER,
  },
  {
    id: 'do-son',
    label: 'Đồ Sơn',
    description: 'Nhóm bãi biển, di tích và Đồi Rồng.',
    bounds: {
      south: 20.66,
      north: 20.76,
      west: 106.75,
      east: 106.83,
    },
    center: {
      lat: 20.713,
      lon: 106.79,
    },
  },
  {
    id: 'cat-ba',
    label: 'Cát Bà - Lan Hạ',
    description: 'Nhóm Cát Bà, Lan Hạ, Việt Hải và vườn quốc gia.',
    bounds: {
      south: 20.66,
      north: 20.84,
      west: 106.94,
      east: 107.13,
    },
    center: {
      lat: 20.75,
      lon: 107.04,
    },
  },
  {
    id: 'north',
    label: 'Bắc Hải Phòng',
    description: 'Thủy Nguyên, Bạch Đằng Giang, Cao Quỳ, Hang Vua.',
    bounds: {
      south: 20.88,
      north: 21.04,
      west: 106.68,
      east: 106.83,
    },
    center: {
      lat: 20.95,
      lon: 106.77,
    },
  },
] as const;

export type PresetSpawnZoneId = (typeof SPAWN_ZONES)[number]['id'];
export type SpawnZoneId = PresetSpawnZoneId | 'custom';

export const DEFAULT_SPAWN_ZONE_ID: SpawnZoneId = 'central';

export const BASE_MAP_STYLE = API_CONFIG.openFreeMapStyle;

export const MAP_INITIAL_STATE = {
  center: [HAI_PHONG_CENTER.lon, HAI_PHONG_CENTER.lat] as [number, number],
  zoom: 13,
};

export function getSpawnZoneById(spawnZoneId: SpawnZoneId) {
  return (
    SPAWN_ZONES.find((zone) => zone.id === spawnZoneId) ??
    SPAWN_ZONES[0]
  );
}

export function getEffectiveSpawnBounds(
  spawnZoneId: SpawnZoneId,
  customBounds: MapBounds | null
) {
  if (spawnZoneId === 'custom' && customBounds) {
    return customBounds;
  }

  return getSpawnZoneById(spawnZoneId).bounds;
}

export const GEO_EDITOR_CONFIG = {
  position: 'top-left' as const,
  toolbarOrientation: 'vertical' as const,
  columns: 2,
  drawModes: [
    'polygon',
    'line',
    'rectangle',
    'circle',
    'marker',
    'freehand',
  ] as DrawMode[],
  editModes: [
    'select',
    'drag',
    'change',
    'rotate',
    'cut',
    'delete',
    'scale',
    'copy',
    'split',
    'union',
    'difference',
    'simplify',
    'lasso',
  ] as EditMode[],
  showFeatureProperties: true,
  fitBoundsOnLoad: true,
};

export const LAYER_CONTROL_CONFIG = {
  collapsed: false,
  panelWidth: 350,
  panelMinWidth: 240,
  panelMaxWidth: 450,
};

export const LEGEND_CONFIG = {
  title: 'Layer Types',
  items: [
    { label: 'Points of Interest', color: '#e74c3c', shape: 'circle' as const },
    { label: 'National Parks', color: '#2ecc71', shape: 'square' as const },
    { label: 'Rivers', color: '#3498db', shape: 'line' as const },
    { label: 'Roads', color: '#95a5a6', shape: 'line' as const },
    { label: 'Cities', color: '#9b59b6', shape: 'circle' as const },
  ],
  collapsible: true,
  collapsed: false,
  width: 180,
  position: 'bottom-left' as const,
};
