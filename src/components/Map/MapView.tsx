import { useEffect, useRef, useState } from 'react';
import maplibregl, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type MapMouseEvent,
  type Map as MapLibreMap,
  type Marker,
} from 'maplibre-gl';
import type { Feature, Polygon } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { API_CONFIG } from '../../config/apiConfig';
import {
  HAI_PHONG_FULL_BOUNDS,
  MAP_INITIAL_STATE,
  type MapBounds,
  getEffectiveSpawnBounds,
  type SpawnZoneId,
} from '../../config/mapConfig';
import type { Challenge } from '../../types/game';
import type { LatLon } from '../../types/poi';
import type { RoadSelection } from '../../types/trafficSign';
import { wardRegionsGeoJSON } from '../../data/wardRegions';
import {
  getEmptyOneWayWarningRoadFeatures,
  getOneWayWarningRoadFeatures,
  type OneWayWarningRoadFeatureCollection,
} from '../../services/oneWayWarningRoadService';
import { createDestinationMarkerElement } from './DestinationMarker';
import { createPlayerMarkerElement } from './PlayerMarker';
import './Map.css';

interface MapViewProps {
  playerPosition: LatLon | null;
  challenge: Challenge | null;
  spawnZoneId: SpawnZoneId;
  customBounds: MapBounds | null;
  showRouteGuidance: boolean;
  showOneWayRoads: boolean;
  isDrawingCustomZone: boolean;
  onCustomBoundsDrawn: (bounds: MapBounds) => void;
  onRoadSelected: (road: RoadSelection) => void;
}

const ROUTE_SOURCE_ID = 'active-route-source';
const ROUTE_CASING_LAYER_ID = 'active-route-casing-layer';
const ROUTE_ALT_LAYER_ID = 'active-route-alt-layer';
const ROUTE_PRIMARY_LAYER_ID = 'active-route-primary-layer';
const ZONE_SOURCE_ID = 'spawn-zone-source';
const ZONE_FILL_LAYER_ID = 'spawn-zone-fill-layer';
const ZONE_LINE_LAYER_ID = 'spawn-zone-line-layer';
const WARD_REGION_SOURCE_ID = 'ward-region-source';
const WARD_REGION_FILL_LAYER_ID = 'ward-region-fill-layer';
const WARD_REGION_LINE_LAYER_ID = 'ward-region-line-layer';
const WARD_REGION_LABEL_LAYER_ID = 'ward-region-label-layer';
const ONE_WAY_WARNING_SOURCE_ID = 'one-way-warning-source';
const ONE_WAY_WARNING_CASING_LAYER_ID = 'one-way-warning-casing-layer';
const ONE_WAY_WARNING_LINE_LAYER_ID = 'one-way-warning-line-layer';
const ONE_WAY_WARNING_LABEL_LAYER_ID = 'one-way-warning-label-layer';
const ROAD_CLICK_TOLERANCE_PX = 8;

const ONE_WAY_WARNING_LAYER_IDS = [
  ONE_WAY_WARNING_CASING_LAYER_ID,
  ONE_WAY_WARNING_LINE_LAYER_ID,
  ONE_WAY_WARNING_LABEL_LAYER_ID,
];

const INTERNAL_LAYER_IDS = new Set([
  ROUTE_CASING_LAYER_ID,
  ROUTE_ALT_LAYER_ID,
  ROUTE_PRIMARY_LAYER_ID,
  ZONE_FILL_LAYER_ID,
  ZONE_LINE_LAYER_ID,
  WARD_REGION_FILL_LAYER_ID,
  WARD_REGION_LINE_LAYER_ID,
  WARD_REGION_LABEL_LAYER_ID,
  ONE_WAY_WARNING_CASING_LAYER_ID,
  ONE_WAY_WARNING_LINE_LAYER_ID,
  ONE_WAY_WARNING_LABEL_LAYER_ID,
]);

const ROAD_NAME_KEYS = [
  'name',
  'name:vi',
  'name_vi',
  'name:latin',
  'name_latin',
  'name:en',
  'name_en',
  'ref',
];

const ROAD_CLASS_KEYS = [
  'class',
  'subclass',
  'highway',
  'type',
  'kind',
];

const emptyRoute = {
  type: 'FeatureCollection' as const,
  features: [],
};

const routeColorExpression: ExpressionSpecification = [
  'match',
  ['get', 'routeIndex'],
  0,
  '#fb923c',
  1,
  '#a3e635',
  2,
  '#c084fc',
  3,
  '#facc15',
  '#fb7185',
];

