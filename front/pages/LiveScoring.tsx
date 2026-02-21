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
  if (configuredBase) {
    if (configuredBase.startsWith('https://')) return configuredBase.replace('https://', 'wss://');
    if (configuredBase.startsWith('http://')) return configuredBase.replace('http://', 'ws://');
  }
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}`;
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

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [stats, setStats] = useState<LiveStats>(DEFAULT_STATS);
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

  const stopSession = useCallback((stopCamera: boolean) => {
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
    setStats(prev => ({
      ...DEFAULT_STATS,
      music_volume: prev.music_volume,
    }));
  }, [clearFrameLoops, stopAudio, stopWebSocket, stream]);

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
    const ws = new WebSocket(`${buildWsBaseUrl()}/ws/live/action/${actionId}?sync_offset_ms=${syncOffsetMs}`);
    wsRef.current = ws;

    ws.onopen = () => {
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
          // 更新关键点数据用于骨架绘制
          if (payload.keypoints) {
            setKeypoints(payload.keypoints);
          }
        } else if (message.type === 'error') {
          setWarning(message.data?.message || '实时检测出现错误');
        }
      } catch {
        setWarning('收到无法解析的实时消息');
      }
    };

    ws.onerror = () => {
      setWarning('实时连接发生错误');
    };

    ws.onclose = () => {
      setWsConnected(false);
      const isManualClose = wsManualCloseRef.current;
      wsManualCloseRef.current = false;
      if (!isManualClose && isPlaying) {
        setWarning('实时连接已断开，请点击"开始检测"重试');
      }
    };
  }, [isPlaying, stopWebSocket]);

  const startFrameLoop = useCallback(() => {
    clearFrameLoops();

    fpsIntervalRef.current = window.setInterval(() => {
      setStats(prev => ({ ...prev, fps: sentFramesRef.current }));
      sentFramesRef.current = 0;
    }, 1000);

    frameIntervalRef.current = window.setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      if (!liveVideoRef.current) return;

      const liveVideo = liveVideoRef.current;
      if (liveVideo.readyState < 2 || liveVideo.videoWidth === 0 || liveVideo.videoHeight === 0) return;

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
    }, 50); // 每 50ms 发送一帧，约 20 FPS
  }, [clearFrameLoops]);

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

    const offsetMs = selectedSync?.sync_offset_ms || 0;
    const audio = new Audio(getMusicUrl(selectedMusic.music_file_path));
    audio.volume = stats.music_volume;
    audio.preload = 'auto';

    // 确保音频从头开始
    audio.currentTime = 0;

    // 处理音乐对齐偏移
    if (offsetMs > 0) {
      // 视频比音乐晚（音乐先播放，音乐播放到偏移点时视频开始）
      // 音乐立即播放，从 0 开始
      playAudio();
    } else if (offsetMs < 0) {
      // 视频比音乐早（视频先播放，视频播放到偏移点时音乐开始）
      // 音乐延迟播放 |offsetMs| 毫秒
      scheduleMusicPlay(Math.abs(offsetMs));
    } else {
      // 无偏移，同时播放
      playAudio();
    }

    audioRef.current = audio;
  }, [playAudio, scheduleMusicPlay, selectedMusic, selectedSync?.sync_offset_ms, stats.music_volume]);

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
    setKeypoints(null);

    // 倒计时计时器
    let count = 5;
    const countdownTimer = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownTimer);
        setCountdown(null);
        // 倒计时结束，开始检测
        setIsPlaying(true);
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

        // 短暂延迟后开始播放，确保媒体已加载
        setTimeout(() => {
          // 确保标准视频从头开始
          if (standardVideoRef.current) {
            const video = standardVideoRef.current;
            video.pause();
            video.currentTime = 0;
            // 等待视频定位到开头后才播放
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              video.play().catch(() => {
                setWarning('标准动作视频播放失败，请重试');
              });
            };
            video.addEventListener('seeked', onSeeked);
          }

          connectWebSocket(selectedAction.id, selectedSync.sync_offset_ms || 0);
          startFrameLoop();
          startMusic();
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
      stopSession(true);
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
    setStream(newStream);
    setCameraReady(!!newStream);
  }, []);

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

        <div className={`h-full grid grid-rows-2 gap-4 ${countdown !== null ? 'opacity-30 pointer-events-none' : ''}`}>
          {/* 上行：两个视频面板并排 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 标准动作视频（静音） */}
            <div className="flex flex-col h-full">
              <LiveVideoPanel
                videoSrc={selectedAction.video_path ? getVideoUrl(selectedAction.video_path) : undefined}
                videoRef={standardVideoRef}
                title="标准动作"
                isActive={isPlaying && !isPaused}
                showSkeleton={false}
                className="h-full"
                muted
                loop
              />
            </div>

            {/* 实时画面 */}
            <div className="flex flex-col h-full">
              <LiveVideoPanel
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
          </div>

          {/* 下行：三个控制面板并排 */}
          <div className="grid grid-cols-3 gap-4">
            {/* 音乐选择 */}
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

            {/* 摄像头选择 */}
            <div className="flex flex-col h-full min-h-0">
              <CameraSelector
                onDeviceChange={setSelectedCamera}
                selectedDeviceId={selectedCamera}
                onStreamReady={handleStreamReady}
                disabled={isPlaying}
              />
            </div>

            {/* 音乐控制与实时统计 */}
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
                <StatCard label="FPS" value={String(stats.fps)} />
                <StatCard label="分数" value={stats.current_score.toFixed(0)} />
                <StatCard label="平均" value={stats.average_score.toFixed(0)} />
                <StatCard label="处理帧数" value={String(stats.frames_processed)} />
                <StatCard label="网络延迟" value={`${Math.round(stats.latency_ms)}ms`} />
                <StatCard label="音乐状态" value={stats.music_playing ? '播放中' : '未播放'} />
                <StatCard label="模型状态" value={modelLoaded ? '就绪' : '加载中'} />
              </div>
            </div>
          </div>
        </div>
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
    </div>
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
