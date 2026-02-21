
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// 请求拦截器：自动附加 JWT Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一错误处理
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 未认证：清除 token 并跳转登录
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      if (window.location.hash !== '#/login' && window.location.hash !== '#/register') {
        window.location.hash = '#/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

/**
 * 工具函数：将后端返回的视频文件路径转换为可访问的 URL
 * 后端返回的 file_path 格式为 "uploads/videos/xxx.mp4"
 * 开发模式下 Vite proxy 会代理到后端；生产模式下需要配置 VITE_API_BASE_URL
 */
export function getVideoUrl(filePath: string): string {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  const normalizedPath = filePath.replace(/\\/g, '/');
  // 去掉可能的前导斜杠
  const cleanPath = normalizedPath.replace(/^\/+/, '');
  const base = API_BASE_URL || '';
  return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
}

/**
 * 检查 YOLO 模型加载状态
 */
export async function checkModelStatus(): Promise<{ model_loaded: boolean }> {
  const res = await api.get('/recognize/model-status');
  return res.data;
}