const routeOffsetExpression: ExpressionSpecification = [
  'match',
  ['get', 'routeIndex'],
  0,
  0,
  1,
  -5,
  2,
  5,
  3,
  10,
  0,
];

const routeCasingWidthExpression: ExpressionSpecification = [
  'case',
  ['==', ['get', 'isPrimary'], true],
  10,
  8,
];

const oneWayWarningLabelExpression: ExpressionSpecification = [
  'concat',
  'NGƯỢC CHIỀU · ',
  ['get', 'label'],
];

const wardRegionFillColorExpression: ExpressionSpecification = [
  'coalesce',
  ['get', 'color'],
  '#a855f7',
];

function setLayerVisibility(
  map: MapLibreMap,
  layerIds: string[],
  visible: boolean
) {
  const visibility = visible ? 'visible' : 'none';

  for (const layerId of layerIds) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }
}

function setPaintProperty(
  map: MapLibreMap,
  layerId: string,
  property: string,
  value: unknown
) {
  try {
    map.setPaintProperty(layerId, property, value);
  } catch {
    // Some style layers do not support every paint property.
  }
}

function getLayerDescriptor(layer: { id: string; [key: string]: unknown }) {
  const sourceLayer =
    typeof layer['source-layer'] === 'string' ? layer['source-layer'] : '';

  return `${layer.id} ${sourceLayer}`.toLowerCase();
}

function applyDungeonMapTheme(map: MapLibreMap) {
  const layers = map.getStyle().layers ?? [];

  for (const layer of layers) {
    if (INTERNAL_LAYER_IDS.has(layer.id)) {
      continue;
    }

    const descriptor = getLayerDescriptor(layer);
    const isWater =
      descriptor.includes('water') ||
      descriptor.includes('river') ||
      descriptor.includes('canal');
    const isGreenSpace =
      descriptor.includes('park') ||
      descriptor.includes('wood') ||
      descriptor.includes('forest') ||
      descriptor.includes('grass') ||
      descriptor.includes('landcover');
    const isRoad =
      descriptor.includes('road') ||
      descriptor.includes('street') ||
      descriptor.includes('highway') ||
      descriptor.includes('transport');
    const isBoundary =
      descriptor.includes('boundary') || descriptor.includes('admin');
    const isBuilding = descriptor.includes('building');

    if (layer.type === 'background') {
      setPaintProperty(map, layer.id, 'background-color', '#0b090d');
      continue;
    }

    if (layer.type === 'fill') {
      if (isWater) {
        setPaintProperty(map, layer.id, 'fill-color', '#111827');
        setPaintProperty(map, layer.id, 'fill-opacity', 0.96);
      } else if (isGreenSpace) {
        setPaintProperty(map, layer.id, 'fill-color', '#132017');
        setPaintProperty(map, layer.id, 'fill-opacity', 0.88);
      } else if (isBuilding) {
        setPaintProperty(map, layer.id, 'fill-color', '#241822');
        setPaintProperty(map, layer.id, 'fill-opacity', 0.7);
      } else {
        setPaintProperty(map, layer.id, 'fill-color', '#161116');
        setPaintProperty(map, layer.id, 'fill-opacity', 0.9);
      }
      continue;
    }

    if (layer.type === 'line') {
      if (isRoad) {
        setPaintProperty(map, layer.id, 'line-color', '#5b3b46');
        setPaintProperty(map, layer.id, 'line-opacity', 0.9);
      } else if (isWater) {
        setPaintProperty(map, layer.id, 'line-color', '#23364a');
        setPaintProperty(map, layer.id, 'line-opacity', 0.75);
      } else if (isBoundary) {
        setPaintProperty(map, layer.id, 'line-color', '#8a5a44');
        setPaintProperty(map, layer.id, 'line-opacity', 0.6);
      } else {
        setPaintProperty(map, layer.id, 'line-color', '#332637');
        setPaintProperty(map, layer.id, 'line-opacity', 0.72);
      }
      continue;
    }

    if (layer.type === 'symbol') {
      setPaintProperty(map, layer.id, 'text-color', '#d8c7a6');
      setPaintProperty(map, layer.id, 'text-halo-color', '#0b090d');
      setPaintProperty(map, layer.id, 'text-halo-width', 1.2);
      setPaintProperty(map, layer.id, 'icon-opacity', 0.82);
      continue;
    }

    if (layer.type === 'circle') {
      setPaintProperty(map, layer.id, 'circle-color', '#9a5a2f');
      setPaintProperty(map, layer.id, 'circle-opacity', 0.75);
      continue;
    }

    if (layer.type === 'raster') {
      setPaintProperty(map, layer.id, 'raster-brightness-max', 0.52);
      setPaintProperty(map, layer.id, 'raster-brightness-min', 0.02);
      setPaintProperty(map, layer.id, 'raster-saturation', -0.45);
      setPaintProperty(map, layer.id, 'raster-contrast', 0.22);
    }
  }
}

