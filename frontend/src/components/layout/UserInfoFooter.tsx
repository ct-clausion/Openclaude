import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

export default function UserInfoFooter() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  if (!user) return null;

  const roleLabel: Record<string, string> = {
    STUDENT: '학생',
    INSTRUCTOR: '강사',
  };

  const initial = user.name.charAt(0).toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div className="p-3 border-t border-slate-300">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
            <p className="text-[11px] text-slate-400">{roleLabel[user.role] ?? user.role}</p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="로그아웃"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
          >
            <h3 className="text-sm font-bold text-slate-800 mb-2">로그아웃</h3>
            <p className="text-sm text-slate-600 mb-5">정말 로그아웃하시겠습니까?</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors"
              >
                로그아웃
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
