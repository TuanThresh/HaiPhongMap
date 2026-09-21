import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CHALLENGE_MAX_DISTANCE_METERS,
  CHALLENGE_COMPLETION_RADIUS,
  CHALLENGE_MIN_DISTANCE_METERS,
  DEFAULT_SPAWN_ZONE_ID,
  RECENT_CHALLENGE_HISTORY_SIZE,
} from '../config/mapConfig';
import { generateNextChallenge } from '../services/challengeService';
import { generateAddressSpawn } from '../services/spawnService';
import type {
  Challenge,
  CompletionNotice,
  GameSettings,
  GameState,
} from '../types/game';
import type { LatLon } from '../types/poi';
import { getDistanceMeters } from '../services/routingService';

const INITIAL_GAME_STATE: GameState = {
  status: 'idle',
  playerPosition: null,
  playerLabel: null,
  currentChallenge: null,
  completedChallenges: 0,
  recentChallengeIds: [],
};

const INITIAL_GAME_SETTINGS: GameSettings = {
  spawnZoneId: DEFAULT_SPAWN_ZONE_ID,
  minDistanceMeters: CHALLENGE_MIN_DISTANCE_METERS,
  maxDistanceMeters: CHALLENGE_MAX_DISTANCE_METERS,
  customBounds: null,
  showRouteGuidance: true,
};

function pushRecentChallenge(recentChallengeIds: string[], challenge: Challenge) {
  return [challenge.destination.id, ...recentChallengeIds].slice(
    0,
    RECENT_CHALLENGE_HISTORY_SIZE
  );
}