function getRouteData(challenge: Challenge | null, showRouteGuidance: boolean) {
  if (!showRouteGuidance || !challenge || challenge.status !== 'active') {
    return emptyRoute;
  }

  return {
    type: 'FeatureCollection' as const,
    features: challenge.route.alternatives.map((route, index) => ({
      ...route.geometry,
      properties: {
        ...(route.geometry.properties ?? {}),
        routeIndex: index,
        distanceMeters: route.distanceMeters,
        isPrimary: index === 0,
      },
    })),
  };
}

function upsertRouteLayer(
  map: MapLibreMap,
  challenge: Challenge | null,
  showRouteGuidance: boolean
) {
  const routeData = getRouteData(challenge, showRouteGuidance);
  const source = map.getSource(ROUTE_SOURCE_ID) as GeoJSONSource | undefined;

  if (source) {
    source.setData(routeData);
    return;
  }

  map.addSource(ROUTE_SOURCE_ID, {
    type: 'geojson',
    data: routeData,
  });

  map.addLayer({
    id: ROUTE_CASING_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#1a0d13',
      'line-width': routeCasingWidthExpression,
      'line-opacity': 0.9,
      'line-offset': routeOffsetExpression,
    },
  });

  map.addLayer({
    id: ROUTE_ALT_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['==', ['get', 'isPrimary'], false],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': routeColorExpression,
      'line-width': 5,
      'line-opacity': 0.88,
      'line-offset': routeOffsetExpression,
    },
  });

  map.addLayer({
    id: ROUTE_PRIMARY_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['==', ['get', 'isPrimary'], true],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': routeColorExpression,
      'line-width': 6,
      'line-opacity': 0.95,
      'line-offset': routeOffsetExpression,
    },
  });
}

function getZoneFeature(bounds: MapBounds): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.south],
          [bounds.east, bounds.north],
          [bounds.west, bounds.north],
          [bounds.west, bounds.south],
        ],
      ],
    },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toRoadProperties(feature: MapGeoJSONFeature) {
  const result: RoadSelection['properties'] = {};

  for (const [key, value] of Object.entries(feature.properties ?? {})) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      result[key] = value;
    }
  }

  return result;
}

function getStringProperty(
  properties: RoadSelection['properties'],
  keys: string[]
) {
  for (const key of keys) {
    const value = properties[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number') {
      return String(value);
    }
  }

  return null;
}

function isRoadFeature(feature: MapGeoJSONFeature) {
  if (INTERNAL_LAYER_IDS.has(feature.layer.id)) {
    return false;
  }

  const geometryType = feature.geometry.type;
  const isLine =
    geometryType === 'LineString' || geometryType === 'MultiLineString';

  if (!isLine) {
    return false;
  }

  const properties = toRoadProperties(feature);
  const layerId = feature.layer.id.toLowerCase();
  const roadClass = getStringProperty(properties, ROAD_CLASS_KEYS)?.toLowerCase();
  const isRailLayer =
    layerId.includes('rail') ||
    roadClass === 'rail' ||
    roadClass === 'transit';
  const looksLikeRoadLayer =
    layerId.includes('road') ||
    layerId.includes('street') ||
    layerId.includes('motorway') ||
    layerId.includes('trunk') ||
    layerId.includes('primary') ||
    layerId.includes('secondary') ||
    layerId.includes('tertiary') ||
    layerId.includes('minor') ||
    layerId.includes('service') ||
    layerId.includes('track') ||
    layerId.includes('path') ||
    layerId.includes('pedestrian') ||
    layerId.includes('link') ||
    layerId.includes('bridge') ||
    layerId.includes('tunnel');

  if (isRailLayer) {
    return false;
  }

  return (
    looksLikeRoadLayer ||
    roadClass === 'motorway' ||
    roadClass === 'trunk' ||
    roadClass === 'primary' ||
    roadClass === 'secondary' ||
    roadClass === 'tertiary' ||
    roadClass === 'residential' ||
    roadClass === 'service' ||
    roadClass === 'unclassified' ||
    roadClass === 'living_street'
  );
}

