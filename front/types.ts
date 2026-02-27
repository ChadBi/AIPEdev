
export enum UserRole {
  USER = 'user'
}

export interface User {
  id: number;
  username: string;
  role: UserRole;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
}

export interface Action {
  id: number;
  name: string;
  description: string;
  video_path?: string; // Standard video path
  keypoints: any;
  music_id?: number | null;
  sync_offset_ms?: number;
  is_aligned?: boolean;
  created_at: string;
}

export interface VideoRecord {
  id: number;
  user_id: number;
  filename?: string; // backward-compatible optional field
  file_path: string;
  fps: number | null;
  total_frames: number | null;
  upload_time?: string; // backward-compatible optional field
  created_at: string;
}

export interface ScoreResponse {
  score_id: number;
  action_id: number;
  video_id: number | null;
  standard_video_path: string | null;
  user_video_path: string | null;
  student_video_delay: number;
  total_score: number;
  joint_scores: {
    [key: string]: number;
  };
  frame_scores: Array<{
    frame_index: number;
    score: number;
    timestamp: number;
  }>;
  feedback: string[];
}

export interface ScoreHistoryItem {
  id: number;
  action_id: number;
  action_name: string;
  total_score: number;
  joint_scores: {
    [key: string]: number;
  };
  feedback: string[];
  is_live: boolean;
  created_at: string;
}

// ========== 音乐模块类型 ==========

