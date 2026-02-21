import api from '../api';

// 音乐相关 API

export interface MusicUploadParams {
  file: File;
  name?: string;
}

// 上传音乐
export async function uploadMusic(params: MusicUploadParams): Promise<any> {
  const formData = new FormData();
  formData.append('file', params.file);
  if (params.name) {
    formData.append('name', params.name);
  }

  const response = await api.post('/music/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

// 获取音乐列表
export async function getMusicList(skip = 0, limit = 100): Promise<any> {
  const response = await api.get('/music/', { params: { skip, limit } });
  return response.data;
}

// 获取当前用户的音乐
export async function getMyMusic(skip = 0, limit = 100): Promise<any> {
  const response = await api.get('/music/me', { params: { skip, limit } });
  return response.data;
}

// 获取单个音乐详情
export async function getMusic(musicId: number): Promise<any> {
  const response = await api.get(`/music/${musicId}`);
  return response.data;
}

// 更新音乐
export async function updateMusic(musicId: number, data: { name?: string; is_default?: boolean }): Promise<any> {
  const response = await api.put(`/music/${musicId}`, data);
  return response.data;
}

// 删除音乐
export async function deleteMusic(musicId: number): Promise<void> {
  await api.delete(`/music/${musicId}`);
}

// 工具函数：获取音乐 URL
export function getMusicUrl(filePath: string): string {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  // 音乐文件存储在 uploads/music/ 目录下
  const normalizedPath = filePath.replace(/\\/g, '/');
  const cleanPath = normalizedPath.replace(/^\/+/, '');
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  return baseUrl ? `${baseUrl}/${cleanPath}` : `/${cleanPath}`;
}
