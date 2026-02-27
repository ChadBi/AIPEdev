import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RefreshCw, AlertCircle, Video } from 'lucide-react';
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
  const [permissionGranted, setPermissionGranted] = useState(false);
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Camera size={18} className="text-indigo-600" />
          摄像头选择
        </h3>
        <button
          onClick={enumerateDevices}
          disabled={loading || disabled}
          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          title="刷新设备列表"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {devices.length === 0 && !loading && !error && (
        <div className="text-center py-6 text-slate-500">
          <Video size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm">未检测到摄像头</p>
          <button
            onClick={enumerateDevices}
            className="mt-2 text-indigo-600 text-sm font-medium hover:underline"
          >
            重新检测
          </button>
        </div>
      )}

      {devices.length > 0 && (
        <div className="space-y-2">
          {devices.map((device) => (
            <button
              key={device.deviceId}
              onClick={() => handleDeviceChange(device.deviceId)}
              disabled={disabled}
              className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                selectedDeviceId === device.deviceId
                  ? 'bg-indigo-50 border-2 border-indigo-500'
                  : 'bg-slate-50 border-2 border-transparent hover:border-indigo-200'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selectedDeviceId === device.deviceId
                  ? 'bg-indigo-100'
                  : 'bg-slate-200'
              }`}>
                <Video size={18} className={selectedDeviceId === device.deviceId ? 'text-indigo-600' : 'text-slate-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${
                  selectedDeviceId === device.deviceId ? 'text-indigo-900' : 'text-slate-700'
                }`}>
                  {device.label}
                </p>
                <p className="text-xs text-slate-500">{device.deviceId.slice(0, 12)}...</p>
              </div>
              {selectedDeviceId === device.deviceId && (
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              )}
            </button>
          ))}
        </div>
      )}

      {permissionGranted && devices.length > 0 && selectedDeviceId && (
        <p className="mt-4 text-xs text-green-600 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          摄像头流已启动
        </p>
      )}
    </div>
  );
};

export default CameraSelector;
