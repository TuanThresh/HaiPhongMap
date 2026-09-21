import { useCallback, useState } from 'react';
import {
  getEffectiveSpawnBounds,
  type MapBounds,
} from './config/mapConfig';
import {
  ChallengePanel,
  CompletionNotification,
  GameSettingsPanel,
  MapView,
  StartGamePanel,
} from './components';
import { useGame } from './hooks';
import './App.css';

function App() {
  const {
    state,
    settings,
    completionNotice,
    startGame,
    updateSettings,
    completeCurrentChallenge,
    teleportToDestination,
    spawnNewAddressPosition,
  } = useGame();
  const [isDrawingCustomZone, setIsDrawingCustomZone] = useState(false);
  const isBusy =
    state.status === 'spawning' || state.status === 'loading_challenge';
  const activeBounds = getEffectiveSpawnBounds(
    settings.spawnZoneId,
    settings.customBounds
  );

  const handleCustomBoundsDrawn = useCallback(
    (bounds: MapBounds) => {
      updateSettings({
        spawnZoneId: 'custom',
        customBounds: bounds,
      });
      setIsDrawingCustomZone(false);
    },
    [updateSettings]
  );

  return (
    <div className="app">
      <main className="game-shell">
        <MapView
          playerPosition={state.playerPosition}
          challenge={state.currentChallenge}
          spawnZoneId={settings.spawnZoneId}
          customBounds={settings.customBounds}
          showRouteGuidance={settings.showRouteGuidance}
          isDrawingCustomZone={isDrawingCustomZone}
          onCustomBoundsDrawn={handleCustomBoundsDrawn}
        />

        <div className="game-overlay">
          <StartGamePanel
            status={state.status}
            hasPlayer={state.playerPosition !== null}
            onStartGame={startGame}
          />

          <GameSettingsPanel
            settings={settings}
            activeBounds={activeBounds}
            isBusy={isBusy}
            isDrawingCustomZone={isDrawingCustomZone}
            onSettingsChange={updateSettings}
            onToggleCustomZoneDraw={() =>
              setIsDrawingCustomZone((current) => !current)
            }
          />

          <ChallengePanel
            status={state.status}
            playerPosition={state.playerPosition}
            playerLabel={state.playerLabel}
            challenge={state.currentChallenge}
            settings={settings}
            completedChallenges={state.completedChallenges}
            errorMessage={state.errorMessage}
            onRestart={startGame}
            onTeleportToDestination={teleportToDestination}
            onCompleteChallenge={completeCurrentChallenge}
            onSpawnNewAddressPosition={spawnNewAddressPosition}
          />
        </div>

        <CompletionNotification notice={completionNotice} />
      </main>
    </div>
  );
}

export default App;
