
import React, { useRef, useState, useEffect } from 'react';
import { useLocation, Link, useParams } from 'react-router-dom';
import { ScoreResponse } from '../types';
import api, { getVideoUrl } from '../api';
import { 
  Award, 
  CheckCircle2, 
  ArrowLeft, 
  Repeat,
  Activity,
  Zap,
  AlertCircle,
  Play,
  Pause,
  Volume2,
  VolumeX
} from 'lucide-react';
import { 
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Legend
} from 'recharts';

const ScoreResult: React.FC = () => {
  const location = useLocation();
  const { id } = useParams<{ id: string }>();  // 改为 id，与路由中的 :id 匹配
  const scoreId = id ? parseInt(id) : null;  // 转换为number
  const [scoreData, setScoreData] = useState<ScoreResponse | null>(location.state?.scoreData || null);
  const [loading, setLoading] = useState(!location.state?.scoreData);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  
  // 视频播放相关状态
  const standardVideoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoMode, setVideoMode] = useState<'side-by-side' | 'overlay'>('side-by-side');
  const [isScrubbing, setIsScrubbing] = useState(false);
  
  // 从API加载评分详情（如果没有通过state传递）
  useEffect(() => {
    console.log('ScoreResult useEffect triggered', { scoreData: !!scoreData, scoreId, loading });
    
    if (!scoreData && scoreId) {
      console.log('Starting API fetch for scoreId:', scoreId);
      const fetchScoreDetail = async () => {
        try {
          console.log('Fetching score detail for ID:', scoreId);
          const res = await api.get(`/scores/${scoreId}`);
          console.log('Score detail loaded:', res.data);
          setScoreData(res.data);
          setError(null);
        } catch (err: any) {
          console.error('Failed to load score details:', err);
          console.error('Error response:', err.response?.data);
          console.error('Error status:', err.response?.status);
          const errorMsg = err.response?.data?.detail || err.message || '加载评分详情失败';
          setError(errorMsg);
        } finally {
          console.log('Setting loading to false');
          setLoading(false);
        }
      };
      fetchScoreDetail();
    } else if (scoreData) {
      console.log('ScoreData already exists, setting loading to false');
      setLoading(false);
    } else {
      console.log('No scoreId found, setting loading to false');
      setLoading(false);
    }
  }, [scoreId]); // 移除scoreData依赖，避免循环
  
  // 获取延迟值，默认为0
  const studentVideoDelay = scoreData?.student_video_delay || 0;

  const getTimelineBounds = () => {
    const frames = scoreData?.frame_scores || [];
    const minTime = frames.length > 0 ? frames[0].timestamp : 0;
    const maxTime = frames.length > 0 ? frames[frames.length - 1].timestamp : 0;
    return { minTime, maxTime };
  };

  const syncVideosToTime = (time: number) => {
    setCurrentTime(time);
    if (standardVideoRef.current) {
      standardVideoRef.current.currentTime = time;
    }
    if (userVideoRef.current) {
      const userTargetTime = Math.max(0, time - studentVideoDelay);
      userVideoRef.current.currentTime = userTargetTime;
    }
  };

  const handleTimelineScrub = (clientX: number) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const { minTime, maxTime } = getTimelineBounds();
    const range = Math.max(maxTime - minTime, 0.0001);
    const time = minTime + (x / rect.width) * range;
    syncVideosToTime(time);
  };

  // 测试后端连接
  const testConnection = async () => {
    try {
      setTestResult('测试中...');
      const res = await api.get('/scores/test');
      setTestResult('✓ 后端连接正常');
    } catch (err: any) {
      setTestResult('✗ 后端连接失败: ' + (err.message || '未知错误'));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500">加载评分详情中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <AlertCircle className="w-16 h-16 text-red-300 mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-red-600">加载失败</h2>
        <p className="text-slate-600 mb-4">{error}</p>
        
        {/* 调试信息 */}
        <div className="bg-slate-100 rounded-xl p-4 mb-6 text-left max-w-md text-xs text-slate-600">
          <p className="font-mono mb-2"><span className="font-bold">当前URL:</span> {window.location.href}</p>
          <p className="font-mono mb-2"><span className="font-bold">ID参数:</span> {scoreId || '(未传递)'}</p>
          <p className="font-mono"><span className="font-bold">建议:</span> 检查浏览器F12控制台的网络标签和日志</p>
        </div>
        
        {/* 测试连接 */}
        <button 
          onClick={testConnection}
          className="mb-6 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600"
        >
          测试后端连接
        </button>
        {testResult && (
          <div className="bg-slate-100 rounded-xl p-3 mb-6 text-xs font-mono max-w-md">
            {testResult}
          </div>
        )}
        
        <div className="flex gap-3">
          <Link to="/scores/history" className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">返回历史</Link>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300">刷新页面</button>
        </div>
      </div>
    );
  }

  if (!scoreData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-16 h-16 text-slate-200 mb-4" />
        <h2 className="text-2xl font-bold mb-4">未找到评分结果</h2>
        <Link to="/scores" className="px-6 py-2 bg-indigo-600 text-white rounded-xl">返回评分</Link>
      </div>
    );
  }

  // 视频播放控制
  const handlePlayPause = () => {
    if (standardVideoRef.current && userVideoRef.current) {
      if (isPlaying) {
        standardVideoRef.current.pause();
        userVideoRef.current.pause();
      } else {
        standardVideoRef.current.play();
        userVideoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleMuteToggle = () => {
    if (standardVideoRef.current && userVideoRef.current) {
      standardVideoRef.current.muted = !isMuted;
      userVideoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const time = e.currentTarget.currentTime;
    setCurrentTime(time);
    
    // 应用延迟同步学生视频
    if (userVideoRef.current) {
      const userTargetTime = Math.max(0, time - studentVideoDelay);
      if (Math.abs(userVideoRef.current.currentTime - userTargetTime) > 0.1) {
        userVideoRef.current.currentTime = userTargetTime;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (standardVideoRef.current && userVideoRef.current) {
      standardVideoRef.current.currentTime = time;
      const userTargetTime = Math.max(0, time - studentVideoDelay);
      userVideoRef.current.currentTime = userTargetTime;
      setCurrentTime(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (standardVideoRef.current) {
      setDuration(standardVideoRef.current.duration);
    }
  };

  const jointData = Object.entries(scoreData.joint_scores).map(([name, score]) => ({
    name: jointNameCn(name),
    score,
    key: name,
  }));

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#6366f1';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getGrade = (score: number) => {
    if (score >= 90) return { label: '优秀', color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (score >= 75) return { label: '良好', color: 'text-indigo-600', bg: 'bg-indigo-50' };
    if (score >= 60) return { label: '及格', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { label: '需改进', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const grade = getGrade(scoreData.total_score);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to="/scores" className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-all group">
          <ArrowLeft className="w-5 h-5" />
          返回评分
        </Link>
        <Link to="/scores" className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-semibold shadow-lg">
          <Repeat className="w-4 h-4" /> 重新评分
        </Link>
      </div>

      {/* 双视频对照播放 */}
      {(scoreData.standard_video_path || scoreData.user_video_path) && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-slate-500 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
            <Play className="w-4 h-4 text-indigo-600" /> 对照视频播放
          </h3>
          
          {/* 视频模式切换 */}
          <div className="flex gap-2">
            <button
              onClick={() => setVideoMode('side-by-side')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                videoMode === 'side-by-side'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              并排播放
            </button>
            <button
              onClick={() => setVideoMode('overlay')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                videoMode === 'overlay'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              叠放播放
            </button>
          </div>

          {/* 视频容器 */}
          <div className={videoMode === 'side-by-side' ? 'grid grid-cols-2 gap-4' : 'relative'}>
            {/* 标准视频 */}
            {scoreData.standard_video_path && (
              <div className={videoMode === 'overlay' ? 'absolute inset-0 z-10 opacity-50' : ''}>
                <div className="relative bg-black rounded-2xl overflow-hidden">
                  <video
                    ref={standardVideoRef}
                    src={getVideoUrl(scoreData.standard_video_path)}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    muted={isMuted}
                    className="w-full h-80 object-contain"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg">
                    标准动作
                  </div>
                </div>
              </div>
            )}

            {/* 用户视频 */}
            {scoreData.user_video_path && (
              <div>
                <div className="relative bg-black rounded-2xl overflow-hidden">
                  <video
                    ref={userVideoRef}
                    src={getVideoUrl(scoreData.user_video_path)}
                    muted={isMuted}
                    className="w-full h-80 object-contain"
                  />
                  <div className="absolute top-3 left-3 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg">
                    学生视频
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 视频控制栏 */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-2xl">
            {/* 延迟信息提示 */}
            {studentVideoDelay !== 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
                <Activity className="w-4 h-4 text-indigo-600" />
                <span className="text-indigo-700 font-semibold">
                  已应用时间对齐：学生视频
                  {studentVideoDelay > 0 ? '提前' : '延后'}
                  {Math.abs(studentVideoDelay).toFixed(1)}秒播放
                </span>
              </div>
            )}
            
            {/* 进度条 */}
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full cursor-pointer"
            />
            
            {/* 基础控制按钮 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePlayPause}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleMuteToggle}
                  className="p-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-all"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>
              
              <div className="text-sm text-slate-600 font-semibold">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 时间轴分数 */}
      {scoreData.frame_scores && scoreData.frame_scores.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-slate-500 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" /> 实时评分时间轴
            </h3>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="px-3 py-1 bg-slate-50 rounded-lg font-semibold">
                评估帧数: {scoreData.frame_scores.length} 帧
              </span>
              <span className="px-3 py-1 bg-slate-50 rounded-lg font-semibold">
                时长: {scoreData.frame_scores.length > 0 ? scoreData.frame_scores[scoreData.frame_scores.length - 1].timestamp.toFixed(1) : 0}秒
              </span>
            </div>
          </div>
          <div
            ref={timelineRef}
            className="h-64 cursor-ew-resize select-none"
            onMouseDown={(e) => {
              setIsScrubbing(true);
              handleTimelineScrub(e.clientX);
            }}
            onMouseMove={(e) => {
              if (isScrubbing) {
                handleTimelineScrub(e.clientX);
              }
            }}
            onMouseUp={() => setIsScrubbing(false)}
            onMouseLeave={() => setIsScrubbing(false)}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreData.frame_scores} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="timestamp" 
                  stroke="#94a3b8" 
                  fontSize={12}
                  label={{ value: '时间(秒)', position: 'insideBottomRight', offset: -5 }}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12}
                  domain={[0, 100]}
                  label={{ value: '分数', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [`${value.toFixed(1)} 分`,'分数']}
                  labelFormatter={(label: number) => `${label.toFixed(2)}秒`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                  name="实时分数"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Score Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Total Score Card */}
        <div className="lg:col-span-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 text-center">
          <p className="text-xs text-slate-400 font-bold uppercase mb-4">综合练习得分</p>
          <div className="relative w-48 h-48 mx-auto mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke={getScoreColor(scoreData.total_score)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(scoreData.total_score / 100) * 339.3} 339.3`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black text-slate-900">{scoreData.total_score.toFixed(1)}</span>
              <span className="text-sm text-slate-400">/ 100</span>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 ${grade.bg} ${grade.color} rounded-full text-xs font-black uppercase tracking-widest`}>
            <Award className="w-3.5 h-3.5" /> {grade.label}
          </div>
        </div>

        {/* Joint Scores Chart */}
        <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h3 className="text-slate-500 font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" /> 各关节评分详情
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={jointData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={60} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [`${value} 分`, '得分']}
                />
                <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={24}>
                  {jointData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Joint score cards below chart */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {jointData.map((item, idx) => (
              <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                <p className="text-xs text-slate-500 mb-1">{item.name}</p>
                <p className="text-xl font-black" style={{ color: getScoreColor(item.score) }}>{item.score}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Feedback */}
      <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
        <Zap className="absolute -right-4 -top-4 w-24 h-24 text-white/10 rotate-12" />
        <h4 className="font-black text-lg mb-6 flex items-center gap-2">
          <Zap className="w-5 h-5" /> AI 指导建议
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scoreData.feedback.map((f, i) => (
            <div key={i} className="flex gap-3 text-sm leading-relaxed text-indigo-50 p-4 bg-white/5 rounded-2xl border border-white/5">
              <CheckCircle2 className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex justify-center gap-4">
        <Link to="/scores/history" className="px-8 py-3 bg-white text-slate-700 font-semibold rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all">
          查看历史记录
        </Link>
        <Link to="/scores" className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
          继续练习
        </Link>
      </div>
    </div>
  );
};

/** 关节英文名转中文 */
function jointNameCn(name: string): string {
  const map: Record<string, string> = {
    left_knee: '左膝',
    right_knee: '右膝',
    left_elbow: '左肘',
    right_elbow: '右肘',
    left_shoulder: '左肩',
    right_shoulder: '右肩',
    left_hip: '左髋',
    right_hip: '右髋',
  };
  return map[name] || name;
}

export default ScoreResult;
