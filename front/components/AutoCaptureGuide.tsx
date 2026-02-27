import React, { useRef, useEffect, useState } from 'react';
import { User, Play, Pause, Mic, MicOff } from 'lucide-react';

interface AutoCaptureGuideProps {
  stream?: MediaStream | null;
  isActive: boolean;
  guidanceText: string;
  onAutoCapture?: (file: File, preview: string) => void; // 改为回调函数接收文件
  detectionStatus?: 'idle' | 'detecting' | 'detected' | 'captured';
  showHumanFigure?: boolean;
}

// 人形框路径 (SVG path)
const HUMAN_FIGURE_PATH = `
  M 50,15                    // 头部中心
  m -12,-12 a 12,12 0 1,0 24,0 a 12,12 0 1,0 -24,0  // 头部轮廓
  M 50,27                    // 颈部起点
  L 50,35                    // 颈部
  M 35,40 L 65,40            // 肩膀
  M 35,40 L 30,60            // 左上臂
  M 30,60 L 25,85            // 左前臂
  M 65,40 L 70,60            // 右上臂
  M 70,60 L 75,85            // 右前臂
  M 50,35 L 50,65            // 躯干上部
  M 50,65 L 50,85            // 躯干下部
  M 50,65                    // 臀部中心
  L 40,90                    // 左大腿
  L 38,95                    // 左小腿(膝盖)
  L 35,95                    // 左脚
  M 50,65                    // 右部中心
  L 60,90                    // 右大腿
  L 62,95                    // 右小腿(膝盖)
  L 65,95                    // 右脚
`;

