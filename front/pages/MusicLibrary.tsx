import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMusicList, deleteMusic, uploadMusic, getMusicUrl } from '../api/music';
import { Music } from '../types';
import {
  Music as MusicIcon,
  Upload,
  Trash2,
  Play,
  Pause,
  Search,
  X,
  FileAudio,
  Clock,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

const MusicLibrary: React.FC = () => {
  const [musicList, setMusicList] = useState<Music[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [playingMusicId, setPlayingMusicId] = useState<number | null>(null);
  const [audio] = useState(() => new Audio());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMusicList();
  }, []);

  useEffect(() => {
    const handleEnded = () => setPlayingMusicId(null);
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [audio]);

  const fetchMusicList = async () => {
    try {
      const data = await getMusicList();
      setMusicList(data.items || []);
    } catch (err: any) {
      setError('加载音乐列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac'];
    const allowedExts = ['.mp3', '.wav', '.ogg', '.flac'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExts.includes(fileExt)) {
      setError('只支持 MP3、WAV、OGG、FLAC 格式的音频文件');
      return;
    }

    // 文件大小限制 50MB
    if (file.size > 50 * 1024 * 1024) {
      setError('文件大小不能超过 50MB');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      await uploadMusic({ file, name: file.name.replace(/\.[^/.]+$/, '') });
      setSuccess('音乐上传成功！');
      fetchMusicList();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || '上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePlay = (music: Music) => {
    if (playingMusicId === music.id) {
      audio.pause();
      setPlayingMusicId(null);
    } else {
      const url = getMusicUrl(music.file_path);
      audio.src = url;
      audio.play();
      setPlayingMusicId(music.id);
    }
  };

  const handleDelete = async (musicId: number) => {
    if (!confirm('确定要删除这首音乐吗？')) return;

    try {
      await deleteMusic(musicId);
      setMusicList(prev => prev.filter(m => m.id !== musicId));
      if (playingMusicId === musicId) {
        audio.pause();
        setPlayingMusicId(null);
      }
    } catch (err: any) {
      setError('删除失败，请重试');
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '--';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredMusic = musicList.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">音乐库</h1>
          <p className="text-slate-500">管理健美操音乐，支持上传、播放和删除</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Upload size={20} />
          上传音乐
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".mp3,.wav,.ogg,.flac,audio/mpeg,audio/wav,audio/ogg"
          className="hidden"
        />
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
          <AlertCircle size={20} />
          {error}
          <button onClick={() => setError('')} className="ml-auto">
            <X size={20} />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-600">
          <CheckCircle2 size={20} />
          {success}
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-3">
            <FileAudio className="w-8 h-8 text-indigo-600" />
            <div className="flex-1">
              <p className="font-semibold text-slate-900">上传中...</p>
              <p className="text-sm text-slate-500">请稍候</p>
            </div>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="搜索音乐..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Music Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredMusic.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center">
          <MusicIcon className="mx-auto text-slate-300 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            {searchTerm ? '未找到相关音乐' : '暂无音乐'}
          </h3>
          <p className="text-slate-500">
            {searchTerm ? '请尝试其他搜索关键词' : '上传音乐文件开始使用'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMusic.map((music) => (
            <div
              key={music.id}
              className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <MusicIcon className="w-7 h-7 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{music.name}</h3>
                    <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {formatDuration(music.duration_seconds)}
                      </span>
                      <span>{formatSize(music.file_size)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  <button
                    onClick={() => handlePlay(music)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-100 transition-colors"
                  >
                    {playingMusicId === music.id ? (
                      <>
                        <Pause size={18} />
                        暂停
                      </>
                    ) : (
                      <>
                        <Play size={18} />
                        播放
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(music.id)}
                    className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    title="删除音乐"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {music.is_default && (
                <div className="px-6 py-2 bg-amber-50 border-t border-amber-100">
                  <span className="text-xs font-semibold text-amber-600">默认音乐</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MusicLibrary;
