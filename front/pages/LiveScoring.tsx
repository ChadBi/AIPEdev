import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { getVideoUrl, checkModelStatus } from '../api';
import { getMusicUrl } from '../api/music';
import { getActionMusicSync, listActionMusicSync } from '../api/sync';
import {
  Action,
  ActionMusicSyncListItem,
  ActionMusicSyncLookup,
  LiveResultData,
  LiveResultFrame,
  LiveScoreSavePayload,
  LiveStats,
  LiveWsScorePayload,
  Keypoints,
} from '../types';
import CameraSelector from '../components/CameraSelector';
import LiveVideoPanel from '../components/LiveVideoPanel';
import {
  Play,
  Pause,
  Square,
  Clock,
  Target,
  Zap,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Music2,
  Settings,
} from 'lucide-react';

type LiveStage = 'select' | 'detect';

const DEFAULT_STATS: LiveStats = {
  fps: 0,
  frames_processed: 0,
  latency_ms: 0,
  current_score: 0,
  average_score: 0,
  music_playing: false,
  music_volume: 1,
};

function getErrorMessage(error: any, fallback: string): string {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      if (typeof first.msg === 'string') return first.msg;
      return JSON.stringify(first);
    }
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.msg === 'string') return detail.msg;
    return JSON.stringify(detail);
  }
  if (typeof error?.message === 'string') return error.message;
  return fallback;
}

function buildWsBaseUrl(): string {
  const configuredBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (configuredBase) {
    if (configuredBase.startsWith('https://')) return configuredBase.replace('https://', 'wss://');
    if (configuredBase.startsWith('http://')) return configuredBase.replace('http://', 'ws://');
    return configuredBase;
  }
  return '';
}

