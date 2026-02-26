import api from '../api';
import {
  PostureAssessmentResponse,
  AssessmentType,
  ViewAngle,
  PostureHistoryList,
  PostureTrendResponse,
  DetailedAssessmentReport,
  PostureTrendData
} from '../types';

/**
 * 体态检测API接口
 */

/**
 * 执行体态检测评估
 * @param photos - 不同角度的照片文件 {angle: File}
 * @param type - 评估类型
 * @param userInfo - 用户信息 {age, height, weight}
 * @param notes - 备注
 */
export async function assessPosture(
  photos: Record<string, File>,
  type: AssessmentType = AssessmentType.ROUTINE,
  userInfo?: { age?: number; height?: number; weight?: number },
  notes?: string
): Promise<PostureAssessmentResponse> {
  console.log('=== assessPosture 函数开始 ===');
  console.log('📸 接收到的照片参数:', Object.keys(photos));
  console.log('📊 评估类型:', type);

  const formData = new FormData();

  // 添加各个角度的照片（确保所有4个角度都上传）
  console.log('🔍 检查必需的照片...');

  if (!photos.front) {
    console.error('❌ 缺少正面照片');
    throw new Error('缺少正面照片');
  }
  console.log('✅ 正面照片存在');

  if (!photos.left_side) {
    console.error('❌ 缺少左侧面照片');
    throw new Error('缺少左侧面照片');
  }
  console.log('✅ 左侧面照片存在');

  if (!photos.right_side) {
    console.error('❌ 缺少右侧面照片');
    throw new Error('缺少右侧面照片');
  }
  console.log('✅ 右侧面照片存在');

  if (!photos.back) {
    console.error('❌ 缺少背面照片');
    throw new Error('缺少背面照片');
  }
  console.log('✅ 背面照片存在');

  console.log('📝 添加照片到FormData...');
  formData.append('front_photo', photos.front);
  console.log('✅ 正面照片已添加, 大小:', photos.front.size, 'bytes');

  formData.append('left_side_photo', photos.left_side);
  console.log('✅ 左侧面照片已添加, 大小:', photos.left_side.size, 'bytes');

  formData.append('right_side_photo', photos.right_side);
  console.log('✅ 右侧面照片已添加, 大小:', photos.right_side.size, 'bytes');

  formData.append('back_photo', photos.back);
  console.log('✅ 背面照片已添加, 大小:', photos.back.size, 'bytes');

  // 添加评估类型
  formData.append('assessment_type', type);
  console.log('✅ 评估类型已添加:', type);

  // 添加用户信息
  if (userInfo) {
    console.log('👤 用户信息:', userInfo);
    if (userInfo.age) {
      formData.append('age', userInfo.age.toString());
      console.log('✅ 年龄已添加:', userInfo.age);
    }
    if (userInfo.height) {
      formData.append('height', userInfo.height.toString());
      console.log('✅ 身高已添加:', userInfo.height);
    }
    if (userInfo.weight) {
      formData.append('weight', userInfo.weight.toString());
      console.log('✅ 体重已添加:', userInfo.weight);
    }
  }

  // 添加备注
  if (notes) {
    formData.append('notes', notes);
    console.log('✅ 备注已添加:', notes);
  }

  console.log('🚀 开始发送API请求...');
  console.log('API端点:', '/posture/assess');

  try {
    const res = await api.post('/posture/assess', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('✅ API请求成功, 状态码:', res.status);
    console.log('📊 响应数据:', res.data);
    return res.data;
  } catch (error) {
    console.error('❌ API请求失败:', error);
    throw error;
  }
}

/**
 * 单张图片骨架分析（调试用）
 * @param image - 图片文件
 * @param angle - 视角类型
 */
export async function analyzeSingleSkeleton(
  image: File,
  angle: ViewAngle = ViewAngle.FRONT
) {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('view_angle', angle);

  const res = await api.post('/posture/skeleton/analyze', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return res.data;
}

/**
 * 获取体态检测历史记录
 * @param skip - 跳过记录数
 * @param limit - 返回记录数
 * @param type - 评估类型筛选
 */
export async function getPostureHistory(
  skip: number = 0,
  limit: number = 10,
  type?: AssessmentType
): Promise<PostureHistoryList> {
  const params: any = { skip, limit };
  if (type) params.assessment_type = type;

  const res = await api.get('/posture/history', { params });
  return res.data;
}

/**
 * 获取体态趋势数据
 * @param period - 时间周期 (1month/3months/6months/1year/2years)
 */
export async function getPostureTrends(
  period: string = '6months'
): Promise<PostureTrendResponse> {
  const res = await api.get('/posture/trends', { params: { period } });
  return res.data;
}

/**
 * 获取详细评估报告
 * @param assessmentId - 评估记录ID
 */
export async function getDetailedReport(
  assessmentId: number
): Promise<DetailedAssessmentReport> {
  const res = await api.get(`/posture/report/${assessmentId}`);
  return res.data;
}

/**
 * 设置基准体态
 * @param assessmentId - 要设为基准的评估ID
 */
export async function setBaselinePosture(assessmentId: number): Promise<{
  success: boolean;
  message: string;
  assessment_id: number;
  score: number | null;
}> {
  const res = await api.post('/posture/baseline', { assessment_id: assessmentId });
  return res.data;
}

/**
 * 获取用户最新的体态检测记录
 * @param type - 评估类型筛选
 */
export async function getLatestAssessment(type?: AssessmentType): Promise<{
  exists: boolean;
  assessment_id?: number;
  assessment_date?: string;
  overall_score?: number;
  assessment_type?: string;
  is_stale?: boolean;
  days_since_last?: number;
  message?: string;
}> {
  const params: any = {};
  if (type) params.assessment_type = type;

  const res = await api.get('/posture/latest', { params });
  return res.data;
}

/**
 * 获取启用的体态问题规则列表
 */
export async function getActiveIssueRules(): Promise<{
  issues: Array<{
    code: string;
    name: string;
    description: string;
    weight: number;
    detection_angles: string[];
    severity_levels: string[];
  }>;
}> {
  const res = await api.get('/posture/issues/active');
  return res.data;
}

/**
 * 获取体态照片URL
 * @param filePath - 照片文件路径
 * @returns 照片的完整URL
 */
export function getPosturePhotoUrl(filePath: string): string {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const normalizedPath = filePath.replace(/\\/g, '/');
  const cleanPath = normalizedPath.replace(/^\//, '');
  return API_BASE_URL ? `${API_BASE_URL}/${cleanPath}` : `/${cleanPath}`;
}

const postureApi = {
  assessPosture,
  analyzeSingleSkeleton,
  getPostureHistory,
  getPostureTrends,
  getDetailedReport,
  setBaselinePosture,
  getLatestAssessment,
  getActiveIssueRules,
  getPosturePhotoUrl
};

export default postureApi;
