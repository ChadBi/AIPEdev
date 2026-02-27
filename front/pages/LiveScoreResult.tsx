import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import api from '../api';
import { LiveResultData } from '../types';
import { ArrowLeft, Repeat, Activity, Zap, Clock, Music2, Award, AlertCircle, Gauge, TrendingUp, TrendingDown, BarChart3, Lightbulb } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

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
  const scoreValues = chartData.map(item => item.score);
  const peakScore = scoreValues.length > 0 ? Math.max(...scoreValues) : resultData.current_score;
  const minScore = scoreValues.length > 0 ? Math.min(...scoreValues) : resultData.current_score;
  const scoreRange = Number((peakScore - minScore).toFixed(1));

  const safeAverage = scoreValues.length > 0
    ? Number((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length).toFixed(1))
    : Number(resultData.average_score.toFixed(1));

  const variance = scoreValues.length > 0
    ? scoreValues.reduce((sum, value) => sum + Math.pow(value - safeAverage, 2), 0) / scoreValues.length
    : 0;
  const standardDeviation = Math.sqrt(variance);
  const stabilityScore = Math.max(0, Math.min(100, Number((100 - standardDeviation * 8).toFixed(1))));

  const thirdSize = Math.max(1, Math.floor(scoreValues.length / 3));
  const startScores = scoreValues.slice(0, thirdSize);
  const middleScores = scoreValues.slice(thirdSize, thirdSize * 2);
  const endScores = scoreValues.slice(thirdSize * 2);
  const getSectionAverage = (values: number[]) => values.length > 0
    ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
    : 0;

  const stageAverages = [
    { label: '起始', value: getSectionAverage(startScores), color: 'bg-sky-500' },
    { label: '中段', value: getSectionAverage(middleScores), color: 'bg-indigo-500' },
    { label: '后段', value: getSectionAverage(endScores), color: 'bg-violet-500' },
  ];

  const trendDelta = Number((stageAverages[2].value - stageAverages[0].value).toFixed(1));
  const trendLabel = trendDelta >= 3 ? '后程明显提升' : trendDelta >= 0 ? '后程小幅提升' : trendDelta > -3 ? '后程略有回落' : '后程明显回落';

  const highCount = scoreValues.filter(score => score >= 80).length;
  const mediumCount = scoreValues.filter(score => score >= 60 && score < 80).length;
  const lowCount = scoreValues.filter(score => score < 60).length;
  const totalCount = Math.max(1, scoreValues.length);
  const highRatio = Number(((highCount / totalCount) * 100).toFixed(1));
  const mediumRatio = Number(((mediumCount / totalCount) * 100).toFixed(1));
  const lowRatio = Number(((lowCount / totalCount) * 100).toFixed(1));

  const suggestions: Array<{ level: 'high' | 'medium' | 'low'; title: string; content: string }> = [];
  if (resultData.total_score < 60) {
    suggestions.push({
      level: 'high',
      title: '动作要更用力',
      content: '低分阶段先把发力做出来，动作不要软，关键动作要有明显力度。'
    });
    suggestions.push({
      level: 'high',
      title: '先稳住节拍',
      content: '先跟慢拍练，保证每拍都踩上，再逐步提到正常节奏。'
    });
    suggestions.push({
      level: 'high',
      title: '动作做到位',
      content: '每个动作都做到完整幅度，起始位和结束位要清楚，不要只做一半。'
    });
  } else if (resultData.total_score < 80) {
    suggestions.push({
      level: 'medium',
      title: '继续跟节拍',
      content: '节奏基本在线，接下来把每拍动作做得更整齐，减少抢拍和慢拍。'
    });
    suggestions.push({
      level: 'medium',
      title: '保持动作到位',
      content: '注意手脚轨迹完整，动作幅度不要缩水，保持全程动作质量。'
    });
  } else {
    suggestions.push({
      level: 'low',
      title: '细节继续抠',
      content: '整体不错，继续保持节拍稳定和动作到位，重点优化转场和停顿细节。'
    });
  }

  if (stabilityScore < 60) {
    suggestions.push({
      level: 'high',
      title: '先求稳再提速',
      content: '波动偏大，建议先放慢一点，把每个动作做稳，再逐步加速。'
    });
  }

  if (trendDelta < 0) {
    suggestions.push({
      level: 'medium',
      title: '后半段别掉强度',
      content: '后程有回落，注意后半段也要保持发力和节拍，不要越做越松。'
    });
  }

  if (lowRatio >= 40) {
    suggestions.push({
      level: 'high',
      title: '先把低分段拉起来',
      content: '低分帧较多，建议多做慢速跟练，先把动作做对、做满，再追求速度。'
    });
  }

  if (resultData.display_fps < 18 || resultData.latency_ms > 80) {
    suggestions.push({
      level: 'low',
      title: '优化检测环境',
      content: '检测帧率或延迟偏弱，建议提高光照、固定机位并关闭后台高占用程序。'
    });
  }

  if (suggestions.length < 4) {
    suggestions.push({
      level: 'low',
      title: '固定训练口诀',
      content: '训练时记住三点：用力、跟节拍、动作到位，重复执行最容易提分。'
    });
  }

  const displaySuggestions = suggestions.slice(0, 4);
  const getSuggestionClass = (level: 'high' | 'medium' | 'low') => {
    if (level === 'high') return 'border-red-200 bg-red-50';
    if (level === 'medium') return 'border-amber-200 bg-amber-50';
    return 'border-indigo-200 bg-indigo-50';
  };
  const getSuggestionTagClass = (level: 'high' | 'medium' | 'low') => {
    if (level === 'high') return 'bg-red-100 text-red-700';
    if (level === 'medium') return 'bg-amber-100 text-amber-700';
    return 'bg-indigo-100 text-indigo-700';
  };
  const getSuggestionTagText = (level: 'high' | 'medium' | 'low') => {
    if (level === 'high') return '优先处理';
    if (level === 'medium') return '建议跟进';
    return '可优化';
  };

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
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{safeAverage.toFixed(1)}</div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="text-slate-500 text-sm mb-1 flex items-center gap-1"><Zap className="w-4 h-4" /> 峰值分</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">{peakScore.toFixed(1)}</div>
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

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5">
            <div className="flex items-center gap-2 text-slate-200 mb-3">
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm font-semibold">结果解读</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white/10 px-4 py-3">
                <div className="text-xs text-slate-300 mb-1">分数波动区间</div>
                <div className="text-2xl font-bold tabular-nums">{scoreRange.toFixed(1)}</div>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3">
                <div className="text-xs text-slate-300 mb-1">稳定指数</div>
                <div className="text-2xl font-bold tabular-nums">{stabilityScore.toFixed(1)}</div>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3">
                <div className="text-xs text-slate-300 mb-1">趋势判断</div>
                <div className="text-lg font-bold flex items-center gap-1">
                  {trendDelta >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-300" /> : <TrendingDown className="w-4 h-4 text-red-300" />}
                  <span>{trendDelta >= 0 ? '+' : ''}{trendDelta}</span>
                </div>
                <div className="text-xs text-slate-300 mt-1">{trendLabel}</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
            <div className="flex items-center gap-2 text-slate-600 mb-3">
              <Gauge className="w-4 h-4" />
              <span className="text-sm font-semibold">得分区间分布</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden bg-slate-200 flex mb-3">
              <div className="bg-red-400 h-full" style={{ width: `${lowRatio}%` }} />
              <div className="bg-amber-400 h-full" style={{ width: `${mediumRatio}%` }} />
              <div className="bg-emerald-500 h-full" style={{ width: `${highRatio}%` }} />
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center justify-between"><span>低分段 (&lt;60)</span><span className="tabular-nums">{lowRatio}%</span></div>
              <div className="flex items-center justify-between"><span>中分段 (60-79)</span><span className="tabular-nums">{mediumRatio}%</span></div>
              <div className="flex items-center justify-between"><span>高分段 (80+)</span><span className="tabular-nums">{highRatio}%</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-slate-500 font-bold text-sm uppercase tracking-widest mb-4">阶段表现</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stageAverages.map((stage) => (
            <div key={stage.label} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">{stage.label}</span>
                <span className="text-lg font-black tabular-nums text-slate-900">{stage.value.toFixed(1)}</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full ${stage.color}`} style={{ width: `${Math.max(0, Math.min(100, stage.value))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h3 className="text-slate-500 font-bold text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
          <Lightbulb className="w-4 h-4" />
          结果建议
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displaySuggestions.map((item, index) => (
            <div key={`${item.title}-${index}`} className={`rounded-2xl border p-4 ${getSuggestionClass(item.level)}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-slate-900">{item.title}</div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${getSuggestionTagClass(item.level)}`}>
                  {getSuggestionTagText(item.level)}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{item.content}</p>
            </div>
          ))}
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
                <ReferenceLine y={safeAverage} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: `均值 ${safeAverage.toFixed(1)}`, fill: '#64748b', fontSize: 12 }} />
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