export function useGame() {
  const [state, setState] = useState<GameState>(INITIAL_GAME_STATE);
  const [settings, setSettings] = useState<GameSettings>(INITIAL_GAME_SETTINGS);
  const [completionNotice, setCompletionNotice] =
    useState<CompletionNotice | null>(null);
  const isCompletingRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);

  const clearNoticeTimer = useCallback(() => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  }, []);

  const showCompletionNotice = useCallback(
    (notice: CompletionNotice) => {
      clearNoticeTimer();
      setCompletionNotice(notice);
      noticeTimerRef.current = window.setTimeout(() => {
        setCompletionNotice(null);
        noticeTimerRef.current = null;
      }, 1800);
    },
    [clearNoticeTimer]
  );

  const loadChallengeFromPosition = useCallback(
    async (
      position: LatLon,
      playerLabel: string,
      recentChallengeIds: string[],
      completedChallenges: number,
      activeSettings: GameSettings
    ) => {
      setState((current) => ({
        ...current,
        status: 'loading_challenge',
        playerPosition: position,
        playerLabel,
        currentChallenge: null,
        recentChallengeIds,
        completedChallenges,
        errorMessage: undefined,
      }));

      const challenge = await generateNextChallenge(
        position,
        recentChallengeIds,
        activeSettings
      );

      setState((current) => ({
        ...current,
        status: 'active',
        playerPosition: position,
        playerLabel,
        currentChallenge: challenge,
        recentChallengeIds,
        completedChallenges,
        errorMessage: undefined,
      }));
    },
    []
  );

  const updateSettings = useCallback((nextSettings: Partial<GameSettings>) => {
    setSettings((current) => {
      const merged = {
        ...current,
        ...nextSettings,
      };
      const minDistanceMeters = Math.max(
        50,
        Math.round(merged.minDistanceMeters)
      );
      const maxDistanceMeters = Math.max(
        minDistanceMeters + 100,
        Math.round(merged.maxDistanceMeters)
      );

      return {
        ...merged,
        minDistanceMeters,
        maxDistanceMeters,
      };
    });
  }, []);

  const startGame = useCallback(async () => {
    isCompletingRef.current = false;
    clearNoticeTimer();
    setCompletionNotice(null);
    setState({
      ...INITIAL_GAME_STATE,
      status: 'spawning',
    });

    try {
      const spawn = await generateAddressSpawn(settings);
      await loadChallengeFromPosition(
        spawn,
        spawn.name ?? 'Địa chỉ cố định',
        [],
        0,
        settings
      );
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        errorMessage:
          error instanceof Error ? error.message : 'Could not start the game',
      }));
    }
  }, [clearNoticeTimer, loadChallengeFromPosition, settings]);

  const spawnNewAddressPosition = useCallback(async () => {
    isCompletingRef.current = false;
    clearNoticeTimer();
    setCompletionNotice(null);
    setState((current) => ({
      ...current,
      status: 'spawning',
      currentChallenge: null,
      errorMessage: undefined,
    }));

    try {
      const spawn = await generateAddressSpawn(settings);
      await loadChallengeFromPosition(
        spawn,
        spawn.name ?? 'Địa chỉ cố định',
        state.recentChallengeIds,
        state.completedChallenges,
        settings
      );
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Could not generate a new address spawn',
      }));
    }
  }, [
    clearNoticeTimer,
    loadChallengeFromPosition,
    settings,
    state.completedChallenges,
    state.recentChallengeIds,
  ]);

  const completeCurrentChallenge = useCallback(async () => {
    if (
      isCompletingRef.current ||
      state.status !== 'active' ||
      !state.currentChallenge
    ) {
      return;
    }

    isCompletingRef.current = true;

    const completedChallenge = state.currentChallenge;
    const nextCompletedCount = state.completedChallenges + 1;
    const nextPosition = {
      lat: completedChallenge.destination.lat,
      lon: completedChallenge.destination.lon,
    };
    const nextPlayerLabel = completedChallenge.destination.name;
    const nextRecentChallengeIds = pushRecentChallenge(
      state.recentChallengeIds,
      completedChallenge
    );

    showCompletionNotice({
      challengeNumber: nextCompletedCount,
      destinationName: completedChallenge.destination.name,
    });

    setState((current) => ({
      ...current,
      status: 'completed',
      playerPosition: nextPosition,
      playerLabel: nextPlayerLabel,
      completedChallenges: nextCompletedCount,
      recentChallengeIds: nextRecentChallengeIds,
      currentChallenge: {
        ...completedChallenge,
        status: 'completed',
      },
      errorMessage: undefined,
    }));

    try {
      const nextChallenge = await generateNextChallenge(
        nextPosition,
        nextRecentChallengeIds,
        settings
      );

      setState((current) => ({
        ...current,
        status: 'active',
        playerPosition: nextPosition,
        playerLabel: nextPlayerLabel,
        currentChallenge: nextChallenge,
        completedChallenges: nextCompletedCount,
        recentChallengeIds: nextRecentChallengeIds,
        errorMessage: undefined,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: 'error',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Could not generate the next challenge',
      }));
    } finally {
      isCompletingRef.current = false;
    }
  }, [settings, showCompletionNotice, state]);

  const teleportToDestination = useCallback(() => {
    const challenge = state.currentChallenge;

    if (!challenge) {
      return;
    }

    setState((current) => ({
      ...current,
      playerPosition: {
        lat: challenge.destination.lat,
        lon: challenge.destination.lon,
      },
      playerLabel: challenge.destination.name,
    }));
  }, [state.currentChallenge]);

  useEffect(() => {
    if (
      state.status !== 'active' ||
      !state.playerPosition ||
      !state.currentChallenge ||
      state.currentChallenge.status !== 'active'
    ) {
      return;
    }

    const remainingDistance = getDistanceMeters(
      state.playerPosition,
      state.currentChallenge.destination
    );

    if (remainingDistance <= CHALLENGE_COMPLETION_RADIUS) {
      void completeCurrentChallenge();
    }
  }, [
    completeCurrentChallenge,
    state.currentChallenge,
    state.playerPosition,
    state.status,
  ]);

  useEffect(() => clearNoticeTimer, [clearNoticeTimer]);

  return {
    state,
    settings,
    completionNotice,
    startGame,
    updateSettings,
    completeCurrentChallenge,
    teleportToDestination,
    spawnNewAddressPosition,
  };
}
