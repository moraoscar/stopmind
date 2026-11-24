import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  collectWordsForAiValidation,
  ConnectionStatus,
  DEFAULT_CONFIG,
  DEFAULT_SERVER_PORT,
  GameConfig,
  LetterDeck,
  RoomSnapshot,
  RoundResults,
  scoreRoundLocal,
} from '@stopmind/shared';
import { isEmbeddedLanServerAvailable } from '../../modules/lan-server';
import { EmbeddedHostEngine } from '../host/EmbeddedHostEngine';
import { validateRoundViaBackend } from '../utils/apiValidator';
import { getWordHint } from '../utils/hintProvider';
import {
  buildJoinQrPayload,
  buildOnlineRoomWsUrl,
  generateRandomRoomCode,
  getDefaultLanServerUrl,
  getOnlineRealtimeBaseUrl,
  isOnlineWsUrl,
  normalizeServerUrl,
} from '../utils/network';
import {
  loadSavedAvatarBg,
  loadSavedAvatarId,
  loadSavedPlayerName,
  savePlayerAvatarBgLocal,
  savePlayerAvatarLocal,
  savePlayerNameLocal,
} from '../utils/playerStorage';
import {
  isAllowedRealtimeWsUrl,
  isValidRoomSnapshot,
  isValidRoundResults,
  MAX_WS_INCOMING_BYTES,
  sanitizeDisplayText,
} from '../utils/security';

export type RoomMode = 'lan' | 'online';

interface StopBanner {
  reason: 'stop' | 'timeout';
  stoppedByName: string | null;
}

interface GameContextValue {
  playerName: string;
  setPlayerName: (name: string) => void;
  playerAvatar: string;
  setPlayerAvatar: (avatarId: string) => void;
  playerAvatarBg: string;
  setPlayerAvatarBg: (avatarBg: string) => void;
  serverUrl: string;
  setServerUrl: (url: string) => void;
  connectionStatus: ConnectionStatus;
  roomMode: RoomMode;
  onlineAvailable: boolean;
  isPhoneHost: boolean;
  errorMessage: string | null;
  clearError: () => void;

  config: GameConfig;
  updateConfig: (
    updater: Partial<GameConfig> | ((prev: GameConfig) => GameConfig)
  ) => void;

  room: RoomSnapshot | null;
  playerId: string | null;
  isHost: boolean;
  qrPayload: string | null;
  effectiveWsUrl: string;

  currentRound: number;
  totalRounds: number;
  currentLetter: string;
  roundEndsAt: number | null;
  isRoundLocked: boolean;
  stopBanner: StopBanner | null;
  answers: Record<string, string>;
  hintsUsed: number;
  roundResults: RoundResults | null;

