
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
