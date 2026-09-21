import type { Challenge, GameSettings, GameStatus } from '../../types/game';
import type { LatLon } from '../../types/poi';

interface ChallengePanelProps {
  status: GameStatus;
  playerPosition: LatLon | null;
  playerLabel: string | null;
  challenge: Challenge | null;
  settings: GameSettings;
  completedChallenges: number;
  errorMessage?: string;
  onRestart: () => void;
  onTeleportToDestination: () => void;
  onCompleteChallenge: () => void;
  onSpawnNewAddressPosition: () => void;
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distanceMeters)} m`;
}

function formatPosition(position: LatLon | null, playerLabel: string | null) {
  if (!position) {
    return 'Chưa spawn';
  }

  return playerLabel ?? 'Địa chỉ cố định';
}

function getDestinationName(challenge: Challenge | null) {
  if (!challenge) {
    return null;
  }

  return challenge.destination.name;
}

export function ChallengePanel({
  status,
  playerPosition,
  playerLabel,
  challenge,
  settings,
  completedChallenges,
  errorMessage,
  onRestart,
  onTeleportToDestination,
  onCompleteChallenge,
  onSpawnNewAddressPosition,
}: ChallengePanelProps) {
  const isBusy = status === 'spawning' || status === 'loading_challenge';
  const destinationName = getDestinationName(challenge);

  return (
    <section className="challenge-panel" aria-label="Current challenge">
      <header>
        <span className="section-kicker">
          {status === 'completed' ? '✅ COMPLETED' : '🎯 NEXT CHALLENGE'}
        </span>
        <strong>Completed: {completedChallenges}</strong>
      </header>

      <div className="challenge-details">
        <div>
          <span>Player position</span>
          <strong>{formatPosition(playerPosition, playerLabel)}</strong>
        </div>

        <div>
          <span>Đi tới địa chỉ cố định</span>
          <strong>
            {destinationName ??
              (isBusy ? 'Đang tạo thử thách...' : 'Chưa có target')}
          </strong>
        </div>

        <div>
          <span>Khoảng cách đường</span>
          <strong>{challenge ? formatDistance(challenge.distanceMeters) : '—'}</strong>
        </div>

        <div>
          <span>Số đường đi hiển thị</span>
          <strong>
            {challenge && settings.showRouteGuidance
              ? `${challenge.route.alternatives.length} tuyến`
              : 'Đã tắt chỉ dẫn'}
          </strong>
        </div>

        <div>
          <span>Distance limit</span>
          <strong>
            {formatDistance(settings.minDistanceMeters)} -{' '}
            {formatDistance(settings.maxDistanceMeters)}
          </strong>
        </div>
      </div>

      {status === 'error' && (
        <div className="error-panel">
          <strong>Không tạo được challenge</strong>
          <span>{errorMessage}</span>
          <button type="button" onClick={onRestart}>
            Thử lại
          </button>
        </div>
      )}

      {import.meta.env.DEV && (
        <div className="dev-panel" aria-label="Developer controls">
          <span>🧪 DEV MODE</span>
          <div className="dev-actions">
            <button
              type="button"
              onClick={onTeleportToDestination}
              disabled={!challenge || status !== 'active'}
            >
              Teleport to Destination
            </button>
            <button
              type="button"
              onClick={onCompleteChallenge}
              disabled={!challenge || status !== 'active'}
            >
              Complete Challenge
            </button>
            <button type="button" onClick={onSpawnNewAddressPosition} disabled={isBusy}>
              Spawn New Address
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
