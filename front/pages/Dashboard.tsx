
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App';
import api from '../api';
import { Action, VideoRecord, ScoreHistoryItem } from '../types';
import { 
  Play, 
  Library, 
  History, 
  TrendingUp, 
  ArrowRight,
  Plus,
  Video
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Dashboard: React.FC = () => {
  const { auth } = useAuth();
  const [recentActions, setRecentActions] = useState<Action[]>([]);
  const [stats, setStats] = useState({ videos: 0, actions: 0, scores: 0 });
  const [history, setHistory] = useState<ScoreHistoryItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [actionsRes, myVideosRes] = await Promise.all([
          api.get('/actions/?limit=3'),
          api.get('/videos/me?limit=100'),
        ]);
        setRecentActions(actionsRes.data);
        
        // 评分历史需要登录，单独请求并容错
        try {
          const historyRes = await api.get('/scores/history?limit=10');
          setHistory(historyRes.data);
          setStats({
            videos: myVideosRes.data.length,
            actions: actionsRes.data.length,
            scores: historyRes.data.length
          });
        } catch {
          setStats({
            videos: myVideosRes.data.length,
            actions: actionsRes.data.length,
            scores: 0
          });
        }
      } catch (err) {
        console.error("Dashboard data load failed", err);
      }
    };
    fetchData();
  }, []);

  const chartData = history.map(h => ({
    name: new Date(h.created_at).toLocaleDateString(),
    score: h.total_score
  })).reverse();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">你好, {auth.user?.username}! 👋</h1>
          <p className="text-slate-500">准备好今天的体育课程了吗？</p>
        </div>
        <div className="flex gap-3">
          <Link to="/videos/upload" className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
            <Plus className="w-5 h-5" />
            上传视频
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard icon={<Video className="text-blue-600" />} label="我的视频" value={stats.videos} bgColor="bg-blue-50" />
        <StatCard icon={<Library className="text-indigo-600" />} label="动作库" value={stats.actions} bgColor="bg-indigo-50" />
        <StatCard icon={<TrendingUp className="text-emerald-600" />} label="评分记录" value={stats.scores} bgColor="bg-emerald-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">进度追踪</h2>
            <Link to="/scores/history" className="text-sm font-semibold text-indigo-600 hover:underline">查看全部</Link>
          </div>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} 
                  />
                  <Area type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <p>暂无评分数据，请开始一次评分</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Actions */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">推荐动作</h2>
            <Link to="/actions" className="text-sm font-semibold text-indigo-600 hover:underline">浏览库</Link>
          </div>
          <div className="space-y-4">
            {recentActions.map((action) => (
              <Link 
                key={action.id} 
                to={`/actions/${action.id}`}
                className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold group-hover:scale-110 transition-transform">
                  {action.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{action.name}</h3>
                  <p className="text-xs text-slate-500 truncate">{action.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, bgColor }: { icon: React.ReactNode, label: string, value: number, bgColor: string }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
    <div className={`p-4 rounded-2xl ${bgColor}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

export default Dashboard;
