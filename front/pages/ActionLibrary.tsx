
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getVideoUrl } from '../api';
import { Action, UserRole } from '../types';
import { useAuth } from '../App';
import { Search, Plus, Eye, Edit2, Trash2, Calendar, Target, Play } from 'lucide-react';

const ActionLibrary: React.FC = () => {
  const { auth } = useAuth();
  const [actions, setActions] = useState<Action[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchActions = async () => {
    try {
      const res = await api.get('/actions/');
      setActions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
  }, []);

  const handleDelete = async (id: number) => {
    if (window.confirm('确定要删除这个动作吗？')) {
      try {
        await api.delete(`/actions/${id}`);
        fetchActions();
      } catch (err) {
        alert('删除失败');
      }
    }
  };

  const filteredActions = actions.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    a.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">动作库</h1>
          <p className="text-slate-500">学习标准运动姿态，获取 AI 实时反馈</p>
        </div>
        {auth.isAuthenticated && (
          <Link to="/actions/create" className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
            <Plus className="w-5 h-5" />
            创建新动作
          </Link>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="搜索动作名称或描述..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-all"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-64 bg-white rounded-3xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredActions.map((action) => (
            <div key={action.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-lg transition-all overflow-hidden group">
              <div className="h-40 bg-slate-900 relative flex items-center justify-center">
                 {action.video_path ? (
                   <>
                     <video
                       src={getVideoUrl(action.video_path)}
                       className="w-full h-full object-cover"
                       muted
                       preload="metadata"
                     />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                     <Play className="w-10 h-10 text-white opacity-80 group-hover:scale-110 transition-transform absolute" />
                   </>
                 ) : (
                   <Target className="w-16 h-16 text-slate-200 absolute" />
                 )}
                 <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-full uppercase tracking-wider">AI Standard</span>
                 </div>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-2 truncate group-hover:text-indigo-600 transition-colors">{action.name}</h3>
                <p className="text-slate-500 text-sm line-clamp-2 mb-4 h-10">{action.description}</p>
                
                <div className="flex items-center gap-4 text-xs text-slate-400 mb-6">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(action.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link to={`/actions/${action.id}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-50 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition-all border border-slate-100">
                    <Eye className="w-4 h-4" />
                    查看详情
                  </Link>
                  {auth.isAuthenticated && (
                    <>
                      <Link to={`/actions/${action.id}/edit`} className="p-2.5 bg-slate-50 text-amber-600 rounded-xl hover:bg-amber-50 transition-all border border-slate-100">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button onClick={() => handleDelete(action.id)} className="p-2.5 bg-slate-50 text-red-600 rounded-xl hover:bg-red-50 transition-all border border-slate-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {!loading && filteredActions.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <Target className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900">未找到相关动作</h3>
          <p className="text-slate-500 mt-2">尝试更换关键词，或者联系老师创建新动作</p>
        </div>
      )}
    </div>
  );
};

export default ActionLibrary;
