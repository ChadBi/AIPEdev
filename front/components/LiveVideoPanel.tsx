import React, { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
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
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  onTimeUpdate?: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
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
  videoRef: externalVideoRef,
  onTimeUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStreamRef = useRef<MediaStream | null>(null); // 追踪当前绑定的流
  const debugClickCountRef = useRef(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // 调试功能：点击标题 5 次显示详细状态
  const handleTitleDoubleClick = () => {
    const video = videoRef.current;
    if (!video) return;

    console.log('[LiveVideoPanel] 详细状态:', {
      title,
      streamProp: !!stream,
      currentStreamRef: !!currentStreamRef.current,
      videoSrc,
      srcObject: !!video.srcObject,
      srcObjectType: video.srcObject?.constructor.name,
      readyState: video.readyState,
      readyStateStr: ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][video.readyState] || 'UNKNOWN',
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      paused: video.paused,
      muted: video.muted,
      autoplay: video.autoplay,
      playsInline: video.playsInline,
      loop: video.loop,
      className: video.className,
      offsetWidth: video.offsetWidth,
      offsetHeight: video.offsetHeight,
      offsetTop: video.offsetTop,
      offsetLeft: video.offsetLeft,
      style: video.style.cssText,
      isInDOM: document.body.contains(video),
      parentNode: video.parentNode?.tagName,
      parentHidden: window.getComputedStyle(video.parentElement || video).display === 'none',
      parentVisibility: window.getComputedStyle(video.parentElement || video).visibility === 'hidden',
      zIndex: parseInt(window.getComputedStyle(video.parentElement || video).zIndex || '0'),
      placeholderVisible: !stream && !videoSrc && !currentStreamRef.current && !(video.srcObject)
    });
  };

  // 确保外部引用始终指向正确的 video 元素
  useLayoutEffect(() => {
    const video = videoRef.current;
    if (video && externalVideoRef) {
      externalVideoRef.current = video;
      console.log('[LiveVideoPanel] 同步 externalVideoRef:', {
        title,
        srcObject: !!video.srcObject,
        srcObjectType: video.srcObject?.constructor.name,
        readyState: video.readyState,
        readyStateStr: ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][video.readyState] || 'UNKNOWN',
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        paused: video.paused,
        videoElement: video.tagName,
        className: video.className,
        offsetWidth: video.offsetWidth,
        offsetHeight: video.offsetHeight
      });

      // 检查 video 元素是否在 DOM 中
      const isInDOM = document.body.contains(video);
      console.log('[LiveVideoPanel] video 元素 DOM 状态:', { isInDOM });
    }
  }, [externalVideoRef, videoRef, stream, title]); // 添加 title 作为依赖

  // 组件卸载时清空外部引用
  useEffect(() => {
    console.log('[LiveVideoPanel] 组件挂载，title:', title);
    return () => {
      if (externalVideoRef) {
        externalVideoRef.current = null;
        console.log('[LiveVideoPanel] 组件卸载，清空 externalVideoRef，title:', title);
      }
    };
  }, [externalVideoRef, title]);

  // 将视频流绑定到 video 元素
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    console.log('[LiveVideoPanel] useEffect 触发:', {
      title,
      streamExists: !!stream,
      streamTracks: stream ? stream.getTracks().length : 0,
      currentStreamRef: !!currentStreamRef.current,
      videoSrcObject: !!video.srcObject,
      videoSrcObjectType: video.srcObject?.constructor.name,
      videoReadyState: video.readyState,
      videoPaused: video.paused,
      isActive,
      videoElementId: video.id,
      videoElementTag: video.tagName
    });

    // 如果 video 已经有 srcObject 且是 MediaStream，只有当新流不同时才替换
    const hasExistingStream = video.srcObject instanceof MediaStream;

    console.log('[LiveVideoPanel] 流资源检查:', {
      hasExistingStream,
      videoSrcObject: video.srcObject,
      srcObjectIsMediaStream: video.srcObject instanceof MediaStream,
      streamProp: stream,
      currentStreamRef: currentStreamRef.current
    });

    // 确定要使用的流（优先使用 prop 传入的 stream，否则使用已有的或 saved）
    const targetStream = stream || (hasExistingStream ? (video.srcObject as MediaStream) : currentStreamRef.current);

    console.log('[LiveVideoPanel] 目标流:', {
      targetStream: !!targetStream,
      targetType: targetStream?.constructor.name
    });

    if (targetStream) {
      console.log('[LiveVideoPanel] 设置 video.srcObject:', !!targetStream);
      // 只有当流真的不同时才重新设置，避免不必要的重置
      if (video.srcObject !== targetStream) {
        video.srcObject = targetStream;
      }
      currentStreamRef.current = targetStream;

      // 确保 autoplay 和 muted 设置正确
      video.autoplay = true;
      video.muted = muted;
      console.log('[LiveVideoPanel] 已设置 autoplay=true, muted=', muted);

      // 监听视频事件以跟踪加载状态
      const onLoadedMetadata = () => {
        console.log('[LiveVideoPanel] loadedmetadata 事件触发:', {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          paused: video.paused
        });
      };

      const onCanPlay = () => {
        console.log('[LiveVideoPanel] canplay 事件触发:', {
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight
        });
      };

      const onPlay = () => {
        console.log('[LiveVideoPanel] play 事件触发:', {
          readyState: video.readyState,
          currentTime: video.currentTime,
          duration: video.duration,
          videoWidth: video.videoWidth
        });
      };

      const onPause = () => {
        console.log('[LiveVideoPanel] pause 事件触发');
      };

      video.addEventListener('loadedmetadata', onLoadedMetadata);
      video.addEventListener('canplay', onCanPlay);
      video.addEventListener('play', onPlay);
      video.addEventListener('pause', onPause);
      video.addEventListener('playing', () => {
        console.log('[LiveVideoPanel] playing 事件触发:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          offsetWidth: video.offsetWidth,
          offsetHeight: video.offsetHeight,
          isInDOM: document.body.contains(video),
          parentHidden: window.getComputedStyle(video.parentElement || video).display === 'none',
          visibility: window.getComputedStyle(video.parentElement || video).visibility
        });
      });
      video.addEventListener('error', (e) => {
        console.error('[LiveVideoPanel] video 元素错误:', {
          error: video.error,
          code: video.error?.code,
          message: video.error?.message
        });
      });
      video.addEventListener('stalled', () => {
        console.warn('[LiveVideoPanel] video stalled 事件触发');
      });

      // 只有当视频暂停时才尝试播放
      if (video.paused && video.readyState >= 2) {
        console.log('[LiveVideoPanel] 视频暂停中，尝试播放');
        video.play().then(() => {
          console.log('[LiveVideoPanel] video.play() 成功:', {
            readyState: video.readyState,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            currentTime: video.currentTime
          });
        }).catch((err) => {
          console.error('[LiveVideoPanel] video.play() 失败:', {
            error: err.message,
            name: err.name,
            code: err.code,
            readyState: video.readyState,
            paused: video.paused
          });
        });
      }

      return () => {
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.removeEventListener('canplay', onCanPlay);
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('playing', null as any);
        video.removeEventListener('error', null as any);
        video.removeEventListener('stalled', null as any);
      };
    } else {
      // 当没有新流但 video 已有 srcObject 时，保持现状不清空
      // 这是为了避免在布局切换或流 prop 临时为 null 时丢失视频
      console.log('[LiveVideoPanel] 没有目标流，检查是否保留现有:', {
        hasExistingStream,
        videoSrcObject: video.srcObject,
        srcObjectConstructor: video.srcObject?.constructor.name,
        videoPaused: video.paused,
        videoReadyState: video.readyState
      });

      if (hasExistingStream) {
        console.log('[LiveVideoPanel] stream prop 为 null 但 video 已有 srcObject，保持现状');
        currentStreamRef.current = video.srcObject as MediaStream;
        // 确保视频在播放
        if (video.paused && video.readyState >= 2) {
          console.log('[LiveVideoPanel] 视频暂停中，尝试恢复播放');
          video.play().catch(console.error);
        }
      } else {
        console.log('[LiveVideoPanel] 确实没有可用的流，清空视频');
        video.srcObject = null;
        currentStreamRef.current = null;
      }
    }

    // 设置 canvas 尺寸与视频匹配
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
  }, [stream, isActive, muted]); // 添加 isActive 作为依赖，布局切换时重新检查

  // 监控视频容器尺寸变化，确保视频正确渲染
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    console.log('[LiveVideoPanel] 设置 ResizeObserver');

    let debounceTimer: NodeJS.Timeout | null = null;
    let lastLoggedSize = { width: 0, height: 0 };

    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;

        // 只在尺寸真正变化时记录，且使用防抖
        if (Math.abs(newWidth - lastLoggedSize.width) > 1 || Math.abs(newHeight - lastLoggedSize.height) > 1) {
          if (debounceTimer) clearTimeout(debounceTimer);

          debounceTimer = setTimeout(() => {
            console.log('[LiveVideoPanel] 视频元素尺寸变化:', {
              title,
              contentRect: entry.contentRect,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              offsetWidth: video.offsetWidth,
              offsetHeight: video.offsetHeight,
              paused: video.paused,
              readyState: video.readyState,
              readyStateStr: ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][video.readyState] || 'UNKNOWN',
              srcObject: !!video.srcObject,
              currentTime: video.currentTime
            });

            lastLoggedSize = { width: newWidth, height: newHeight };

            // 如果视频暂停但有流，尝试恢复播放
            if (video.paused && video.srcObject instanceof MediaStream && video.videoWidth > 0 && video.readyState >= 2) {
              console.log('[LiveVideoPanel] 尺寸变化导致视频暂停，尝试恢复播放');
              video.play().then(() => {
                console.log('[LiveVideoPanel] 尺寸变化后视频恢复播放成功');
              }).catch((err) => {
                console.error('[LiveVideoPanel] 尺寸变化后视频恢复播放失败:', err.message);
              });
            }
          }, 200); // 200ms 防抖
        }
      }
    });

    resizeObserverRef.current.observe(video);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [title]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    console.log('[LiveVideoPanel] videoSrc 改变:', { videoSrc, streamExists: !!stream });
    if (videoSrc) {
      console.log('[LiveVideoPanel] 设置 video.src =', videoSrc);
      video.src = videoSrc;
      video.load();
    } else if (!stream) {
      // 只有在没有有效的 srcObject 时才清空
      // 避免中断正在播放的 MediaStream
      if (currentStreamRef.current || (video.srcObject instanceof MediaStream)) {
        console.log('[LiveVideoPanel] video 已有 MediaStream，保留 srcObject，不调用 load()');
      } else {
        console.log('[LiveVideoPanel] 无 videoSrc 且无 stream，清空视频');
        video.removeAttribute("src");
        video.load();
      }
    }
  }, [videoSrc, stream]);

  // 监控视频元素状态变化（调试用）
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    console.log('[LiveVideoPanel] 视频元素状态检查:', {
      title,
      readyState: video.readyState,
      readyStateStr: ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][video.readyState] || 'UNKNOWN',
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      currentTime: video.currentTime,
      paused: video.paused,
      muted: video.muted,
      srcObject: !!video.srcObject,
      offsetWidth: video.offsetWidth,
      offsetHeight: video.offsetHeight,
      offsetTop: video.offsetTop,
      offsetLeft: video.offsetLeft,
      className: video.className,
      display: window.getComputedStyle(video).display,
      visibility: window.getComputedStyle(video).visibility,
      opacity: window.getComputedStyle(video).opacity,
      parentDisplay: window.getComputedStyle(video.parentElement || video).display,
      parentVisibility: window.getComputedStyle(video.parentElement || video).visibility,
      parentOpacity: window.getComputedStyle(video.parentElement || video).opacity,
      parentZIndex: window.getComputedStyle(video.parentElement || video).zIndex,
      isInDOM: document.body.contains(video),
      parentElement: video.parentElement?.tagName,
      hasStream: !!currentStreamRef.current
    });

    // 持续监控视频状态（在布局切换后的前 2 秒内）
    const monitorInterval = setInterval(() => {
      if (!videoRef.current) {
        clearInterval(monitorInterval);
        return;
      }

      const checkVideo = videoRef.current;
      const state = checkVideo.readyState;
      const vw = checkVideo.videoWidth;
      const vh = checkVideo.videoHeight;

      // 如果视频暂停但有 srcObject，尝试恢复播放
      if (checkVideo.paused && checkVideo.srcObject instanceof MediaStream && vw > 0 && state >= 2) {
        console.log('[LiveVideoPanel] 定时监控：检测到视频暂停，尝试恢复播放', {
          videoWidth: vw,
          videoHeight: vh,
          readyState: state
        });
        checkVideo.play().catch((err) => {
          console.error('[LiveVideoPanel] 定时监控：恢复播放失败', err.message);
        });
        clearInterval(monitorInterval);
      }

      // 如果视频有 srcObject 但 videoWidth 为 0，说明还在加载
      if (checkVideo.srcObject && vw === 0 && state < 2) {
        console.log('[LiveVideoPanel] 定时监控：视频中请中', {
          readyState: state,
          srcObject: !!checkVideo.srcObject
        });
      }

      // 额外检查：如果视频有流但尺寸异常小（可能是2x2），记录警告但不自动修复（避免循环）
      if (checkVideo.srcObject instanceof MediaStream && (vw === 0 || vw <= 2 || vh <= 2) && state >= 1) {
        console.error('[LiveVideoPanel] ⚠️ 视频尺寸异常小 - 这是一个问题，不应该自动修复', {
          videoWidth: vw,
          videoHeight: vh,
          readyState: state,
          paused: checkVideo.paused,
          srcObject: !!checkVideo.srcObject,
          offsetWidth: checkVideo.offsetWidth,
          offsetHeight: checkVideo.offsetHeight,
          computedDisplay: window.getComputedStyle(checkVideo).display,
          computedVisibility: window.getComputedStyle(checkVideo).visibility,
          parentDisplay: window.getComputedStyle(checkVideo.parentElement || checkVideo).display
        });
        console.error('[LiveVideoPanel] 请在浏览器控制台手动检查 video 元素状态');
      }
    }, 100);

    // 2 秒后停止监控
    const timeout = setTimeout(() => {
      clearInterval(monitorInterval);
      console.log('[LiveVideoPanel] 定时监控结束');
    }, 2000);

    return () => {
      clearInterval(monitorInterval);
      clearTimeout(timeout);
    };
  }, [title, isActive, showSkeleton]); // 每当这些 prop 变化时检查状态

  // 绘制骨架
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video || !keypoints || !showSkeleton) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 确保 canvas 尺寸正确
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    const width = canvas.width;
    const height = canvas.height;

    // 清除画布
    ctx.clearRect(0, 0, width, height);

    // 设置样式
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

  return (
    <div className={`relative bg-slate-900 rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className={`absolute top-0 left-0 right-0 z-10 px-4 py-3 flex items-center justify-between ${
        isActive ? 'bg-gradient-to-b from-black/60 to-transparent' : ''
      }`}>
        <div className="flex items-center gap-2" onDoubleClick={handleTitleDoubleClick} title="双击查看调试信息">
          {isActive && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
          <span className="text-white font-medium text-sm cursor-help">{title}</span>
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
      <div className="relative aspect-video">
        <video
          ref={videoRef}
          autoPlay={!!stream} // 只有 stream 时才自动播放，videoSrc 不自动播放
          playsInline
          muted={muted}
          loop={loop}
          onTimeUpdate={onTimeUpdate}
          className="w-full h-full object-cover"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />

        {/* 没有视频流时的占位 */}
        {!stream && !videoSrc && !currentStreamRef.current && !(videoRef.current?.srcObject) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">等待视频信号...</p>
          </div>
        )}

        {/* 调试显示占位条件 */}
        {false && ( // 设置为 true 启用调试
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs p-2 rounded">
            <div>stream: {!!stream}</div>
            <div>videoSrc: {!!videoSrc}</div>
            <div>currentStreamRef: {!!currentStreamRef.current}</div>
            <div>videoRef?.srcObject: {!!(videoRef.current?.srcObject)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveVideoPanel;