const AutoCaptureGuide: React.FC<AutoCaptureGuideProps> = ({
  stream,
  isActive,
  guidanceText,
  onAutoCapture,
  detectionStatus = 'idle',
  showHumanFigure = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastGuidanceText, setLastGuidanceText] = useState('');
  const [videoError, setVideoError] = useState('');

  // 绑定视频流
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      console.log('📹 AutoCaptureGuide: video ref is null');
      return;
    }

    console.log('📹 AutoCaptureGuide: stream status:', stream ? '✓ 有视频流' : '✗ 无视频流');
    console.log('📹 AutoCaptureGuide: stream tracks:', stream?.getTracks().length || 0);

    if (stream) {
      video.srcObject = stream;

      // 处理视频加载和播放
      const handleLoadedMetadata = () => {
        console.log('📹 AutoCaptureGuide: 视频元数据已加载', {
          width: video.videoWidth,
          height: video.videoHeight
        });
      };

      const handleCanPlay = () => {
        console.log('📹 AutoCaptureGuide: 视频可以播放');
        video.play().catch(err => {
          console.error('📹 AutoCaptureGuide: 播放失败', err);
          setVideoError('视频播放失败: ' + err);
        });
      };

      const handleError = (e: Event) => {
        console.error('📹 AutoCaptureGuide: 视频错误', e);
        setVideoError('视频加载错误');
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('error', handleError);

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
      };
    } else {
      video.srcObject = null;
      console.log('📹 AutoCaptureGuide: video srcObject 已清空');
    }
  }, [stream]);

  // 语音播报
  useEffect(() => {
    if (!voiceEnabled || !guidanceText) return;

    // 避免重复播报相同内容
    if (guidanceText === lastGuidanceText) return;
    setLastGuidanceText(guidanceText);

    const utterance = new SpeechSynthesisUtterance(guidanceText);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    synthesisRef.current = utterance;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // 停止之前的语音
      window.speechSynthesis.speak(utterance);
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [guidanceText, voiceEnabled, lastGuidanceText]);

  // 绘制引导框和人形
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');

    // 设置画布尺寸
    const updateCanvasSize = () => {
      if (video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    };

    updateCanvasSize();
    video.addEventListener('loadedmetadata', updateCanvasSize);

    const drawFrame = () => {
      if (!canvas || !ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // 清除画布
      ctx.clearRect(0, 0, width, height);

      // 根据检测状态绘制不同的引导
      if (isActive && showHumanFigure) {
        drawHumanFigure(ctx, width, height);
      }

      // 绘制检测状态指示
      drawDetectionStatus(ctx, width, height, detectionStatus);

      requestAnimationFrame(drawFrame);
    };

    drawFrame();

    return () => {
      video.removeEventListener('loadedmetadata', updateCanvasSize);
    };
  }, [isActive, showHumanFigure, detectionStatus]);

  // 绘制人形框
  const drawHumanFigure = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = height / 120; // 缩放因子

    ctx.save();
    ctx.translate(centerX - 50 * scale, centerY - 50 * scale);
    ctx.scale(scale, scale);

    // 绘制人形框轮廓
    ctx.strokeStyle = detectionStatus === 'detected' ? 'rgba(34, 197, 94, 0.8)' : 'rgba(99, 102, 241, 0.6)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);

    // 简化的人形轮廓 (用线条代替复杂的SVG path) - 所有点都必须是[x,y]格式
    const humanPoints = [
      // 头部轮廓
      [50, 12], [62, 12], [62, 26], [50, 26], [38, 26], [38, 26], [65, 26], [50, 12],
      // 颈部和肩膀
      [50, 27], [50, 35], [35, 40], [65, 40],
      // 左臂
      [35, 40], [30, 60], [25, 85],
      // 右臂
      [65, 40], [70, 60], [75, 85],
      // 躯干
      [50, 35], [50, 65], [50, 85],
      // 左腿
      [50, 65], [40, 90], [38, 95], [35, 95],
      // 右腿
      [50, 65], [60, 90], [62, 95], [65, 95]
    ];

    ctx.beginPath();
    ctx.moveTo(humanPoints[0][0], humanPoints[0][1]);
    for (let i = 1; i < humanPoints.length; i++) {
      const [x, y] = humanPoints[i];
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 绘制关节标记
    ctx.fillStyle = detectionStatus === 'detected' ? 'rgba(34, 197, 94, 0.8)' : 'rgba(99, 102, 241, 0.8)';
    const jointPoints = [
      [50, 19], // 头部中心
      [50, 31], // 颈部
      [35, 40], [65, 40], // 肩膀
      [30, 60], [70, 60], // 肘部
      [25, 85], [75, 85], // 手腕
      [50, 65], // 躯干中心
      [40, 90], [60, 90], // 臀部
      [38, 95], [62, 95], // 膝盖
      [35, 95], [65, 95] // 脚踝
    ];

    jointPoints.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // 绘制引导文字
    ctx.fillStyle = 'white';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';

    const statusText = detectionStatus === 'detected' ? '✓ 人体完整' : '请站在框内';
    ctx.fillText(statusText, 50, height - 15);

    ctx.restore();
  };

  // 绘制检测状态
  const drawDetectionStatus = (ctx: CanvasRenderingContext2D, width: number, height: number, status: string) => {
    if (status === 'detecting') {
      // 绘制扫描动画
      const scanLineY = (Date.now() % 2000) / 2000 * height;
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, scanLineY);
      ctx.lineTo(width, scanLineY);
      ctx.stroke();
    } else if (status === 'captured') {
      // 绘制拍照闪光效果
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, 0, width, height);
    }
  };

  // 切换语音
  const toggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  // 从视频中捕获照片
  const captureFromVideo = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    // 确保canvas尺寸与video一致
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 临时保存当前画面（因为canvas可能正在绘制人形框）
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;

    // 绘制当前视频帧到临时canvas
    tempCtx.drawImage(video, 0, 0);

    // 转换为图片数据URL
    const previewUrl = tempCanvas.toDataURL('image/jpeg', 0.95);

    // 转换为File对象
    return new Promise<File | null>((resolve) => {
      tempCanvas.toBlob((blob) => {
        if (blob && onAutoCapture) {
          const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          resolve(file);
        } else {
          resolve(null);
        }
      }, 'image/jpeg', 0.95);
    });
  };

  // 触发闪光效果
  const triggerFlash = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setTimeout(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }, 100);
    }
  };

  // 手动触发拍照
  const handleManualCapture = async () => {
    if (!stream) return;

    // 触发闪光效果
    triggerFlash();

    // 播放拍照音效 - 可以添加拍照声音
    if (voiceEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // 捕获照片
    const file = await captureFromVideo();
    if (file && onAutoCapture) {
      onAutoCapture(file, `data:image/jpeg;base64,${file.name}`);
    }
  };

  // 自动拍照
  const handleAutoCapture = async () => {
    if (!stream) return;

    // 触发闪光效果
    triggerFlash();

    // 播放拍照音效
    if (voiceEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // 捕获照片
    const file = await captureFromVideo();
    if (file && onAutoCapture) {
      const previewUrl = URL.createObjectURL(file);
      onAutoCapture(file, previewUrl);
    }
  };

  // 监听检测状态，自动触发拍照
  useEffect(() => {
    let captureTimeout: NodeJS.Timeout | null = null;

    if (detectionStatus === 'detected' && onAutoCapture) {
      // 延迟3秒后自动拍照
      captureTimeout = setTimeout(() => {
        handleAutoCapture();
      }, 3000);
    }

    return () => {
      if (captureTimeout) {
        clearTimeout(captureTimeout);
      }
    };
  }, [detectionStatus, onAutoCapture]);

  return (
    <div className="relative bg-slate-900 rounded-2xl overflow-hidden">
      {/* 视频和画布层 */}
      <div className="relative aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ backgroundColor: stream ? 'transparent' : '#1e293b' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />

        {/* 无视频流时的提示 */}
        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            <div className="text-center">
              <Camera className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">正在启动摄像头...</p>
            </div>
          </div>
        )}

        {/* 视频错误提示 */}
        {videoError && (
          <div className="absolute top-4 left-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg">
            <p className="font-semibold">摄像头错误</p>
            <p className="text-sm">{videoError}</p>
          </div>
        )}
      </div>

      {/* 引导文字层 */}
      {isActive && stream && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 via-black/30 to-transparent px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                detectionStatus === 'detected' ? 'bg-green-500 animate-pulse' :
                detectionStatus === 'detecting' ? 'bg-blue-500 animate-pulse' :
                'bg-indigo-600'
              }`}>
                {detectionStatus === 'detected' ? (
                  <User className="w-5 h-5 text-white" />
                ) : detectionStatus === 'detecting' ? (
                  <User className="w-5 h-5 text-white animate-bounce" />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <p className="text-white font-semibold text-lg">{guidanceText}</p>
                <p className="text-white/70 text-sm">
                  {detectionStatus === 'idle' && '请站在人形框内'}
                  {detectionStatus === 'detecting' && '正在检测...'}
                  {detectionStatus === 'detected' && '检测完成，自动拍照中...'}
                  {detectionStatus === 'captured' && '拍照完成！'}
                </p>
              </div>
            </div>

            {/* 语音控制按钮 */}
            <button
              onClick={toggleVoice}
              className={`p-3 rounded-full transition-colors ${
                voiceEnabled ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-700 hover:bg-slate-600'
              }`}
              title={voiceEnabled ? '关闭语音' : '开启语音'}
            >
              {voiceEnabled ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white/60" />}
            </button>
          </div>
        </div>
      )}

      {/* 检测状态指示器 */}
      {isActive && stream && detectionStatus !== 'idle' && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                detectionStatus === 'detected' ? 'bg-green-500' :
                detectionStatus === 'detecting' ? 'bg-blue-500 animate-pulse' :
                'bg-yellow-500'
              }`} />
              <span className="text-white text-sm">
                {detectionStatus === 'detecting' && '检测人体中...'}
                {detectionStatus === 'detected' && '人体完整'}
                {detectionStatus === 'captured' && '拍照完成'}
              </span>
            </div>

            {/* 手动拍照按钮 */}
            <button
              onClick={handleManualCapture}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              手动拍照
            </button>
          </div>
        </div>
      )}

      {/* 摄像头状态指示器 */}
      {isActive && !stream && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-white text-sm">正在启动摄像头...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoCaptureGuide;