function getRoadSelectionFromClick(
  map: MapLibreMap,
  event: MapMouseEvent
): RoadSelection | null {
  const features = map.queryRenderedFeatures([
    [
      event.point.x - ROAD_CLICK_TOLERANCE_PX,
      event.point.y - ROAD_CLICK_TOLERANCE_PX,
    ],
    [
      event.point.x + ROAD_CLICK_TOLERANCE_PX,
      event.point.y + ROAD_CLICK_TOLERANCE_PX,
    ],
  ]);
  const roadFeature = features.find(isRoadFeature);

  if (!roadFeature) {
    return null;
  }

  const properties = toRoadProperties(roadFeature);
  const className = getStringProperty(properties, ROAD_CLASS_KEYS);
  const fallbackName = className ? `Đường ${className}` : 'Đường chưa có tên';
  const name = getStringProperty(properties, ROAD_NAME_KEYS) ?? fallbackName;
  const position = {
    lat: event.lngLat.lat,
    lon: event.lngLat.lng,
  };

  return {
    id: [
      roadFeature.source,
      roadFeature.sourceLayer,
      roadFeature.layer.id,
      roadFeature.id ?? 'unknown',
      position.lat.toFixed(5),
      position.lon.toFixed(5),
    ]
      .filter(Boolean)
      .join(':'),
    name,
    className,
    layerId: roadFeature.layer.id,
    position,
    properties,
  };
}

function createBoundsFromPoints(start: LatLon, end: LatLon): MapBounds {
  const south = clamp(
    Math.min(start.lat, end.lat),
    HAI_PHONG_FULL_BOUNDS.south,
    HAI_PHONG_FULL_BOUNDS.north
  );
  const north = clamp(
    Math.max(start.lat, end.lat),
    HAI_PHONG_FULL_BOUNDS.south,
    HAI_PHONG_FULL_BOUNDS.north
  );
  const west = clamp(
    Math.min(start.lon, end.lon),
    HAI_PHONG_FULL_BOUNDS.west,
    HAI_PHONG_FULL_BOUNDS.east
  );
  const east = clamp(
    Math.max(start.lon, end.lon),
    HAI_PHONG_FULL_BOUNDS.west,
    HAI_PHONG_FULL_BOUNDS.east
  );

  return {
    south,
    north,
    west,
    east,
  };
}

function isUsableBounds(bounds: MapBounds) {
  return bounds.north - bounds.south >= 0.002 && bounds.east - bounds.west >= 0.002;
}

function upsertZoneLayer(map: MapLibreMap, bounds: MapBounds) {
  const zoneData = getZoneFeature(bounds);
  const source = map.getSource(ZONE_SOURCE_ID) as GeoJSONSource | undefined;

  if (source) {
    source.setData(zoneData);
    return;
  }

  map.addSource(ZONE_SOURCE_ID, {
    type: 'geojson',
    data: zoneData,
  });

  map.addLayer({
    id: ZONE_FILL_LAYER_ID,
    type: 'fill',
    source: ZONE_SOURCE_ID,
    paint: {
      'fill-color': '#14b8a6',
      'fill-opacity': 0.1,
    },
  });

  map.addLayer({
    id: ZONE_LINE_LAYER_ID,
    type: 'line',
    source: ZONE_SOURCE_ID,
    paint: {
      'line-color': '#84cc16',
      'line-width': 3,
      'line-opacity': 0.82,
      'line-dasharray': [1.4, 1.6],
    },
  });
}

function upsertWardRegionLayer(map: MapLibreMap) {
  const source = map.getSource(WARD_REGION_SOURCE_ID) as
    | GeoJSONSource
    | undefined;

  if (source) {
    source.setData(wardRegionsGeoJSON);
    return;
  }

  map.addSource(WARD_REGION_SOURCE_ID, {
    type: 'geojson',
    data: wardRegionsGeoJSON,
  });

  map.addLayer({
    id: WARD_REGION_FILL_LAYER_ID,
    type: 'fill',
    source: WARD_REGION_SOURCE_ID,
    paint: {
      'fill-color': wardRegionFillColorExpression,
      'fill-opacity': 0.16,
    },
  });

  map.addLayer({
    id: WARD_REGION_LINE_LAYER_ID,
    type: 'line',
    source: WARD_REGION_SOURCE_ID,
    paint: {
      'line-color': '#f59e0b',
      'line-width': 1.6,
      'line-opacity': 0.58,
      'line-dasharray': [1.1, 1.7],
    },
  });

  map.addLayer({
    id: WARD_REGION_LABEL_LAYER_ID,
    type: 'symbol',
    source: WARD_REGION_SOURCE_ID,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 12,
      'text-letter-spacing': 0,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': '#f8e4b0',
      'text-halo-color': '#130c12',
      'text-halo-width': 1.8,
      'text-halo-blur': 0.6,
    },
  });
}

