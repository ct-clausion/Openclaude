import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { ROLE_LABELS, getDisplayInitial } from '../utils/userDisplay';

export default function Profile() {
  const { user } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  if (!user) return null;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    setPwLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.status === 401) {
        setPwError('현재 비밀번호가 올바르지 않습니다.');
        return;
      }
      if (!res.ok) {
        setPwError('비밀번호 변경에 실패했습니다. 다시 시도해주세요.');
        return;
      }
      setPwSuccess('비밀번호가 변경되었습니다.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPwError('비밀번호 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <h1 className="text-base font-bold text-slate-800">내 정보</h1>
          <p className="text-xs text-slate-500">프로필 및 비밀번호 관리</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-5">
        {/* Profile info card */}
        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">프로필 정보</h2>
          <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {getDisplayInitial(user.name)}
              </div>
            <div>
              <p className="text-base font-bold text-slate-800">{user.name}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
              <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500">이름</span>
              <span className="text-sm text-slate-800 font-medium">{user.name}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500">이메일</span>
              <span className="text-sm text-slate-800">{user.email}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500">역할</span>
              <span className="text-sm text-slate-800">{ROLE_LABELS[user.role] ?? user.role}</span>
            </div>
          </div>
        </div>

        {/* Password change card */}
        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">비밀번호 변경</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">현재 비밀번호</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="현재 비밀번호 입력"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">새 비밀번호</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6자 이상 입력"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">새 비밀번호 확인</label>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호를 다시 입력"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>

            {pwError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-600">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
                {pwSuccess}
              </div>
            )}

            <button
              type="submit"
              disabled={pwLoading}
              className="w-full py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {pwLoading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
