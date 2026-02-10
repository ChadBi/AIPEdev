
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { Action } from '../types';
import { ArrowLeft, Save, AlertCircle, Info, Code, Upload, Play } from 'lucide-react';

const ActionForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [createMode, setCreateMode] = useState<'json' | 'video'>('json'); // 创建模式
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // JSON 模式
  const [keypointsJson, setKeypointsJson] = useState('{\n  "joints": ["elbow", "knee"],\n  "angles": [90, 45]\n}');
  
  // 视频模式
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      const fetchAction = async () => {
        try {
          const res = await api.get(`/actions/${id}`);
          const action = res.data as Action;
          setName(action.name);
          setDescription(action.description);
          setKeypointsJson(JSON.stringify(action.keypoints, null, 2));
        } catch (err) {
          setError('获取动作详情失败');
        }
      };
      fetchAction();
    }
  }, [id, isEdit]);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('video/')) {
      setError('请选择视频文件');
      return;
    }
    
    setVideoFile(file);
    const fileReader = new FileReader();
    fileReader.onload = (event) => {
      setVideoPreview(event.target?.result as string);
    };
    fileReader.readAsDataURL(file);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!name.trim()) {
      setError('动作名称不能为空');
      return;
    }
    
    if (!description.trim()) {
      setError('动作描述不能为空');
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        // 编辑模式只支持 JSON
        let keypoints;
        try {
          keypoints = JSON.parse(keypointsJson);
        } catch (err) {
          setError('关键点 JSON 格式不正确');
          setLoading(false);
          return;
        }
        await api.put(`/actions/${id}`, { description, keypoints });
      } else {
        // 新建模式
        if (createMode === 'video') {
          // 视频模式：上传视频并自动识别
          if (!videoFile) {
            setError('请选择标准视频');
            setLoading(false);
            return;
          }
          
          const formData = new FormData();
          formData.append('name', name);
          formData.append('description', description);
          formData.append('file', videoFile);
          
          await api.post('/actions/create-from-video', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } else {
          // JSON 模式：手动输入
          let keypoints;
          try {
            keypoints = JSON.parse(keypointsJson);
          } catch (err) {
            setError('关键点 JSON 格式不正确');
            setLoading(false);
            return;
          }
          await api.post('/actions/', { name, description, keypoints });
        }
      }
      navigate('/actions');
    } catch (err: any) {
      setError(err.response?.data?.detail || '保存失败，请检查输入');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link to="/actions" className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{isEdit ? '编辑动作' : '创建新动作'}</h1>
          <p className="text-slate-500">定义标准动作参数，用于 AI 评分基准</p>
        </div>
      </div>

      {!isEdit && (
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => {
              setCreateMode('video');
              setError('');
            }}
            className={`p-4 rounded-2xl border-2 transition-all text-center ${
              createMode === 'video'
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <Play className="w-6 h-6 mx-auto mb-2" style={{color: createMode === 'video' ? '#4f46e5' : '#94a3b8'}}/>
            <span className="font-bold text-slate-900">上传标准视频</span>
            <p className="text-xs text-slate-500 mt-1">自动识别姿态作为标准</p>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setCreateMode('json');
              setError('');
            }}
            className={`p-4 rounded-2xl border-2 transition-all text-center ${
              createMode === 'json'
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <Code className="w-6 h-6 mx-auto mb-2" style={{color: createMode === 'json' ? '#4f46e5' : '#94a3b8'}}/>
            <span className="font-bold text-slate-900">手动输入参数</span>
            <p className="text-xs text-slate-500 mt-1">直接编辑 JSON 定义</p>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">动作名称</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isEdit} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all disabled:opacity-50"
                  placeholder="如：标准深蹲、仰卧起坐"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">详细描述</label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                  placeholder="请描述该动作的标准执行流程和注意事项..."
                />
              </div>

              {createMode === 'video' && !isEdit && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-indigo-600" />
                    上传标准视频
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer relative">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoSelect}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {videoFile ? (
                      <div className="space-y-2">
                        <p className="font-semibold text-slate-900">✓ {videoFile.name}</p>
                        <p className="text-xs text-slate-500">{(videoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button
                          type="button"
                          onClick={() => setVideoFile(null)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          更换视频
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="font-semibold text-slate-700">拖拽视频上传或点击选择</p>
                        <p className="text-xs text-slate-500">支持 MP4、WebM、MOV 等格式</p>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">系统将自动识别视频中的身体姿态，作为该动作的标准定义</p>
                </div>
              )}

              {createMode === 'json' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-600" />
                    关键点编辑器 (JSON)
                  </label>
                  <textarea
                    required={!isEdit}
                    rows={10}
                    value={keypointsJson}
                    onChange={(e) => setKeypointsJson(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 text-emerald-400 font-mono text-sm border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
                  />
                  <p className="mt-2 text-xs text-slate-400">请输入合法的 JSON 格式，定义该动作需要监测的关键点及阈值。</p>
                </div>
              )}
           </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
           <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm sticky top-8">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-600" />
                保存提示
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-8">
                {createMode === 'video'
                  ? '上传标准视频后，系统将自动进行身体姿态识别，识别结果将作为该动作的标准定义。'
                  : '标准动作定义后，系统将使用该数据作为评分引擎的基础。请确保描述准确且关键点定义合理。'}
              </p>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div> : <Save className="w-5 h-5" />}
                  保存动作
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/actions')}
                  className="w-full py-4 bg-slate-50 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all border border-slate-100"
                >
                  取消
                </button>
              </div>
           </div>
        </div>
      </form>
    </div>
  );
};

export default ActionForm;