function upsertOneWayWarningRoadLayer(
  map: MapLibreMap,
  data: OneWayWarningRoadFeatureCollection
) {
  const source = map.getSource(ONE_WAY_WARNING_SOURCE_ID) as
    | GeoJSONSource
    | undefined;

  if (source) {
    source.setData(data);
    return;
  }

  map.addSource(ONE_WAY_WARNING_SOURCE_ID, {
    type: 'geojson',
    data,
  });

  map.addLayer({
    id: ONE_WAY_WARNING_CASING_LAYER_ID,
    type: 'line',
    source: ONE_WAY_WARNING_SOURCE_ID,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#2b090d',
      'line-width': 11,
      'line-opacity': 0.92,
    },
  });

  map.addLayer({
    id: ONE_WAY_WARNING_LINE_LAYER_ID,
    type: 'line',
    source: ONE_WAY_WARNING_SOURCE_ID,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#fb923c',
      'line-width': 7,
      'line-opacity': 0.96,
      'line-dasharray': [1.2, 0.7],
    },
  });

  map.addLayer({
    id: ONE_WAY_WARNING_LABEL_LAYER_ID,
    type: 'symbol',
    source: ONE_WAY_WARNING_SOURCE_ID,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 260,
      'text-field': oneWayWarningLabelExpression,
      'text-size': 12,
      'text-letter-spacing': 0,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': '#fff7ed',
      'text-halo-color': '#2b090d',
      'text-halo-width': 2,
      'text-halo-blur': 0.5,
    },
  });
}

function fitPlayerAndDestination(
  map: MapLibreMap,
  playerPosition: LatLon | null,
  challenge: Challenge | null
) {
  if (!playerPosition || !challenge) {
    return;
  }

  const destination = challenge.destination;
  const bounds = new maplibregl.LngLatBounds(
    [playerPosition.lon, playerPosition.lat],
    [playerPosition.lon, playerPosition.lat]
  );

  bounds.extend([destination.lon, destination.lat]);

  map.fitBounds(bounds, {
    padding: {
      top: 96,
      right: 96,
      bottom: 160,
      left: 380,
    },
    maxZoom: 15.5,
    duration: 700,
  });
}

function fitBounds(map: MapLibreMap, bounds: MapBounds) {
  map.fitBounds(
    [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ],
    {
      padding: 80,
      duration: 500,
      maxZoom: 13.5,
    }
  );
}