  createLanRoom: (overrideUrl?: string) => Promise<boolean>;
  createOnlineRoom: () => Promise<boolean>;
  joinLanRoom: (
    wsUrl: string,
    roomCode: string,
    nameOverride?: string
  ) => Promise<boolean>;
  joinOnlineRoom: (
    roomCode: string,
    nameOverride?: string
  ) => Promise<boolean>;
  startGame: () => void;
  setAnswer: (category: string, value: string) => void;
  requestHint: (category: string) => Promise<{
    word: string | null;
    lockSeconds: number;
    pointsPenalty: number;
  }>;
  pressStop: () => void;
  triggerLocalTimeout: () => void;
  nextRound: () => void;
  finishGame: () => void;
  playAgain: () => void;
  leaveGame: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

function triggerHaptic(type: 'light' | 'success' | 'warning') {
  if (Platform.OS === 'web') return;
  try {
    if (type === 'light') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (type === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch {
    // Ignore haptic errors on unsupported devices
  }
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [playerName, setPlayerNameState] = useState<string>(() =>
    loadSavedPlayerName()
  );
  const [playerAvatar, setPlayerAvatarState] = useState<string>(() =>
    loadSavedAvatarId()
  );
  const [playerAvatarBg, setPlayerAvatarBgState] = useState<string>(() =>
    loadSavedAvatarBg()
  );
  const [serverUrl, setServerUrlState] = useState<string>(() =>
    getDefaultLanServerUrl()
  );
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected');
  const [roomMode, setRoomMode] = useState<RoomMode>('lan');
  const [isPhoneHost, setIsPhoneHost] = useState(false);
  const onlineBaseUrl = getOnlineRealtimeBaseUrl();
  const onlineAvailable = onlineBaseUrl.length > 0;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const [currentRound, setCurrentRound] = useState(0);
  const [currentLetter, setCurrentLetter] = useState('');
  const [roundEndsAt, setRoundEndsAt] = useState<number | null>(null);
  const [isRoundLocked, setIsRoundLocked] = useState(false);
  const [stopBanner, setStopBanner] = useState<StopBanner | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hintsUsed, setHintsUsed] = useState(0);
  const [roundResults, setRoundResults] = useState<RoundResults | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const embeddedHostRef = useRef<EmbeddedHostEngine | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const hintsUsedRef = useRef<number>(0);
  const configRef = useRef<GameConfig>(config);
  const playerNameRef = useRef(playerName);
  const playerAvatarRef = useRef(playerAvatar);
  const playerAvatarBgRef = useRef(playerAvatarBg);
  const playerIdRef = useRef<string | null>(null);
  const roomRef = useRef<RoomSnapshot | null>(null);
  const connectionStatusRef = useRef<ConnectionStatus>(connectionStatus);
  const isRoundLockedRef = useRef(false);
  const stopBannerRef = useRef<StopBanner | null>(null);
  const roundResultsRef = useRef<RoundResults | null>(null);
  const onResultsScreenRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultsNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectSeqRef = useRef(0);

  // Local solo state refs (letterDeck persists across consecutive matches)
  const localLetterDeckRef = useRef<LetterDeck>(new LetterDeck());
  const localTotalScoreRef = useRef<number>(0);
  const localRoundRef = useRef<number>(0);
  const localLetterRef = useRef<string>('');

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  useEffect(() => {
    playerAvatarRef.current = playerAvatar;
  }, [playerAvatar]);

  useEffect(() => {
    playerAvatarBgRef.current = playerAvatarBg;
  }, [playerAvatarBg]);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  useEffect(() => {
    isRoundLockedRef.current = isRoundLocked;
  }, [isRoundLocked]);

  const clearError = useCallback(() => setErrorMessage(null), []);

  const setPlayerName = useCallback((name: string) => {
    setPlayerNameState(name);
    savePlayerNameLocal(name);
    if (embeddedHostRef.current) {
      embeddedHostRef.current.updateHostName(name);
    }
  }, []);

  const setPlayerAvatar = useCallback((avatarId: string) => {
    setPlayerAvatarState(avatarId);
    playerAvatarRef.current = avatarId;
    savePlayerAvatarLocal(avatarId);
    if (embeddedHostRef.current) {
      embeddedHostRef.current.updateHostAvatar(avatarId);
    }
  }, []);

  const setPlayerAvatarBg = useCallback((avatarBg: string) => {
    setPlayerAvatarBgState(avatarBg);
    playerAvatarBgRef.current = avatarBg;
    savePlayerAvatarBgLocal(avatarBg);
    if (embeddedHostRef.current) {
      embeddedHostRef.current.updateHostAvatarBg(avatarBg);
    }
  }, []);

  const setServerUrl = useCallback((url: string) => {
    setServerUrlState(url);
  }, []);

  const stopEmbeddedHost = useCallback(() => {
    if (embeddedHostRef.current) {
      embeddedHostRef.current.stop();
      embeddedHostRef.current = null;
    }
    setIsPhoneHost(false);
  }, []);

  const closeSocket = useCallback(() => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    if (resultsNavTimerRef.current) {
      clearTimeout(resultsNavTimerRef.current);
      resultsNavTimerRef.current = null;
    }
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'leave_room' }));
        }
        ws.close();
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      closeSocket();
      stopEmbeddedHost();
    };
  }, [closeSocket, stopEmbeddedHost]);

  const sendWs = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  const openAndHandshake = useCallback(
    (
      rawUrl: string,
      handshakePayload: Record<string, unknown>,
      fallbackToLocal: boolean
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        const attemptSeq = ++connectSeqRef.current;
        closeSocket();
        stopEmbeddedHost();
        const url = normalizeServerUrl(rawUrl);
        if (!isAllowedRealtimeWsUrl(url, getOnlineRealtimeBaseUrl())) {
          if (fallbackToLocal) {
            setConnectionStatus('local');
            setRoom(null);
            setPlayerId('local_player');
          } else {
            setConnectionStatus('disconnected');
            setErrorMessage('Dirección de servidor no autorizada o inválida.');
          }
          resolve(false);
          return;
        }
        const onlineAttempt = isOnlineWsUrl(url);
        setRoomMode(onlineAttempt ? 'online' : 'lan');
        setServerUrlState(url);
        setConnectionStatus('connecting');
        setErrorMessage(null);

        let settled = false;
        let ws: WebSocket;
        try {
          ws = new WebSocket(url);
        } catch {
          if (attemptSeq !== connectSeqRef.current) {
            resolve(false);
            return;
          }
          if (fallbackToLocal) {
            setConnectionStatus('local');
            setRoom(null);
            setPlayerId('local_player');
          } else {
            setConnectionStatus('disconnected');
            setErrorMessage('Dirección de servidor WiFi inválida.');
          }
          resolve(false);
          return;
        }

        wsRef.current = ws;

        const connectTimeout = setTimeout(() => {
          if (!settled && attemptSeq === connectSeqRef.current) {
            settled = true;
            closeSocket();
            if (fallbackToLocal) {
              setConnectionStatus('local');
              setRoom(null);
              setPlayerId('local_player');
            } else {
              setConnectionStatus('disconnected');
              setErrorMessage(
                onlineAttempt
                  ? 'No se pudo conectar al servidor online. Verifica tu conexión a internet e intenta de nuevo.'
                  : 'No se pudo conectar con el teléfono anfitrión. Verifica que ambos estén en el mismo WiFi y acepta el permiso de Red Local.'
              );
            }
            resolve(false);
          }
        }, 8000);

        ws.onopen = () => {
          if (attemptSeq !== connectSeqRef.current || wsRef.current !== ws) {
            ws.close();
            return;
          }
          ws.send(JSON.stringify(handshakePayload));
        };

        ws.onmessage = (event) => {
          if (attemptSeq !== connectSeqRef.current || wsRef.current !== ws) {
            return;
          }
          const rawText = typeof event.data === 'string' ? event.data : String(event.data ?? '');
          if (rawText.length > MAX_WS_INCOMING_BYTES) {
            return;
          }
          let msg: Record<string, unknown>;
          try {
            const parsed = JSON.parse(rawText);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              return;
            }
            msg = parsed as Record<string, unknown>;
          } catch {
            return;
          }

          switch (msg.type) {
            case 'joined': {
              if (!isValidRoomSnapshot(msg.room)) {
                return;
              }
              clearTimeout(connectTimeout);
              const joinedPlayerId = sanitizeDisplayText(msg.playerId, 64);
              const snapshot = msg.room;
              setPlayerId(joinedPlayerId);
              setRoom(snapshot);
              setConfig(snapshot.config);
              setConnectionStatus('connected');
              setErrorMessage(null);
              if (!settled) {
                settled = true;
                resolve(true);
              }
              break;
            }

            case 'room_state': {
              if (!isValidRoomSnapshot(msg.room)) {
                return;
              }
              const snapshot = msg.room;
              const prevPhase = roomRef.current?.phase;
              setRoom(snapshot);
              setConfig(snapshot.config);

              if (
                (prevPhase === 'results' || prevPhase === 'finished') &&
                snapshot.phase === 'lobby'
              ) {
                stopBannerRef.current = null;
                setStopBanner(null);
                setIsRoundLocked(false);
                isRoundLockedRef.current = false;
                roundResultsRef.current = null;
                setRoundResults(null);
                onResultsScreenRef.current = false;
                if (snapshot.hostId === playerIdRef.current) {
                  router.replace('/setup');
                } else {
                  router.replace('/join');
                }
              }
              break;
            }

            case 'round_started': {
              if (resultsNavTimerRef.current) {
                clearTimeout(resultsNavTimerRef.current);
                resultsNavTimerRef.current = null;
              }
              const roundNumber = Number.isFinite(Number(msg.roundNumber))
                ? Math.max(1, Math.min(50, Math.floor(Number(msg.roundNumber))))
                : 1;
              const letter = sanitizeDisplayText(msg.letter, 2).toUpperCase() || 'A';
              const durationSeconds = Number.isFinite(Number(msg.durationSeconds))
                ? Math.max(10, Math.min(600, Number(msg.durationSeconds)))
                : 60;
              const serverNow = Number.isFinite(Number(msg.serverNow))
                ? Number(msg.serverNow)
                : Date.now();
              const endsAtServer = Number.isFinite(Number(msg.endsAt))
                ? Number(msg.endsAt)
                : serverNow + durationSeconds * 1000;
              const clockOffset = Date.now() - serverNow;
              const localEndsAt = endsAtServer + clockOffset;

              answersRef.current = {};
              hintsUsedRef.current = 0;
              setAnswers({});
              setHintsUsed(0);
              setCurrentRound(roundNumber);
              setCurrentLetter(letter);
              setRoundEndsAt(localEndsAt);
              setIsRoundLocked(false);
              isRoundLockedRef.current = false;
              stopBannerRef.current = null;
              setStopBanner(null);
              onResultsScreenRef.current = false;

              triggerHaptic('light');
              router.replace('/play');
              break;
            }

            case 'force_stop': {
              const reason = (msg.reason === 'stop' ? 'stop' : 'timeout') as
                | 'stop'
                | 'timeout';
              const stoppedByName =
                typeof msg.stoppedByName === 'string'
                  ? sanitizeDisplayText(msg.stoppedByName, 24) || null
                  : null;

              setIsRoundLocked(true);
              isRoundLockedRef.current = true;
              const banner = { reason, stoppedByName };
              stopBannerRef.current = banner;
              setStopBanner(banner);
              triggerHaptic('warning');

              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    type: 'submit_answers',
                    answers: answersRef.current,
                    hintsUsed: hintsUsedRef.current,
                  })
                );
              }
              break;
            }

            case 'round_results': {
              if (!isValidRoundResults(msg.results)) {
                return;
              }
              const results = msg.results;
              const alreadyOnResults = onResultsScreenRef.current;
              const hadStopBanner = stopBannerRef.current !== null;
              roundResultsRef.current = results;
              setRoundResults(results);
              setRoundEndsAt(null);
              setIsRoundLocked(true);
              isRoundLockedRef.current = true;
              triggerHaptic('success');

              if (!alreadyOnResults) {
                onResultsScreenRef.current = true;
                if (resultsNavTimerRef.current) {
                  clearTimeout(resultsNavTimerRef.current);
                }
                if (!hadStopBanner) {
                  router.replace('/results');
                } else {
                  resultsNavTimerRef.current = setTimeout(() => {
                    router.replace('/results');
                  }, 550);
                }
              }
              break;
            }

            case 'error': {
              clearTimeout(connectTimeout);
              const message =
                sanitizeDisplayText(msg.message, 160) ||
                'Error de conexión con la sala.';
              setErrorMessage(message);
              if (!settled) {
                settled = true;
                closeSocket();
                setConnectionStatus('disconnected');
                resolve(false);
              }
              break;
            }

            default:
              break;
          }
        };

        ws.onerror = () => {
          if (attemptSeq !== connectSeqRef.current || wsRef.current !== ws) {
            return;
          }
          if (!settled) {
            clearTimeout(connectTimeout);
            settled = true;
            closeSocket();
            if (fallbackToLocal) {
              setConnectionStatus('local');
              setRoom(null);
              setPlayerId('local_player');
            } else {
              setConnectionStatus('disconnected');
              setErrorMessage(
                onlineAttempt
                  ? 'No se pudo conectar con la sala online. Revisa el código o tu conexión a internet.'
                  : 'No se encontró la partida en esa dirección WiFi.'
              );
            }
            resolve(false);
          }
        };

        ws.onclose = () => {
          if (attemptSeq !== connectSeqRef.current) {
            return;
          }
          if (!settled) {
            clearTimeout(connectTimeout);
            settled = true;
            if (fallbackToLocal) {
              setConnectionStatus('local');
              setRoom(null);
              setPlayerId('local_player');
            } else {
              setConnectionStatus('disconnected');
            }
            resolve(false);
          } else if (wsRef.current === ws) {
            wsRef.current = null;
            setConnectionStatus('disconnected');
            setRoom(null);
            setErrorMessage('Se perdió la conexión con el anfitrión.');
          }
        };
      });
    },
    [closeSocket, stopEmbeddedHost]
  );

  const createLanRoom = useCallback(
    async (overrideUrl?: string): Promise<boolean> => {
      const safeName = playerNameRef.current.trim() || 'Anfitrión';

      if (!overrideUrl && isEmbeddedLanServerAvailable()) {
        closeSocket();
        stopEmbeddedHost();
        setConnectionStatus('connecting');
        setErrorMessage(null);

        const engine = new EmbeddedHostEngine(
          safeName,
          configRef.current,
          {
            onRoomState: (snapshot) => {
            const prevPhase = roomRef.current?.phase;
            setRoom(snapshot);
            setConfig(snapshot.config);
            if (
              (prevPhase === 'results' || prevPhase === 'finished') &&
              snapshot.phase === 'lobby'
            ) {
              stopBannerRef.current = null;
              setStopBanner(null);
              setIsRoundLocked(false);
              isRoundLockedRef.current = false;
              roundResultsRef.current = null;
              setRoundResults(null);
              onResultsScreenRef.current = false;
              router.replace('/setup');
            }
          },
          onRoundStarted: ({ roundNumber, letter, endsAt }) => {
            if (resultsNavTimerRef.current) {
              clearTimeout(resultsNavTimerRef.current);
              resultsNavTimerRef.current = null;
            }
            answersRef.current = {};
            hintsUsedRef.current = 0;
            setAnswers({});
            setHintsUsed(0);
            setCurrentRound(roundNumber);
            setCurrentLetter(letter);
            setRoundEndsAt(endsAt);
            setIsRoundLocked(false);
            isRoundLockedRef.current = false;
            stopBannerRef.current = null;
            setStopBanner(null);
            onResultsScreenRef.current = false;
            triggerHaptic('light');
            router.replace('/play');
          },
          onForceStop: ({ reason, stoppedByName }) => {
            setIsRoundLocked(true);
            isRoundLockedRef.current = true;
            const banner = { reason, stoppedByName };
            stopBannerRef.current = banner;
            setStopBanner(banner);
            triggerHaptic('warning');
          },
          onRoundResults: (results) => {
            const alreadyOnResults = onResultsScreenRef.current;
            const hadStopBanner = stopBannerRef.current !== null;
            roundResultsRef.current = results;
            setRoundResults(results);
            setRoundEndsAt(null);
            setIsRoundLocked(true);
            isRoundLockedRef.current = true;
            triggerHaptic('success');
            if (!alreadyOnResults) {
              onResultsScreenRef.current = true;
              if (resultsNavTimerRef.current) {
                clearTimeout(resultsNavTimerRef.current);
              }
              if (!hadStopBanner) {
                router.replace('/results');
              } else {
                resultsNavTimerRef.current = setTimeout(() => {
                  router.replace('/results');
                }, 550);
              }
            }
          },
        }, playerAvatarRef.current, playerAvatarBgRef.current);

        try {
          const {
            playerId: hostPlayerId,
            room: snapshot,
            serverInfo,
          } = await engine.start(DEFAULT_SERVER_PORT);
          embeddedHostRef.current = engine;
          setRoomMode('lan');
          setIsPhoneHost(true);
          setPlayerId(hostPlayerId);
          setRoom(snapshot);
          setServerUrlState(serverInfo.wsUrl);
          setConnectionStatus('connected');
          setErrorMessage(null);
          return true;
        } catch {
          engine.stop();
          setIsPhoneHost(false);
        }
      }

      const targetUrl = overrideUrl ?? serverUrl;
      return openAndHandshake(
        targetUrl,
        {
          type: 'create_room',
          playerName: safeName,
          avatarId: playerAvatarRef.current,
          avatarBg: playerAvatarBgRef.current,
          config: configRef.current,
        },
        true
      );
    },
    [closeSocket, openAndHandshake, serverUrl, stopEmbeddedHost]
  );

  const createOnlineRoom = useCallback(async (): Promise<boolean> => {
    const base = getOnlineRealtimeBaseUrl();
    if (!base) {
      setErrorMessage(
        'Modo Online no disponible en este momento. Usa Wi-Fi local para jugar sin internet.'
      );
      return false;
    }

    const safeName = playerNameRef.current.trim() || 'Anfitrión';
    const roomCode = generateRandomRoomCode(4);
    const roomWsUrl = buildOnlineRoomWsUrl(roomCode, base);

    return openAndHandshake(
      roomWsUrl,
      {
        type: 'create_room',
        roomCode,
        playerName: safeName,
        avatarId: playerAvatarRef.current,
        avatarBg: playerAvatarBgRef.current,
        config: configRef.current,
      },
      false
    );
  }, [openAndHandshake]);

  const joinLanRoom = useCallback(
    async (
      wsUrl: string,
      roomCode: string,
      nameOverride?: string
    ): Promise<boolean> => {
      const safeName =
        (nameOverride ?? playerNameRef.current).trim() || 'Jugador';
      if (nameOverride && nameOverride.trim()) {
        const cleaned = nameOverride.trim();
        setPlayerNameState(cleaned);
        savePlayerNameLocal(cleaned);
      }
      return openAndHandshake(
        wsUrl,
        {
          type: 'join_room',
          roomCode: roomCode.trim().toUpperCase(),
          playerName: safeName,
          avatarId: playerAvatarRef.current,
          avatarBg: playerAvatarBgRef.current,
        },
        false
      );
    },
    [openAndHandshake]
  );

  const joinOnlineRoom = useCallback(
    async (roomCode: string, nameOverride?: string): Promise<boolean> => {
      const base = getOnlineRealtimeBaseUrl();
      if (!base) {
        setErrorMessage(
          'Modo Online no disponible en este momento. Usa Wi-Fi local para jugar sin internet.'
        );
        return false;
      }
      const cleanCode = roomCode.trim().toUpperCase();
      if (!cleanCode) {
        setErrorMessage('Ingresa el código de 4 caracteres de la sala.');
        return false;
      }
      const roomWsUrl = buildOnlineRoomWsUrl(cleanCode, base);
      return joinLanRoom(roomWsUrl, cleanCode, nameOverride);
    },
    [joinLanRoom]
  );

  const updateConfig = useCallback(
    (updater: Partial<GameConfig> | ((prev: GameConfig) => GameConfig)) => {
      setConfig((prev) => {
        const next =
          typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        configRef.current = next;
        if (embeddedHostRef.current) {
          embeddedHostRef.current.updateConfig(next);
        } else if (
          connectionStatusRef.current === 'connected' &&
          roomRef.current?.hostId === playerIdRef.current
        ) {
          sendWs({ type: 'update_config', config: next });
        }
        return next;
      });
    },
    [sendWs]
  );

  const pickLocalLetter = useCallback(() => {
    return localLetterDeckRef.current.draw(configRef.current.allowedLetters);
  }, []);

  const startLocalRound = useCallback(
    (roundNumber: number) => {
      if (resultsNavTimerRef.current) {
        clearTimeout(resultsNavTimerRef.current);
        resultsNavTimerRef.current = null;
      }
      const cfg = configRef.current;
      const letter = pickLocalLetter();
      localRoundRef.current = roundNumber;
      localLetterRef.current = letter;

      answersRef.current = {};
      hintsUsedRef.current = 0;
      setAnswers({});
      setHintsUsed(0);
      setCurrentRound(roundNumber);
      setCurrentLetter(letter);
      setRoundEndsAt(Date.now() + cfg.timeLimitSeconds * 1000);
      setIsRoundLocked(false);
      isRoundLockedRef.current = false;
      stopBannerRef.current = null;
      setStopBanner(null);
      onResultsScreenRef.current = false;

      triggerHaptic('light');
      router.replace('/play');
    },
    [pickLocalLetter]
  );

  const finishLocalRound = useCallback(async (reason: 'stop' | 'timeout') => {
    if (isRoundLockedRef.current) return;
    isRoundLockedRef.current = true;
    setIsRoundLocked(true);

    const safeName = playerNameRef.current.trim() || 'Jugador';
    const banner = {
      reason,
      stoppedByName: reason === 'stop' ? safeName : null,
    };
    stopBannerRef.current = banner;
    setStopBanner(banner);
    triggerHaptic('warning');

    const cfg = configRef.current;
    const pId = 'local_player';
    const playersList = [{ id: pId, name: safeName }];
    const snapshotAnswers = { [pId]: { ...answersRef.current } };

    let aiVerdicts: Map<string, { valid: boolean; reason?: string }> | undefined;
    let usedAi = false;

    if (cfg.aiValidation) {
      const items = collectWordsForAiValidation({
        categories: cfg.categories,
        letter: localLetterRef.current,
        validateLetter: cfg.validateLetter,
        players: playersList,
        answersByPlayer: snapshotAnswers,
      });
      if (items.length > 0) {
        const aiRes = await validateRoundViaBackend({ items });
        aiVerdicts = aiRes.verdicts;
        usedAi = aiRes.usedAi;
      }
    }

    const hintPoints =
      cfg.hintsEnabled &&
      (cfg.hintPenaltyMode === 'points' || cfg.hintPenaltyMode === 'both')
        ? cfg.hintPenaltyPoints
        : 0;

    const { categoryResults, roundScores, hintPenalties } = scoreRoundLocal({
      categories: cfg.categories,
      letter: localLetterRef.current,
      validateLetter: cfg.validateLetter,
      players: playersList,
      answersByPlayer: snapshotAnswers,
      aiVerdicts,
      hintsUsedByPlayer: { [pId]: hintsUsedRef.current },
      hintPenaltyPoints: hintPoints,
    });

    const earned = roundScores[pId] ?? 0;
    localTotalScoreRef.current += earned;
    const roundNumber = localRoundRef.current;
    const isFinalRound = roundNumber >= cfg.totalRounds;

    const results: RoundResults = {
      roundNumber,
      totalRounds: cfg.totalRounds,
      letter: localLetterRef.current,
      stopReason: reason,
      stoppedByName: reason === 'stop' ? safeName : null,
      stoppedByPlayerId: reason === 'stop' ? pId : null,
      categoryResults,
      roundScores,
      leaderboard: [
        {
          playerId: pId,
          playerName: safeName,
          avatarId: playerAvatarRef.current,
          avatarBg: playerAvatarBgRef.current,
          roundScore: earned,
          totalScore: localTotalScoreRef.current,
          hintsUsed: hintsUsedRef.current,
          hintPenalty: hintPenalties[pId] ?? 0,
          isHost: true,
          rank: 1,
          stoppedRound: reason === 'stop',
          wonTiebreak: false,
        },
      ],
      isFinalRound,
      validatedBy: usedAi ? 'gemini' : 'local',
    };

    roundResultsRef.current = results;
    setRoundResults(results);
    setRoundEndsAt(null);
    onResultsScreenRef.current = true;
    if (resultsNavTimerRef.current) {
      clearTimeout(resultsNavTimerRef.current);
    }
    resultsNavTimerRef.current = setTimeout(() => {
      router.replace('/results');
    }, 450);
  }, []);

  const startGame = useCallback(() => {
    const cfg = configRef.current;
    if (cfg.categories.length === 0) {
      setErrorMessage('Selecciona al menos una categoría para jugar.');
      return;
    }
    if (cfg.allowedLetters.length === 0) {
      setErrorMessage('Selecciona al menos una letra para jugar.');
      return;
    }

    if (embeddedHostRef.current) {
      embeddedHostRef.current.startGame(cfg);
      return;
    }

    if (connectionStatusRef.current === 'connected' && roomRef.current) {
      sendWs({ type: 'start_game', config: cfg });
      return;
    }

    setConnectionStatus('local');
    setPlayerId('local_player');
    localTotalScoreRef.current = 0;
    roundResultsRef.current = null;
    setRoundResults(null);
    onResultsScreenRef.current = false;
    startLocalRound(1);
  }, [sendWs, startLocalRound]);

  const setAnswer = useCallback(
    (category: string, value: string) => {
      if (isRoundLockedRef.current) return;
      const next = { ...answersRef.current, [category]: value };
      answersRef.current = next;
      setAnswers(next);

      if (embeddedHostRef.current) {
        embeddedHostRef.current.syncHostDraft(next, hintsUsedRef.current);
        return;
      }

      if (connectionStatusRef.current === 'connected') {
        if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
        draftTimerRef.current = setTimeout(() => {
          sendWs({
            type: 'sync_draft',
            answers: answersRef.current,
            hintsUsed: hintsUsedRef.current,
          });
        }, 180);
      }
    },
    [sendWs]
  );

  const requestHint = useCallback(
    async (category: string) => {
      if (isRoundLockedRef.current) {
        return { word: null, lockSeconds: 0, pointsPenalty: 0 };
      }
      const activeCfg = roomRef.current?.config ?? configRef.current;
      if (!activeCfg.hintsEnabled) {
        return { word: null, lockSeconds: 0, pointsPenalty: 0 };
      }

      const letter =
        roomRef.current?.currentLetter || localLetterRef.current || currentLetter;
      const word = await getWordHint({
        category,
        letter,
        currentValue: answersRef.current[category] ?? '',
      });

      if (!word || isRoundLockedRef.current) {
        return { word: null, lockSeconds: 0, pointsPenalty: 0 };
      }

      const nextAnswers = { ...answersRef.current, [category]: word };
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);

      const nextHints = hintsUsedRef.current + 1;
      hintsUsedRef.current = nextHints;
      setHintsUsed(nextHints);
      triggerHaptic('light');

      if (embeddedHostRef.current) {
        embeddedHostRef.current.syncHostDraft(nextAnswers, nextHints);
      } else if (connectionStatusRef.current === 'connected') {
        sendWs({
          type: 'sync_draft',
          answers: nextAnswers,
          hintsUsed: nextHints,
        });
      }

      const lockSeconds =
        activeCfg.hintPenaltyMode === 'lock' ||
        activeCfg.hintPenaltyMode === 'both'
          ? activeCfg.hintLockSeconds
          : 0;
      const pointsPenalty =
        activeCfg.hintPenaltyMode === 'points' ||
        activeCfg.hintPenaltyMode === 'both'
          ? activeCfg.hintPenaltyPoints
          : 0;

      return { word, lockSeconds, pointsPenalty };
    },
    [currentLetter, sendWs]
  );

  const pressStop = useCallback(() => {
    if (isRoundLockedRef.current) return;

    if (embeddedHostRef.current) {
      embeddedHostRef.current.pressHostStop(
        answersRef.current,
        hintsUsedRef.current
      );
      return;
    }

    if (connectionStatusRef.current === 'connected' && roomRef.current) {
      isRoundLockedRef.current = true;
      setIsRoundLocked(true);
      setStopBanner({
        reason: 'stop',
        stoppedByName: playerNameRef.current.trim() || 'Tú',
      });
      triggerHaptic('warning');
      sendWs({
        type: 'press_stop',
        answers: answersRef.current,
        hintsUsed: hintsUsedRef.current,
      });
      return;
    }

    void finishLocalRound('stop');
  }, [finishLocalRound, sendWs]);

  const triggerLocalTimeout = useCallback(() => {
    if (embeddedHostRef.current) {
      return;
    }
    if (connectionStatusRef.current === 'connected') {
      if (!isRoundLockedRef.current) {
        isRoundLockedRef.current = true;
        setIsRoundLocked(true);
        setStopBanner({ reason: 'timeout', stoppedByName: null });
        sendWs({
          type: 'submit_answers',
          answers: answersRef.current,
          hintsUsed: hintsUsedRef.current,
        });
      }
      return;
    }
    void finishLocalRound('timeout');
  }, [finishLocalRound, sendWs]);

  const nextRound = useCallback(() => {
    if (embeddedHostRef.current) {
      embeddedHostRef.current.nextRound();
      return;
    }
    if (connectionStatusRef.current === 'connected' && roomRef.current) {
      sendWs({ type: 'next_round' });
      return;
    }
    startLocalRound(localRoundRef.current + 1);
  }, [sendWs, startLocalRound]);

  const finishGame = useCallback(() => {
    if (embeddedHostRef.current) {
      embeddedHostRef.current.finishGame();
      return;
    }
    if (connectionStatusRef.current === 'connected' && roomRef.current) {
      sendWs({ type: 'finish_game' });
      return;
    }

    // Solo mode early finish: lock active round and display final summary with accumulated points
    if (resultsNavTimerRef.current) {
      clearTimeout(resultsNavTimerRef.current);
      resultsNavTimerRef.current = null;
    }
    isRoundLockedRef.current = true;
    setIsRoundLocked(true);
    setRoundEndsAt(null);
    stopBannerRef.current = null;
    setStopBanner(null);

    const safeName = playerNameRef.current.trim() || 'Jugador';
    const prevResults = roundResultsRef.current;
    const finalResults: RoundResults = prevResults
      ? {
          ...prevResults,
          isFinalRound: true,
        }
      : {
          roundNumber: Math.max(1, localRoundRef.current),
          totalRounds: configRef.current.totalRounds,
          letter: localLetterRef.current || '—',
          stopReason: 'timeout',
          stoppedByName: null,
          stoppedByPlayerId: null,
          categoryResults: [],
          roundScores: { local_player: 0 },
          leaderboard: [
            {
              playerId: 'local_player',
              playerName: safeName,
              avatarId: playerAvatarRef.current,
              avatarBg: playerAvatarBgRef.current,
              roundScore: 0,
              totalScore: localTotalScoreRef.current,
              hintsUsed: 0,
              hintPenalty: 0,
              isHost: true,
              rank: 1,
              stoppedRound: false,
              wonTiebreak: false,
            },
          ],
          isFinalRound: true,
          validatedBy: 'local',
        };

    const alreadyOnResults = onResultsScreenRef.current;
    roundResultsRef.current = finalResults;
    setRoundResults(finalResults);
    triggerHaptic('success');

    if (!alreadyOnResults) {
      onResultsScreenRef.current = true;
      router.replace('/results');
    }
  }, [sendWs]);

  const playAgain = useCallback(() => {
    if (embeddedHostRef.current) {
      embeddedHostRef.current.playAgain();
      return;
    }
    if (connectionStatusRef.current === 'connected' && roomRef.current) {
      sendWs({ type: 'play_again' });
      return;
    }
    stopBannerRef.current = null;
    setStopBanner(null);
    setIsRoundLocked(false);
    isRoundLockedRef.current = false;
    localTotalScoreRef.current = 0;
    roundResultsRef.current = null;
    setRoundResults(null);
    onResultsScreenRef.current = false;
    router.replace('/setup');
  }, [sendWs]);

  const leaveGame = useCallback(() => {
    closeSocket();
    stopEmbeddedHost();
    setConnectionStatus('disconnected');
    setRoom(null);
    setPlayerId(null);
    roundResultsRef.current = null;
    setRoundResults(null);
    onResultsScreenRef.current = false;
    stopBannerRef.current = null;
    setStopBanner(null);
    setIsRoundLocked(false);
    isRoundLockedRef.current = false;
    setAnswers({});
    answersRef.current = {};
    setHintsUsed(0);
    hintsUsedRef.current = 0;
    setErrorMessage(null);
    router.replace('/');
  }, [closeSocket, stopEmbeddedHost]);

  const isHost = useMemo(() => {
    if (isPhoneHost || connectionStatus === 'local' || !room) return true;
    return room.hostId === playerId;
  }, [isPhoneHost, connectionStatus, room, playerId]);

  const effectiveWsUrl = useMemo(() => {
    if (roomMode === 'online' && room?.roomCode) {
      const onlineUrl = buildOnlineRoomWsUrl(room.roomCode);
      if (onlineUrl) return onlineUrl;
    }
    if (room && room.serverIps.length > 0) {
      return `ws://${room.serverIps[0]}:${room.serverPort}`;
    }
    return normalizeServerUrl(serverUrl);
  }, [room, roomMode, serverUrl]);

  const qrPayload = useMemo(() => {
    if (!room?.roomCode) return null;
    return buildJoinQrPayload(effectiveWsUrl, room.roomCode);
  }, [effectiveWsUrl, room]);

  const totalRounds = room?.config.totalRounds ?? config.totalRounds;

  const value = useMemo<GameContextValue>(
    () => ({
      playerName,
      setPlayerName,
      playerAvatar,
      setPlayerAvatar,
      playerAvatarBg,
      setPlayerAvatarBg,
      serverUrl,
      setServerUrl,
      connectionStatus,
      roomMode,
      onlineAvailable,
      isPhoneHost,
      errorMessage,
      clearError,
      config,
      updateConfig,
      room,
      playerId,
      isHost,
      qrPayload,
      effectiveWsUrl,
      currentRound,
      totalRounds,
      currentLetter,
      roundEndsAt,
      isRoundLocked,
      stopBanner,
      answers,
      hintsUsed,
      roundResults,
      createLanRoom,
      createOnlineRoom,
      joinLanRoom,
      joinOnlineRoom,
      startGame,
      setAnswer,
      requestHint,
      pressStop,
      triggerLocalTimeout,
      nextRound,
      finishGame,
      playAgain,
      leaveGame,
    }),
    [
      playerName,
      setPlayerName,
      playerAvatar,
      setPlayerAvatar,
      playerAvatarBg,
      setPlayerAvatarBg,
      serverUrl,
      setServerUrl,
      connectionStatus,
      roomMode,
      onlineAvailable,
      isPhoneHost,
      errorMessage,
      clearError,
      config,
      updateConfig,
      room,
      playerId,
      isHost,
      qrPayload,
      effectiveWsUrl,
      currentRound,
      totalRounds,
      currentLetter,
      roundEndsAt,
      isRoundLocked,
      stopBanner,
      answers,
      hintsUsed,
      roundResults,
      createLanRoom,
      createOnlineRoom,
      joinLanRoom,
      joinOnlineRoom,
      startGame,
      setAnswer,
      requestHint,
      pressStop,
      triggerLocalTimeout,
      nextRound,
      finishGame,
      playAgain,
      leaveGame,
    ]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame debe usarse dentro de GameProvider');
  }
  return ctx;
}