const LiveScoring: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialActionId = Number(searchParams.get('action_id') || '0');
  const initialVideoId = Number(searchParams.get('video_id') || '0');
  const initialMusicId = Number(searchParams.get('music_id') || '0');

  const [actions, setActions] = useState<Action[]>([]);
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const selectedAction = useMemo(
    () => actions.find(item => item.id === selectedActionId) || null,
    [actions, selectedActionId]
  );

  const [actionMusicList, setActionMusicList] = useState<ActionMusicSyncListItem[]>([]);
  const [selectedMusicId, setSelectedMusicId] = useState<number | null>(null);
  const selectedMusic = useMemo(
    () => actionMusicList.find(item => item.music_id === selectedMusicId) || null,
    [actionMusicList, selectedMusicId]
  );
  const [selectedSync, setSelectedSync] = useState<ActionMusicSyncLookup | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);

  const [stage, setStage] = useState<LiveStage>('select');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [modelLoaded, setModelLoaded] = useState(false);

  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    console.log('[LiveScoring] stream 状态变化:', {
      exists: !!stream,
      trackCount: stream ? stream.getTracks().length : 0,
      trackDetails: stream ? stream.getTracks().map(t => ({
        kind: t.kind,
        id: t.id.slice(0, 12),
        enabled: t.enabled
      })) : 'N/A'
    });
  }, [stream]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFullscreenCompare, setIsFullscreenCompare] = useState(false);
  const [showStatsPanel, setShowStatsPanel] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const isPlayingRef = useRef(false);
  const isFullscreenCompareRef = useRef(false);
  const ignoreNullStreamUpdateRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isFullscreenCompareRef.current = isFullscreenCompare;
  }, [isFullscreenCompare]);
  const [stats, setStats] = useState<LiveStats>(DEFAULT_STATS);
  const [displayFps, setDisplayFps] = useState(0);
  const [liveFrameScores, setLiveFrameScores] = useState<LiveResultFrame[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [keypoints, setKeypoints] = useState<Keypoints | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const wsManualCloseRef = useRef(false);
  const frameIntervalRef = useRef<number>();
  const fpsIntervalRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const sentFramesRef = useRef<number>(0);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const standardVideoRef = useRef<HTMLVideoElement | null>(null);
  const initialMusicAppliedRef = useRef(false);

  // 保存流，避免组件重新挂载时丢失
  const persistedStreamRef = useRef<MediaStream | null>(null);

  const clearFrameLoops = useCallback(() => {
    if (frameIntervalRef.current) {
      window.clearInterval(frameIntervalRef.current);
    }
    if (fpsIntervalRef.current) {
      window.clearInterval(fpsIntervalRef.current);
    }
    frameIntervalRef.current = undefined;
    fpsIntervalRef.current = undefined;
    sentFramesRef.current = 0;
  }, []);

  const stopWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsManualCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  }, []);

  const stopSession = useCallback((stopCamera: boolean, reason: string = 'unknown') => {
    console.log('[stopSession] 调用，参数:', stopCamera, '原因:', reason);
    const currentIsPlaying = isPlayingRef.current;
    const currentIsFullscreen = isFullscreenCompareRef.current;

    if (reason === 'cleanup' && currentIsFullscreen && currentIsPlaying) {
      console.log('[stopSession] 检测进行中，忽略组件重新挂载导致的 cleanup');
      return;
    }

    clearFrameLoops();
    stopWebSocket();

    if (standardVideoRef.current) {
      standardVideoRef.current.pause();
      standardVideoRef.current.currentTime = 0;
    }

    if (stopCamera && stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraReady(false);
      setSelectedCamera(null);
    }

    setIsPlaying(false);
    setIsPaused(false);
    setIsFullscreenCompare(false);
    if (reason !== 'cleanup') {
      ignoreNullStreamUpdateRef.current = false;
    } else {
      console.log('[stopSession] 组件卸载 cleanup，保持保护标记不重置');
    }
    setShowStatsPanel(true);
    setStats(prev => ({
      ...DEFAULT_STATS,
      music_volume: prev.music_volume,
    }));
    setDisplayFps(0);
    setLiveFrameScores([]);
    setSessionStartedAt(null);
  }, [clearFrameLoops, stopWebSocket, stream, isPaused]);

  const fetchLiveActions = useCallback(async () => {
    setLoading(true);
    setError('');
    setWarning('');

    try {
      let list: Action[] = [];
      try {
        const res = await api.get('/actions/live');
        list = (res.data || []) as Action[];
      } catch (liveErr: any) {
        const status = liveErr?.response?.status;
        if (status === 422 || status === 404) {
          const fallbackRes = await api.get('/actions/', { params: { limit: 500 } });
          const allActions = (fallbackRes.data || []) as Action[];
          list = allActions.filter(item => !!item.video_path);
          setWarning('后端未提供 /actions/live，已自动使用兼容模式。');
        } else {
          throw liveErr;
        }
      }

      setActions(list);

      if (initialActionId > 0) {
        const matched = list.find(item => item.id === initialActionId);
        if (matched) {
          setSelectedActionId(matched.id);
          setStage('detect');
        }
      } else if (initialVideoId > 0) {
        try {
          const res = await api.get(`/actions/by-video/${initialVideoId}`);
          const matched = res.data as Action;
          setSelectedActionId(matched.id);
          setStage('detect');
          if (!list.some(item => item.id === matched.id)) {
            setActions(prev => [...prev, matched]);
          }
        } catch {
          setWarning('未能根据 video_id 自动定位动作，请手动选择动作。');
        }
      }
    } catch (err: any) {
      setError(getErrorMessage(err, '动作列表加载失败'));
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [initialActionId, initialVideoId]);

  useEffect(() => {
    console.log('[全屏状态] isFullscreenCompare 变化:', isFullscreenCompare);
    console.log('[全屏状态] isPlaying:', isPlaying);
    console.log('[全屏状态] countdown:', countdown);
  }, [isFullscreenCompare, isPlaying, countdown]);

  useEffect(() => {
    fetchLiveActions();
  }, [fetchLiveActions]);

  useEffect(() => {
    checkModelStatus()
      .then((status) => {
        setModelLoaded(status.model_loaded);
      })
      .catch(() => {
        setModelLoaded(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedActionId) {
      setActionMusicList([]);
      setSelectedMusicId(null);
      setSelectedSync(null);
      initialMusicAppliedRef.current = false;
      return;
    }

    let cancelled = false;
    listActionMusicSync(selectedActionId)
      .then((list) => {
        if (cancelled) return;
        setActionMusicList(list);
        if (!initialMusicAppliedRef.current && initialMusicId > 0 && list.some(item => item.music_id === initialMusicId)) {
          initialMusicAppliedRef.current = true;
          setSelectedMusicId(initialMusicId);
          return;
        }
        if (selectedMusicId && list.some(item => item.music_id === selectedMusicId)) {
          return;
        }
        setSelectedMusicId(null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setActionMusicList([]);
        setWarning(getErrorMessage(err, '音乐列表加载失败'));
      });

    return () => {
      cancelled = true;
    };
  }, [initialMusicId, selectedActionId]);

  useEffect(() => {
    if (!selectedActionId || !selectedMusicId) {
      setSelectedSync(null);
      setSyncLoading(false);
      return;
    }

    let cancelled = false;
    setSyncLoading(true);
    getActionMusicSync(selectedActionId, selectedMusicId)
      .then((result) => {
        if (cancelled) return;
        setSelectedSync(result);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setWarning(getErrorMessage(err, '读取动作 - 音乐对齐配置失败'));
        setSelectedSync({
          action_id: selectedActionId,
          music_id: selectedMusicId,
          sync_offset_ms: 0,
          is_aligned: false,
          alignment_note: null,
          has_sync_config: false,
        });
      })
      .finally(() => {
        if (!cancelled) {
          setSyncLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedActionId, selectedMusicId]);

  const connectWebSocket = useCallback((actionId: number, syncOffsetMs: number) => {
    stopWebSocket();

    const wsBaseUrl = buildWsBaseUrl();
    const wsUrl = `${wsBaseUrl}/ws/live/action/${actionId}?sync_offset_ms=${syncOffsetMs}`;

    console.log('[WebSocket] 正在建立连接:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.error('[WebSocket] 连接超时');
        ws.close();
        setWarning('WebSocket连接超时，请检查网络或后端服务');
      }
    }, 10000);

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      console.log('[WebSocket] 连接成功建立');
      setWsConnected(true);
      setWarning('');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'score') {
          const payload = message.data as LiveWsScorePayload & { keypoints?: Keypoints; standard_keypoints?: Keypoints };
          setStats(prev => ({
            ...prev,
            current_score: payload.current_score,
            average_score: payload.average_score,
            frames_processed: payload.processed_frames,
            latency_ms: Math.max(0, Math.round(performance.now() - startTimeRef.current - payload.elapsed_ms)),
          }));
          setLiveFrameScores(prev => ([
            ...prev,
            {
              timestamp: Number((payload.elapsed_ms / 1000).toFixed(2)),
              score: payload.current_score,
            },
          ]));
          if (payload.keypoints) {
            setKeypoints(payload.keypoints);
          }
        } else if (message.type === 'error') {
          console.error('[WebSocket] 收到错误消息:', message);
          setWarning(message.data?.message || '实时检测出现错误');
        }
      } catch (err) {
        console.error('[WebSocket] 解析消息失败:', err);
        setWarning('收到无法解析的实时消息');
      }
    };

    ws.onerror = (error) => {
      clearTimeout(connectionTimeout);
      console.error('[WebSocket] 发生错误:', error);
      setWarning('实时连接发生错误');
    };

    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      setWsConnected(false);
      const isManualClose = wsManualCloseRef.current;
      wsManualCloseRef.current = false;
      if (!isManualClose && isPlaying) {
        setWarning(`实时连接已断开`);
      }
    };
  }, [isPlaying, stopWebSocket]);

  const startFrameLoop = useCallback(() => {
    clearFrameLoops();

    fpsIntervalRef.current = window.setInterval(() => {
      const sent = sentFramesRef.current;
      setDisplayFps(sent);
      sentFramesRef.current = 0;
    }, 1000);

    frameIntervalRef.current = window.setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }
      if (!liveVideoRef.current) {
        return;
      }

      const liveVideo = liveVideoRef.current;

      if (liveVideo.readyState < 2 || liveVideo.videoWidth === 0 || liveVideo.videoHeight === 0 || !liveVideo.srcObject) {
        return;
      }

      try {
        if (!captureCanvasRef.current) {
          captureCanvasRef.current = document.createElement('canvas');
        }
        const canvas = captureCanvasRef.current;
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(liveVideo, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const elapsedMs = Math.round(performance.now() - startTimeRef.current);
        wsRef.current.send(JSON.stringify({
          type: 'frame',
          data: {
            image_base64: dataUrl,
            elapsed_ms: elapsedMs,
          },
        }));
        sentFramesRef.current += 1;
      } catch (err) {
        console.error('[帧发送] 错误:', err);
      }
    }, 50);
  }, [clearFrameLoops]);

  const handleStart = useCallback(() => {
    if (!selectedAction || !selectedAction.video_path || !cameraReady || !stream) {
      return;
    }

    setError('');
    setWarning('');

    setIsPlaying(false);
    setIsPaused(false);
    setCountdown(5);
    setStats(prev => ({ ...DEFAULT_STATS, music_volume: prev.music_volume }));
    setDisplayFps(0);
    setLiveFrameScores([]);
    setSessionStartedAt(null);
    setKeypoints(null);

    let count = 5;
    const countdownTimer = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownTimer);
        setCountdown(null);

        ignoreNullStreamUpdateRef.current = true;
        console.log('[handleStart] 保护标记已设置，准备切换布局');

        setIsPlaying(true);
        setIsFullscreenCompare(true);
        console.log('[handleStart] 倒计时结束，设置全屏模式');
        startTimeRef.current = performance.now();
        setSessionStartedAt(new Date().toISOString());

        if (standardVideoRef.current) {
          standardVideoRef.current.pause();
          standardVideoRef.current.currentTime = 0;
        }

        setTimeout(() => {
          const checkRefs = (attempts: number = 0) => {
            if (liveVideoRef.current && standardVideoRef.current) {
              const liveVideo = liveVideoRef.current;
              const liveVideoReady = liveVideo.readyState >= 2 &&
                                    liveVideo.videoWidth > 0 &&
                                    liveVideo.videoHeight > 0 &&
                                    !!liveVideo.srcObject;

              if (!liveVideoReady && attempts < 40) {
                setTimeout(() => checkRefs(attempts + 1), 50);
                return;
              }

              if (liveVideo.paused) {
                liveVideo.play().catch(console.error);
              }

              const video = standardVideoRef.current;
              console.log('[播放控制] 获取标准视频引用:', {
                videoExists: !!video,
                videoElementId: video?.id,
                videoSrc: video?.src,
                videoWidth: video?.videoWidth,
                videoHeight: video?.videoHeight,
                readyState: video?.readyState
              });
              if (!video) {
                console.error('[播放控制] 错误：standardVideoRef.current 为空！无法播放视频');
                setWarning('标准视频元素未找到，请重新加载页面');
                return;
              }
              video.pause();
              video.currentTime = 0;

              // 直接播放标准视频（带原声）
              const playStandardVideo = (retryCount = 0) => {
                const currentVideo = standardVideoRef.current;
                if (!currentVideo) {
                  console.error('[播放控制] 无法获取标准视频引用');
                  return;
                }

                console.log('[播放控制] 检查标准视频状态:', {
                  currentTime: currentVideo.currentTime,
                  paused: currentVideo.paused,
                  readyState: currentVideo.readyState,
                  readyStateStr: ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][currentVideo.readyState] || 'UNKNOWN',
                  videoWidth: currentVideo.videoWidth,
                  videoHeight: currentVideo.videoHeight,
                  videoExists: !!currentVideo.src,
                  retryCount
                });

                // 重试直到视频尺寸加载完成
                if (currentVideo.videoWidth === 0 || currentVideo.videoHeight === 0) {
                  if (retryCount < 50) {
                    console.log('[播放控制] 视频尺寸未加载完成，100ms 后重试...');
                    setTimeout(() => playStandardVideo(retryCount + 1), 100);
                    return;
                  } else {
                    console.error('[播放控制] 视频尺寸加载超时，强制播放');
                  }
                }

                // 直接播放视频（带原声）
                currentVideo.play().then(() => {
                  console.log('[播放控制] 标准视频播放成功，当前时间:', currentVideo.currentTime);
                }).catch((err) => {
                  console.error('[播放控制] 标准动作视频播放失败:', {
                    name: err.name,
                    message: err.message
                  });
                  setWarning('标准动作视频播放失败，请重试');
                });
              };
              playStandardVideo();

              // WebSocket 连接不需要 sync_offset_ms
              connectWebSocket(selectedAction.id, 0);
              startFrameLoop();
            } else if (attempts < 30) {
              setTimeout(() => checkRefs(attempts + 1), 50);
              return;
            } else {
              setWarning('视频初始化超时，请重试');
              setIsFullscreenCompare(false);
              setIsPlaying(false);
            }
          };
          checkRefs();
        }, 200);
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [
    cameraReady,
    connectWebSocket,
    selectedAction,
    startFrameLoop,
    stream,
  ]);

  const handleTogglePause = useCallback(() => {
    if (!isPlaying) return;

    if (isPaused) {
      setIsPaused(false);
      startFrameLoop();

      if (standardVideoRef.current) {
        standardVideoRef.current.play().catch(() => {});
      }
      return;
    }

    setIsPaused(true);
    clearFrameLoops();

    if (standardVideoRef.current) {
      standardVideoRef.current.pause();
    }
  }, [clearFrameLoops, isPaused, isPlaying, startFrameLoop]);

  const handleStop = useCallback(async () => {
    console.log('[handleStop] 停止按钮被点击');
    if (isPlaying && selectedAction) {
      const endedAt = new Date().toISOString();
      const startedAt = sessionStartedAt || endedAt;
      const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
      const durationSeconds = Number((durationMs / 1000).toFixed(2));
      const finalAverageScore = stats.average_score > 0 ? stats.average_score : stats.current_score;

      const resultData: LiveResultData = {
        action_id: selectedAction.id,
        action_name: selectedAction.name,
        music_id: selectedMusic?.music_id ?? null,
        music_name: selectedMusic?.music_name ?? null,
        started_at: startedAt,
        ended_at: endedAt,
        duration_seconds: durationSeconds,
        total_score: Number(finalAverageScore.toFixed(1)),
        current_score: Number(stats.current_score.toFixed(1)),
        average_score: Number(finalAverageScore.toFixed(1)),
        frames_processed: stats.frames_processed,
        display_fps: displayFps,
        latency_ms: stats.latency_ms,
        frame_scores: liveFrameScores,
      };

      stopSession(false);

      const savePayload: LiveScoreSavePayload = {
        action_id: resultData.action_id,
        music_id: resultData.music_id,
        music_name: resultData.music_name,
        started_at: resultData.started_at,
        ended_at: resultData.ended_at,
        duration_seconds: resultData.duration_seconds,
        total_score: resultData.total_score,
        current_score: resultData.current_score,
        average_score: resultData.average_score,
        frames_processed: resultData.frames_processed,
        display_fps: resultData.display_fps,
        latency_ms: resultData.latency_ms,
        frame_scores: resultData.frame_scores.map((item, index) => ({
          frame_index: index,
          score: item.score,
          timestamp: item.timestamp,
        })),
      };

      try {
        const res = await api.post('/scores/live', savePayload);
        const scoreId = res.data?.score_id as number | undefined;
        if (scoreId) {
          navigate(`/scores/live/result/${scoreId}`, {
            state: {
              resultData: {
                ...resultData,
                score_id: scoreId,
              },
            },
          });
          return;
        }
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        setWarning(typeof detail === 'string' ? `结果保存失败：${detail}` : '结果保存失败，已展示本地结果');
      }

      navigate('/scores/live/result', { state: { resultData } });
      return;
    }

    stopSession(false);
  }, [displayFps, isPlaying, liveFrameScores, navigate, selectedAction, selectedMusic, sessionStartedAt, stats, stopSession]);

  useEffect(() => {
    return () => {
      stopSession(true, 'cleanup');
    };
  }, [stopSession]);

  useEffect(() => {
    if (!stream) return;
    const tracks = stream.getVideoTracks();
    const handleTrackEnded = () => {
      setCameraReady(false);
      if (isPlaying) {
        setWarning('摄像头流已中断，请重新选择摄像头后再开始检测。');
        stopSession(false);
      }
    };

    tracks.forEach(track => track.addEventListener('ended', handleTrackEnded));
    return () => {
      tracks.forEach(track => track.removeEventListener('ended', handleTrackEnded));
    };
  }, [isPlaying, stopSession, stream]);

  const handleActionSelect = (actionId: number) => {
    stopSession(false);
    setSelectedActionId(actionId);
    setSelectedMusicId(null);
    setSelectedSync(null);
    setActionMusicList([]);
    initialMusicAppliedRef.current = false;
    setStage('detect');
    setError('');
    setWarning('');
    navigate(`/scores/live?action_id=${actionId}`, { replace: true });
  };

  const handleMusicSelect = (musicId: number) => {
    if (isPlaying) return;
    setSelectedMusicId(musicId);
    setError('');
    if (selectedActionId) {
      navigate(`/scores/live?action_id=${selectedActionId}&music_id=${musicId}`, { replace: true });
    }
  };

  const backToSelect = () => {
    stopSession(true);
    setStage('select');
    setSelectedActionId(null);
    setSelectedMusicId(null);
    setSelectedSync(null);
    setActionMusicList([]);
    initialMusicAppliedRef.current = false;
    navigate('/scores/live', { replace: true });
  };

  const goToSyncAlign = () => {
    if (!selectedActionId || !selectedMusicId) return;
    navigate(`/sync-align?action_id=${selectedActionId}&music_id=${selectedMusicId}`);
  };

  const handleStreamReady = useCallback((newStream: MediaStream | null) => {
    console.log('[handleStreamReady] 摄像头流状态变化:', {
      streamExists: !!newStream,
      isPlaying,
      isFullscreenCompare,
      currentStream: !!stream,
      persistedStream: !!persistedStreamRef.current,
      ignoreNullStreamUpdate: ignoreNullStreamUpdateRef.current
    });

    if ((isPlaying && isFullscreenCompare) || ignoreNullStreamUpdateRef.current) {
      if (newStream === null && stream !== null) {
        console.log('[handleStreamReady] 检测进行中，忽略布局切换导致的流状态变化');
        return;
      }
    }

    if (newStream) {
      persistedStreamRef.current = newStream;
    }

    setStream(newStream);
    setCameraReady(!!newStream);
  }, [isPlaying, isFullscreenCompare, stream]);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const volume = Number(event.target.value);
    setStats(prev => ({ ...prev, music_volume: volume }));
    // 音量控制用于标准视频（通过 LiveVideoPanel 组件）
  };

  const canStart = Boolean(selectedAction && cameraReady && modelLoaded);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (stage === 'select') {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">实时检测</h1>
            <p className="text-slate-500 mt-2">先选择标准动作，再选择音乐与摄像头后开始实时检测</p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${modelLoaded ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            <div className={`w-3 h-3 rounded-full ${modelLoaded ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}></div>
            <span className="font-medium text-sm">{modelLoaded ? '模型已就绪' : '模型加载中...'}</span>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
            {error}
          </div>
        )}

        {actions.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center">
            <AlertCircle className="mx-auto text-slate-300 mb-4" size={56} />
            <h2 className="text-xl font-bold text-slate-900 mb-2">没有可用于实时检测的动作</h2>
            <p className="text-slate-500 mb-6">请先在动作库创建并上传标准视频</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleActionSelect(action.id)}
                className="text-left bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-indigo-400 hover:shadow-lg transition-all"
              >
                <div className="h-44 bg-slate-900">
                  {action.video_path ? (
                    <video
                      src={getVideoUrl(action.video_path)}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      无标准视频
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-slate-900 text-lg">{action.name}</h3>
                  <p className="text-sm text-slate-500 mt-2 line-clamp-2">{action.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!selectedAction) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <AlertCircle className="mx-auto text-red-400 mb-4" size={64} />
        <h2 className="text-2xl font-bold text-slate-900 mb-3">未找到动作</h2>
        <button onClick={backToSelect} className="px-6 py-3 bg-indigo-600 text-white rounded-xl">
          返回动作选择
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-900 flex flex-col ${isFullscreenCompare ? 'fixed inset-0 z-50' : ''}`}>
      {/* header - 常规模式显示 */}
      {!isFullscreenCompare && (
        <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button onClick={backToSelect} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">实时检测 - {selectedAction.name}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isPlaying ? (
                <button onClick={handleStart} disabled={!canStart} className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50">
                  <Play size={18} /> 开始检测
                </button>
              ) : (
                <>
                  <button onClick={handleTogglePause} className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700">
                    {isPaused ? <Play size={18} /> : <Pause size={18} />}
                    {isPaused ? '继续' : '暂停'}
                  </button>
                  <button onClick={handleStop} className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700">
                    <Square size={18} /> 停止
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      <div className={`flex-1 ${isFullscreenCompare ? 'flex flex-col overflow-hidden' : 'p-6'}`}>
        {/* 倒计时覆盖层 */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-slate-900/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-8xl font-bold text-white mb-4 animate-pulse">{countdown}</div>
              <div className="text-white text-lg">即将开始检测...</div>
            </div>
          </div>
        )}

        {/* 始终渲染两个 LiveVideoPanel - 防止重新挂载 */}
        {/* 全屏模式布局 */}
        {isFullscreenCompare && (
          <div className={`h-full flex flex-col ${countdown !== null ? 'opacity-30 pointer-events-none' : ''}`}>
            {/* 全屏顶部控制栏 */}
            <div className="bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 px-4 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              {/* 当前分数 */}
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg w-24 py-2 text-center shrink-0">
                <div className="text-3xl font-bold text-white tabular-nums">{stats.current_score.toFixed(0)}</div>
                <div className="text-white/80 text-xs">当前分数</div>
              </div>
              <div className="flex gap-2">
                {/* FPS */}
                <div className="bg-slate-700/50 rounded w-24 px-3 py-1 flex items-center justify-between shrink-0">
                  <span className="text-slate-400 text-xs">FPS</span>
                  <span className="text-white font-bold ml-1 tabular-nums">{displayFps}</span>
                </div>
                {/* 平均分 */}
                <div className="bg-slate-700/50 rounded w-28 px-3 py-1 flex items-center justify-between shrink-0">
                  <span className="text-slate-400 text-xs">平均分</span>
                  <span className="text-white font-bold ml-1 tabular-nums">{stats.average_score.toFixed(1)}</span>
                </div>
                {/* 帧数 */}
                <div className="bg-slate-700/50 rounded w-24 px-3 py-1 flex items-center justify-between shrink-0">
                  <span className="text-slate-400 text-xs">帧数</span>
                  <span className="text-white font-bold ml-1 tabular-nums">{stats.frames_processed}</span>
                </div>
                {/* 延迟 */}
                <div className="bg-slate-700/50 rounded w-24 px-3 py-1 flex items-center justify-between shrink-0">
                  <span className="text-slate-400 text-xs">延迟</span>
                  <span className="text-white font-bold ml-1 tabular-nums">{stats.latency_ms}ms</span>
                </div>
                {/* 音乐状态 */}
                <div className="bg-slate-700/50 rounded w-24 px-3 py-1 flex items-center justify-center gap-1 shrink-0">
                  <Music2 size={14} className={stats.music_playing ? 'text-green-400' : 'text-slate-400'} />
                  <span className={`text-xs font-medium ${stats.music_playing ? 'text-green-400' : 'text-slate-400'}`}>
                    {stats.music_playing ? '播放中' : '未播放'}
                  </span>
                </div>
              </div>
              {/* 音量控制 */}
              <div className="flex items-center gap-2 bg-slate-700/50 rounded w-36 px-3 py-1 shrink-0">
                <span className="text-slate-400 text-xs">音量</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={stats.music_volume}
                  onChange={handleVolumeChange}
                  className="w-20 accent-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleTogglePause} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700">
                {isPaused ? <Play size={18} /> : <Pause size={18} />}
                {isPaused ? '继续' : '暂停'}
              </button>
              <button onClick={handleStop} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">
                <Square size={18} /> 停止
              </button>
            </div>
            {/* 隐藏的 CameraSelector，用于在全屏模式保持流 */}
            <div className="hidden">
              <CameraSelector
                onDeviceChange={setSelectedCamera}
                selectedDeviceId={selectedCamera}
                onStreamReady={handleStreamReady}
                disabled={isPlaying}
                preserveStreamOnUnmount={true}
              />
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-0">
            <div className="relative border-r border-slate-700">
              <LiveVideoPanel
                key="standard-video-panel"
                videoSrc={selectedAction.video_path ? getVideoUrl(selectedAction.video_path) : undefined}
                videoRef={standardVideoRef}
                title="标准动作"
                isActive={isPlaying && !isPaused}
                showSkeleton={false}
                className="h-full"
                loop
                muted={false}
                volume={stats.music_volume}
              />
            </div>
            <div className="relative">
              <LiveVideoPanel
                key="live-video-panel"
                stream={stream || persistedStreamRef.current || undefined}
                videoRef={liveVideoRef}
                title="实时画面"
                isActive={cameraReady}
                score={stats.current_score > 0 ? stats.current_score : undefined}
                keypoints={keypoints}
                showSkeleton
                className="h-full"
                muted
              />
            </div>
          </div>
        </div>
        )}

        {!isFullscreenCompare && (
          <div className={`h-full grid grid-rows-2 gap-4 ${countdown !== null ? 'opacity-30 pointer-events-none' : ''}`}>
            <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col h-full">
              <LiveVideoPanel
                key="standard-video-panel"
                videoSrc={selectedAction.video_path ? getVideoUrl(selectedAction.video_path) : undefined}
                videoRef={standardVideoRef}
                title="标准动作"
                isActive={isPlaying && !isPaused}
                showSkeleton={false}
                className="h-full"
                loop
                muted={false}
                volume={stats.music_volume}
              />
            </div>
            <div className="flex flex-col h-full">
              <LiveVideoPanel
                key="live-video-panel"
                stream={stream || persistedStreamRef.current || undefined}
                videoRef={liveVideoRef}
                title="实时画面"
                isActive={cameraReady}
                score={stats.current_score > 0 ? stats.current_score : undefined}
                keypoints={keypoints}
                showSkeleton
                className="h-full"
                muted
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col h-full min-h-0">
              <CameraSelector
                onDeviceChange={setSelectedCamera}
                selectedDeviceId={selectedCamera}
                onStreamReady={handleStreamReady}
                disabled={isPlaying}
              />
            </div>
            <div className="bg-slate-800 rounded-2xl p-4 flex flex-col min-h-0">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Music2 size={18} className="text-indigo-400" /> 音乐库
              </h3>
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <p className="text-slate-400 text-sm mb-4">
                  实时检测直接播放标准动作视频的原声
                </p>
                <button
                  onClick={() => navigate('/music')}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                >
                  管理音乐库
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">视频音量</span>
                  <input type="range" min="0" max="1" step="0.1" value={stats.music_volume} onChange={handleVolumeChange} className="flex-1 accent-indigo-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {(error || warning) && !isFullscreenCompare && (
          <div className="mt-4">
            {error && <div className="mb-2 p-3 bg-red-500/20 text-red-300 rounded-xl text-sm">{error}</div>}
            {warning && <div className="p-3 bg-amber-500/20 text-amber-300 rounded-xl text-sm">{warning}</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveScoring;
