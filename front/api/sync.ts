import api from '../api';
import {
  ActionMusicSyncAlignRequest,
  ActionMusicSyncListItem,
  ActionMusicSyncLookup,
  ActionMusicSyncOut,
  VideoWithSync,
} from '../types';

// 同步配置相关 API

// 手动对齐
export async function syncAlign(params: {
  video_id: number;
  music_id: number;
  sync_offset_ms: number;
  alignment_note?: string;
}): Promise<any> {
  const response = await api.post('/sync/align', params);
  return response.data;
}

// 动作-音乐组合对齐保存
export async function alignActionMusic(params: ActionMusicSyncAlignRequest): Promise<ActionMusicSyncOut> {
  const response = await api.post('/sync/action-music/align', params);
  return response.data;
}

// 查询动作-音乐组合对齐
export async function getActionMusicSync(actionId: number, musicId: number): Promise<ActionMusicSyncLookup> {
  const response = await api.get('/sync/action-music', {
    params: { action_id: actionId, music_id: musicId },
  });
  return response.data;
}

// 查询动作可用音乐及对齐状态
export async function listActionMusicSync(actionId: number): Promise<ActionMusicSyncListItem[]> {
  const response = await api.get('/sync/action-music/list', {
    params: { action_id: actionId },
  });
  return response.data || [];
}

// 获取视频的同步配置
export async function getSyncConfig(videoId: number): Promise<any> {
  const response = await api.get(`/sync/video/${videoId}`);
  return response.data;
}

// 创建同步配置
export async function createSyncConfig(params: {
  video_id: number;
  music_id: number;
  sync_offset_ms?: number;
  is_manually_aligned?: boolean;
  alignment_note?: string;
}): Promise<any> {
  const response = await api.post('/sync/', params);
  return response.data;
}

// 更新同步配置
export async function updateSyncConfig(syncId: number, params: {
  music_id?: number;
  sync_offset_ms?: number;
  is_manually_aligned?: boolean;
  alignment_note?: string;
}): Promise<any> {
  const response = await api.put(`/sync/${syncId}`, params);
  return response.data;
}

// 删除同步配置
export async function deleteSyncConfig(syncId: number): Promise<void> {
  await api.delete(`/sync/${syncId}`);
}

// 获取同步配置列表
export async function listSyncConfigs(skip = 0, limit = 100): Promise<any> {
  const response = await api.get('/sync/list', { params: { skip, limit } });
  return response.data;
}

// 获取视频详情（包含同步信息）
export async function getVideoWithSync(videoId: number): Promise<VideoWithSync> {
  const response = await api.get(`/videos/${videoId}`);
  return response.data;
}
