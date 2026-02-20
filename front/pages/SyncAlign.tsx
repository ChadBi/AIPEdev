import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { syncAlign, getVideoWithSync, getMusicList } from '../api/sync';
import { VideoWithSync, Music } from '../types';
import api, { getVideoUrl } from '../api';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Save,
  ArrowLeft,
  Clock,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

const SyncAlign: React.FC = () => {
  const [searchParams] = useSearchParams();
  const videoId = parseInt(searchParams.get('video_id') || '0');
  const navigate = useNavigate();

  const [video, setVideo] = useState<VideoWithSync | null>(null);
  const [musicList, setMusicList] = useState<Music[]>([]);
  const [selectedMusicId, setSelectedMusicId] = useState<number | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 视频和音频引用
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 获取视频和音乐列表
  useEffect(() => {
    if (!videoId) {
      setError('未指定视频');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [videoData, musicData] = await Promise.all([
          getVideoWithSync(videoId),
          getMusicList()
        ]);

        setVideo(videoData);
        setMusicList(musicData.items || []);

        // 如果视频已有关联音乐，设为默认选择
        if (videoData.music_id) {
          setSelectedMusicId(videoData.music_id);
        } else if (musicData.items && musicData.items.length > 0) {
          setSelectedMusicId(musicData.items[0].id);
        }

        // 如果已有同步配置，加载偏移量
        if (videoData.sync_offset_ms !== null) {
          setOffsetMs(videoData.sync_offset_ms);
        }
      } catch (err: any) {
        setError('加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [videoId]);

  // 同步播放状态
  useEffect(() => {
    const videoEl = videoRef.current;
    const audioEl = audioRef.current;

    if (!videoEl || !audioEl || !selectedMusicId) return;

    const handleTimeUpdate = () => {
      // 计算音频应该播放的时间点
      const audioTime = Math.max(0, videoEl.currentTime * 1000 + offsetMs) / 1000;
      if (Math.abs(audioEl.currentTime - audioTime) > 0.1) {
        audioEl.currentTime = audioTime;
      }
    };

    const handleVideoPlay = () => {
      if (audioEl.src) {
        audioEl.play();
        setIsPlaying(true);
      }
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
  }, [selectedMusicId, offsetMs]);

  // 加载选中的音乐
  useEffect(() => {
    if (!selectedMusicId) return;

    const loadMusic = async () => {
      const music = musicList.find(m => m.id === selectedMusicId);
      if (music) {
        const url = getMusicUrl(music.file_path);

        // 如果是新建 audio
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }

        audioRef.current.src = url;
        audioRef.current.load();
      }
    };

    loadMusic();
  }, [selectedMusicId, musicList]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  };

  const handleOffsetChange = (newOffset: number) => {
    setOffsetMs(newOffset);
  };

  const handleSave = async () => {
    if (!videoId || !selectedMusicId) {
      setError('请选择音乐');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await syncAlign({
        video_id: videoId,
        music_id: selectedMusicId,
        sync_offset_ms: offsetMs,
        alignment_note: offsetMs > 0 ? `音乐提前 ${offsetMs}ms` : `音乐延后 ${Math.abs(offsetMs)}ms`
      });

      setSuccess('对齐保存成功！正在跳转...');
      setTimeout(() => {
        navigate(`/scores/live?video_id=${videoId}`);
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || '保存失败，请重试');
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

  const selectedMusic = musicList.find(m => m.id === selectedMusicId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <AlertCircle className="mx-auto text-red-400 mb-4" size={64} />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">视频不存在</h2>
        <p className="text-slate-500">请检查视频ID或返回重新选择</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft size={24} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">音视频对齐</h1>
          <p className="text-slate-500">调整音乐与标准动作的同步偏移</p>
        </div>
      </div>

      {/* Alerts */}
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
        {/* Video Section */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-slate-900 aspect-video relative">
            {video.file_path && (
              <video
                ref={videoRef}
                src={getVideoUrl(video.file_path)}
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
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-600">标准动作预览</span>
            </div>
            <span className="text-sm text-slate-500">
              {video.music_id ? '已关联音乐' : '请选择音乐'}
            </span>
          </div>
        </div>

        {/* Controls Section */}
        <div className="space-y-6">
          {/* Music Selection */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 text-sm font-bold">1</span>
              选择音乐
            </h3>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {musicList.map((music) => (
                <button
                  key={music.id}
                  onClick={() => setSelectedMusicId(music.id)}
                  className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                    selectedMusicId === music.id
                      ? 'bg-indigo-50 border-2 border-indigo-500'
                      : 'bg-slate-50 border-2 border-transparent hover:border-indigo-200'
                  }`}
                >
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <span className="text-indigo-600 font-bold text-sm">♪</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{music.name}</p>
                    <p className="text-xs text-slate-500">
                      {music.duration_seconds
                        ? `${Math.floor(music.duration_seconds / 60)}:${Math.floor(music.duration_seconds % 60).toString().padStart(2, '0')}`
                        : '--:--'}
                    </p>
                  </div>
                  {selectedMusicId === music.id && (
                    <CheckCircle2 size={20} className="text-indigo-600 flex-shrink-0" />
                  )}
                </button>
              ))}

              {musicList.length === 0 && (
                <div className="text-center py-4 text-slate-500">
                  <p>暂无音乐，请先</p>
                  <button
                    onClick={() => navigate('/music')}
                    className="text-indigo-600 font-medium hover:underline"
                  >
                    上传音乐
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sync Offset Adjustment */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 text-sm font-bold">2</span>
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
                  onChange={(e) => handleOffsetChange(parseInt(e.target.value))}
                  className="w-full accent-indigo-600"
                />

                <div className="flex justify-between text-xs text-slate-500 mt-2">
                  <span>-3s (音乐延后)</span>
                  <span>0 (完美对齐)</span>
                  <span>+3s (音乐提前)</span>
                </div>
              </div>

              {/* 时间说明 */}
              <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-600">
                {offsetMs > 0 ? (
                  <p className="flex items-center gap-2">
                    <Clock size={16} className="text-green-600" />
                    音乐将提前 {formatMs(offsetMs)} 播放
                  </p>
                ) : offsetMs < 0 ? (
                  <p className="flex items-center gap-2">
                    <Clock size={16} className="text-red-600" />
                    音乐将延后 {formatMs(Math.abs(offsetMs))} 播放
                  </p>
                ) : (
                  <p className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-600" />
                    当前音乐与视频已完美对齐
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Audio Preview */}
          {selectedMusic && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <h3 className="font-bold text-slate-900 mb-4">音乐预览</h3>
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <span className="text-amber-600 font-bold">♪</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{selectedMusic.name}</p>
                  <p className="text-xs text-slate-500">点击播放按钮预览效果</p>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
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
                保存对齐设置
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncAlign;
