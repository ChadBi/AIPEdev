import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { getVideoUrl } from '../api';
import { Action, VideoRecord } from '../types';
import { Target, ChevronRight, Check, AlertCircle, Loader2, Play, Pause, Volume2, VolumeX, Calendar } from 'lucide-react';

const ScoringPage: React.FC = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialVideoId = queryParams.get('video_id');

  const [actions, setActions] = useState<Action[]>([]);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [selectedActionId, setSelectedActionId] = useState<number | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(initialVideoId ? parseInt(initialVideoId) : null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  
  // 时间同步相关
  const standardVideoRef = useRef<HTMLVideoElement>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const [studentVideoDelay, setStudentVideoDelay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [actRes, vidRes] = await Promise.all([
          api.get('/actions/'),
          api.get('/videos/me')
        ]);
        setActions(actRes.data);
        setVideos(vidRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  // 自动触发评分
  useEffect(() => {
    if (step === 4 && selectedActionId && selectedVideoId && !loading) {
      handleStartScoring();
    }
  }, [step]);

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
    
    // 只同步学生视频的时间，基于当前的延迟值
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

  // 当延迟值改变时，立即更新学生视频的播放位置
  const handleDelayChange = (newDelay: number) => {
    setStudentVideoDelay(newDelay);
    // 立即应用新的延迟到学生视频
    if (standardVideoRef.current && userVideoRef.current) {
      const standardTime = standardVideoRef.current.currentTime;
      const userTargetTime = Math.max(0, standardTime - newDelay);
      userVideoRef.current.currentTime = userTargetTime;
    }
  };

  const handleLoadedMetadata = () => {
    if (standardVideoRef.current) {
      setDuration(standardVideoRef.current.duration);
    }
  };

  const handleStartScoring = async () => {
    if (!selectedActionId || !selectedVideoId) return;

    setLoading(true);
    try {
      // 传入学生视频延迟参数
      const res = await api.post(
        `/scores/?action_id=${selectedActionId}&video_id=${selectedVideoId}&student_video_delay=${studentVideoDelay}`
      );
      navigate(`/scores/result/${res.data.score_id}`, { state: { scoreData: res.data } });
    } catch (err: any) {
      alert(err.response?.data?.detail || '评分失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const selectedAction = actions.find(a => a.id === selectedActionId);
  const selectedVideo = videos.find(v => v.id === selectedVideoId);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 py-12">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">AI 智能评分系统</h1>
          <p className="text-slate-600 text-lg">基于 YOLOv8-Pose 姿态识别的专业动作评估</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-10 bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex items-center ${s < 4 ? 'flex-1' : ''}`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg transition-all ${
                    s < step
                      ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                      : s === step
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {s < step ? <Check size={24} /> : s}
                </div>
                {s < 4 && (
                  <div
                    className={`flex-1 h-2 mx-3 rounded-full transition-all ${
                      s < step ? 'bg-green-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 px-2">
            {['选择动作', '选择视频', '调整时间', '开始评分'].map((label, index) => (
              <span 
                key={index}
                className={`text-sm font-semibold transition-all ${
                  index + 1 === step ? 'text-indigo-600 scale-105' : 'text-slate-500'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Step 1: Select Action */}
        {step === 1 && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-slate-900">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <Target className="text-indigo-600" size={24} />
              </div>
              选择标准动作
            </h2>
            {actions.length === 0 ? (
              <div className="text-center py-20">
                <AlertCircle className="mx-auto text-slate-300 mb-4" size={64} />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">暂无可用动作</h3>
                <p className="text-slate-500">请联系管理员添加标准动作</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {actions.map((action) => (
                  <div
                    key={action.id}
                    onClick={() => {
                      setSelectedActionId(action.id);
                      setStep(2);
                    }}
                    className={`cursor-pointer bg-white rounded-3xl border-2 transition-all overflow-hidden group hover:shadow-xl ${
                      selectedActionId === action.id
                        ? 'border-indigo-500 shadow-lg shadow-indigo-100'
                        : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {/* 视频预览区域 */}
                    <div className="h-48 bg-slate-900 relative flex items-center justify-center overflow-hidden">
                      {action.video_path ? (
                        <>
                          <video 
                            src={getVideoUrl(action.video_path)} 
                            className="w-full h-full object-cover" 
                            muted 
                            loop
                            preload="metadata"
                            onMouseEnter={(e) => e.currentTarget.play()}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0;
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                          <Play className="w-12 h-12 text-white opacity-80 group-hover:scale-125 transition-transform absolute pointer-events-none" />
                        </>
                      ) : (
                        <>
                          <Target className="w-20 h-20 text-slate-700" />
                          <div className="absolute bottom-3 left-4 right-4 text-white text-xs font-medium bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                            暂无示范视频
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* 动作信息 */}
                    <div className="p-6">
                      <h3 className="font-bold text-lg mb-2 text-slate-900">{action.name}</h3>
                      <p className="text-slate-600 text-sm line-clamp-2">{action.description}</p>
                      {selectedActionId === action.id && (
                        <div className="mt-4 flex items-center gap-2 text-indigo-600 text-sm font-semibold">
                          <Check size={16} />
                          已选择
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-8 flex justify-end">
              <button
                disabled={!selectedActionId}
                onClick={() => setStep(2)}
                className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all"
              >
                下一步 <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Video */}
        {step === 2 && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-slate-900">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <Target className="text-indigo-600" size={24} />
              </div>
              选择您的练习视频
            </h2>
            {videos.length === 0 ? (
              <div className="text-center py-20">
                <AlertCircle className="mx-auto text-slate-300 mb-4" size={64} />
                <h3 className="text-xl font-semibold text-slate-900 mb-2">暂无可用视频</h3>
                <p className="text-slate-500">请先上传练习视频</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => {
                      setSelectedVideoId(video.id);
                      setStep(3);
                    }}
                    className={`cursor-pointer bg-white rounded-3xl border-2 transition-all overflow-hidden group hover:shadow-xl ${
                      selectedVideoId === video.id
                        ? 'border-indigo-500 shadow-lg shadow-indigo-100'
                        : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    {/* 视频预览区域 */}
                    <div className="h-48 bg-slate-900 relative flex items-center justify-center overflow-hidden">
                      <video 
                        src={getVideoUrl(video.file_path)} 
                        className="w-full h-full object-cover" 
                        muted 
                        preload="metadata"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                      <Play className="w-12 h-12 text-white opacity-80 group-hover:scale-125 transition-transform absolute pointer-events-none" />
                    </div>
                    
                    {/* 视频信息 */}
                    <div className="p-6">
                      <h3 className="font-bold text-lg mb-3 text-slate-900">📹 {video.filename}</h3>
                      <div className="space-y-2 mb-4">
                        <p className="text-slate-600 text-sm flex items-center gap-2">
                          <Calendar size={14} className="text-indigo-500" />
                          上传时间: {new Date(video.upload_time).toLocaleDateString()}
                        </p>
                        {video.fps && video.total_frames && (
                          <p className="text-slate-600 text-sm flex items-center gap-2">
                            <Target size={14} className="text-indigo-500" />
                            时长: {Math.round(video.total_frames / video.fps)}秒 · {video.fps} FPS
                          </p>
                        )}
                      </div>
                      {selectedVideoId === video.id && (
                        <div className="flex items-center gap-2 text-indigo-600 text-sm font-semibold">
                          <Check size={16} />
                          已选择
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-8 py-3 border-2 border-slate-200 text-slate-700 font-semibold rounded-2xl hover:bg-slate-50 transition-all"
              >
                ← 上一步
              </button>
              <button
                disabled={!selectedVideoId}
                onClick={() => setStep(3)}
                className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all"
              >
                下一步 <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Adjust Time Sync */}
        {step === 3 && selectedAction && selectedVideo && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
            <h2 className="text-2xl font-bold mb-2 text-slate-900">调整视频时间对齐</h2>
            <p className="text-slate-600 mb-8">
              如果您的视频与标准动作有时间差，请调整下方滑块来对齐。只调整您的视频，不调整标准动作。
            </p>

            {/* Video Preview Section */}
            <div className="mb-8 bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Standard Video */}
                <div>
                  <div className="bg-slate-900 rounded-2xl overflow-hidden mb-3 shadow-lg" style={{ paddingBottom: '75%', position: 'relative', height: 0 }}>
                    {selectedAction.video_path && (
                      <video
                        ref={standardVideoRef}
                        src={getVideoUrl(selectedAction.video_path)}
                        className="absolute top-0 left-0 w-full h-full object-cover"
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        muted={isMuted}
                      />
                    )}
                  </div>
                  <div className="text-center">
                    <span className="inline-block bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
                      📌 标准动作
                    </span>
                  </div>
                </div>

                {/* Student Video */}
                <div>
                  <div className="bg-slate-900 rounded-2xl overflow-hidden mb-3 shadow-lg" style={{ paddingBottom: '75%', position: 'relative', height: 0 }}>
                    {selectedVideo && (
                      <video
                        ref={userVideoRef}
                        src={getVideoUrl(selectedVideo.file_path)}
                        className="absolute top-0 left-0 w-full h-full object-cover"
                        muted={isMuted}
                      />
                    )}
                  </div>
                  <div className="text-center">
                    <span className="inline-block bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
                      🎯 您的视频
                    </span>
                  </div>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <button
                  onClick={handlePlayPause}
                  className="p-3 hover:bg-indigo-50 rounded-xl transition-all text-indigo-600"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button
                  onClick={handleMuteToggle}
                  className="p-3 hover:bg-indigo-50 rounded-xl transition-all text-indigo-600"
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-sm text-slate-600 font-semibold whitespace-nowrap min-w-[100px] text-right">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
            </div>

            {/* Time Adjustment Slider */}
            <div className="mb-8 bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-2xl p-6 shadow-sm">
              <label className="block mb-4">
                <span className="font-bold text-slate-900 text-lg">⏱️ 您的视频时间延迟</span>
                <p className="text-sm text-slate-600 mt-2">
                  拖动滑块调整延迟，学生视频会实时跟随调整
                </p>
              </label>
              
              {/* 实时时间对比显示 */}
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 shadow-sm border border-green-200">
                  <div className="text-xs text-green-700 font-semibold mb-1">标准动作时间</div>
                  <div className="text-lg font-bold text-green-600">{formatTime(currentTime)}</div>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm border border-indigo-200">
                  <div className="text-xs text-indigo-700 font-semibold mb-1">您的视频时间</div>
                  <div className="text-lg font-bold text-indigo-600">
                    {formatTime(Math.max(0, currentTime - studentVideoDelay))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm text-slate-600 font-semibold w-12">-5s</span>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.1"
                  value={studentVideoDelay}
                  onChange={(e) => handleDelayChange(parseFloat(e.target.value))}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-sm text-slate-600 font-semibold w-12">+5s</span>
              </div>
              <div className="text-center bg-white rounded-xl p-4 shadow-sm">
                <div className="text-2xl font-bold text-indigo-600 mb-2">
                  {studentVideoDelay > 0 ? '+' : ''}{studentVideoDelay.toFixed(1)}秒
                </div>
                {studentVideoDelay === 0 ? (
                  <p className="text-sm text-green-600 font-semibold flex items-center justify-center gap-1">
                    <Check size={16} /> 视频已完全对齐
                  </p>
                ) : studentVideoDelay > 0 ? (
                  <p className="text-sm text-slate-600">
                    您的视频将提前 {studentVideoDelay.toFixed(1)} 秒开始播放
                  </p>
                ) : (
                  <p className="text-sm text-slate-600">
                    您的视频将延后 {Math.abs(studentVideoDelay).toFixed(1)} 秒开始播放
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex-1 px-8 py-4 border-2 border-slate-200 text-slate-700 font-semibold rounded-2xl hover:bg-slate-50 transition-all"
              >
                ← 返回选择视频
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-2xl hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-100"
              >
                开始 AI 评分 <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Scoring in Progress */}
        {step === 4 && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
            <div className="text-center">
              <div className="mb-8 flex justify-center">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Target className="text-indigo-600" size={48} />
                  </div>
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-3 text-slate-900">🤖 AI 智能评分中...</h2>
              <p className="text-slate-600 mb-8 max-w-2xl mx-auto text-lg">
                我们正在基于 YOLOv8-Pose 姿态识别算法，提取您的动作关键点并与标准动作进行精准比对分析...
              </p>
              
              {/* Progress Bar */}
              <div className="w-full max-w-md mx-auto mb-8">
                <div className="bg-slate-200 h-3 rounded-full overflow-hidden shadow-inner">
                  <div className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full rounded-full animate-pulse transition-all" style={{width: '66%'}}></div>
                </div>
                <p className="text-slate-500 text-sm mt-3 font-medium">正在处理关键点数据...</p>
              </div>

              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-xl text-indigo-700">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold">姿态识别</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl text-blue-700">
                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold">动作对比</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-xl text-purple-700">
                  <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold">评分计算</span>
                </div>
              </div>
              
              <button
                onClick={handleStartScoring}
                disabled={loading}
                className="px-10 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-100 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin inline mr-2" />
                    AI 正在分析中...
                  </>
                ) : (
                  <>点击开始评分</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoringPage;
