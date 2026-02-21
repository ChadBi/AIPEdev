import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { getVideoUrl } from '../api';
import { getMusicUrl } from '../api/music';
import { alignActionMusic, getActionMusicSync, listActionMusicSync } from '../api/sync';
import { Action, ActionMusicSyncListItem } from '../types';
import {
  Play,
  Pause,
  Save,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Music2,
  Clock,
} from 'lucide-react';

const SyncAlign: React.FC = () => {
  const [searchParams] = useSearchParams();
  const actionIdFromQuery = Number(searchParams.get('action_id') || '0');
  const videoIdFromQuery = Number(searchParams.get('video_id') || '0');
  const musicIdFromQuery = Number(searchParams.get('music_id') || '0');
  const navigate = useNavigate();

  const [resolvedActionId, setResolvedActionId] = useState<number>(0);
  const [action, setAction] = useState<Action | null>(null);
  const [musicList, setMusicList] = useState<ActionMusicSyncListItem[]>([]);
  const [selectedMusicId, setSelectedMusicId] = useState<number | null>(null);
  // 视频延迟偏移量（毫秒）：正数=视频晚播，负数=视频早播
  const [videoOffsetMs, setVideoOffsetMs] = useState(0);
  const [isAligned, setIsAligned] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 进度条相关
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number>();

  const selectedMusic = useMemo(
    () => musicList.find(item => item.music_id === selectedMusicId) || null,
    [musicList, selectedMusicId]
  );

  useEffect(() => {
    const resolveAction = async () => {
      try {
        if (actionIdFromQuery > 0) {
          setResolvedActionId(actionIdFromQuery);
          return;
        }
        if (videoIdFromQuery > 0) {
          const res = await api.get(`/actions/by-video/${videoIdFromQuery}`);
          setResolvedActionId(res.data.id);
          return;
        }
        setError('未指定动作，请从动作详情或实时检测页进入。');
      } catch {
        setError('无法定位动作，请重新选择动作后再对齐。');
      }
    };
    resolveAction();
  }, [actionIdFromQuery, videoIdFromQuery]);

  useEffect(() => {
    if (!resolvedActionId) return;
    setLoading(true);
    setError('');

    const fetchData = async () => {
      try {
        const [actionRes, musicSyncList] = await Promise.all([
          api.get(`/actions/${resolvedActionId}`),
          listActionMusicSync(resolvedActionId),
        ]);
        setAction(actionRes.data as Action);
        setMusicList(musicSyncList);

        if (musicIdFromQuery > 0 && musicSyncList.some(item => item.music_id === musicIdFromQuery)) {
          setSelectedMusicId(musicIdFromQuery);
        } else {
          setSelectedMusicId(null);
        }
      } catch (err: any) {
        setError(err?.response?.data?.detail || '加载动作或音乐失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [musicIdFromQuery, resolvedActionId]);

  useEffect(() => {
    if (!resolvedActionId || !selectedMusicId) {
      setVideoOffsetMs(0);
      setIsAligned(false);
      return;
    }
    getActionMusicSync(resolvedActionId, selectedMusicId)
      .then((syncInfo) => {
        setVideoOffsetMs(syncInfo.sync_offset_ms || 0);
        setIsAligned(Boolean(syncInfo.is_aligned));
      })
      .catch(() => {
        setVideoOffsetMs(0);
        setIsAligned(false);
      });
  }, [resolvedActionId, selectedMusicId]);

  // 初始化音频 - 选择音乐时立即加载，但先不播放
  useEffect(() => {
    if (!selectedMusic) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audioEl = audioRef.current;

    audioEl.src = getMusicUrl(selectedMusic.music_file_path);
    audioEl.load();
    audioEl.loop = true; // 音乐循环播放

    // 加载元数据后获取时长
    const handleLoadedMetadata = () => {
      setDuration(audioEl.duration);
    };

    audioEl.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      if (audioEl) {
        audioEl.pause();
      }
      audioEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [selectedMusic]);

  // 视频播放控制：根据偏移量延迟视频
  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;
    if (!videoEl || !audioEl || !selectedMusic) return;

    // 计算视频目标时间（根据音频时间和偏移量）
    const syncVideoToAudio = () => {
      if (!audioEl || !videoEl) return;
      // 视频时间 = 音频时间 - 偏移量
      // 正偏移：视频晚播（视频时间滞后）
      // 负偏移：视频早播（视频时间超前）
      const targetVideoTime = Math.max(0, (audioEl.currentTime * 1000 - videoOffsetMs) / 1000);
      if (Math.abs(videoEl.currentTime - targetVideoTime) > 0.1) {
        videoEl.currentTime = targetVideoTime;
      }
    };

    const handleAudioPlay = async () => {
      setIsPlaying(true);
      // 播放时立即同步视频
      syncVideoToAudio();
    };

    const handleAudioPause = () => {
      setIsPlaying(false);
    };

    const handleAudioTimeUpdate = () => {
      syncVideoToAudio();
      setCurrentTime(audioEl.currentTime);
    };

    // 使用 requestAnimationFrame 持续同步
    const animate = () => {
      if (isPlaying && audioEl && !audioEl.paused) {
        syncVideoToAudio();
        setCurrentTime(audioEl.currentTime);
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    audioEl.addEventListener('play', handleAudioPlay);
    audioEl.addEventListener('pause', handleAudioPause);
    audioEl.addEventListener('timeupdate', handleAudioTimeUpdate);

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      audioEl.removeEventListener('play', handleAudioPlay);
      audioEl.removeEventListener('pause', handleAudioPause);
      audioEl.removeEventListener('timeupdate', handleAudioTimeUpdate);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [videoOffsetMs, isPlaying, selectedMusic]);

  // 清理
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handlePlayPause = () => {
    const audioEl = audioRef.current;
    const videoEl = videoRef.current;
    if (!audioEl || !videoEl) return;

    if (isPlaying) {
      audioEl.pause();
      videoEl.pause();
    } else {
      // 播放前同步视频时间
      const targetVideoTime = Math.max(0, (audioEl.currentTime * 1000 - videoOffsetMs) / 1000);
      videoEl.currentTime = targetVideoTime;

      audioEl.play().catch(() => {
        setError('音乐播放失败，请检查浏览器权限');
      });
      videoEl.play().catch(() => {});
    }
  };

  // 处理进度条拖拽
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audioEl = audioRef.current;
    const videoEl = videoRef.current;
    const time = parseFloat(e.target.value);

    if (!audioEl || !videoEl) return;

    // 同时设置音频和视频的时间
    audioEl.currentTime = time;
    const targetVideoTime = Math.max(0, (time * 1000 - videoOffsetMs) / 1000);
    videoEl.currentTime = targetVideoTime;
    setCurrentTime(time);
  };

  const handleSave = async () => {
    if (!resolvedActionId || !selectedMusicId) {
      setError('请先选择音乐');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await alignActionMusic({
        action_id: resolvedActionId,
        music_id: selectedMusicId,
        sync_offset_ms: videoOffsetMs,
        alignment_note: videoOffsetMs > 0
          ? `视频延迟 ${videoOffsetMs}ms`
          : `视频提前 ${Math.abs(videoOffsetMs)}ms`,
      });
      setSuccess('对齐保存成功，正在跳转实时检测...');
      setIsAligned(true);
      setTimeout(() => {
        navigate(`/scores/live?action_id=${resolvedActionId}&music_id=${selectedMusicId}`);
      }, 1000);
    } catch (err: any) {
      setError(err?.response?.data?.detail || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const formatMs = (ms: number) => {
    const secs = ms / 1000;
    const absSecs = Math.abs(secs);
    const sign = secs >= 0 ? '+' : '-';
    return `${sign}${absSecs.toFixed(1)}s`;
  };

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.floor(Math.abs(seconds) % 60);
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 根据偏移量说明
  const getOffsetDescription = () => {
    if (videoOffsetMs > 0) {
      return `视频延迟 ${formatMs(videoOffsetMs)}（视频晚于音乐）`;
    } else if (videoOffsetMs < 0) {
      return `视频提前 ${formatMs(Math.abs(videoOffsetMs))}（视频早于音乐）`;
    }
    return '视频与音乐同步';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <AlertCircle className="mx-auto text-red-400 mb-4" size={64} />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">动作不存在</h2>
        <p className="text-slate-500">请返回动作列表重新选择</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft size={24} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">动作 - 音乐对齐</h1>
          <p className="text-slate-500">动作：{action.name}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-600">
          <CheckCircle2 size={20} />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 视频区域 */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-slate-900 aspect-video relative">
            {action.video_path && (
              <video
                ref={videoRef}
                src={getVideoUrl(action.video_path)}
                className="w-full h-full object-contain"
                playsInline
                muted
              />
            )}
            {/* 播放控制按钮 */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-4">
              <button
                onClick={handlePlayPause}
                className="p-4 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
              >
                {isPlaying ? (
                  <Pause size={32} className="text-white" />
                ) : (
                  <Play size={32} className="text-white" />
                )}
              </button>
            </div>
            {/* 状态提示 */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <div className="px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full text-white text-sm">
                {isPlaying ? '播放中' : '已暂停'}
              </div>
            </div>
          </div>
          {/* 进度条控制栏 */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3">
            {/* 进度条 */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-mono min-w-[45px] text-right">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(currentTime, duration)}
                onChange={handleSeek}
                className="flex-1 accent-indigo-600 cursor-pointer"
                disabled={!selectedMusic}
              />
              <span className="text-xs text-slate-500 font-mono min-w-[45px]">
                {formatTime(duration)}
              </span>
            </div>
            {/* 播放/暂停和静音按钮 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlayPause}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isAligned ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                <span className="text-sm font-medium text-slate-600">{isAligned ? '已对齐' : '未对齐'}</span>
              </div>
              <span className="text-sm text-slate-500">{getOffsetDescription()}</span>
            </div>
          </div>
        </div>

        {/* 右侧控制面板 */}
        <div className="space-y-6">
          {/* 音乐选择 */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Music2 size={18} className="text-indigo-600" />
              选择音乐
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {musicList.map((music) => (
                <button
                  key={music.music_id}
                  onClick={() => {
                    setSelectedMusicId(music.music_id);
                    // 切换音乐时停止播放
                    if (audioRef.current) {
                      audioRef.current.pause();
                      setIsPlaying(false);
                    }
                  }}
                  disabled={isPlaying}
                  className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between ${
                    selectedMusicId === music.music_id
                      ? 'bg-indigo-50 border-2 border-indigo-500'
                      : 'bg-slate-50 border-2 border-transparent hover:border-indigo-200'
                  } disabled:opacity-50`}
                >
                  <span className="font-medium text-slate-900 truncate">{music.music_name}</span>
                  <span className={`text-xs ${music.is_aligned ? 'text-green-600' : 'text-amber-600'}`}>
                    {music.is_aligned ? '已对齐' : '未对齐'}
                  </span>
                </button>
              ))}

              {musicList.length === 0 && (
                <div className="text-center py-4 text-slate-500">
                  暂无音乐，请先上传音乐
                </div>
              )}
            </div>
          </div>

          {/* 视频延迟调整 */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock size={18} className="text-amber-600" />
              调整视频延迟
            </h3>
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">视频偏移量</span>
                  <span className={`text-2xl font-bold ${
                    videoOffsetMs > 0 ? 'text-amber-600' : videoOffsetMs < 0 ? 'text-blue-600' : 'text-slate-600'
                  }`}>
                    {formatMs(videoOffsetMs)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">{getOffsetDescription()}</p>
                <input
                  type="range"
                  min="-3000"
                  max="3000"
                  step="50"
                  value={videoOffsetMs}
                  onChange={(e) => {
                    setVideoOffsetMs(parseInt(e.target.value, 10));
                    setIsAligned(false);
                  }}
                  className="w-full accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>视频提前 3s</span>
                  <span>同步</span>
                  <span>视频延迟 3s</span>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={!selectedMusicId || saving}
                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-2xl hover:from-indigo-700 hover:to-blue-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                    保存中...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    保存对齐配置
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <h3 className="font-bold text-slate-900 mb-3">使用说明</h3>
        <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
          <li>选择一首音乐，音乐会自动加载</li>
          <li>点击播放按钮，音乐开始播放，视频根据偏移量同步播放</li>
          <li>拖动滑块调整视频延迟，观察画面与音乐是否对齐</li>
          <li>
            <span className="font-medium">正偏移（+）</span>：视频晚于音乐（画面滞后）
          </li>
          <li>
            <span className="font-medium">负偏移（-）</span>：视频早于音乐（画面超前）
          </li>
          <li>找到最佳对齐点后，点击保存</li>
        </ol>
      </div>
    </div>
  );
};

export default SyncAlign;
