import { useEffect, useRef, useState } from 'react';
import maplibregl, {
  type GeoJSONSource,
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
import { createDestinationMarkerElement } from './DestinationMarker';
import { createPlayerMarkerElement } from './PlayerMarker';
import './Map.css';

interface MapViewProps {
  playerPosition: LatLon | null;
  challenge: Challenge | null;
  spawnZoneId: SpawnZoneId;
  customBounds: MapBounds | null;
  showRouteGuidance: boolean;
  isDrawingCustomZone: boolean;
  onCustomBoundsDrawn: (bounds: MapBounds) => void;
}

const ROUTE_SOURCE_ID = 'active-route-source';
const ROUTE_ALT_LAYER_ID = 'active-route-alt-layer';
const ROUTE_PRIMARY_LAYER_ID = 'active-route-primary-layer';
const ZONE_SOURCE_ID = 'spawn-zone-source';
const ZONE_FILL_LAYER_ID = 'spawn-zone-fill-layer';
const ZONE_LINE_LAYER_ID = 'spawn-zone-line-layer';

const emptyRoute = {
  type: 'FeatureCollection' as const,
  features: [],
};

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
    id: ROUTE_ALT_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['==', ['get', 'isPrimary'], false],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': '#60a5fa',
      'line-width': 4,
      'line-opacity': 0.52,
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
      'line-color': '#1d4ed8',
      'line-width': 6,
      'line-opacity': 0.9,
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
      'fill-opacity': 0.08,
    },
  });

  map.addLayer({
    id: ZONE_LINE_LAYER_ID,
    type: 'line',
    source: ZONE_SOURCE_ID,
    paint: {
      'line-color': '#0f766e',
      'line-width': 3,
      'line-dasharray': [2, 2],
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
  isDrawingCustomZone,
  onCustomBoundsDrawn,
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
      upsertZoneLayer(
        map,
        getEffectiveSpawnBounds(spawnZoneId, customBounds)
      );
      upsertRouteLayer(map, null, showRouteGuidance);
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