export function MapView({
  playerPosition,
  challenge,
  spawnZoneId,
  customBounds,
  showRouteGuidance,
  showOneWayRoads,
  isDrawingCustomZone,
  onCustomBoundsDrawn,
  onRoadSelected,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const playerMarkerRef = useRef<Marker | null>(null);
  const destinationMarkerRef = useRef<Marker | null>(null);
  const drawStartRef = useRef<LatLon | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: API_CONFIG.openFreeMapStyle,
      center: MAP_INITIAL_STATE.center,
      zoom: MAP_INITIAL_STATE.zoom,
      maxBounds: [
        [HAI_PHONG_FULL_BOUNDS.west, HAI_PHONG_FULL_BOUNDS.south],
        [HAI_PHONG_FULL_BOUNDS.east, HAI_PHONG_FULL_BOUNDS.north],
      ],
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      applyDungeonMapTheme(map);
      upsertWardRegionLayer(map);
      upsertZoneLayer(
        map,
        getEffectiveSpawnBounds(spawnZoneId, customBounds)
      );
      upsertRouteLayer(map, null, showRouteGuidance);
      upsertOneWayWarningRoadLayer(map, getEmptyOneWayWarningRoadFeatures());
      setLayerVisibility(map, ONE_WAY_WARNING_LAYER_IDS, showOneWayRoads);
      setIsLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setIsLoaded(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isLoaded) {
      return;
    }

    setLayerVisibility(map, ONE_WAY_WARNING_LAYER_IDS, showOneWayRoads);

    if (!showOneWayRoads) {
      return;
    }

    const controller = new AbortController();

    getOneWayWarningRoadFeatures(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          upsertOneWayWarningRoadLayer(map, data);
          setLayerVisibility(map, ONE_WAY_WARNING_LAYER_IDS, true);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.warn('Could not load one-way warning roads:', error);
        }
      });

    return () => {
      controller.abort();
    };
  }, [isLoaded, showOneWayRoads]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isLoaded) {
      return;
    }

    const bounds = getEffectiveSpawnBounds(spawnZoneId, customBounds);
    upsertZoneLayer(map, bounds);

    if (!playerPosition && !challenge) {
      fitBounds(map, bounds);
    }
  }, [challenge, customBounds, isLoaded, playerPosition, spawnZoneId]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isLoaded) {
      return;
    }

    const canvas = map.getCanvas();
    canvas.style.cursor = isDrawingCustomZone ? 'crosshair' : '';

    if (!isDrawingCustomZone) {
      drawStartRef.current = null;
      map.dragPan.enable();
      return;
    }

    map.dragPan.disable();

    const handleMouseDown = (event: MapMouseEvent) => {
      event.preventDefault();
      drawStartRef.current = {
        lat: event.lngLat.lat,
        lon: event.lngLat.lng,
      };
    };

    const handleMouseMove = (event: MapMouseEvent) => {
      const start = drawStartRef.current;

      if (!start) {
        return;
      }

      const draftBounds = createBoundsFromPoints(start, {
        lat: event.lngLat.lat,
        lon: event.lngLat.lng,
      });
      upsertZoneLayer(map, draftBounds);
    };

    const handleMouseUp = (event: MapMouseEvent) => {
      const start = drawStartRef.current;

      if (!start) {
        return;
      }

      const bounds = createBoundsFromPoints(start, {
        lat: event.lngLat.lat,
        lon: event.lngLat.lng,
      });
      drawStartRef.current = null;

      if (isUsableBounds(bounds)) {
        onCustomBoundsDrawn(bounds);
      }
    };

    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);

    return () => {
      canvas.style.cursor = '';
      drawStartRef.current = null;
      map.dragPan.enable();
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
    };
  }, [isDrawingCustomZone, isLoaded, onCustomBoundsDrawn]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isLoaded) {
      return;
    }

    const handleClick = (event: MapMouseEvent) => {
      if (isDrawingCustomZone) {
        return;
      }

      const road = getRoadSelectionFromClick(map, event);

      if (road) {
        onRoadSelected(road);
      }
    };

    map.on('click', handleClick);

    return () => {
      map.off('click', handleClick);
    };
  }, [isDrawingCustomZone, isLoaded, onRoadSelected]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isLoaded) {
      return;
    }

    upsertRouteLayer(map, challenge, showRouteGuidance);
  }, [challenge, isLoaded, showRouteGuidance]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isLoaded) {
      return;
    }

    if (!playerPosition) {
      playerMarkerRef.current?.remove();
      playerMarkerRef.current = null;
      return;
    }

    if (!playerMarkerRef.current) {
      playerMarkerRef.current = new maplibregl.Marker({
        element: createPlayerMarkerElement(),
        anchor: 'bottom',
      })
        .setLngLat([playerPosition.lon, playerPosition.lat])
        .addTo(map);
    } else {
      playerMarkerRef.current.setLngLat([playerPosition.lon, playerPosition.lat]);
    }
  }, [isLoaded, playerPosition]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isLoaded) {
      return;
    }

    if (!challenge || challenge.status !== 'active') {
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = null;
      return;
    }

    if (!destinationMarkerRef.current) {
      destinationMarkerRef.current = new maplibregl.Marker({
        element: createDestinationMarkerElement(),
        anchor: 'bottom',
      })
        .setLngLat([challenge.destination.lon, challenge.destination.lat])
        .addTo(map);
    } else {
      destinationMarkerRef.current.setLngLat([
        challenge.destination.lon,
        challenge.destination.lat,
      ]);
    }
  }, [challenge, isLoaded]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isLoaded) {
      return;
    }

    if (playerPosition && challenge) {
      fitPlayerAndDestination(map, playerPosition, challenge);
    } else {
      fitBounds(map, getEffectiveSpawnBounds(spawnZoneId, customBounds));
    }
  }, [challenge, customBounds, isLoaded, playerPosition, spawnZoneId]);

  return (
    <div
      ref={containerRef}
      className={`map-container ${isDrawingCustomZone ? 'drawing-zone' : ''}`}
    />
  );
}
