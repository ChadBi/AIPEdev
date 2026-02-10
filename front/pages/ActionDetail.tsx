
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { Action } from '../types';
import { ArrowLeft, Target, Calendar, Info, PlayCircle, BarChart3 } from 'lucide-react';

const ActionDetail: React.FC = () => {
  const { id } = useParams();
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAction = async () => {
      try {
        const res = await api.get(`/actions/${id}`);
        setAction(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAction();
  }, [id]);

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-12 bg-slate-100 rounded-xl w-48"></div>
      <div className="h-96 bg-slate-100 rounded-3xl"></div>
    </div>;
  }

  if (!action) return <div>动作未找到</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
       <div className="flex items-center gap-4">
        <Link to="/actions" className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{action.name}</h1>
          <p className="text-slate-500">标准动作详情与参数基准</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
           <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                 <Info className="w-5 h-5 text-indigo-600" />
                 动作介绍
              </h3>
              <p className="text-slate-600 leading-relaxed text-lg mb-8">
                {action.description}
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                    <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                       <Target className="w-4 h-4 text-indigo-600" />
                       关键观测点
                    </h4>
                    <ul className="text-sm text-slate-500 space-y-1 list-disc pl-4">
                       <li>肩部水平度</li>
                       <li>膝盖弯曲角度</li>
                       <li>动作节奏连贯性</li>
                    </ul>
                 </div>
                 <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                    <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                       <Calendar className="w-4 h-4 text-indigo-600" />
                       创建于
                    </h4>
                    <p className="text-sm text-slate-500">{new Date(action.created_at).toLocaleString()}</p>
                 </div>
              </div>
           </div>

           <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                 <BarChart3 className="w-5 h-5 text-indigo-600" />
                 AI 判定逻辑 (JSON)
              </h3>
              <pre className="p-6 bg-slate-900 text-emerald-400 font-mono text-sm rounded-2xl overflow-x-auto">
                {JSON.stringify(action.keypoints, null, 2)}
              </pre>
           </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
           <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm text-center">
              <div className="w-full aspect-square bg-slate-100 rounded-2xl mb-6 flex items-center justify-center relative overflow-hidden group">
                 <Target className="w-24 h-24 text-slate-200" />
                 <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/40 transition-all flex items-center justify-center">
                    <PlayCircle className="w-16 h-16 text-white opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all" />
                 </div>
                 <p className="absolute bottom-4 text-xs font-bold text-slate-400">标准动作示意图</p>
              </div>
              <Link to="/scores" className="block w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                立刻开始练习
              </Link>
              <p className="text-xs text-slate-400 mt-4">已累计 1,240 次练习评价</p>
           </div>
           
           <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
              <h4 className="font-bold text-indigo-900 mb-3">AI 动作要领</h4>
              <p className="text-sm text-indigo-700 leading-relaxed">
                该动作由 AI 算法提供全自动评估。在练习时，请尽量侧对摄像机，确保所有 17 个关键点都在视野范围内。
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ActionDetail;
