import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RefreshCw, AlertCircle, Video } from 'lucide-react';
import { CameraDevice } from '../types';

interface CameraSelectorProps {
  onDeviceChange: (deviceId: string | null) => void;
  selectedDeviceId: string | null;
  onStreamReady?: (stream: MediaStream | null) => void;
}

const CameraSelector: React.FC<CameraSelectorProps> = ({
  onDeviceChange,
  selectedDeviceId,
  onStreamReady
}) => {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const currentStreamRef = useRef<MediaStream | null>(null);

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
    // 停止当前流
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach(track => track.stop());
      currentStreamRef.current = null;
    }

    onDeviceChange(deviceId);
  };

  // 停止视频流（用于组件卸载或设备切换）
  const stopStream = useCallback(() => {
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach(track => track.stop());
      currentStreamRef.current = null;
      onStreamReady?.(null);
    }
  }, [onStreamReady]);

  // 启动视频流
  const startStream = useCallback(async (deviceId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });

      currentStreamRef.current = stream;
      setPermissionGranted(true);
      onStreamReady?.(stream);
      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('摄像头权限被拒绝');
      } else if (err.name === 'NotFoundError') {
        setError('选中的摄像头不可用');
      } else {
        setError('无法启动摄像头: ' + (err.message || '未知错误'));
      }
      onStreamReady?.(null);
      return null;
    }
  }, [onStreamReady]);

  // 清理
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Camera size={18} className="text-indigo-600" />
          摄像头选择
        </h3>
        <button
          onClick={enumerateDevices}
          disabled={loading}
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

      {permissionGranted && devices.length > 0 && (
        <p className="mt-4 text-xs text-green-600 flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          摄像头已就绪
        </p>
      )}
    </div>
  );
};

export default CameraSelector;
