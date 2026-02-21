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
  Clock,
  AlertCircle,
  CheckCircle2,
  Music2,
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
  const [offsetMs, setOffsetMs] = useState(0);
  const [isAligned, setIsAligned] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      setOffsetMs(0);
      setIsAligned(false);
      return;
    }
    getActionMusicSync(resolvedActionId, selectedMusicId)
      .then((syncInfo) => {
        setOffsetMs(syncInfo.sync_offset_ms || 0);
        setIsAligned(Boolean(syncInfo.is_aligned));
      })
      .catch(() => {
        setOffsetMs(0);
        setIsAligned(false);
      });
  }, [resolvedActionId, selectedMusicId]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !selectedMusic) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audioEl = audioRef.current;
    audioEl.src = getMusicUrl(selectedMusic.music_file_path);
    audioEl.load();

    const handleTimeUpdate = () => {
      if (!audioEl) return;
      const targetAudioTime = Math.max(0, videoEl.currentTime * 1000 + offsetMs) / 1000;
      if (Math.abs(audioEl.currentTime - targetAudioTime) > 0.12) {
        audioEl.currentTime = targetAudioTime;
      }
    };

    const handleVideoPlay = () => {
      audioEl.play().catch(() => {});
      setIsPlaying(true);
    };

    const handleVideoPause = () => {
      audioEl.pause();
      setIsPlaying(false);
    };

    videoEl.addEventListener('timeupdate', handleTimeUpdate);
    videoEl.addEventListener('play', handleVideoPlay);
    videoEl.addEventListener('pause', handleVideoPause);

    return () => {
      videoEl.removeEventListener('timeupdate', handleTimeUpdate);
      videoEl.removeEventListener('play', handleVideoPlay);
      videoEl.removeEventListener('pause', handleVideoPause);
    };
  }, [offsetMs, selectedMusic]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
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
        sync_offset_ms: offsetMs,
        alignment_note: offsetMs > 0 ? `音乐提前 ${offsetMs}ms` : `音乐延后 ${Math.abs(offsetMs)}ms`,
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
          <h1 className="text-3xl font-bold text-slate-900">动作-音乐对齐</h1>
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
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-slate-900 aspect-video relative">
            {action.video_path && (
              <video
                ref={videoRef}
                src={getVideoUrl(action.video_path)}
                className="w-full h-full object-contain"
                playsInline
                muted={false}
              />
            )}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center">
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
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isAligned ? 'bg-green-500' : 'bg-amber-500'}`}></div>
              <span className="text-sm font-medium text-slate-600">{isAligned ? '当前组合已对齐' : '当前组合未对齐'}</span>
            </div>
            <span className="text-sm text-slate-500">偏移 {formatMs(offsetMs)}</span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Music2 size={18} className="text-indigo-600" />
              选择音乐
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {musicList.map((music) => (
                <button
                  key={music.music_id}
                  onClick={() => setSelectedMusicId(music.music_id)}
                  className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between ${
                    selectedMusicId === music.music_id
                      ? 'bg-indigo-50 border-2 border-indigo-500'
                      : 'bg-slate-50 border-2 border-transparent hover:border-indigo-200'
                  }`}
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

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock size={18} className="text-amber-600" />
              调整同步偏移
            </h3>
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-slate-600">音乐偏移量</span>
                  <span className={`text-2xl font-bold ${
                    offsetMs > 0 ? 'text-green-600' : offsetMs < 0 ? 'text-red-600' : 'text-slate-600'
                  }`}>
                    {formatMs(offsetMs)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-3000"
                  max="3000"
                  step="100"
                  value={offsetMs}
                  onChange={(e) => {
                    setOffsetMs(parseInt(e.target.value, 10));
                    setIsAligned(false);
                  }}
                  className="w-full accent-indigo-600"
                />
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
                    保存动作-音乐对齐
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SyncAlign;