export interface Music {
  id: number;
  name: string;
  file_path: string;
  duration_seconds: number | null;
  file_size: number | null;
  is_default: boolean;
  uploaded_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface MusicListResponse {
  items: Music[];
  total: number;
}

export interface SyncConfig {
  id: number;
  video_id: number;
  music_id: number;
  sync_offset_ms: number;
  is_manually_aligned: boolean;
  alignment_note: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface SyncAlignRequest {
  video_id: number;
  music_id: number;
  sync_offset_ms: number;
  alignment_note?: string;
}

export interface SyncAlignResponse {
  sync_config_id: number;
  video_id: number;
  music_id: number;
  sync_offset_ms: number;
  video_time_at_aligned: number;
  music_time_at_aligned: number;
  message: string;
}

export interface ActionMusicSyncLookup {
  action_id: number;
  music_id: number;
  sync_offset_ms: number;
  is_aligned: boolean;
  alignment_note: string | null;
  has_sync_config: boolean;
}

export interface ActionMusicSyncAlignRequest {
  action_id: number;
  music_id: number;
  sync_offset_ms: number;
  alignment_note?: string;
}

export interface ActionMusicSyncOut {
  id: number;
  action_id: number;
  music_id: number;
  sync_offset_ms: number;
  is_aligned: boolean;
  alignment_note: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ActionMusicSyncListItem {
  music_id: number;
  music_name: string;
  music_file_path: string;
  sync_offset_ms: number;
  is_aligned: boolean;
  has_sync_config: boolean;
}

// 包含同步信息的视频类型
export interface VideoWithSync {
  id: number;
  user_id: number;
  file_path: string;
  fps: number | null;
  total_frames: number | null;
  music_id: number | null;
  sync_config_id: number | null;
  created_at: string;
  music_name: string | null;
  music_file_path: string | null;
  sync_offset_ms: number | null;
  is_aligned: boolean;
}

// ========== 实时检测模块类型 ==========

// 姿态关键点（单帧）
export interface Keypoints {
  [key: string]: [number, number, number]; // [x, y, confidence]
}

// 实时帧数据
export interface LiveFrame {
  frame_index: number;
  timestamp: number; // 相对于开始的时间（秒）
  keypoints: Keypoints;
}

// 实时评分结果
export interface LiveScore {
  timestamp: number;
  current_score: number;
  average_score: number;
  completion_rate: number;
  frame_scores: number[];
}

// 实时会话状态
export interface LiveSession {
  action_id: number;
  music_id: number | null;
  sync_offset_ms: number;
  is_aligned: boolean;
  start_time: number | null;
  current_frame_index: number;
  is_playing: boolean;
  is_paused: boolean;
}

// WebSocket 消息类型
export interface WSMessage {
  type: 'frame' | 'score' | 'error' | 'status' | 'pong';
  data: any;
  timestamp: number | string;
}

// 实时检测配置
export interface LiveDetectionConfig {
  action_id: number;
  camera_device_id: string | null;
  enable_audio: boolean;
  sync_offset_ms: number;
}

// 摄像头设备信息
export interface CameraDevice {
  deviceId: string;
  label: string;
  kind: 'videoinput' | 'audioinput';
}

// 实时检测统计
export interface LiveStats {
  fps: number;
  frames_processed: number;
  latency_ms: number;
  current_score: number;
  average_score: number;
  music_playing: boolean;
  music_volume: number;
}

export interface LiveActionConfig {
  action_id: number;
  music_id: number | null;
  sync_offset_ms: number;
  is_aligned: boolean;
}

export interface LiveResultFrame {
  timestamp: number;
  score: number;
}

export interface LiveResultData {
  score_id?: number;
  action_id: number;
  action_name: string;
  music_id: number | null;
  music_name: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  total_score: number;
  current_score: number;
  average_score: number;
  frames_processed: number;
  display_fps: number;
  latency_ms: number;
  frame_scores: LiveResultFrame[];
}

export interface LiveScoreSavePayload {
  action_id: number;
  music_id: number | null;
  music_name: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  total_score: number;
  current_score: number;
  average_score: number;
  frames_processed: number;
  display_fps: number;
  latency_ms: number;
  frame_scores: Array<{
    frame_index: number;
    score: number;
    timestamp: number;
  }>;
}

export interface LiveWsScorePayload {
  current_score: number;
  average_score: number;
  completion_rate: number;
  frame_index: number;
  elapsed_ms: number;
  processed_frames: number;
  music_time_ms: number;
}

// ========== 体态检测模块类型 ==========

// 评估类型
export enum AssessmentType {
  BASELINE = 'baseline',
  ROUTINE = 'routine',
  PRE_TRAINING = 'pre_training'
}

// 视角类型
export enum ViewAngle {
  FRONT = 'front',
  LEFT_SIDE = 'left_side',
  RIGHT_SIDE = 'right_side',
  BACK = 'back'
}

// 严重程度
export enum Severity {
  NONE = 'none',
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe'
}

// 体态评估响应（格式：后端返回的完整数据库对象）
export interface PostureAssessmentResponse {
  assessment: PostureAssessmentRecord;
  photos: PosturePhotoRecord[];
  metrics: PostureMetricsRecord;
  detected_issues: PostureAssessmentIssueRecord[];
  overall_score: number;
  issue_codes: string[];
  severity_summary: {
    none: number;
    mild: number;
    moderate: number;
    severe: number;
  };
  timestamp: string;
  recommendations?: PostureRecommendationRecord[]; // 数据库驱动的建议
}

// 体态评估记录（数据库模型）
export interface PostureAssessmentRecord {
  id: number;
  user_id: number;
  assessment_type: AssessmentType;
  assessment_date: string;
  overall_score: number | null;
  age: number | null;
  height: number | null;
  weight: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// 照片记录（数据库模型）
export interface PosturePhotoRecord {
  id: number;
  assessment_id: number;
  view_angle: ViewAngle;
  photo_path: string | null;
  thumbnail_path: string | null;
  keypoints: Record<string, any> | null;
  confidence_score: number | null;
  image_width: number | null;
  image_height: number | null;
  capture_quality_score: number | null;
  created_at: string;
}

// 指标记录（数据库模型）
export interface PostureMetricsRecord {
  id: number;
  assessment_id: number;
  body_balance: number | null;
  spinal_alignment: number | null;
  shoulder_balance: number | null;
  hip_alignment: number | null;
  head_neck_angle: number | null;
  spine_curvature_front: number | null;
  spine_curvature_side: number | null;
  pelvis_tilt_angle: number | null;
  skeletal_symmetry: number | null;
  posture_stability: number | null;
  depth_estimates: Record<string, any> | null;
  created_at: string;
}

// 检测问题记录（数据库模型）
export interface PostureAssessmentIssueRecord {
  id: number;
  assessment_id: number;
  issue_id: number;
  severity: Severity;
  detected_value: number | null;
  threshold_value: number | null;
  score_impact: number;
  evidence_data: Record<string, any> | null;
  created_at: string;
}

// 体态指标
export interface PostureMetrics {
  body_balance: number;
  spinal_alignment: number;
  shoulder_balance: number;
  hip_alignment: number;
  head_neck_angle: number;
  spine_curvature_front: number;
  spine_curvature_side: number;
  pelvis_tilt_angle: number;
  skeletal_symmetry: number;
  posture_stability: number;
}

// 检测到的体态问题
export interface PostureIssueDetected {
  code: string;
  name: string;
  severity: string;
  description: string;
  value: number;
  threshold: number;
}

// 改善建议
export interface PostureRecommendation {
  type: string;
  text: string;
  priority: number;
  estimated_days: number;
}

// 改善建议记录（数据库模型）
export interface PostureRecommendationRecord {
  id: number;
  issue_code: string;
  issue_name: string;
  severity_level: string;
  recommendation_type: string;
  recommendation_text: string;
  priority: number;
  estimated_improvement_days: number;
  related_exercises: any | null;
  is_active: boolean;
  created_at: string;
}

// 照片信息
export interface PosturePhotoInfo {
  angle: string;
  path: string;
  quality: number;
}

// 评分分解
export interface ScoreBreakdown {
  base_score: number;
  metric_contributors: MetricContributor[];
  total_deduction: number;
  issue_deductions: IssueDeduction[];
  final_score: number;
}

export interface MetricContributor {
  metric: string;
  score: number;
  weight: number;
  contribution: number;
}

export interface IssueDeduction {
  issue: string;
  deduction: number;
}

// 历史记录项
export interface PostureHistoryItem {
  id: number;
  user_id: number;
  assessment_date: string;
  overall_score: number | null;
  assessment_type: AssessmentType;
  age: number | null;
  height: number | null;
  weight: number | null;
  notes: string | null;
  photo_count: number;
  issue_count: number;
  severe_issue_count: number;
  created_at: string;
  updated_at: string;
}

// 历史记录列表响应
export interface PostureHistoryList {
  items: PostureHistoryItem[];
  total: number;
  skip: number;
  limit: number;
}

// 体态趋势数据
export interface PostureTrendData {
  id: number;
  user_id: number;
  baseline_score: number | null;
  baseline_date: string | null;
  current_score: number | null;
  current_date: string | null;
  trend_direction: string | null;
  improvement_percentage: number | null;
  total_assessments: number;
  last_assessment_date: string | null;
  active_issues_count: number;
  created_at: string;
  updated_at: string;
}

// 体态趋势响应
export interface PostureTrendResponse {
  trend: PostureTrendData;
  history: PostureHistoryItem[];
}

// 详细评估报告
export interface DetailedAssessmentReport {
  assessment: {
    id: number;
    date: string;
    type: string;
    overall_score: number | null;
  };
  photos: Array<{
    angle: string;
    path: string;
    keypoints: any;
    confidence: number | null;
  }>;
  metrics: PostureMetrics;
  issues: Array<{
    code: number;
    severity: string;
    detected_value: number | null;
    threshold: number | null;
    score_impact: number | null;
  }>;
  baseline_comparison: BaselineComparison | null;
  evaluation: {
    evaluation: string;
    description: string;
    color: string;
    icon: string;
  };
}

export interface BaselineComparison {
  has_baseline: boolean;
  baseline_score: number;
  current_score: number;
  difference: number;
  percent_change: number;
  trend: string;
  message: string;
}

// 拍照流程状态
export type CaptureStep = 'guide' | 'front' | 'left_side' | 'right_side' | 'back' | 'analyzing' | 'result';

// 拍照数据
export interface PhotoCapture {
  angle: ViewAngle;
  file: File;
  preview: string;
}
