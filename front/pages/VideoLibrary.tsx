
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getVideoUrl } from '../api';
import { VideoRecord } from '../types';
import { Play, Calendar, Video, Clock, Trash2, Upload, Target } from 'lucide-react';

const VideoLibrary: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'me' | 'all'>('me');
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'me' ? '/videos/me' : '/videos/';
      const res = await api.get(endpoint);
      setVideos(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [activeTab]);

  const handleDelete = async (id: number) => {
    if (window.confirm('确定要删除这段视频吗？')) {
      // In a real app, send DELETE request. Mocking success for now.
      setVideos(videos.filter(v => v.id !== id));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">视频库</h1>
          <p className="text-slate-500">管理您的练习视频，回看每一个进步瞬间</p>
        </div>
        <Link to="/videos/upload" className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
          <Upload className="w-5 h-5" />
          上传练习视频
        </Link>
      </div>

      <div className="flex p-1 bg-slate-200/50 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('me')}
          className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'me' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          我的视频
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-all ${
            activeTab === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          公共视频
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-64 bg-white rounded-3xl animate-pulse"></div>
          ))}
        </div>
      ) : videos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all overflow-hidden group">
              <div className="h-48 bg-slate-900 relative flex items-center justify-center">
                 <video src={getVideoUrl(video.file_path)} className="w-full h-full object-cover" muted preload="metadata" />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                 <Play className="w-12 h-12 text-white opacity-80 group-hover:scale-125 transition-transform absolute" />
                 <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center text-white text-xs">
                    {video.fps && video.total_frames ? (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {Math.round(video.total_frames / video.fps)}s</span>
                    ) : (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> --</span>
                    )}
                    <span className="bg-white/20 px-2 py-1 rounded backdrop-blur-md">{video.fps || '--'} FPS</span>
                 </div>
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 truncate">练习视频 #{video.id}</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    {new Date(video.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Video className="w-3.5 h-3.5 text-indigo-500" />
                    {video.total_frames ?? '--'} 帧
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link to={`/scores?video_id=${video.id}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100">
                    <Target className="w-4 h-4" />
                    开始评分
                  </Link>
                  <button onClick={() => handleDelete(video.id)} className="p-2.5 bg-slate-50 text-red-600 rounded-xl hover:bg-red-50 transition-all border border-slate-100">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <Video className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900">暂无视频记录</h3>
          <p className="text-slate-500 mt-2">上传你的第一个练习视频，开启 AI 智能评测</p>
        </div>
      )}
    </div>
  );
};

export default VideoLibrary;
