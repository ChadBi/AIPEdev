
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthState, User, UserRole } from './types';
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
import ScoreHistory from './pages/ScoreHistory';
import UserProfile from './pages/UserProfile';
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

const App: React.FC = () => {
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
          logout();
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
      <Router>
        <Routes>
          <Route path="/login" element={!auth.isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
          <Route path="/register" element={!auth.isAuthenticated ? <RegisterPage /> : <Navigate to="/" />} />
          
          <Route element={<ProtectedRoute isAuthenticated={auth.isAuthenticated} />}>
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
              <Route path="/profile" element={<UserProfile />} />
              <Route path="/users/me" element={<UserProfile />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
};

// Fixed ProtectedRoute: directly using Outlet from react-router-dom to avoid 'require' error
const ProtectedRoute = ({ isAuthenticated }: { isAuthenticated: boolean }) => {
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default App;
