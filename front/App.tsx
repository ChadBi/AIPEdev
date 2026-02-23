import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate
} from 'react-router-dom';
import { AuthState, User } from './types';
import api from './api';

// Pages
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import Dashboard from './pages/Dashboard';
import ActionLibrary from './pages/ActionLibrary';
import ActionDetail from './pages/ActionDetail';
import ActionForm from './pages/ActionForm';
import VideoLibrary from './pages/VideoLibrary';
import VideoUpload from './pages/VideoUpload';
import ScoringPage from './pages/Scoring';
import ScoreResult from './pages/ScoreResult';
import LiveScoreResult from './pages/LiveScoreResult';
import ScoreHistory from './pages/ScoreHistory';
import UserProfile from './pages/UserProfile';
import MusicLibrary from './pages/MusicLibrary';
import SyncAlign from './pages/SyncAlign';
import LiveScoring from './pages/LiveScoring';
import Layout from './components/Layout';

// Auth Context
interface AuthContextType {
  auth: AuthState;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// Protected Route Component
const ProtectedRoute: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const { auth } = useAuth();
  return auth.isAuthenticated ? children || <Outlet /> : <Navigate to="/login" replace />;
};

const AppContent: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({
    token: localStorage.getItem('access_token'),
    user: null,
    isAuthenticated: !!localStorage.getItem('access_token'),
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (auth.token) {
        try {
          const res = await api.get('/users/me');
          setAuth(prev => ({ ...prev, user: res.data, isAuthenticated: true }));
        } catch (err) {
          console.error("Auth verify failed", err);
          // 清除无效的token
          localStorage.removeItem('access_token');
          setAuth({ token: null, user: null, isAuthenticated: false });
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, [auth.token]);

  const login = (token: string, user: User) => {
    localStorage.setItem('access_token', token);
    setAuth({ token, user, isAuthenticated: true });
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setAuth({ token: null, user: null, isAuthenticated: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      <Routes>
        <Route path="/login" element={!auth.isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/register" element={!auth.isAuthenticated ? <RegisterPage /> : <Navigate to="/" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/actions" element={<ActionLibrary />} />
            <Route path="/actions/create" element={<ActionForm />} />
            <Route path="/actions/:id" element={<ActionDetail />} />
            <Route path="/actions/:id/edit" element={<ActionForm />} />
            <Route path="/videos" element={<VideoLibrary />} />
            <Route path="/videos/upload" element={<VideoUpload />} />
            <Route path="/scores" element={<ScoringPage />} />
            <Route path="/scores/result/:id" element={<ScoreResult />} />
            <Route path="/scores/history" element={<ScoreHistory />} />
            <Route path="/scores/live" element={<LiveScoring />} />
            <Route path="/scores/live/result" element={<LiveScoreResult />} />
            <Route path="/scores/live/result/:id" element={<LiveScoreResult />} />
            <Route path="/music" element={<MusicLibrary />} />
            <Route path="/sync-align" element={<SyncAlign />} />
            <Route path="/sync/align" element={<SyncAlign />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/users/me" element={<UserProfile />} />
          </Route>
        </Route>
      </Routes>
    </AuthContext.Provider>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;