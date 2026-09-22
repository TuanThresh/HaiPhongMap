import type { GameStatus } from '../../types/game';

interface StartGamePanelProps {
  status: GameStatus;
  hasPlayer: boolean;
  onStartGame: () => void;
}

export function StartGamePanel({
  status,
  hasPlayer,
  onStartGame,
}: StartGamePanelProps) {
  const isBusy = status === 'spawning' || status === 'loading_challenge';
  const canStart = !isBusy;

  return (
    <section className="start-panel" aria-label="Game start">
      <h1>HaiPhong Map Challenge</h1>
      <p>Spawn và target đều là địa chỉ nhà cố định trong danh sách.</p>
      <button
        type="button"
        className="primary-action"
        onClick={onStartGame}
        disabled={!canStart}
      >
        🎮 START GAME
      </button>
      {hasPlayer && (
        <div className="spawn-status">
          <strong>🎮 PLAYER SPAWNED</strong>
          <span>Hãy đi tới địa chỉ hoặc điểm đường tiếp theo.</span>
        </div>
      )}
    </section>
  );
}
