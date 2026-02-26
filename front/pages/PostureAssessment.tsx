import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Camera,
  Clock,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Home,
  History,
  User,
  RotateCw
} from 'lucide-react';
import * as postureApi from '../api/posture';
import { ViewAngle, PhotoCapture, CaptureStep, PostureAssessmentResponse, AssessmentType } from '../types';
import AutoCaptureGuide from '../components/AutoCaptureGuide';

// 辅助函数：根据评分获取体态评价
const getEvaluationText = (score: number): string => {
  if (score >= 90) return '优秀体态';
  if (score >= 75) return '良好体态';
  if (score >= 60) return '一般体态';
  return '体态欠佳';
};

// 辅助函数：根据评分获取等级
const getGradeFromScore = (score: number): string => {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
};

// 辅助函数：根据问题代码获取问题信息
const getIssueInfo = (issueCode: string): { name: string; description: string } => {
  const issueInfo: Record<string, { name: string; description: string }> = {
    'round_shoulders': {
      name: '圆肩',
      description: '肩膀向内扣，驼背体态，可能影响呼吸和姿态美观'
    },
    'forward_head': {
      name: '头前伸',
      description: '头部前倾，颈部肌肉紧张，容易导致颈椎问题'
    },
    'kyphosis': {
      name: '驼背',
      description: '背部过度弯曲，影响脊柱健康和整体形象'
    },
    'lordosis': {
      name: '骨盆前倾',
      description: '骨盆前倾，腰部过度前凸，可能引起腰痛'
    },
    'scoliosis': {
      name: '脊柱侧弯',
      description: '脊柱向一侧弯曲，可能影响身体平衡和姿态'
    },
    'uneven_shoulders': {
      name: '高低肩',
      description: '左右肩膀高度不一致，可能与姿势或肌肉不平衡有关'
    }
  };
  return issueInfo[issueCode] || {
    name: `问题: ${issueCode}`,
    description: '检测到异常体态问题，建议咨询专业医师'
  };
};

// 辅助函数：根据问题ID获取问题名称（为了兼容保留）
const getIssueName = (issueId: number): string => {
  const issueNames: Record<number, string> = {
    1: '圆肩',
    2: '头前伸',
    3: '驼背',
    4: '骨盆前倾',
    5: '脊柱侧弯',
    6: '高低肩'
  };
  return issueNames[issueId] || `问题 ${issueId}`;
};

// 辅助函数：根据问题ID获取问题代码
const getIssueCodeFromId = (issueId: number): string => {
  const issueCodeMap: Record<number, string> = {
    1: 'round_shoulders',    // 圆肩
    2: 'forward_head',       // 头前伸
    3: 'kyphosis',           // 驼背
    4: 'lordosis',           // 骨盆前倾
    5: 'scoliosis',          // 脊柱侧弯
    6: 'uneven_shoulders'    // 高低肩
  };
  return issueCodeMap[issueId] || '';
};

// 辅助函数：获取数据库建议（优先）或使用默认建议
const getRecommendationText = (issueId: number, severity: string, apiRecommendations: any[]): string => {
  const issueCode = getIssueCodeFromId(issueId);
  if (!issueCode) return '请保持良好的生活习惯，适当进行体态训练';

  // 优先查找数据库建议
  if (apiRecommendations && apiRecommendations.length > 0) {
    const recommendation = apiRecommendations.find(rec =>
      rec.issue_code === issueCode && rec.severity_level === severity
    );
    if (recommendation) {
      return recommendation.recommendation_text;
    }
  }

  // 如果没有找到数据库建议，使用默认建议
  const severityTextMap: Record<string, string> = {
    'mild': '轻微',
    'moderate': '中等',
    'severe': '严重',
    'none': '无'
  };
  const severityText = severityTextMap[severity] || '';

  const defaultRecommendations: Record<string, string> = {
    'round_shoulders': `圆肩${severityText}问题，建议进行肩部拉伸和背部肌肉强化训练。工作间隙做扩胸运动，每次20次，每天3-5次。`,
    'forward_head': `头前伸${severityText}问题，建议每小时提醒自己将下巴水平后收，保持头部在肩膀正上方。调整工作屏幕高度，减少低头习惯。`,
    'kyphosis': `驼背${severityText}问题，建议进行胸肌拉伸和背肌强化训练。每天进行猫牛式伸展10次，配合胸部拉伸。`,
    'lordosis': `骨盆前倾${severityText}问题，建议进行髋屈肌拉伸和核心肌群训练。弓步姿势感受髋部拉伸，配合平板支撑练习。`,
    'scoliosis': `脊柱侧弯${severityText}问题，建议咨询专业医生进行评估。避免单侧负重，进行对称性训练。`,
    'uneven_shoulders': `高低肩${severityText}问题，注意日常姿势，避免长时间单侧承重。进行侧平板支撑等平衡训练。`
  };

  return defaultRecommendations[issueCode] || '请保持良好的生活习惯，适当进行体态训练';
};

