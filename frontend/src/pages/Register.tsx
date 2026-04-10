import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [role, setRole] = useState<User['role']>('STUDENT');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, name, role);
      navigate(`/${role.toLowerCase()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('회원가입 실패: ' + msg);
      console.error('Register error:', err);
    } finally {
      setLoading(false);
    }
  };

  const roles: { value: User['role']; label: string; desc: string }[] = [
    { value: 'STUDENT', label: '학생', desc: '학습 및 복습 관리' },
    { value: 'INSTRUCTOR', label: '강사', desc: '커리큘럼 및 상담 관리' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left gradient panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b, #312e81, #1e3a5f)',
        }}
      >
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mx-auto mb-6">
            <span className="text-white text-2xl font-bold">CP</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-4">ClassPulse Twin</h2>
          <p className="text-white/60 leading-relaxed">
            학생별 AI 학습 분신이 최적의 교육 개입 시점을 설계합니다.
            지금 가입하고 시작하세요.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-slate-900">회원가입</h1>
            <p className="text-sm text-slate-500 mt-1">ClassPulse Twin 계정을 생성하세요.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">역할 선택</label>
              <div className="flex gap-2">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border transition-all ${
                      role === r.value
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-300'
                    }`}
                  >
                    <div>{r.label}</div>
                    <div className={`text-[10px] mt-0.5 ${role === r.value ? 'text-white/70' : 'text-slate-400'}`}>
                      {r.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                이름
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                이메일
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@university.ac.kr"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상 입력"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
              />
            </div>

            {/* Password confirm */}
            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-slate-700 mb-1">
                비밀번호 확인
              </label>
              <input
                id="passwordConfirm"
                type="password"
                required
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호를 다시 입력"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-600">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-500/20"
            >
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="text-indigo-600 font-medium hover:text-indigo-700">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
