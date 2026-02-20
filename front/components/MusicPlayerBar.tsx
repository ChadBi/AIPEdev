import React, { useState, useRef, useEffect } from 'react';
import { Music } from '../types';
import { getMusicUrl } from '../api/music';
import { Play, Pause, Volume2, VolumeX, Settings } from 'lucide-react';

interface MusicPlayerBarProps {
  music: Music | null;
  syncOffsetMs?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  disabled?: boolean;
}

const MusicPlayerBar: React.FC<MusicPlayerBarProps> = ({
  music,
  syncOffsetMs = 0,
  onPlay,
  onPause,
  onEnded,
  disabled = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 初始化 Audio
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';

    const audio = audioRef.current;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onEnded?.();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onEnded]);

  // 加载音乐
  useEffect(() => {
    if (!music || !audioRef.current) return;

    const audio = audioRef.current;
    const url = getMusicUrl(music.file_path);

    // 如果是新的音乐源
    if (audio.src !== url) {
      audio.src = url;
      audio.load();

      // 设置起始偏移（用于对齐）
      if (syncOffsetMs !== 0) {
        const offsetSeconds = syncOffsetMs / 1000;
        if (offsetSeconds > 0) {
          // 音乐提前：从偏移时间点开始
          audio.currentTime = offsetSeconds;
        }
      }
    }
  }, [music, syncOffsetMs]);

  // 播放控制
  const handlePlayPause = () => {
    if (!audioRef.current || disabled) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      onPause?.();
    } else {
      // 设置起始偏移（用于对齐）
      if (syncOffsetMs !== 0) {
        const offsetSeconds = syncOffsetMs / 1000;
        if (offsetSeconds > 0 && audioRef.current.currentTime < offsetSeconds) {
          audioRef.current.currentTime = offsetSeconds;
        }
      }

      audioRef.current.play();
      setIsPlaying(true);
      onPlay?.();
    }
  };

  // 音量控制
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 1;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!music) {
    return null;
  }

  return (
    <div className="bg-slate-800 rounded-2xl p-4">
      <div className="flex items-center gap-4">
        {/* Music Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">♪</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium truncate">{music.name}</p>
            <p className="text-slate-400 text-sm">
              偏移: {syncOffsetMs > 0 ? '+' : ''}{(syncOffsetMs / 1000).toFixed(1)}s
            </p>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            disabled={disabled}
            className="w-12 h-12 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPlaying ? (
              <Pause size={20} className="text-slate-900" />
            ) : (
              <Play size={20} className="text-slate-900 ml-1" />
            )}
          </button>
        </div>

        {/* Progress */}
        <div className="flex-1 max-w-xs hidden sm:block">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs w-10 text-right">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1.5 bg-slate-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span className="text-slate-400 text-xs w-10">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1.5 accent-indigo-500"
          />
        </div>
      </div>
    </div>
  );
};

export default MusicPlayerBar;
