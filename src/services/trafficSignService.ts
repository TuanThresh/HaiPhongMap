import { API_CONFIG } from '../config/apiConfig';
import type { LatLon } from '../types/poi';
import type { RoadSelection, TrafficSign } from '../types/trafficSign';
import { getDistanceMeters } from './routingService';

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

const TRAFFIC_SIGN_SEARCH_RADIUS_METERS = 220;
const ROAD_RULE_SEARCH_RADIUS_METERS = 45;
const TURN_RESTRICTION_SEARCH_RADIUS_METERS = 90;

function getTrafficSignQuery(position: LatLon) {
  return `
    [out:json][timeout:20];
    (
      node["traffic_sign"](around:${TRAFFIC_SIGN_SEARCH_RADIUS_METERS},${position.lat},${position.lon});
      way["traffic_sign"](around:${TRAFFIC_SIGN_SEARCH_RADIUS_METERS},${position.lat},${position.lon});
      node["highway"="traffic_signals"](around:${TRAFFIC_SIGN_SEARCH_RADIUS_METERS},${position.lat},${position.lon});
      way["highway"](around:${ROAD_RULE_SEARCH_RADIUS_METERS},${position.lat},${position.lon});
      relation["type"="restriction"](around:${TURN_RESTRICTION_SEARCH_RADIUS_METERS},${position.lat},${position.lon});
    );
    out center tags 120;
  `;
}

function getSignLabel(tags: Record<string, string>) {
  if (tags.highway === 'traffic_signals') {
    return 'Đèn tín hiệu giao thông';
  }

  const trafficSignValue = getSignValue(tags);

  if (trafficSignValue?.match(/(^|[:;_ -])(p\.?130|130|no_stopping)([:;_ -]|$)/i)) {
    return 'Cấm dừng và đỗ xe';
  }

  if (trafficSignValue?.match(/(^|[:;_ -])(p\.?131|131|no_parking)([:;_ -]|$)/i)) {
    return 'Cấm đỗ xe';
  }

  if (trafficSignValue?.match(/one[-_ ]?way|oneway/i)) {
    return 'Đường một chiều';
  }

  if (tags.traffic_sign) {
    return 'Biển giao thông';
  }

  return tags.name ?? 'Biển / tín hiệu giao thông';
}

function getSignValue(tags: Record<string, string>) {
  return (
    tags.traffic_sign ??
    tags['traffic_sign:forward'] ??
    tags['traffic_sign:backward'] ??
    tags.name ??
    null
  );
}

function toTrafficSign(
  element: OverpassElement,
  clickedPosition: LatLon
): TrafficSign | null {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  const tags = element.tags ?? {};
  const hasMappedSign =
    Boolean(
      tags.traffic_sign ||
        tags['traffic_sign:forward'] ||
        tags['traffic_sign:backward']
    ) || tags.highway === 'traffic_signals';

  if (!hasMappedSign || typeof lat !== 'number' || typeof lon !== 'number') {
    return null;
  }

  const position = { lat, lon };

  return {
    id: `${element.type}-${element.id}`,
    lat,
    lon,
    label: getSignLabel(tags),
    value: getSignValue(tags),
    distanceMeters: getDistanceMeters(clickedPosition, position),
    source: 'mapped-sign',
    tags,
  };
}

function isParkingRestrictionKey(key: string) {
  return (
    key.startsWith('parking:lane') ||
    key.startsWith('parking:condition') ||
    key.startsWith('parking:restriction') ||
    key === 'parking' ||
    key === 'parking:both' ||
    key === 'parking:left' ||
    key === 'parking:right'
  );
}

function isNoParkingValue(value: string) {
  return [
    'no',
    'none',
    'no_parking',
    'no_stopping',
    'no_standing',
    'fire_lane',
  ].includes(value.toLowerCase());
}

function getAccessRestrictionLabel(key: string, value: string) {
  const restrictedValues = new Set([
    'no',
    'private',
    'destination',
    'delivery',
    'permissive',
    'customers',
  ]);

  if (!restrictedValues.has(value.toLowerCase())) {
    return null;
  }

  const labels: Record<string, string> = {
    access: 'Hạn chế lưu thông',
    vehicle: 'Hạn chế phương tiện',
    motor_vehicle: 'Hạn chế xe cơ giới',
    motorcycle: 'Hạn chế xe máy',
    motorcar: 'Hạn chế ô tô',
    hgv: 'Hạn chế xe tải',
    bus: 'Hạn chế xe buýt',
    bicycle: 'Hạn chế xe đạp',
    foot: 'Hạn chế người đi bộ',
    psv: 'Hạn chế xe dịch vụ công cộng',
    goods: 'Hạn chế xe chở hàng',
  };

  return labels[key] ?? null;
}

