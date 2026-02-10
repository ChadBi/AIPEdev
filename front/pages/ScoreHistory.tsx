
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { ScoreHistoryItem } from '../types';
import { History, Calendar, Target, ChevronRight, Filter, Search } from 'lucide-react';

const ScoreHistory: React.FC = () => {
  const [history, setHistory] = useState<ScoreHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/scores/history');
        setHistory(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredHistory = history.filter(h => 
    h.action_name.toLowerCase().includes(filter.toLowerCase())
  );

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (score >= 75) return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    if (score >= 60) return 'bg-amber-50 text-amber-600 border-amber-100';
    return 'bg-red-50 text-red-600 border-red-100';
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">评分历史</h1>
        <p className="text-slate-500">追踪你的每一个动作演进过程</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="按动作名称搜索..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
        <button className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all">
          <Filter className="w-5 h-5" />
          筛选日期
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">练习动作</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">评分得分</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">评估日期</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">关联动作</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i}>
                    <td colSpan={5} className="px-6 py-4"><div className="h-10 bg-slate-50 animate-pulse rounded-lg"></div></td>
                  </tr>
                ))
              ) : filteredHistory.length > 0 ? (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                             <Target className="w-5 h-5" />
                          </div>
                          <span className="font-bold text-slate-900">{item.action_name}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-4 py-1 rounded-lg text-sm font-black border ${getScoreBg(item.total_score)}`}>
                         {item.total_score.toFixed(1)}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-sm">
                       <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {new Date(item.created_at).toLocaleString()}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-slate-400 text-xs font-mono">ACT_{item.action_id}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <Link 
                         to={`/scores/result/${item.id}`} 
                         className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                       >
                          查看详情
                          <ChevronRight className="w-3.5 h-3.5" />
                       </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                     <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                     <p className="text-slate-500">暂无评分历史记录</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ScoreHistory;
