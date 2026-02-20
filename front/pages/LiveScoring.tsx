import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getVideoWithSync, getSyncConfig } from '../api/sync';
import { getMusicList, getMusicUrl } from '../api/music';
import { VideoWithSync, Music, CameraDevice, LiveStats } from '../types';
import { getVideoUrl } from '../api';
import CameraSelector from '../components/CameraSelector';
import LiveVideoPanel from '../components/LiveVideoPanel';
import MusicPlayerBar from '../components/MusicPlayerBar';
import {
  Play,
  Pause,
  Square,
  Settings,
  ChevronRight,
  Clock,
  Target,
  Zap,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

const LiveScoring: React.FC = () => {
  const [searchParams] = useSearchParams();
  const videoId = parseInt(searchParams.get('video_id') || '0');
  const navigate = useNavigate();

  // 数据状态
  const [video, setVideo] = useState<VideoWithSync | null>(null);
  const [music, setMusic] = useState<Music | null>(null);
  const [cameraDevices, setCameraDevices] = useState<CameraDevice[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);

  // 播放状态
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // 统计状态
  const [stats, setStats] = useState<LiveStats>({
    fps: 0,
    frames_processed: 0,
    latency_ms: 0,
    current_score: 0,
    average_score: 0,
    music_playing: false,
    music_volume: 1
  });

  // 加载状态
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameLoopRef = useRef<number>();
  const statsLoopRef = useRef<number>();
  const startTimeRef = useRef<number>(0);

  // 加载视频和音乐数据
  useEffect(() => {
    const fetchData = async () => {
      if (!videoId) {
        setError('未指定视频');
        setLoading(false);
        return;
      }

      try {
        const [videoData, musicList] = await Promise.all([
          getVideoWithSync(videoId),
          getMusicList()
        ]);

        setVideo(videoData);
        setCameraDevices([]); // 摄像头列表由 CameraSelector 组件管理

        // 加载音乐
        if (videoData.music_id) {
          const musicData = musicList.items?.find((m: Music) => m.id === videoData.music_id);
          if (musicData) {
            setMusic(musicData);
          }
        }

        // 检查是否有对齐配置
        if (!videoData.is_aligned) {
          setWarning('该视频尚未进行音视频对齐，点击"调整对齐"进行设置');
        }
      } catch (err: any) {
        setError('加载数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [videoId]);

  // 摄像头流就绪
  const handleStreamReady = useCallback((newStream: MediaStream | null) => {
    setStream(newStream);
    setCameraReady(!!newStream);
  }, []);

  // 开始检测
  const handleStart = async () => {
    if (!cameraReady || !stream) {
      setError('请先选择并启动摄像头');
      return;
    }

    setError('');
    setIsPlaying(true);
    setIsPaused(false);
    startTimeRef.current = Date.now();

    // 启动音乐
    if (music) {
      const audio = new Audio(getMusicUrl(music.file_path));
      audioRef.current = audio;

      // 设置偏移
      if (video?.sync_offset_ms && video.sync_offset_ms > 0) {
        audio.currentTime = video.sync_offset_ms / 1000;
      }

      audio.volume = stats.music_volume;
      audio.play().catch((err) => {
        console.warn('音乐播放失败:', err);
      });
    }

    // 开始帧处理循环
    startFrameLoop();
  };

  // 帧处理循环
  const startFrameLoop = () => {
    let frameCount = 0;
    let lastFpsTime = Date.now();
    let lastFrameTime = Date.now();

    const processFrame = async () => {
      if (!isPlaying || isPaused) return;

      const now = Date.now();
      const timestamp = (now - startTimeRef.current) / 1000;

      // FPS 计算
      frameCount++;
      if (now - lastFpsTime >= 1000) {
        setStats(prev => ({
          ...prev,
          fps: frameCount,
          frames_processed: prev.frames_processed + frameCount
        }));
        frameCount = 0;
        lastFpsTime = now;
      }

      // 从视频流捕获帧
      if (stream && videoRef.current) {
        // 模拟姿态检测（这里应该接入 MediaPipe 或后端 API）
        // 实际实现中，应该：
        // 1. 使用 MediaPipe/Teaachability 在前端提取关键点
        // 2. 或将帧发送到后端进行 YOLOv8 推理

        // 计算延迟
        const latency = now - lastFrameTime;
        lastFrameTime = now;

        // 模拟评分（实际应该基于关键点计算）
        const currentScore = Math.max(0, Math.min(100, 70 + Math.random() * 25));
        const avgScore = 75 + Math.random() * 15;

        setStats(prev => ({
          ...prev,
          latency_ms: latency,
          current_score: currentScore,
          average_score: avgScore,
          music_playing: true
        }));
      }

      // 继续下一帧
      frameLoopRef.current = requestAnimationFrame(processFrame);
    };

    frameLoopRef.current = requestAnimationFrame(processFrame);
  };

  // 暂停/继续
  const handleTogglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      startFrameLoop();
    } else {
      setIsPaused(true);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (frameLoopRef.current) {
        cancelAnimationFrame(frameLoopRef.current);
      }
    }
  };

  // 停止检测
  const handleStop = () => {
    setIsPlaying(false);
    setIsPaused(false);

    if (frameLoopRef.current) {
      cancelAnimationFrame(frameLoopRef.current);
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraReady(false);
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  // 清理
  useEffect(() => {
    return () => {
      handleStop();
    };
  }, []);

  // 格式化工具函数
  const formatScore = (score: number) => score.toFixed(1);
  const formatMs = (ms: number) => `${ms.toFixed(0)}ms`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error && !video) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <AlertCircle className="mx-auto text-red-400 mb-4" size={64} />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">加载失败</h2>
        <p className="text-slate-500 mb-6">{error}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl">
          返回
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* 顶部栏 */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700">
              ← 返回
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">实时检测</h1>
              {video && <p className="text-slate-400 text-sm">{video.sync_config_id ? '已对齐' : '未对齐'}</p>}
            </div>
          </div>

          {/* 警告提示 */}
          {warning && !isPlaying && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl text-sm">
              <AlertCircle size={16} />
              {warning}
              <button
                onClick={() => navigate(`/sync/align?video_id=${videoId}`)}
                className="ml-2 underline hover:text-amber-300"
              >
                调整对齐
              </button>
            </div>
          )}

          {/* 控制按钮 */}
          <div className="flex items-center gap-2">
            {!isPlaying ? (
              <button
                onClick={handleStart}
                disabled={!cameraReady}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={20} />
                开始检测
              </button>
            ) : (
              <>
                <button
                  onClick={handleTogglePause}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700"
                >
                  {isPaused ? <Play size={20} /> : <Pause size={20} />}
                  {isPaused ? '继续' : '暂停'}
                </button>
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700"
                >
                  <Square size={20} />
                  停止
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 主体内容 - 左右分栏 */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-6">
          {/* 左侧 - 标准动作视频 */}
          <div className="col-span-7 flex flex-col gap-4">
            <LiveVideoPanel
              stream={null}
              title="标准动作"
              isActive={isPlaying}
              score={stats.average_score > 0 ? stats.average_score : undefined}
              showSkeleton={false}
              className="flex-1"
            />
            {music && (
              <MusicPlayerBar
                music={music}
                syncOffsetMs={video?.sync_offset_ms || 0}
                disabled={!isPlaying}
              />
            )}
          </div>

          {/* 右侧 - 实时摄像头 + 控制面板 */}
          <div className="col-span-5 flex flex-col gap-4">
            {/* 摄像头选择 */}
            {!isPlaying && (
              <CameraSelector
                onDeviceChange={setSelectedCamera}
                selectedDeviceId={selectedCamera}
                onStreamReady={handleStreamReady}
              />
            )}

            {/* 实时画面 */}
            <LiveVideoPanel
              stream={stream}
              title="实时画面"
              isActive={cameraReady}
              score={stats.current_score > 0 ? stats.current_score : undefined}
              showSkeleton={true}
              className="flex-1"
            />

            {/* 实时统计面板 */}
            <div className="bg-slate-800 rounded-2xl p-4">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Zap size={18} className="text-yellow-500" />
                实时统计
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  label="FPS"
                  value={stats.fps.toString()}
                  icon={<Target size={16} />}
                  color={stats.fps >= 20 ? 'green' : stats.fps >= 10 ? 'yellow' : 'red'}
                />
                <StatCard
                  label="当前分数"
                  value={formatScore(stats.current_score)}
                  icon={<Target size={16} />}
                  color={stats.current_score >= 80 ? 'green' : stats.current_score >= 60 ? 'yellow' : 'red'}
                />
                <StatCard
                  label="平均分数"
                  value={formatScore(stats.average_score)}
                  icon={<Target size={16} />}
                  color={stats.average_score >= 80 ? 'green' : stats.average_score >= 60 ? 'yellow' : 'red'}
                />
                <StatCard
                  label="处理延迟"
                  value={formatMs(stats.latency_ms)}
                  icon={<Clock size={16} />}
                  color={stats.latency_ms < 100 ? 'green' : stats.latency_ms < 200 ? 'yellow' : 'red'}
                />
                <StatCard
                  label="已处理帧数"
                  value={stats.frames_processed.toString()}
                  icon={<Zap size={16} />}
                />
                <StatCard
                  label="播放状态"
                  value={isPlaying ? (isPaused ? '已暂停' : '进行中') : '未开始'}
                  icon={isPlaying && !isPaused ? <CheckCircle2 size={16} className="text-green-500" /> : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 统计卡片组件
const StatCard: React.FC<{
  label: string;
  value: string;
  icon?: React.ReactNode;
  color?: 'green' | 'yellow' | 'red';
}> = ({ label, value, icon, color = 'slate' }) => {
  const colorClasses = {
    green: 'bg-green-500/20 text-green-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    red: 'bg-red-500/20 text-red-400',
    slate: 'bg-slate-700 text-slate-300'
  };

  return (
    <div className="bg-slate-700/50 rounded-xl p-3">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
        {icon}
        {label}
      </div>
      <div className={`text-lg font-bold ${colorClasses[color].split(' ')[1]}`}>
        {value}
      </div>
    </div>
  );
};

export default LiveScoring;
