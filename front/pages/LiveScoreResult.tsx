import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import api from '../api';
import { LiveResultData } from '../types';
import { ArrowLeft, Repeat, Activity, Zap, Clock, Music2, Award, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const LiveScoreResult: React.FC = () => {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const scoreId = id ? parseInt(id, 10) : null;
  const [resultData, setResultData] = useState<LiveResultData | null>((location.state?.resultData || null) as LiveResultData | null);
  const [loading, setLoading] = useState<boolean>(!location.state?.resultData && !!scoreId);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (resultData || !scoreId) {
      setLoading(false);
      return;
    }

    const fetchLiveScore = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/scores/live/${scoreId}`);
        const data = res.data;
        const parsed: LiveResultData = {
          score_id: data.score_id,
          action_id: data.action_id,
          action_name: data.action_name,
          music_id: data.music_id,
          music_name: data.music_name,
          started_at: data.started_at,
          ended_at: data.ended_at,
          duration_seconds: Number(data.duration_seconds || 0),
          total_score: Number(data.total_score || 0),
          current_score: Number(data.current_score || 0),
          average_score: Number(data.average_score || 0),
          frames_processed: Number(data.frames_processed || 0),
          display_fps: Number(data.display_fps || 0),
          latency_ms: Number(data.latency_ms || 0),
          frame_scores: Array.isArray(data.frame_scores)
            ? data.frame_scores.map((item: any) => ({
                timestamp: Number(item.timestamp || 0),
                score: Number(item.score || 0),
              }))
            : [],
        };
        setResultData(parsed);
        setError('');
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : '加载实时检测结果失败');
      } finally {
        setLoading(false);
      }
    };

    fetchLiveScore();
  }, [resultData, scoreId]);

  const getGrade = (score: number) => {
    if (score >= 90) return { label: '优秀', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (score >= 75) return { label: '良好', color: 'text-indigo-600', bg: 'bg-indigo-50' };
    if (score >= 60) return { label: '及格', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { label: '需改进', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500">加载实时评分详情中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <AlertCircle className="w-16 h-16 text-red-300 mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-red-600">加载失败</h2>
        <p className="text-slate-600 mb-6">{error}</p>
        <div className="flex gap-3">
          <Link to="/scores/history" className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">返回历史</Link>
          <Link to="/scores/live" className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300">返回实时检测</Link>
        </div>
      </div>
    );
  }

  if (!resultData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <AlertCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-slate-900">未找到实时检测结果</h2>
        <p className="text-slate-500 mb-6">请从实时检测页面开始并结束一次检测后查看结果</p>
        <div className="flex gap-3">
          <Link to="/scores/live" className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">返回实时检测</Link>
          <Link to="/scores" className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300">去普通评分</Link>
        </div>
      </div>
    );
  }

  const grade = getGrade(resultData.total_score);
  const chartData = resultData.frame_scores.map((item, index) => ({
    index: index + 1,
    timestamp: item.timestamp,
    score: Number(item.score.toFixed(1)),
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <Link to="/scores/live" className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-all group">
          <ArrowLeft className="w-5 h-5" />
          返回实时检测
        </Link>
        <Link to={`/scores/live?action_id=${resultData.action_id}${resultData.music_id ? `&music_id=${resultData.music_id}` : ''}`} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-semibold shadow-lg">
          <Repeat className="w-4 h-4" /> 再测一次
        </Link>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div>
            <div className="text-sm text-slate-500 mb-2">实时检测总评</div>
            <div className="text-6xl font-black text-slate-900 tabular-nums">{resultData.total_score.toFixed(1)}</div>
            <div className={`inline-flex mt-4 px-4 py-2 rounded-xl font-bold ${grade.bg} ${grade.color}`}>{grade.label}</div>
          </div>
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="text-slate-500 text-sm mb-1 flex items-center gap-1"><Activity className="w-4 h-4" /> 平均分</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{resultData.average_score.toFixed(1)}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="text-slate-500 text-sm mb-1 flex items-center gap-1"><Zap className="w-4 h-4" /> 峰值分</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{resultData.current_score.toFixed(1)}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="text-slate-500 text-sm mb-1 flex items-center gap-1"><Clock className="w-4 h-4" /> 检测时长</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{formatTime(resultData.duration_seconds)}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="text-slate-500 text-sm mb-1 flex items-center gap-1"><Award className="w-4 h-4" /> 处理帧</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{resultData.frames_processed}</div>
            </div>
          </div>
        </div>
        <div className="mt-6 text-sm text-slate-500 flex flex-wrap gap-x-6 gap-y-2">
          <span>动作：{resultData.action_name}</span>
          <span className="flex items-center gap-1"><Music2 className="w-4 h-4" /> 音乐：{resultData.music_name || '未选择'}</span>
          <span>显示 FPS：{resultData.display_fps}</span>
          <span>延迟：{resultData.latency_ms}ms</span>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-slate-500 font-bold text-sm uppercase tracking-widest mb-4">分数曲线</h3>
        {chartData.length > 1 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="timestamp" tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${value}s`} />
                <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`${value} 分`, '得分']} labelFormatter={(value) => `时间 ${value}s`} />
                <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-slate-400">本次有效帧较少，暂无可视化曲线</div>
        )}
      </div>
    </div>
  );
};

export default LiveScoreResult;
