import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RefreshCw, ChevronDown } from 'lucide-react';
import { CameraDevice } from '../types';

interface CameraSelectorProps {
  onDeviceChange: (deviceId: string | null) => void;
  selectedDeviceId: string | null;
  onStreamReady?: (stream: MediaStream | null) => void;
  disabled?: boolean;
  preserveStreamOnUnmount?: boolean; // 布局切换时是否保持流
}

const CameraSelector: React.FC<CameraSelectorProps> = ({
  onDeviceChange,
  selectedDeviceId,
  onStreamReady,
  disabled = false,
  preserveStreamOnUnmount = false,
}) => {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [, setPermissionGranted] = useState(false);
  const currentStreamRef = useRef<MediaStream | null>(null);
  const lastStartedDeviceIdRef = useRef<string | null>(null);
  const onStreamReadyRef = useRef(onStreamReady);

  useEffect(() => {
    onStreamReadyRef.current = onStreamReady;
  }, [onStreamReady]);

  // 枚举设备
  const enumerateDevices = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      // 先请求权限
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setPermissionGranted(true);

      // 停止测试流
      stream.getTracks().forEach(track => track.stop());

      // 枚举设备
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `摄像头 ${device.deviceId.slice(0, 8)}`,
          kind: device.kind as 'videoinput'
        }));

      setDevices(videoDevices);

      // 如果有设备但没有选中的，自动选择第一个
      if (videoDevices.length > 0 && !selectedDeviceId) {
        onDeviceChange(videoDevices[0].deviceId);
      }

      if (videoDevices.length === 0) {
        setError('未检测到摄像头设备');
      }
    } catch (err: any) {
      setPermissionGranted(false);
      if (err.name === 'NotAllowedError') {
        setError('请允许浏览器访问摄像头权限');
      } else if (err.name === 'NotFoundError') {
        setError('未找到摄像头设备');
      } else {
        setError('无法访问摄像头: ' + (err.message || '未知错误'));
      }
    } finally {
      setLoading(false);
    }
  }, [onDeviceChange, selectedDeviceId]);

  // 初始化时枚举设备
  useEffect(() => {
    enumerateDevices();
  }, []);

  // 处理设备选择
  const handleDeviceChange = (deviceId: string) => {
    if (disabled) return;
    // 如果选中的设备没有变化，不做任何事情
    if (selectedDeviceId === deviceId) return;
    onDeviceChange(deviceId);
  };

  // 停止视频流（用于组件卸载或设备切换）
  const stopStream = useCallback((skipStreamStop: boolean = false) => {
    if (currentStreamRef.current) {
      // 如果 skipStreamStop 为 true，不停止轨道（用于布局切换时保持流）
      if (!skipStreamStop) {
        currentStreamRef.current.getTracks().forEach(track => track.stop());
      }
      currentStreamRef.current = null;
      lastStartedDeviceIdRef.current = null;
      onStreamReadyRef.current?.(null);
    }
  }, []);

  // 启动视频流
  const startStream = useCallback(async (deviceId: string) => {
    if (
      lastStartedDeviceIdRef.current === deviceId &&
      currentStreamRef.current &&
      currentStreamRef.current.getVideoTracks().some(track => track.readyState === 'live')
    ) {
      // 流已经在运行，直接返回
      return currentStreamRef.current;
    }

    // 如果需要保持流且流存在，不要停止它
    if (preserveStreamOnUnmount && currentStreamRef.current) {
      setError('');
      setPermissionGranted(true);
      onStreamReadyRef.current?.(currentStreamRef.current);
      return currentStreamRef.current;
    }

    stopStream(false);
    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      currentStreamRef.current = stream;
      lastStartedDeviceIdRef.current = deviceId;
      setPermissionGranted(true);
      onStreamReadyRef.current?.(stream);
      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('摄像头权限被拒绝');
      } else if (err.name === 'NotFoundError') {
        setError('选中的摄像头不可用');
      } else if (err.name === 'OverconstrainedError') {
        setError('当前设备分辨率约束不支持，建议切换摄像头重试');
      } else {
        setError('无法启动摄像头: ' + (err.message || '未知错误'));
      }
      lastStartedDeviceIdRef.current = null;
      onStreamReadyRef.current?.(null);
      return null;
    }
  }, [stopStream, preserveStreamOnUnmount]);

  // 当选中设备变化时，自动启动新流
  useEffect(() => {
    if (!selectedDeviceId) return;
    startStream(selectedDeviceId);
  }, [selectedDeviceId, startStream]);

  // 清理
  useEffect(() => {
    return () => {
      stopStream(preserveStreamOnUnmount);
    };
  }, [stopStream, preserveStreamOnUnmount]);

  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-300 z-10">
        <Camera size={16} />
      </div>
      <select
        value={selectedDeviceId || ''}
        onChange={(e) => handleDeviceChange(e.target.value)}
        disabled={disabled || loading || devices.length === 0}
        className="appearance-none bg-slate-700/85 border border-slate-500/70 text-slate-100 text-sm font-medium rounded-xl pl-9 pr-16 py-2.5 backdrop-blur-sm shadow-inner shadow-black/20 hover:border-indigo-400/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/80 focus:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed w-64 truncate transition-all"
      >
        {devices.length === 0 ? (
          <option value="">{loading ? '加载中...' : '未检测到摄像头'}</option>
        ) : (
          devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))
        )}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
        <ChevronDown size={16} />
      </div>
      
      <button
        onClick={enumerateDevices}
        disabled={loading || disabled}
        className="absolute right-8 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-600/60 rounded-lg transition-colors"
        title="刷新设备列表"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      </button>
    </div>
  );
};

export default CameraSelector;
