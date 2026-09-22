import { useCallback, useRef, useState } from 'react';
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
  TrafficSignPanel,
  type TrafficSignPanelState,
} from './components';
import { useGame } from './hooks';
import { getTrafficSignsForRoad } from './services/trafficSignService';
import type { RoadSelection } from './types/trafficSign';
import './App.css';

const INITIAL_TRAFFIC_SIGN_PANEL_STATE: TrafficSignPanelState = {
  status: 'idle',
  road: null,
  signs: [],
};

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
  const [trafficSignPanel, setTrafficSignPanel] =
    useState<TrafficSignPanelState>(INITIAL_TRAFFIC_SIGN_PANEL_STATE);
  const trafficSignsAbortRef = useRef<AbortController | null>(null);
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

  const handleRoadSelected = useCallback(async (road: RoadSelection) => {
    trafficSignsAbortRef.current?.abort();

    const controller = new AbortController();
    trafficSignsAbortRef.current = controller;

    setTrafficSignPanel({
      status: 'loading',
      road,
      signs: [],
    });

    try {
      const signs = await getTrafficSignsForRoad(road, controller.signal);

      if (controller.signal.aborted) {
        return;
      }

      setTrafficSignPanel({
        status: 'loaded',
        road,
        signs,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setTrafficSignPanel({
        status: 'error',
        road,
        signs: [],
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Không tải được dữ liệu biển giao thông',
      });
    }
  }, []);

  const handleTrafficSignPanelClose = useCallback(() => {
    trafficSignsAbortRef.current?.abort();
    trafficSignsAbortRef.current = null;
    setTrafficSignPanel(INITIAL_TRAFFIC_SIGN_PANEL_STATE);
  }, []);

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
          onRoadSelected={handleRoadSelected}
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

        <TrafficSignPanel
          state={trafficSignPanel}
          onClose={handleTrafficSignPanelClose}
        />

        <CompletionNotification notice={completionNotice} />
      </main>
    </div>
  );
}

export default App;