const PostureAssessment: React.FC = () => {
  const navigate = useNavigate();

  // 初始化调试输出
  console.log('🚀 PostureAssessment 组件已加载');
  console.log('📐 当前时间:', new Date().toISOString());
  console.log('🔍 检查环境变量:', {
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    NODE_ENV: import.meta.env.NODE_ENV
  });

  const [currentStep, setCurrentStep] = useState<CaptureStep>('guide');
  const [capturedPhotos, setCapturedPhotos] = useState<Record<string, PhotoCapture>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [assessmentResult, setAssessmentResult] = useState<PostureAssessmentResponse | null>(null);
  const [userInfo, setUserInfo] = useState({
    age: '',
    height: '',
    weight: ''
  });
  const [analysisProgress, setAnalysisProgress] = useState({
    stage: '',
    details: []
  });
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // 自动拍照流程状态
  const [autoCaptureMode, setAutoCaptureMode] = useState(false);
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [detectionStatus, setDetectionStatus] = useState<'idle' | 'detecting' | 'detected' | 'captured'>('idle');
  const [guidanceText, setGuidanceText] = useState('');

  // 拍照角度配置（带语音引导）
  const angles = [
    {
      angle: ViewAngle.FRONT,
      label: '正面',
      description: '请正对摄像头，全身入镜，双臂自然下垂',
      voiceGuidance: ['请正对摄像头站好', '双脚分开与肩同宽', '双臂自然下垂放在身体两侧', '保持自然站姿，不要抬头也不要低头', '请确保全身都在画面中，从头到脚都要完整显示']
    },
    {
      angle: ViewAngle.LEFT_SIDE,
      label: '左侧面',
      description: '请左侧面对摄像头，全身入镜',
      voiceGuidance: ['现在请向左转身', '左肩膀对着摄像头', '保持自然站姿', '确保从头到脚都能看到']
    },
    {
      angle: ViewAngle.RIGHT_SIDE,
      label: '右侧面',
      description: '请右侧面对摄像头，全身入镜',
      voiceGuidance: ['现在请向右转身', '右肩膀对着摄像头', '保持自然站姿', '确保从头到脚都能看到']
    },
    {
      angle: ViewAngle.BACK,
      label: '背面',
      description: '请背对摄像头，全身入镜',
      voiceGuidance: ['现在请背对摄像头', '让背部正对镜头', '保持自然站姿', '确保从头到脚都能看到', '最后一张照片了，请保持好姿势']
    }
  ];

  // 跳转到指定步骤
  const goToStep = (step: CaptureStep) => {
    setCurrentStep(step);
    setError('');
  };

  // 处理照片捕获
  const handlePhotoCapture = async (angle: ViewAngle, file: File, preview: string) => {
    console.log('📸 照片捕获触发:', { angle, fileName: file.name, fileSize: file.size });
    console.log('📸 Previews:', preview.substring(0, 50) + '...');

    setCapturedPhotos(prev => {
      const newPhotos = {
        ...prev,
        [angle]: { angle, file, preview }
      };
      console.log('📸 当前所有照片:', Object.keys(newPhotos));
      return newPhotos;
    });

    // 如果是自动模式，使用特殊的逻辑
    if (autoCaptureMode) {
      const nextIndex = currentAngleIndex + 1;
      if (nextIndex < angles.length) {
        // 进入下一个角度
        setTimeout(() => {
          setCurrentAngleIndex(nextIndex);
          setDetectionStatus('idle');
          startAngleGuidance(nextIndex);
        }, 2000);
      } else {
        // 所有角度完成，进入分析
        setTimeout(() => {
          goToStep('analyzing');
          // 停止摄像头
          if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            setCurrentStream(null);
          }
          setAutoCaptureMode(false);
        }, 2000);
      }
    } else {
      // 手动模式
      const currentIndex = angles.findIndex(a => a.angle === angle);
      console.log('📸 当前角度索引:', currentIndex, '总角度数:', angles.length);

      if (currentIndex < angles.length - 1) {
        const nextAngle = angles[currentIndex + 1].angle;
        console.log('➡️ 下一个角度:', nextAngle);
        setTimeout(() => {
          goToStep(nextAngle as CaptureStep);
        }, 300);
      } else {
        console.log('✅ 所有照片拍摄完成');
        // 所有照片拍完，准备分析
        goToStep('analyzing');
      }
    }
  };

  // 重新拍摄指定角度
  const handleRetake = (angle: ViewAngle) => {
    goToStep(angle as CaptureStep);
  };

  // 提交进行评估
  const handleSubmit = async () => {
    // 检查所有必需的角度是否都已拍摄
    const requiredAngles = ['front', 'left_side', 'right_side', 'back'];
    const missingAngles = requiredAngles.filter(angle => !capturedPhotos[angle]);

    if (missingAngles.length > 0) {
      setError(`缺少以下角度的照片：${missingAngles.map(a => a).join(', ')}`);
      return;
    }

    setLoading(true);
    setError('');
    setDebugInfo([]);
    setAnalysisProgress({ stage: '准备上传', details: ['开始体态检测流程'] });

    try {
      console.log('=== 开始体态检测流程 ===');
      console.log('提交时的状态:', { loading, error, currentStep });

      // 步骤1: 准备数据
      console.log('🔄 步骤1: 准备数据');
      setAnalysisProgress({
        stage: '准备数据',
        details: ['检查照片...', '整理用户信息...']
      });

      console.log('📸 已拍摄的照片:', capturedPhotos);
      console.log('📸 照片数量:', Object.keys(capturedPhotos).length);

      setDebugInfo(prev => [...prev, `✓ 检测到 ${Object.keys(capturedPhotos).length} 张照片`]);
      setDebugInfo(prev => [...prev, `✓ 照片键名: ${JSON.stringify(Object.keys(capturedPhotos))}`]);

      console.log('📝 开始构建photosObj...');
      const photosObj: Record<string, File> = {};
      Object.entries(capturedPhotos).forEach(([key, value]) => {
        console.log(`🔄 处理照片: ${key}`, value);
        const photoCapture = value as PhotoCapture;
        if (photoCapture && photoCapture.file) {
          photosObj[key] = photoCapture.file;
          const logMsg = `✓ 照片类型: ${key}, 大小: ${photoCapture.file.size} bytes, 名字: ${photoCapture.file.name}`;
          console.log(`✅ ${logMsg}`);
          setDebugInfo(prev => [...prev, logMsg]);
        } else {
          console.error(`❌ 照片无效: ${key}`, value);
          setDebugInfo(prev => [...prev, `✗ 照片类型: ${key}, 数据无效`]);
        }
      });

      console.log('📊 photosObj构建完成:', photosObj);
      console.log('📊 photosObj键名:', Object.keys(photosObj));

      const userInfoData = {
        age: userInfo.age ? parseInt(userInfo.age) : undefined,
        height: userInfo.height ? parseInt(userInfo.height) : undefined,
        weight: userInfo.weight ? parseInt(userInfo.weight) : undefined
      };

      console.log('👤 用户信息:', userInfoData);

      setDebugInfo(prev => [...prev, `✓ 用户信息: 年龄=${userInfoData.age}, 身高=${userInfoData.height}, 体重=${userInfoData.weight}`]);
      setDebugInfo(prev => [...prev, `✓ 准备发送的照片对象: ${JSON.stringify(Object.keys(photosObj))}`]);

      // 步骤2: 开始API调用，带超时
      console.log('🔄 步骤2: 准备API调用');
      setAnalysisProgress({
        stage: '上传照片',
        details: ['正在上传照片到服务器...', '请稍候...']
      });
      setDebugInfo(prev => [...prev, `⏱️ 开始API调用 (${new Date().toLocaleTimeString()})`]);

      const startTime = Date.now();
      const TIMEOUT_MS = 60000; // 60秒超时

      setDebugInfo(prev => [...prev, `🔍 准备调用assessPosture函数...`]);
      console.log('🎯 准备调用assessPosture函数...');

      // 检查照片对象
      const requiredAngs = ['front', 'left_side', 'right_side', 'back'];
      console.log('🔍 检查必需的角度:', requiredAngs);
      console.log('🔍 当前的photosObj键:', Object.keys(photosObj));

      const missing = requiredAngs.filter(a => !photosObj[a]);
      console.log('🔍 缺失的角度:', missing);

      if (missing.length > 0) {
        const errorMsg = `缺少照片: ${missing.join(', ')}`;
        console.error('❌', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ 所有必需的照片都已准备');
      setDebugInfo(prev => [...prev, `✅ 所有必需的照片都已准备`]);

      console.log('🚀 开始异步API调用...');
      setDebugInfo(prev => [...prev, `🚀 开始异步API调用...`]);

      console.log('⏰ 当前时间:', new Date().toISOString());
      console.log('⚡ 准备执行 Promise.race');

      const result = await Promise.race([
        postureApi.assessPosture(
          photosObj,
          AssessmentType.ROUTINE,
          userInfoData
        ).then(response => {
          console.log('✅ assessPosture成功返回:', response);
          console.log('⏰ API完成时间:', new Date().toISOString());
          return response;
        }).catch(apiError => {
          console.error('❌ assessPosture失败:', apiError);
          console.error('❌ 错误堆栈:', apiError.stack);
          throw new Error(`API调用失败: ${apiError.message}`);
        }),
        new Promise((_, reject) => {
          console.log('⏱️ 设置超时定时器:', TIMEOUT_MS, 'ms');
          setTimeout(() => {
            console.error('❌ 请求超时');
            reject(new Error('请求超时：分析时间超过60秒'));
          }, TIMEOUT_MS);
        })
      ]) as PostureAssessmentResponse;

      console.log('🎉 Promise.race 完成, 获得结果:', result);

      // 添加详细的metric调试信息
      console.log('📊 详细 Metrics 分析:');
      console.log('Metrics 对象:', result.metrics);
      console.log('Metrics 类型:', typeof result.metrics);
      console.log('Metrics 键:', Object.keys(result.metrics || {}));
      console.log('body_balance:', result.metrics?.body_balance);
      console.log('spinal_alignment:', result.metrics?.spinal_alignment);
      console.log('head_neck_angle:', result.metrics?.head_neck_angle);
      console.log('shoulder_balance:', result.metrics?.shoulder_balance);
      console.log('hip_alignment:', result.metrics?.hip_alignment);
      console.log('posture_stability:', result.metrics?.posture_stability);

      // 检查metrics中是否有任何非null的值
      if (result.metrics) {
        const nonEmpty = Object.entries(result.metrics).filter(([key, value]) => value !== null && key !== 'id' && key !== 'assessment_id' && key !== 'created_at');
        console.log('非空的指标数量:', nonEmpty.length);
        console.log('非空的指标:', nonEmpty);
      }

      const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
      setDebugInfo(prev => [...prev, `✅ API调用成功，耗时 ${elapsedTime} 秒`]);

      // 步骤3: 显示结果
      setAnalysisProgress({
        stage: '完成',
        details: ['分析完成！', '正在准备结果...']
      });

      setAssessmentResult(result);
      setDebugInfo(prev => [...prev, `✅ 获得评分: ${result.overall_score}`]);

      setTimeout(() => {
        goToStep('result');
      }, 1000);

    } catch (err: any) {
      console.error('体态检测失败:', err);

      // 详细的错误信息
      let errorMessage = '体态检测失败';
      let errorDetails = [];

      if (err.message) {
        // 客户端错误（如缺少照片）
        errorMessage = '数据错误';
        errorDetails.push(err.message);
      } else if (err.message === '请求超时：分析时间超过60秒') {
        errorMessage = '分析超时';
        errorDetails.push('服务器处理时间过长，可能是：', '• 照片文件过大', '• 同时有其他用户在进行检测', '• 服务器资源受限');
      } else if (err.response) {
        // HTTP错误响应
        const status = err.response.status;
        errorMessage = `服务器错误 (${status})`;

        if (status === 401) {
          errorMessage = '认证失败';
          errorDetails.push('登录已过期，请重新登录');
        } else if (status === 422) {
          errorMessage = '数据验证错误';
          // 处理422错误的具体字段错误
          if (err.response.data?.detail && Array.isArray(err.response.data.detail)) {
            const missingFields = err.response.data.detail
              .filter((item: any) => item.type === 'missing')
              .map((item: any) => item.msg);
            if (missingFields.length > 0) {
              errorDetails.push('缺少必需的照片：', ...missingFields.map((msg: string) => `• ${msg}`));
            }
          } else {
            errorDetails.push('提交的数据格式不正确');
          }
        } else if (status === 400) {
          errorMessage = '请求错误';
          errorDetails.push('请求数据格式错误');
        } else if (status === 500) {
          errorDetails.push('服务器内部错误');
        } else {
          errorDetails.push(`HTTP状态码: ${status}`);
        }

        if (err.response.data?.detail && status !== 422) {
          errorDetails.push(`详细错误: ${err.response.data.detail}`);
        }
      } else if (err.request) {
        // 请求已发出但没有收到响应
        errorMessage = '网络连接错误';
        errorDetails.push('请检查：', '• 后端服务器是否正常运行', '• 网络连接是否正常', '• 端口是否正确');
      } else {
        // 其他错误
        errorDetails.push(err.message || '未知错误');
      }

      setDebugInfo(prev => [...prev, `❌ 错误: ${errorMessage}`]);
      setDebugInfo(prev => [...prev, ...errorDetails.map(d => `   ${d}`)]);

      setError({
        message: errorMessage,
        details: errorDetails
      } as any);

      setAnalysisProgress({
        stage: '错误',
        details: [errorMessage, ...errorDetails]
      });

    } finally {
      setLoading(false);
    }
  };

  // 重新开始检测
  const handleRestart = () => {
    setCapturedPhotos({});
    setAssessmentResult(null);
    setError('');
    setAutoCaptureMode(false);
    setCurrentAngleIndex(0);
    goToStep('guide');
  };

  // 启动自动拍照模式
  const startAutoCaptureMode = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setCurrentStream(mediaStream);
      setAutoCaptureMode(true);
      setCurrentAngleIndex(0);
      goToStep('front'); // 开始第一个角度
      startAngleGuidance(0);
    } catch (err: any) {
      setError('无法启动摄像头: ' + err.message);
    }
  };

  // 开始特定角度的语音引导
  const startAngleGuidance = (index: number) => {
    const angle = angles[index];
    setDetectionStatus('detecting');
    setGuidanceText(angle.voiceGuidance[0]);

    // 序列播放语音指导
    let textIndex = 0;
    const playNextText = () => {
      if (textIndex < angle.voiceGuidance.length) {
        setGuidanceText(angle.voiceGuidance[textIndex]);
        textIndex++;

        // 开始检测人体完整性
        if (textIndex === angle.voiceGuidance.length) {
          startDetection();
        } else {
          // 继续播放下一个指导文本
          setTimeout(playNextText, 2500);
        }
      }
    };

    // 延迟开始播放
    setTimeout(playNextText, 1000);
  };

  // 模拟检测人体完整性（在实际应用中这里会连接到YOLO检测）
  const startDetection = () => {
    setDetectionStatus('detecting');
    setGuidanceText('正在检测人体完整性...');

    // 模拟检测过程，2秒后标记为已检测
    // AutoCaptureGuide会自动在detected状态3秒后拍照
    setTimeout(() => {
      setDetectionStatus('detected');
      setGuidanceText('检测完成，3秒后自动拍照');
    }, 2000);
  };

  // 停止自动拍照模式
  const stopAutoCaptureMode = () => {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      setCurrentStream(null);
    }
    setAutoCaptureMode(false);
    goToStep('guide');
  };

  // 处理AutoCaptureGuide返回的照片文件
  const handleAutoCaptureFile = (file: File, preview: string) => {
    console.log('🤖 自动拍照收到文件:', { fileName: file.name, fileSize: file.size });

    const currentAngle = angles[currentAngleIndex];
    handlePhotoCapture(currentAngle.angle, file, preview);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* 顶部导航 */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Activity className="w-8 h-8 text-indigo-600" />
              <h1 className="text-xl font-bold text-slate-900">体态检测</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="返回首页"
              >
                <Home size={20} />
              </button>
              <button
                onClick={() => navigate('/posture/history')}
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="历史记录"
              >
                <History size={20} />
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="个人中心"
              >
                <User size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容区域 */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {currentStep === 'guide' && (
          <GuideStep
            onStart={() => goToStep('front')}
            startAutoCapture={startAutoCaptureMode}
            userInfo={userInfo}
            setUserInfo={setUserInfo}
          />
        )}

        {currentStep === 'analyzing' && (
          <AnalyzingStep
            loading={loading}
            analysisProgress={analysisProgress}
            error={error}
            debugInfo={debugInfo}
            onStartAnalysis={handleSubmit}
          />
        )}

        {currentStep === 'result' && assessmentResult && (
          <ResultStep
            result={assessmentResult}
            capturedPhotos={capturedPhotos}
            onRestart={handleRestart}
          />
        )}

        {/* 自动拍照模式 */}
        {autoCaptureMode && currentStep !== 'guidance' && currentStep !== 'analyzing' && currentStep !== 'result' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 自动拍照引导 */}
            <div className="lg:col-span-2">
              <AutoCaptureGuide
                stream={currentStream}
                isActive={true}
                guidanceText={guidanceText}
                onAutoCapture={handleAutoCaptureFile}
                detectionStatus={detectionStatus}
                showHumanFigure={true}
              />
            </div>

            {/* 控制面板 */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-indigo-600" />
                  拍摄进度
                </h3>

                {/* 进度步骤 */}
                <div className="space-y-3">
                  {angles.map((angle, index) => {
                    const isCurrent = index === currentAngleIndex;
                    const isCompleted = capturedPhotos[angle.angle];

                    return (
                      <div
                        key={angle.angle}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                          isCurrent ? 'border-indigo-500 bg-indigo-50' :
                          isCompleted ? 'border-green-500 bg-green-50' :
                          'border-slate-200'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          isCompleted ? 'bg-green-500 text-white' :
                          isCurrent ? 'bg-indigo-600 text-white' :
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {isCompleted ? <CheckCircle className="w-5 h-5" /> : index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">{angle.label}</div>
                          <div className="text-sm text-slate-600">{angle.description}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
                <button
                  onClick={stopAutoCaptureMode}
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <Home className="w-5 h-5" />
                  返回首页
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 手动拍照模式 */}
        {!autoCaptureMode && angles.map(angleConfig => {
          if (currentStep !== angleConfig.angle) return null;

          const hasPhoto = capturedPhotos[angleConfig.angle];
          const currentIndex = angles.findIndex(a => a.angle === angleConfig.angle);

          return (
            <CaptureAngleStep
              key={angleConfig.angle}
              angleConfig={angleConfig}
              hasPrevious={currentIndex > 0}
              hasPhoto={!!hasPhoto}
              onNext={() => {
                if (hasPhoto) {
                  const nextIndex = currentIndex + 1;
                  if (nextIndex < angles.length) {
                    goToStep(angles[nextIndex].angle as CaptureStep);
                  } else {
                    goToStep('analyzing');
                  }
                }
              }}
              onRetake={() => handleRetake(angleConfig.angle)}
              onPhotoCapture={(file, preview) => handlePhotoCapture(angleConfig.angle, file, preview)}
              totalAngles={angles.length}
              currentIndex={currentIndex}
            />
          );
        })}
      </main>

      {/* 错误提示 */}
      {error && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md w-full mx-4">
          <div className="flex items-start gap-2">
            <AlertCircle size={20} className="flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold">
                {typeof error === 'object' && error.message ? error.message : error}
              </p>
              {typeof error === 'object' && error.details && error.details.length > 0 && (
                <p className="text-sm mt-1 opacity-90">
                  {error.details[0]}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 引导步骤
const GuideStep: React.FC<{
  onStart: () => void;
  startAutoCapture: () => void;
  userInfo: { age: string; height: string; weight: string };
  setUserInfo: (info: { age: string; height: string; weight: string }) => void;
}> = ({ onStart, startAutoCapture, userInfo, setUserInfo }) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6">
        <div className="flex items-center gap-3 mb-2">
          <Camera className="w-10 h-10 text-white" />
          <h2 className="text-2xl font-bold text-white">体态检测</h2>
        </div>
        <p className="text-indigo-100">
          静态拍照AI智能分析，全面评估身体姿态健康
        </p>
      </div>

      {/* 内容 */}
      <div className="p-8 space-y-6">
        {/* 准备须知 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            检测准备
          </h3>
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs mt-0.5">1</div>
              <span>穿着贴身衣物，确保身体轮廓清晰可见</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs mt-0.5">2</div>
              <span>选择光线充足、背景整洁的环境</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs mt-0.5">3</div>
              <span>保持自然站姿，双脚分开与肩同宽</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs mt-0.5">4</div>
              <span>拍摄时全身入镜，头部到脚部完整可见</span>
            </li>
          </ul>
        </div>

        {/* 拍摄方式选择 */}
        <div className="bg-slate-50 rounded-xl p-6">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5 text-slate-600" />
            选择拍摄方式
          </h3>

          {/* 重要提示 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-amber-800 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              重要提示：必须完整拍摄全部4个角度才能完成体态检测
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 自动拍照 */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200 hover:border-green-400 transition-all cursor-pointer"
                 onClick={startAutoCapture}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                  <RotateCw className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">智能自动拍照</h4>
                  <p className="text-sm text-green-700">推荐：完全解放双手</p>
                </div>
              </div>
              <ul className="text-sm text-slate-700 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>语音指导站位</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>自动检测人体完整性</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>自动拍照无需按键</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>语音提示转身</span>
                </li>
              </ul>
            </div>

            {/* 手动拍照 */}
            <div className="bg-white rounded-xl p-6 border-2 border-slate-200 hover:border-indigo-400 transition-all cursor-pointer"
                 onClick={onStart}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">手动拍照</h4>
                  <p className="text-sm text-indigo-700">传统方式：手动拍照</p>
                </div>
              </div>
              <ul className="text-sm text-slate-700 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-600" />
                  <span>按需手动确认拍照</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-600" />
                  <span>完全可控拍照时机</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-600" />
                  <span>适合有特殊需求情况</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-indigo-600" />
                  <span>无语音提示</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* 拍摄流程 */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-600" />
            拍摄流程
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {['正面', '左侧面', '右侧面', '背面'].map((angle, index) => (
              <div
                key={angle}
                className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{angle}</p>
                  <p className="text-xs text-slate-500">全身照（必需）</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 用户信息输入 */}
        <div className="bg-white rounded-xl p-6 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-slate-600" />
            基本信息（可选）
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1">年龄</label>
              <input
                type="number"
                value={userInfo.age}
                onChange={(e) => setUserInfo({ ...userInfo, age: e.target.value })}
                placeholder="岁"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">身高</label>
              <input
                type="number"
                value={userInfo.height}
                onChange={(e) => setUserInfo({ ...userInfo, height: e.target.value })}
                placeholder="cm"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">体重</label>
              <input
                type="number"
                value={userInfo.weight}
                onChange={(e) => setUserInfo({ ...userInfo, weight: e.target.value })}
                placeholder="kg"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* 开始按钮 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={startAutoCapture}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <RotateCw className="w-5 h-5" />
            智能自动拍照
          </button>
          <button
            onClick={onStart}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            <Camera size={20} />
            手动拍照
          </button>
        </div>
      </div>
    </div>
  );
};

// 分析步骤
const AnalyzingStep: React.FC<{
  loading: boolean;
  analysisProgress: { stage: string; details: string[] };
  error: string | any;
  debugInfo: string[];
  onStartAnalysis: () => void;
}> = ({ loading, analysisProgress, error, debugInfo, onStartAnalysis }) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
      <div className="text-center mb-8">
        {error ? (
          // 错误状态
          <div className="mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-red-900 mb-2">
              {typeof error === 'object' && error.message ? error.message : '分析失败'}
            </h2>
          </div>
        ) : (
          // 加载状态
          <div className="animate-pulse mb-6">
            <div className="relative w-32 h-32 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
              <Activity className="absolute inset-0 w-full h-full p-4 text-indigo-600" />
            </div>
          </div>
        )}

        {!error && (
          <>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {analysisProgress.stage}
            </h2>
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {analysisProgress.details.map((detail, index) => (
                <span
                  key={index}
                  className="text-sm px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full"
                >
                  {detail}
                </span>
              ))}
            </div>
          </>
        )}

        {error && (
          <div className="mt-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left">
              <h3 className="font-semibold text-red-900 mb-2">错误详情：</h3>
              <ul className="text-sm text-red-700 space-y-1">
                {(typeof error === 'object' && error.details ? error.details : [error as string]).map((detail, index) => (
                  <li key={index}>• {detail}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              重新尝试
            </button>
          </div>
        )}

        {(!loading && !error) && (
          <div className="mt-6">
            <button
              onClick={() => {
                console.log('🚀 点击了开始分析按钮');
                onStartAnalysis();
              }}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Activity size={24} />
              开始分析
            </button>
          </div>
        )}
      </div>

      {/* 调试信息 */}
      {debugInfo.length > 0 && (
        <div className="mt-8 bg-slate-50 rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-600" />
              处理进度
            </h3>
            <div className="text-xs text-slate-500">
              共 {debugInfo.length} 条日志
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {debugInfo.map((log, index) => (
              <div
                key={index}
                className={`text-sm p-3 rounded-lg ${
                  log.startsWith('✅') ? 'bg-green-50 text-green-800 border border-green-200' :
                  log.startsWith('⏱️') ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                  log.startsWith('❌') ? 'bg-red-50 text-red-800 border border-red-200' :
                  'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 进度条 */}
      {!error && (
        <div className="mt-6">
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{
                width: loading
                  ? '33.33%'
                  : analysisProgress.stage === '完成'
                  ? '100%'
                  : '16.66%',
                transition: 'width 0.5s ease-in-out'
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>准备数据</span>
            <span>上传照片</span>
            <span>分析处理</span>
            <span>生成结果</span>
          </div>
        </div>
      )}
    </div>
  );
};

// 结果步骤
const ResultStep: React.FC<{
  result: PostureAssessmentResponse;
  capturedPhotos: Record<string, PhotoCapture>;
  onRestart: () => void;
}> = ({ result, capturedPhotos, onRestart }) => {
  return (
    <div className="space-y-6">
      {/* 评分卡片 */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* 评分头部 */}
        <div className={`bg-gradient-to-r ${
          result.overall_score >= 90 ? 'from-green-500 to-emerald-500' :
          result.overall_score >= 75 ? 'from-yellow-500 to-amber-500' :
          result.overall_score >= 60 ? 'from-orange-500 to-red-500' :
          'from-red-600 to-red-700'
        } px-8 py-6 text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-1">{getEvaluationText(result.overall_score)}</h2>
              <p className="text-white/90">{result.overall_score}分 - {getGradeFromScore(result.overall_score)}</p>
            </div>
            <div className="text-right">
              <div className="text-6xl font-bold">{result.overall_score}</div>
              <div className="text-sm text-white/80">综合体态评分</div>
            </div>
          </div>
        </div>

        {/* 评分详情 */}
        <div className="p-6">
          <h3 className="font-semibold text-slate-900 mb-4">体态指标</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="text-xs text-slate-600 mb-1">身体平衡度</div>
              <div className="text-lg font-bold text-slate-900">{result.metrics.body_balance?.toFixed(1) || 'N/A'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="text-xs text-slate-600 mb-1">脊柱对齐度</div>
              <div className="text-lg font-bold text-slate-900">{result.metrics.spinal_alignment?.toFixed(1) || 'N/A'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="text-xs text-slate-600 mb-1">肩膀平衡度</div>
              <div className="text-lg font-bold text-slate-900">{result.metrics.shoulder_balance?.toFixed(1) || 'N/A'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="text-xs text-slate-600 mb-1">髋部对齐度</div>
              <div className="text-lg font-bold text-slate-900">{result.metrics.hip_alignment?.toFixed(1) || 'N/A'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="text-xs text-slate-600 mb-1">头颈角度</div>
              <div className="text-lg font-bold text-slate-900">{result.metrics.head_neck_angle?.toFixed(1) || 'N/A'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="text-xs text-slate-600 mb-1">正面脊柱弯曲</div>
              <div className="text-lg font-bold text-slate-900">{result.metrics.spine_curvature_front?.toFixed(1) || 'N/A'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="text-xs text-slate-600 mb-1">侧面脊柱弯曲</div>
              <div className="text-lg font-bold text-slate-900">{result.metrics.spine_curvature_side?.toFixed(1) || 'N/A'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="text-xs text-slate-600 mb-1">体态稳定性</div>
              <div className="text-lg font-bold text-slate-900">{result.metrics.posture_stability?.toFixed(1) || 'N/A'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="text-xs text-slate-600 mb-1">骨盆倾斜角度</div>
              <div className="text-lg font-bold text-slate-900">{result.metrics.pelvis_tilt_angle?.toFixed(1) || 'N/A'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:border-indigo-300 transition-colors">
              <div className="text-xs text-slate-600 mb-1">骨骼对称性</div>
              <div className="text-lg font-bold text-slate-900">{result.metrics.skeletal_symmetry?.toFixed(1) || 'N/A'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 问题卡片 */}
      {result.detected_issues && result.detected_issues.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              检测到的体态问题
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {result.detected_issues.map((issue) => (
              <div
                key={issue.id}
                className={`p-4 rounded-lg border-2 ${
                  issue.severity === 'severe' ? 'border-red-300 bg-red-50' :
                  issue.severity === 'moderate' ? 'border-amber-300 bg-amber-50' :
                  'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">{getIssueInfo(issue.issue_code || issue.issue_id).name}</h4>
                    <p className="text-sm text-slate-600 mt-1">
                      {getIssueInfo(issue.issue_code || issue.issue_id).description}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-semibold px-2 py-1 rounded ${
                      issue.severity === 'severe' ? 'bg-red-200 text-red-800' :
                      issue.severity === 'moderate' ? 'bg-amber-200 text-amber-800' :
                      'bg-yellow-200 text-yellow-800'
                    }`}>
                      {issue.severity === 'severe' ? '严重' :
                       issue.severity === 'moderate' ? '中等' :
                       issue.severity === 'mild' ? '轻微' : '无'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 建议 */}
      {result.detected_issues && result.detected_issues.filter(i => i.severity !== 'none').length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              改善建议
            </h3>
          </div>
          <div className="p-6 space-y-3">
            {result.detected_issues
              .filter(issue => issue.severity !== 'none')
              .map((issue, index) => {
                const recommendations = result.recommendations || [];
                // 直接使用后端返回的issue_code，不进行转换
                const issueCode = issue.issue_code || '';
                const apiRecommendation = recommendations.find((rec) =>
                  rec.issue_code === issueCode && rec.severity_level === issue.severity
                );
                const recommendationText = apiRecommendation?.recommendation_text ||
                  getRecommendationText(issue.issue_id, issue.severity, recommendations);
                const estimatedDays = apiRecommendation?.estimated_improvement_days || 30;
                const issueName = apiRecommendation?.issue_name || getIssueInfo(issueCode).name;

                return (
                  <div key={issue.id} className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-900 mb-1 font-medium">{issueName}</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{recommendationText}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-medium px-2 py-1 rounded bg-indigo-100 text-indigo-700">
                          {apiRecommendation?.recommendation_type === 'daily_habit' ? '日常习惯' :
                           apiRecommendation?.recommendation_type === 'exercise' ? '运动训练' :
                           apiRecommendation?.recommendation_type === 'medical_advice' ? '医疗建议' : '综合建议'}
                        </span>
                        <span className="text-xs text-slate-500">
                          坚持训练{estimatedDays}天可见改善效果
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 重新开始按钮 */}
      <button
        onClick={onRestart}
        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-xl font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
      >
        重新检测
      </button>
    </div>
  );
};

// 拍照角度步骤
const CaptureAngleStep: React.FC<{
  angleConfig: { angle: ViewAngle; label: string; description: string };
  hasPrevious: boolean;
  hasPhoto: boolean;
  onNext: () => void;
  onRetake: () => void;
  onPhotoCapture: (file: File, preview: string) => void;
  totalAngles: number;
  currentIndex: number;
}> = ({ angleConfig, hasPhoto, onNext, onPhotoCapture, totalAngles, currentIndex }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [error, setError] = useState('');

  // 启动摄像头
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          setStream(mediaStream);
        }
      } catch (err: any) {
        setError('无法启动摄像头: ' + err.message);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 拍照
  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const previewUrl = canvas.toDataURL('image/jpeg');
        setPreview(previewUrl);

        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `${angleConfig.angle}.jpg`, { type: 'image/jpeg' });
            onPhotoCapture(file, previewUrl);
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const isLastAngle = currentIndex === totalAngles - 1;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Camera className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-lg font-bold text-white">{angleConfig.label}照片</h2>
              <p className="text-sm text-indigo-100">{angleConfig.description}</p>
            </div>
          </div>
          <div className="text-white text-sm font-medium">
            {currentIndex + 1} / {totalAngles}
          </div>
        </div>
      </div>

      {/* 相机区域 */}
      <div className="relative">
        {!hasPhoto ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto bg-slate-900"
              style={{ minHeight: '400px' }}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* 拍照按钮 */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
              <button
                onClick={handleCapture}
                disabled={!!error}
                className="w-20 h-20 rounded-full bg-white shadow-2xl hover:scale-110 transition-transform flex items-center justify-center border-4 border-indigo-600"
              >
                <Camera className="w-8 h-8 text-indigo-600" />
              </button>
            </div>
          </>
        ) : (
          <div className="relative">
            <img
              src={preview}
              alt={`${angleConfig.label}预览`}
              className="w-full h-auto"
              style={{ minHeight: '400px' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/50 rounded-full p-4">
                <CheckCircle className="w-24 h-24 text-green-500" />
              </div>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* 进度指示器 */}
        <div className="absolute top-4 left-4 right-4 flex justify-center gap-2">
          {Array.from({ length: totalAngles }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i === currentIndex ? 'bg-white scale-125' :
                i < currentIndex ? 'bg-green-400' :
                'bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PostureAssessment;
