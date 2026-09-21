import {
  RECENT_CHALLENGE_HISTORY_SIZE,
  ROUTE_CANDIDATE_LIMIT,
  ROUTE_CHOICE_POOL_SIZE,
} from '../config/mapConfig';
import type { Challenge, GameSettings } from '../types/game';
import type { LatLon, Poi } from '../types/poi';
import { getCandidatePois } from './poiService';
import {
  getDistanceMeters,
  getRoadDistances,
  getRoute,
} from './routingService';

interface CandidateWithDistance {
  destination: Poi;
  distanceMeters: number;
}

function shuffle<TItem>(items: TItem[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function isChallengeDistance(
  distanceMeters: number,
  settings: GameSettings
) {
  return (
    distanceMeters >= settings.minDistanceMeters &&
    distanceMeters <= settings.maxDistanceMeters
  );
}

function createChallengeId(destination: Poi) {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.round(Math.random() * 100000)}`;

  return `${destination.id}-${randomPart}`;
}

function removeRecentChallenges(candidates: Poi[], recentChallengeIds: string[]) {
  const recent = new Set(recentChallengeIds.slice(0, RECENT_CHALLENGE_HISTORY_SIZE));

  return candidates.filter((candidate) => !recent.has(candidate.id));
}

function sortByReasonableDistance(currentPosition: LatLon, candidates: Poi[]) {
  return [...candidates].sort((a, b) => {
    const aDistance = getDistanceMeters(currentPosition, a);
    const bDistance = getDistanceMeters(currentPosition, b);
    return aDistance - bDistance;
  });
}

async function getTableCandidates(
  currentPosition: LatLon,
  candidates: Poi[],
  settings: GameSettings
): Promise<CandidateWithDistance[]> {
  const routeDistances = await getRoadDistances(
    currentPosition,
    candidates.slice(0, ROUTE_CANDIDATE_LIMIT)
  );

  return routeDistances
    .filter(
      (item): item is CandidateWithDistance =>
        item.distanceMeters !== null &&
        isChallengeDistance(item.distanceMeters, settings)
    )
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

async function getSequentialCandidates(
  currentPosition: LatLon,
  candidates: Poi[],
  settings: GameSettings
): Promise<CandidateWithDistance[]> {
  const results: CandidateWithDistance[] = [];

  for (const destination of candidates.slice(0, ROUTE_CANDIDATE_LIMIT)) {
    try {
      const route = await getRoute(
        currentPosition.lat,
        currentPosition.lon,
        destination.lat,
        destination.lon,
        false
      );

      if (isChallengeDistance(route.distanceMeters, settings)) {
        results.push({
          destination,
          distanceMeters: route.distanceMeters,
        });
      }
    } catch {
      continue;
    }
  }

  return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export async function generateNextChallenge(
  currentPosition: LatLon,
  recentChallengeIds: string[] = [],
  settings: GameSettings
): Promise<Challenge> {
  const candidates = sortByReasonableDistance(
    currentPosition,
    shuffle(
      removeRecentChallenges(
        await getCandidatePois(settings),
        recentChallengeIds
      )
    )
  );

  if (candidates.length === 0) {
    throw new Error('No available POIs after recent challenge filtering');
  }

  let validCandidates: CandidateWithDistance[] = [];

  try {
    validCandidates = await getTableCandidates(
      currentPosition,
      candidates,
      settings
    );
  } catch (error) {
    console.warn('OSRM table failed, falling back to limited route checks:', error);
    validCandidates = await getSequentialCandidates(
      currentPosition,
      candidates,
      settings
    );
  }

  if (validCandidates.length === 0) {
    validCandidates = await getSequentialCandidates(
      currentPosition,
      shuffle(candidates).slice(0, ROUTE_CANDIDATE_LIMIT),
      settings
    );
  }

  const choicePool = shuffle(
    validCandidates.slice(0, Math.min(ROUTE_CHOICE_POOL_SIZE, validCandidates.length))
  );

  for (const candidate of choicePool) {
    try {
      const route = await getRoute(
        currentPosition.lat,
        currentPosition.lon,
        candidate.destination.lat,
        candidate.destination.lon
      );

      if (!isChallengeDistance(route.distanceMeters, settings)) {
        continue;
      }

      return {
        id: createChallengeId(candidate.destination),
        destination: candidate.destination,
        route,
        distanceMeters: route.distanceMeters,
        status: 'active',
      };
    } catch {
      continue;
    }
  }

  throw new Error('Could not create a valid route-based challenge');
}
