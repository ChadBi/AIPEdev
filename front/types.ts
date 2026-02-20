
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
  created_at: string;
}

export interface VideoRecord {
  id: number;
  user_id: number;
  filename: string;
  file_path: string;
  fps: number | null;
  total_frames: number | null;
  upload_time: string;
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
  video_id: number;
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
  timestamp: number;
}

// 实时检测配置
export interface LiveDetectionConfig {
  video_id: number;
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
