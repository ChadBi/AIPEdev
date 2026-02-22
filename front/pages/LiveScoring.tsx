import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { getVideoUrl, checkModelStatus } from '../api';
import { getMusicUrl } from '../api/music';
import { getActionMusicSync, listActionMusicSync } from '../api/sync';
import {
  Action,
  ActionMusicSyncListItem,
  ActionMusicSyncLookup,
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

  // 如果配置了 API_BASE_URL（生产环境）
  if (configuredBase) {
    if (configuredBase.startsWith('https://')) return configuredBase.replace('https://', 'wss://');
    if (configuredBase.startsWith('http://')) return configuredBase.replace('http://', 'ws://');
    return configuredBase;
  }

  // 开发环境：使用 Vite 的 WebSocket 代理
  // 返回空字符串，将使用相对路径 '/ws'，由 Vite 代理到 'ws://localhost:8000'
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

  // 跟踪 stream 变化
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

  // Refs for state values used in stopSession (avoid dependency changes)
  const isPlayingRef = useRef(false);
  const isFullscreenCompareRef = useRef(false);
  const ignoreNullStreamUpdateRef = useRef(false); // 标记是否应该忽略空流更新

  // Sync state to refs
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isFullscreenCompareRef.current = isFullscreenCompare;
  }, [isFullscreenCompare]);
  const [stats, setStats] = useState<LiveStats>(DEFAULT_STATS);
  const [displayFps, setDisplayFps] = useState(0);
  const [keypoints, setKeypoints] = useState<Keypoints | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const wsManualCloseRef = useRef(false);
  const frameIntervalRef = useRef<number>();
  const fpsIntervalRef = useRef<number>();
  const musicDelayTimerRef = useRef<number>();
  const pendingMusicDelayRef = useRef<number>(0);
  const musicDelayStartedAtRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const sentFramesRef = useRef<number>(0);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const standardVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const initialMusicAppliedRef = useRef(false);

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

  const clearMusicDelayTimer = useCallback(() => {
    if (musicDelayTimerRef.current) {
      window.clearTimeout(musicDelayTimerRef.current);
      musicDelayTimerRef.current = undefined;
    }
    musicDelayStartedAtRef.current = 0;
  }, []);

  const stopAudio = useCallback(() => {
    clearMusicDelayTimer();
    pendingMusicDelayRef.current = 0;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setStats(prev => ({ ...prev, music_playing: false }));
  }, [clearMusicDelayTimer]);

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
    console.log('[stopSession] 调用时状态 (从 ref):', {
      isPlaying: currentIsPlaying,
      isFullscreenCompare: currentIsFullscreen,
      isPaused: isPaused
    });

    // 如果是因为组件重新挂载导致的 cleanup（React Strict Mode 双重调用），不执行完全重置
    if (reason === 'cleanup' && currentIsFullscreen && currentIsPlaying) {
      console.log('[stopSession] 检测进行中，忽略组件重新挂载导致的 cleanup');
      return;
    }

    clearFrameLoops();
    stopWebSocket();
    stopAudio();

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
    // 只在真实停止检测时重置保护标记，而不是组件卸载时
    if (reason !== 'cleanup') {
      ignoreNullStreamUpdateRef.current = false; // 重置空流更新忽略标记
    } else {
      console.log('[stopSession] 组件卸载 cleanup，保持保护标记不重置');
    }
    setShowStatsPanel(true);
    setStats(prev => ({
      ...DEFAULT_STATS,
      music_volume: prev.music_volume,
    }));
    setDisplayFps(0);
  }, [clearFrameLoops, stopAudio, stopWebSocket, stream, isPaused]);

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

  // 监控全屏比对模式状态变化 - 调试用
  useEffect(() => {
    console.log('[全屏状态] isFullscreenCompare 变化:', isFullscreenCompare);
    console.log('[全屏状态] isPlaying:', isPlaying);
    console.log('[全屏状态] countdown:', countdown);
  }, [isFullscreenCompare, isPlaying, countdown]);

  useEffect(() => {
    fetchLiveActions();
  }, [fetchLiveActions]);

  // 检查模型加载状态
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
    console.log('[WebSocket] 当前页面URL:', window.location.href);
    console.log('[WebSocket] WebSocket URL详细信息:', {
      baseUrl: wsBaseUrl,
      fullUrl: wsUrl,
      actionId,
      syncOffsetMs
    });

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // 设置连接超时，防止挂起
    const connectionTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        console.error('[WebSocket] 连接超时');
        ws.close();
        setWarning('WebSocket连接超时，请检查网络或后端服务');
      }
    }, 10000); // 10秒超时

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      console.log('[WebSocket] 连接成功建立');
      setWsConnected(true);
      setWarning('');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('[WebSocket] 收到消息:', message.type);

        if (message.type === 'score') {
          const payload = message.data as LiveWsScorePayload & { keypoints?: Keypoints; standard_keypoints?: Keypoints };
          setStats(prev => ({
            ...prev,
            current_score: payload.current_score,
            average_score: payload.average_score,
            frames_processed: payload.processed_frames,
            latency_ms: Math.max(0, Math.round(performance.now() - startTimeRef.current - payload.elapsed_ms)),
          }));
          // 更新关键点数据用于骨架绘制
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
      console.error('[WebSocket] 当前readyState:', ws.readyState);
      console.error('[WebSocket] URL:', wsUrl);
      console.error('[WebSocket] 错误详情:', {
        type: error.type,
        target: error.target ? {
          url: error.target.url,
          readyState: error.target.readyState
        } : 'N/A'
      });
      setWarning('实时连接发生错误');
    };

    ws.onclose = (event) => {
      clearTimeout(connectionTimeout);
      console.log('[WebSocket] 连接关闭:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      setWsConnected(false);
      const isManualClose = wsManualCloseRef.current;
      wsManualCloseRef.current = false;
      if (!isManualClose && isPlaying) {
        setWarning(`实时连接已断开 (code: ${event.code}, reason: ${event.reason || '未知原因'})，请点击"开始检测"重试`);
      }
    };
  }, [isPlaying, stopWebSocket]);

  const startFrameLoop = useCallback(() => {
    clearFrameLoops();

    console.log('[startFrameLoop] 开始帧循环');
    console.log('[startFrameLoop] 初始状态:', {
      liveVideoRef: !!liveVideoRef.current,
      liveVideoValue: liveVideoRef.current,
      ifLiveVideoRefLive: !!liveVideoRef.current ? {
        readyState: liveVideoRef.current?.readyState,
        videoWidth: liveVideoRef.current?.videoWidth,
        videoHeight: liveVideoRef.current?.videoHeight,
        srcObject: !!liveVideoRef.current?.srcObject,
        paused: liveVideoRef.current?.paused
      } : 'N/A',
      wsRef: !!wsRef.current,
      wsReadyState: wsRef.current?.readyState,
      cameraReady,
      streamExists: !!stream
    });

    fpsIntervalRef.current = window.setInterval(() => {
      const sent = sentFramesRef.current;
      console.log('[FPS Interval] 过去 1 秒发送了', sent, '帧，更新 displayFps');
      setDisplayFps(sent);
      sentFramesRef.current = 0;
    }, 1000);

    frameIntervalRef.current = window.setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('[帧发送] WebSocket 未就绪');
        return;
      }
      if (!liveVideoRef.current) {
        // 每秒只打印一次
        if (!window._debugLastLog || Date.now() - window._debugLastLog > 1000) {
          console.log('[帧发送] 视频引用不可用，liveVideoRef.current =', liveVideoRef.current);
          console.log('[帧发送] 摄像头就绪状态:', cameraReady, '流存在:', !!stream, '全屏模式:', isFullscreenCompare);
          window._debugLastLog = Date.now();
        }
        return;
      }

      const liveVideo = liveVideoRef.current;
      const readyStateStr = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][liveVideo.readyState] || 'UNKNOWN';

      if (liveVideo.readyState < 2 || liveVideo.videoWidth === 0 || liveVideo.videoHeight === 0 || !liveVideo.srcObject) {
        // 减少日志频率
        if (sentFramesRef.current === 0 || !window._debugVideoLog || Date.now() - window._debugVideoLog > 2000) {
          console.log('[帧发送] 视频未就绪:', {
            readyState: liveVideo.readyState,
            readyStateStr: readyStateStr,
            width: liveVideo.videoWidth,
            height: liveVideo.videoHeight,
            srcObject: !!liveVideo.srcObject,
            paused: liveVideo.paused,
            muted: liveVideo.muted,
            autoplay: liveVideo.autoplay,
            cameraReady,
            streamExists: !!stream,
            isFullscreenCompare
          });

          // 额外检查 LiveVideoPanel 的 videoRef
          const videoElements = document.querySelectorAll('video');
          const liveVideoEl = Array.from(videoElements).find(v => {
            const panel = v.closest('[class*="LiveVideoPanel"]') || v.parentElement;
            // 通过父元素的文本内容判断是否是实时画面
            return panel && panel.textContent && panel.textContent.includes('实时画面');
          });
          console.log('[帧发送] DOM 中的实时画面 video 元素:', {
            found: !!liveVideoEl,
            ifFound: !!liveVideoEl ? {
              readyState: liveVideoEl.readyState,
              videoWidth: liveVideoEl.videoWidth,
              videoHeight: liveVideoEl.videoHeight,
              srcObject: !!liveVideoEl.srcObject
            } : 'N/A'
          });

          window._debugVideoLog = Date.now();
        }
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
    }, 50); // 每 50ms 发送一帧，约 20 FPS
  }, [clearFrameLoops, cameraReady, isFullscreenCompare]);

  const playAudio = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.play()
      .then(() => setStats(prev => ({ ...prev, music_playing: true })))
      .catch(() => setWarning('音乐播放失败，请检查浏览器媒体权限'));
  }, []);

  const scheduleMusicPlay = useCallback((delayMs: number) => {
    clearMusicDelayTimer();
    pendingMusicDelayRef.current = delayMs;
    musicDelayStartedAtRef.current = performance.now();
    setStats(prev => ({ ...prev, music_playing: false }));

    musicDelayTimerRef.current = window.setTimeout(() => {
      pendingMusicDelayRef.current = 0;
      musicDelayStartedAtRef.current = 0;
      playAudio();
    }, delayMs);
  }, [clearMusicDelayTimer, playAudio]);

  const startMusic = useCallback(() => {
    if (!selectedMusic) return;

    // 清理旧的音频元素
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    const syncOffsetMs = selectedSync?.sync_offset_ms || 0;
    const audio = new Audio(getMusicUrl(selectedMusic.music_file_path));
    audio.volume = stats.music_volume;
    audio.preload = 'auto';

    // 音乐始终从头开始播放
    audio.currentTime = 0;

    // 先设置 audioRef，再播放
    audioRef.current = audio;

    // 音乐立即开始播放（与 SyncAlign 页面的逻辑一致）
    // sync_offset_ms 控制视频的延迟：正数=视频晚播，负数=视频早播
    playAudio();
  }, [playAudio, selectedMusic, selectedSync?.sync_offset_ms, stats.music_volume]);

  const handleStart = useCallback(() => {
    if (!selectedAction) {
      setError('请先选择标准动作');
      return;
    }
    if (!selectedAction.video_path) {
      setError('该动作未绑定标准视频，无法开始实时检测');
      return;
    }
    if (!selectedMusicId || !selectedMusic) {
      setError('请先选择音乐');
      return;
    }
    if (!cameraReady || !stream) {
      setError('请先选择并启动摄像头');
      return;
    }
    if (syncLoading || !selectedSync) {
      setError('正在加载动作与音乐对齐配置，请稍候重试');
      return;
    }

    setError('');
    if (!selectedSync.is_aligned) {
      setWarning('当前动作与音乐未完成对齐，已按 0ms（或已保存偏移）继续实时检测。');
    } else {
      setWarning('');
    }

    // 开始倒计时
    setIsPlaying(false);
    setIsPaused(false);
    setCountdown(5);
    setStats(prev => ({ ...DEFAULT_STATS, music_volume: prev.music_volume }));
    setDisplayFps(0);
    setKeypoints(null);

    // 倒计时计时器
    let count = 5;
    const countdownTimer = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownTimer);
        setCountdown(null);

        // 先设置保护标记，防止布局切换时流被清空
        ignoreNullStreamUpdateRef.current = true;
        console.log('[handleStart] 保护标记已设置，准备切换布局');

        // 倒计时结束，进入全屏比对模式
        setIsPlaying(true);
        setIsFullscreenCompare(true);
        console.log('[handleStart] 倒计时结束，设置全屏模式: isFullscreenCompare = true');
        startTimeRef.current = performance.now();

        // 确保所有媒体都从头开始
        if (standardVideoRef.current) {
          standardVideoRef.current.pause();
          standardVideoRef.current.currentTime = 0;
        }

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }

        // 短暂延迟后开始播放，确保 media 已加载
        setTimeout(() => {
          // 轮询等待 LiveVideoPanel 完成 ref 设置
          const checkRefs = (attempts: number = 0) => {
            console.log(`[checkRefs] 检查中 (${attempts + 1}/30):`, {
              liveVideoRef: !!liveVideoRef.current,
              liveVideoValue: liveVideoRef.current,
              liveVideoDetails: liveVideoRef.current ? {
                readyState: liveVideoRef.current.readyState,
                videoWidth: liveVideoRef.current.videoWidth,
                videoHeight: liveVideoRef.current.videoHeight,
                srcObject: !!liveVideoRef.current.srcObject,
                paused: liveVideoRef.current.paused
              } : 'N/A',
              standardVideoRef: !!standardVideoRef.current,
              standardVideoDetails: standardVideoRef.current ? {
                readyState: standardVideoRef.current.readyState,
                videoWidth: standardVideoRef.current.videoWidth,
                videoHeight: standardVideoRef.current.videoHeight,
                src: standardVideoRef.current.src
              } : 'N/A',
              streamExists: !!stream
            });

            if (liveVideoRef.current && standardVideoRef.current) {
              // 检查实时视频是否真正就绪
              const liveVideo = liveVideoRef.current;
              // 双重检查 liveVideoRef 仍然有效
              if (!liveVideo) {
                console.error('[checkRefs] liveVideoRef.current 在检查后变为 null!');
                setTimeout(() => checkRefs(attempts + 1), 50);
                return;
              }
              const liveVideoReady = liveVideo.readyState >= 2 &&
                                    liveVideo.videoWidth > 0 &&
                                    liveVideo.videoHeight > 0 &&
                                    !!liveVideo.srcObject;

              console.log('[checkRefs] 视频就绪检查:', {
                liveVideoReady,
                readyState: liveVideo.readyState,
                readyStateStr: ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][liveVideo.readyState] || 'UNKNOWN',
                videoWidth: liveVideo.videoWidth,
                videoHeight: liveVideo.videoHeight,
                srcObject: !!liveVideo.srcObject,
                paused: liveVideo.paused,
                muted: liveVideo.muted
              });

              // 如果实时视频还未就绪，继续等待（最多再等 2 秒）
              if (!liveVideoReady && attempts < 40) {
                const remainingAttempts = 40 - attempts;
                console.log(`[checkRefs] 实时视频未就绪，继续等待... (剩余 ${remainingAttempts} 次检查)`);

                // 尝试播放视频来激活它
                if (attempts === 0) {
                  console.log('[checkRefs] 尝试播放视频来激活它');
                  liveVideo.play().then(() => {
                    console.log('[checkRefs] 被动播放成功');
                  }).catch((err) => {
                    console.log('[checkRefs] 被动播放失败（这是正常的，用户可能需要交互）:', err.message);
                  });
                }

                setTimeout(() => checkRefs(attempts + 1), 50);
                return;
              }

              const syncOffsetMs = selectedSync.sync_offset_ms || 0;
              console.log('[handleStart] Refs 和视频都已就绪，开始启动');

              // 确保实时视频正在播放
              if (liveVideo.paused) {
                console.log('[handleStart] 实时视频已暂停，尝试播放');
                liveVideo.play().then(() => {
                  console.log('[handleStart] 实时视频播放成功');
                }).catch((err) => {
                  console.error('[handleStart] 实时视频播放失败:', err);
                });
              }

              // 确保标准视频从头开始
              const video = standardVideoRef.current;
              video.pause();
              video.currentTime = 0;

              // 根据偏移量延迟视频播放（与 SyncAlign 逻辑一致）
              if (syncOffsetMs > 0) {
                // 视频延迟播放
                setTimeout(() => {
                  video.play().catch(() => {
                    setWarning('标准动作视频播放失败，请重试');
                  });
                }, syncOffsetMs);
              } else {
                // 偏移量为负或 0，视频立即播放
                const onSeeked = () => {
                  video.removeEventListener('seeked', onSeeked);
                  video.play().catch(() => {
                    setWarning('标准动作视频播放失败，请重试');
                  });
                };
                video.addEventListener('seeked', onSeeked);
              }

              connectWebSocket(selectedAction.id, syncOffsetMs);
              startFrameLoop();
              startMusic();
            } else if (attempts < 30) {
              // 最多等待 1.5 秒（30 * 50ms）
              console.log(`[handleStart] Refs 未就绪，等待中... (${attempts + 1}/30)`);
              setTimeout(() => checkRefs(attempts + 1), 50);
              return;
            } else {
              console.error('[handleStart] Refs 超时仍未就绪');
              console.error('[handleStart] 超时时状态:', {
                liveVideoRef: !!liveVideoRef.current,
                standardVideoRef: !!standardVideoRef.current,
                ifLiveVideoRef: !!liveVideoRef.current ? {
                  readyState: liveVideoRef.current.readyState,
                  videoWidth: liveVideoRef.current.videoWidth,
                  videoHeight: liveVideoRef.current.videoHeight,
                  srcObject: !!liveVideoRef.current.srcObject
                } : 'N/A',
                streamExists: !!stream,
                cameraReady
              });
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
    selectedMusic,
    selectedMusicId,
    selectedSync,
    startFrameLoop,
    startMusic,
    stream,
    syncLoading,
  ]);

  const handleTogglePause = useCallback(() => {
    if (!isPlaying) return;

    if (isPaused) {
      setIsPaused(false);
      startFrameLoop();

      if (standardVideoRef.current) {
        standardVideoRef.current.play().catch(() => {});
      }

      if (pendingMusicDelayRef.current > 0) {
        scheduleMusicPlay(pendingMusicDelayRef.current);
      } else if (audioRef.current) {
        playAudio();
      }
      return;
    }

    setIsPaused(true);
    clearFrameLoops();

    if (standardVideoRef.current) {
      standardVideoRef.current.pause();
    }

    if (musicDelayTimerRef.current && pendingMusicDelayRef.current > 0) {
      const elapsed = performance.now() - musicDelayStartedAtRef.current;
      pendingMusicDelayRef.current = Math.max(0, pendingMusicDelayRef.current - elapsed);
      clearMusicDelayTimer();
      setStats(prev => ({ ...prev, music_playing: false }));
    } else if (audioRef.current) {
      audioRef.current.pause();
      setStats(prev => ({ ...prev, music_playing: false }));
    }
  }, [clearFrameLoops, clearMusicDelayTimer, isPaused, isPlaying, playAudio, scheduleMusicPlay, startFrameLoop]);

  const handleStop = useCallback(() => {
    stopSession(false);
  }, [stopSession]);

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

  const handleStreamReady = useCallback((newStream: MediaStream | null) => {
    console.log('[handleStreamReady] 摄像头流状态变化:', {
      streamExists: !!newStream,
      tracks: newStream ? newStream.getTracks().map(t => ({
        kind: t.kind,
        id: t.id.slice(0, 8),
        enabled: t.enabled,
        readyState: t.readyState
      })) : 'N/A',
      isPlaying,
      isFullscreenCompare,
      currentStream: !!stream,
      ignoreNullStreamUpdate: ignoreNullStreamUpdateRef.current
    });

    // 如果正在播放且已进入全屏模式，忽略流变化（因为这是布局切换导致的，不是真实问题）
    if ((isPlaying && isFullscreenCompare) || ignoreNullStreamUpdateRef.current) {
      if (newStream === null && stream !== null) {
        console.log('[handleStreamReady] 检测进行中，忽略布局切换导致的流状态变化');
        return;
      }
    }

    setStream(newStream);
    setCameraReady(!!newStream);
  }, [isPlaying, isFullscreenCompare, stream]);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const volume = Number(event.target.value);
    setStats(prev => ({ ...prev, music_volume: volume }));
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  };

  const canStart = Boolean(selectedAction && selectedMusic && cameraReady && !syncLoading && modelLoaded);

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
            <button
              onClick={() => navigate('/actions/create')}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700"
            >
              去创建动作
            </button>
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
                  <div className="mt-4 text-indigo-600 font-semibold text-sm">选择动作并继续</div>
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
        <button
          onClick={backToSelect}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl"
        >
          返回动作选择
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={backToSelect}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
              title="返回动作选择"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">实时检测 - {selectedAction.name}</h1>
              <p className="text-sm text-slate-400">
                {selectedSync?.is_aligned ? '已对齐' : '未对齐'}
                {' · '}
                {wsConnected ? '实时连接已建立' : '实时连接未建立'}
                {' · '}
                <span className={modelLoaded ? 'text-green-400' : 'text-amber-400'}>
                  {modelLoaded ? '模型已就绪' : '模型加载中...'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/sync/align?action_id=${selectedActionId}`)}
              disabled={!selectedActionId}
              className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="进入音乐对齐页面"
            >
              <Music2 size={18} />
              音乐对齐
            </button>
            {!isPlaying ? (
              <button
                onClick={handleStart}
                disabled={!canStart}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={18} />
                开始检测
              </button>
            ) : (
              <>
                <button
                  onClick={handleTogglePause}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700"
                >
                  {isPaused ? <Play size={18} /> : <Pause size={18} />}
                  {isPaused ? '继续' : '暂停'}
                </button>
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700"
                >
                  <Square size={18} />
                  停止
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-hidden relative">
        {/* 倒计时覆盖层 */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-slate-900/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-8xl font-bold text-white mb-4 animate-pulse">{countdown}</div>
              <div className="text-white text-lg">即将开始检测...</div>
            </div>
          </div>
        )}

        {/* 主内容区域 - 通过 isFullscreenCompare 控制布局，不条件渲染 LiveVideoPanel */}
        <div className={`h-full ${countdown !== null ? 'opacity-30 pointer-events-none' : ''}`}>
          {/* 主视频区域 - 两种布局使用相同结构，通过 CSS 控制显示 */}
          <div className={`${
            isFullscreenCompare
              ? 'flex h-full gap-4 pr-4' // 全屏模式：横向布局
              : 'grid grid-rows-2 gap-4'  // 常规模式：纵向布局，两行
          }`}>
            {/* 第一行/左侧：两个视频面板 - 使用固定 key 避免重新挂载 */}
            <div className={`${
              isFullscreenCompare
                ? 'flex-1 grid grid-cols-2 gap-4' // 全屏：并列
                : 'grid grid-cols-2 gap-4'         // 常规：第一行并列
            }`}>
              {/* 标准动作视频 - 使用固定 key */}
              <LiveVideoPanel
                key="standard-video-panel"
                videoSrc={selectedAction.video_path ? getVideoUrl(selectedAction.video_path) : undefined}
                videoRef={standardVideoRef}
                title="标准动作"
                isActive={isPlaying && !isPaused}
                showSkeleton={false}
                className="h-full"
                muted
                loop
              />

              {/* 实时画面 - 使用固定 key（与全屏模式相同，避免重新挂载） */}
              <LiveVideoPanel
                key="live-video-panel"
                stream={stream}
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

            {/* 第二行/右侧：控制面板 */}
            <div className={`${
              isFullscreenCompare
                ? `flex flex-col ${showStatsPanel ? 'w-80' : 'hidden'}` // 全屏：右侧统计面板
                : 'grid grid-cols-3 gap-4'                               // 常规：第二行三列控制面板
            }`}>
              {/* 音乐选择 - 只在常规模式显示 */}
              {!isFullscreenCompare && (
                <div className="bg-slate-800 rounded-2xl p-4 flex flex-col min-h-0">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Music2 size={18} className="text-indigo-400" />
                    选择音乐
                  </h3>
                  {actionMusicList.length === 0 ? (
                    <p className="text-slate-400 text-sm">暂无可用音乐，请先到音乐库上传。</p>
                  ) : (
                    <div className="space-y-2 flex-1 overflow-auto">
                      {actionMusicList.map((item) => (
                        <button
                          key={item.music_id}
                          onClick={() => handleMusicSelect(item.music_id)}
                          disabled={isPlaying}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                            selectedMusicId === item.music_id
                              ? 'bg-indigo-500/20 border-indigo-400 text-white'
                              : 'bg-slate-700/40 border-slate-600 text-slate-200 hover:border-indigo-300'
                          } disabled:opacity-50`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">{item.music_name}</span>
                            <span className={`text-xs shrink-0 ${item.is_aligned ? 'text-green-300' : 'text-amber-300'}`}>
                              {item.is_aligned ? '已对齐' : '未对齐'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 摄像头选择 - 全屏模式隐藏但不卸载，避免清理代码触发 */}
              {(!isFullscreenCompare || true) && (
                <div className={`flex flex-col h-full min-h-0 ${isFullscreenCompare ? 'hidden' : ''}`}>
                  <CameraSelector
                    onDeviceChange={setSelectedCamera}
                    selectedDeviceId={selectedCamera}
                    onStreamReady={handleStreamReady}
                    disabled={isPlaying}
                  />
                </div>
              )}

              {/* 全屏模式统计面板 */}
              {isFullscreenCompare && showStatsPanel && (
                <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl p-4 flex flex-col h-full">
                  {/* 面板头部 */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      <Zap size={18} className="text-yellow-500" />
                      实时统计
                    </h3>
                    <button
                      onClick={() => setShowStatsPanel(false)}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"
                      title="隐藏面板"
                    >
                      <Square size={18} />
                    </button>
                  </div>

                  {/* 当前分数大显示 */}
                  <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-6 mb-4 text-center">
                    <div className="text-5xl font-bold text-white">{stats.current_score.toFixed(0)}</div>
                    <div className="text-white/80 text-sm mt-1">当前分数</div>
                  </div>

                  {/* 详细统计数据 */}
                  <div className="flex-1 space-y-2 overflow-auto">
                    <StatCard label="FPS" value={String(displayFps)} />
                    <StatCard label="平均" value={stats.average_score.toFixed(0)} />
                    <StatCard label="处理帧数" value={String(stats.frames_processed)} />
                    <StatCard label="网络延迟" value={`${Math.round(stats.latency_ms)}ms`} />
                    <StatCard label="音乐状态" value={stats.music_playing ? '播放中' : '未播放'} />
                  </div>

                  {/* 音量控制 */}
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs">音量</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={stats.music_volume}
                        onChange={handleVolumeChange}
                        className="flex-1 accent-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 常规模式音乐控制与实时统计 */}
              {!isFullscreenCompare && (
                <div className="bg-slate-800 rounded-2xl p-4 flex flex-col min-h-0">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Music2 size={18} className="text-indigo-400" />
                    音乐控制
                  </h3>
                  {selectedMusic ? (
                    <div className="space-y-3 mb-4">
                      <p className="text-slate-200 text-sm truncate">{selectedMusic.music_name}</p>
                      <p className="text-slate-400 text-xs">
                        偏移：{(selectedSync?.sync_offset_ms || 0) / 1000}s
                      </p>
                      {!selectedSync?.is_aligned && (
                        <p className="text-amber-300 text-xs">当前组合未完成对齐</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs">音量</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={stats.music_volume}
                          onChange={handleVolumeChange}
                          className="flex-1 accent-indigo-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-amber-300 text-sm mb-4">开始检测前必须选择音乐。</p>
                  )}

                  <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <Zap size={18} className="text-yellow-500" />
                    实时统计
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="FPS" value={String(displayFps)} />
                    <StatCard label="分数" value={stats.current_score.toFixed(0)} />
                    <StatCard label="平均" value={stats.average_score.toFixed(0)} />
                    <StatCard label="处理帧数" value={String(stats.frames_processed)} />
                    <StatCard label="网络延迟" value={`${Math.round(stats.latency_ms)}ms`} />
                    <StatCard label="音乐状态" value={stats.music_playing ? '播放中' : '未播放'} />
                    <StatCard label="模型状态" value={modelLoaded ? '就绪' : '加载中'} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 浮动按钮：显示统计面板 - 只在全屏模式隐藏面板时显示 */}
          {isFullscreenCompare && !showStatsPanel && (
            <button
              onClick={() => setShowStatsPanel(true)}
              className="fixed bottom-6 right-6 bg-slate-800/90 backdrop-blur-sm text-white p-3 rounded-full shadow-lg hover:bg-slate-700 transition-all z-40"
              title="显示统计面板"
            >
              <Zap size={24} />
            </button>
          )}
        </div>

      {(error || warning) && (
        <div className="px-6 pb-4">
          {error && (
            <div className="mb-2 p-3 bg-red-500/20 text-red-300 rounded-xl text-sm">{error}</div>
          )}
          {warning && (
            <div className="p-3 bg-amber-500/20 text-amber-300 rounded-xl text-sm">{warning}</div>
          )}
        </div>
      )}
      </div>  // Close flex-1 content div
    </div>      // Close main container
  );
};

const StatCard: React.FC<{
  label: string;
  value: string;
}> = ({ label, value }) => (
  <div className="bg-slate-700/50 rounded-xl p-3">
    <div className="text-slate-400 text-xs mb-1">{label}</div>
    <div className="text-lg font-bold text-slate-100">{value}</div>
  </div>
);

export default LiveScoring;
