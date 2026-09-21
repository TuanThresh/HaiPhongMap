import type { GameSettings } from '../types/game';
import type { SpawnPoint } from '../types/poi';
import { getCandidatePois } from './poiService';

function shuffle<TItem>(items: TItem[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export async function generateAddressSpawn(
  settings: GameSettings
): Promise<SpawnPoint> {
  const [candidate] = shuffle(await getCandidatePois(settings));

  if (!candidate) {
    throw new Error('No fixed address points found in the selected zone');
  }

  return {
    id: `spawn-${candidate.id}`,
    lat: candidate.lat,
    lon: candidate.lon,
    name: candidate.name,
    sourcePoiId: candidate.id,
  };
}