function getTurnRestrictionLabel(value: string) {
  const labels: Record<string, string> = {
    no_left_turn: 'Cấm rẽ trái',
    no_right_turn: 'Cấm rẽ phải',
    no_u_turn: 'Cấm quay đầu',
    no_straight_on: 'Cấm đi thẳng',
    only_left_turn: 'Chỉ được rẽ trái',
    only_right_turn: 'Chỉ được rẽ phải',
    only_straight_on: 'Chỉ được đi thẳng',
  };

  return labels[value] ?? 'Hạn chế hướng rẽ';
}

function createRoadRuleSign(
  element: OverpassElement,
  clickedPosition: LatLon,
  label: string,
  value: string | null,
  tags: Record<string, string>,
  ruleKey: string
): TrafficSign {
  const lat = element.lat ?? element.center?.lat ?? clickedPosition.lat;
  const lon = element.lon ?? element.center?.lon ?? clickedPosition.lon;
  const position = { lat, lon };

  return {
    id: `rule-${element.type}-${element.id}-${ruleKey}`,
    lat,
    lon,
    label,
    value,
    distanceMeters: getDistanceMeters(clickedPosition, position),
    source: 'road-rule',
    tags,
  };
}

function getRoadRuleSigns(
  element: OverpassElement,
  clickedPosition: LatLon
): TrafficSign[] {
  const tags = element.tags ?? {};
  const signs: TrafficSign[] = [];

  if (tags.oneway === 'yes' || tags.oneway === '1' || tags.junction === 'roundabout') {
    signs.push(
      createRoadRuleSign(
        element,
        clickedPosition,
        'Đường một chiều',
        tags.oneway ?? tags.junction ?? 'yes',
        tags,
        'oneway'
      )
    );
  }

  if (tags.oneway === '-1') {
    signs.push(
      createRoadRuleSign(
        element,
        clickedPosition,
        'Đường một chiều ngược chiều vẽ',
        tags.oneway,
        tags,
        'oneway-reverse'
      )
    );
  }

  if (tags.maxspeed) {
    signs.push(
      createRoadRuleSign(
        element,
        clickedPosition,
        'Giới hạn tốc độ',
        tags.maxspeed,
        tags,
        'maxspeed'
      )
    );
  }

  if (tags.overtaking && tags.overtaking !== 'yes') {
    signs.push(
      createRoadRuleSign(
        element,
        clickedPosition,
        'Hạn chế vượt xe',
        tags.overtaking,
        tags,
        'overtaking'
      )
    );
  }

  for (const [key, value] of Object.entries(tags)) {
    if (isParkingRestrictionKey(key) && isNoParkingValue(value)) {
      signs.push(
        createRoadRuleSign(
          element,
          clickedPosition,
          value.toLowerCase() === 'no_stopping' ? 'Cấm dừng xe' : 'Cấm đỗ xe',
          `${key}=${value}`,
          tags,
          key
        )
      );
    }

    const accessLabel = getAccessRestrictionLabel(key, value);

    if (accessLabel) {
      signs.push(
        createRoadRuleSign(
          element,
          clickedPosition,
          accessLabel,
          `${key}=${value}`,
          tags,
          key
        )
      );
    }
  }

  if (tags.type === 'restriction' && tags.restriction) {
    signs.push(
      createRoadRuleSign(
        element,
        clickedPosition,
        getTurnRestrictionLabel(tags.restriction),
        tags.restriction,
        tags,
        'restriction'
      )
    );
  }

  return signs;
}

function dedupeSigns(signs: TrafficSign[]) {
  const byId = new Map<string, TrafficSign>();

  for (const sign of signs) {
    byId.set(sign.id, sign);
  }

  return [...byId.values()].sort(
    (a, b) => a.distanceMeters - b.distanceMeters
  );
}

export async function getTrafficSignsForRoad(
  road: RoadSelection,
  signal?: AbortSignal
) {
  const response = await fetch(API_CONFIG.overpass, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: new URLSearchParams({
      data: getTrafficSignQuery(road.position),
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Overpass traffic sign request failed with ${response.status}`);
  }

  const data = (await response.json()) as OverpassResponse;

  return dedupeSigns(
    (data.elements ?? []).flatMap((element) => {
      const mappedSign = toTrafficSign(element, road.position);
      const ruleSigns = getRoadRuleSigns(element, road.position);

      return mappedSign ? [mappedSign, ...ruleSigns] : ruleSigns;
    })
  );
}
