import type { Poi, LatLon } from './poi';
import type { RouteResult } from './route';
import type { MapBounds, SpawnZoneId } from '../config/mapConfig';

export type GameStatus =
  | 'idle'
  | 'spawning'
  | 'loading_challenge'
  | 'active'
  | 'completed'
  | 'error';

export interface Challenge {
  id: string;
  destination: Poi;
  route: RouteResult;
  distanceMeters: number;
  status: 'active' | 'completed';
}

export interface GameState {
  status: GameStatus;
  playerPosition: LatLon | null;
  playerLabel: string | null;
  currentChallenge: Challenge | null;
  completedChallenges: number;
  recentChallengeIds: string[];
  errorMessage?: string;
}

export interface CompletionNotice {
  challengeNumber: number;
  destinationName: string;
}

export interface GameSettings {
  spawnZoneId: SpawnZoneId;
  customBounds: MapBounds | null;
  minDistanceMeters: number;
  maxDistanceMeters: number;
  showRouteGuidance: boolean;
}
