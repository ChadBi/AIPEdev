import React, { useRef, useEffect, useLayoutEffect } from 'react';
import { Keypoints } from '../types';

interface LiveVideoPanelProps {
  stream?: MediaStream | null;
  videoSrc?: string;
  title: string;
  isActive?: boolean;
  keypoints?: Keypoints | null;
  score?: number;
  showSkeleton?: boolean;
  className?: string;
  muted?: boolean;
  loop?: boolean;
  volume?: number;
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  onTimeUpdate?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  fitMode?: 'contain' | 'cover';
}

// 骨架连接定义 (COCO 关键点索引)
const SKELETON_CONNECTIONS = [
  [5, 7],   // 左肩-左肘
  [7, 9],   // 左肘-左腕
  [6, 8],   // 右肩-右肘
  [8, 10],  // 右肘-右腕
  [5, 6],   // 左肩-右肩
  [5, 11],  // 左肩-左髋
  [6, 12],  // 右肩-右髋
  [11, 12], // 左髋-右髋
  [11, 13], // 左髋-左膝
  [13, 15], // 左膝-左踝
  [12, 14], // 右髋-右膝
  [14, 16], // 右膝-右踝
  [0, 1],   // 鼻子-左眼
  [0, 2],   // 鼻子-右眼
  [1, 3],   // 左眼-左耳
  [2, 4],   // 右眼-右耳
];

// 关键点名称到索引的映射
const KEYPOINT_NAMES = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
];

const LiveVideoPanel: React.FC<LiveVideoPanelProps> = ({
  stream = null,
  videoSrc,
  title,
  isActive = false,
  keypoints = null,
  score,
  showSkeleton = true,
  className = '',
  muted = true,
  loop = false,
  volume = 1.0,
  videoRef: externalVideoRef,
  onTimeUpdate,
  fitMode = 'contain',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStreamRef = useRef<MediaStream | null>(null);

  // 同步外部引用到内部 video 元素
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (video && externalVideoRef) {
      externalVideoRef.current = video;
    }
  }, [externalVideoRef]);

  // 组件卸载时清空外部引用
  useEffect(() => {
    return () => {
      if (externalVideoRef) {
        externalVideoRef.current = null;
      }
    };
  }, [externalVideoRef]);

  // 将视频流绑定到 video 元素
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const hasExistingStream = video.srcObject instanceof MediaStream;
    const targetStream = stream || (hasExistingStream ? (video.srcObject as MediaStream) : currentStreamRef.current);

    if (targetStream) {
      if (video.srcObject !== targetStream) {
        video.srcObject = targetStream;
      }
      currentStreamRef.current = targetStream;
      video.autoplay = true;
      video.muted = muted;

      // 尝试播放视频
      if (video.paused && video.readyState >= 2) {
        video.play().catch(() => {});
      }
    } else if (hasExistingStream) {
      // 保持现有流
      currentStreamRef.current = video.srcObject as MediaStream;
      if (video.paused && video.readyState >= 2) {
        video.play().catch(() => {});
      }
    } else {
      video.srcObject = null;
      currentStreamRef.current = null;
    }

    // 设置 canvas 尺寸
    const updateCanvasSize = () => {
      if (video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    };

    updateCanvasSize();
    video.addEventListener('loadedmetadata', updateCanvasSize);
    video.addEventListener('resize', updateCanvasSize);

    return () => {
      video.removeEventListener('loadedmetadata', updateCanvasSize);
      video.removeEventListener('resize', updateCanvasSize);
    };
  }, [stream, muted]);

  // 处理 videoSrc 变化
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (videoSrc) {
      video.src = videoSrc;
      video.load();
    } else if (!stream) {
      if (currentStreamRef.current || (video.srcObject instanceof MediaStream)) {
        // 保留现有 MediaStream
      } else {
        video.removeAttribute("src");
        video.load();
      }
    }
  }, [videoSrc, stream]);

  // 绘制骨架
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !keypoints || !showSkeleton) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
    ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(255, 0, 100, 0.9)';

    // 绘制连接线
    SKELETON_CONNECTIONS.forEach(([i, j]) => {
      const kp1 = keypoints[KEYPOINT_NAMES[i]];
      const kp2 = keypoints[KEYPOINT_NAMES[j]];
      if (kp1 && kp1[2] > 0.3 && kp2 && kp2[2] > 0.3) {
        ctx.beginPath();
        ctx.moveTo(kp1[0] * width, kp1[1] * height);
        ctx.lineTo(kp2[0] * width, kp2[1] * height);
        ctx.stroke();
      }
    });

    // 绘制关键点
    KEYPOINT_NAMES.forEach((name) => {
      const kp = keypoints[name];
      if (kp && kp[2] > 0.3) {
        ctx.beginPath();
        ctx.arc(kp[0] * width, kp[1] * height, 6, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }, [keypoints, showSkeleton]);

  // 控制视频音量
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
  }, [volume]);

  return (
    <div className={`relative bg-slate-900 rounded-2xl overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className={`absolute top-0 left-0 right-0 z-10 px-4 py-3 flex items-center justify-between ${
        isActive ? 'bg-gradient-to-b from-black/60 to-transparent' : ''
      }`}>
        <div className="flex items-center gap-2">
          {isActive && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
          <span className="text-white font-medium text-sm">{title}</span>
        </div>
        {score !== undefined && (
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
            score >= 80 ? 'bg-green-500/80' : score >= 60 ? 'bg-yellow-500/80' : 'bg-red-500/80'
          }`}>
            {score.toFixed(1)}
          </div>
        )}
      </div>

      {/* Video + Canvas Overlay */}
      <div className="relative flex-1 w-full flex items-center justify-center bg-black overflow-hidden">
        <video
          ref={videoRef}
          autoPlay={!!stream}
          playsInline
          muted={muted}
          loop={loop}
          onTimeUpdate={onTimeUpdate}
          className={`absolute inset-0 w-full h-full ${fitMode === 'cover' ? 'object-cover' : 'object-contain'}`}
        />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${fitMode === 'cover' ? 'object-cover' : 'object-contain'} pointer-events-none`}
        />

        {/* 没有视频流时的占位 */}
        {!stream && !videoSrc && !currentStreamRef.current && !(videoRef.current?.srcObject) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-10">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">等待视频信号...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveVideoPanel;