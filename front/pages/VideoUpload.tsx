
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Upload, X, FileVideo, AlertCircle, CheckCircle2 } from 'lucide-react';

const VideoUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 100 * 1024 * 1024) {
        setError('文件大小不能超过 100MB');
        return;
      }
      setFile(selected);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/videos/upload', formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setProgress(percentCompleted);
        },
      });
      setSuccess(true);
      setTimeout(() => navigate('/videos'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || '上传失败，请稍后重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">上传视频</h1>
        <p className="text-slate-500">上传练习视频，AI 将为你分析动作细节</p>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8">
        {!file ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="video/*" 
              className="hidden" 
            />
            <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Upload className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">点击或拖拽上传视频</h3>
            <p className="text-slate-500 text-sm">支持 MP4, MOV, AVI 等常见格式 (最大 100MB)</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100 relative">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <FileVideo className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
              {!uploading && (
                <button onClick={() => setFile(null)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-600 text-sm">
                <CheckCircle2 className="w-5 h-5" />
                上传成功！正在跳转...
              </div>
            )}

            {uploading ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-600">正在上传...</span>
                  <span className="text-indigo-600">{progress}%</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleUpload}
                disabled={success}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                开始上传
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
          <h4 className="font-bold text-amber-900 mb-2">拍摄建议</h4>
          <ul className="text-sm text-amber-800 space-y-2 list-disc pl-4">
            <li>保持光线充足，避免逆光拍摄</li>
            <li>背景整洁，尽量减少干扰物</li>
            <li>手机固定在支架上，避免晃动</li>
          </ul>
        </div>
        <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
          <h4 className="font-bold text-blue-900 mb-2">动作要领</h4>
          <ul className="text-sm text-blue-800 space-y-2 list-disc pl-4">
            <li>确保全身都在取景框内</li>
            <li>侧面拍摄对于关节角度识别更准确</li>
            <li>动作尽量舒展，不要过快</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VideoUpload;
