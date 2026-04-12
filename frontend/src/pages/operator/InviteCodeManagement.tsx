import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';

interface InviteCode {
  id: number;
  code: string;
  createdByName: string | null;
  isUsed: boolean;
  usedByName: string | null;
  expiresAt: string;
  createdAt: string;
  usedAt: string | null;
}

export default function InviteCodeManagement() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expiryDays, setExpiryDays] = useState(7);

  const fetchCodes = useCallback(async () => {
    try {
      const data = await api.get<InviteCode[]>('/api/operator/invite-codes');
      setCodes(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.post('/api/operator/invite-codes', { expiryDays });
      await fetchCodes();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/operator/invite-codes/${id}`);
      setCodes((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // ignore
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  const getStatusBadge = (code: InviteCode) => {
    if (code.isUsed) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">사용됨</span>;
    }
    if (isExpired(code.expiresAt)) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">만료</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600">활성</span>;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">초대 코드 관리</h1>
        <p className="text-sm text-slate-500 mt-1">운영자 계정 가입을 위한 초대 코드를 생성하고 관리합니다.</p>
      </div>

      {/* Create section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-800 mb-3">새 초대 코드 생성</h2>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">유효 기간</label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(Number(e.target.value))}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value={1}>1일</option>
              <option value={3}>3일</option>
              <option value={7}>7일</option>
              <option value={14}>14일</option>
              <option value={30}>30일</option>
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 disabled:opacity-50 transition-colors"
          >
            {creating ? '생성 중...' : '코드 생성'}
          </button>
        </div>
      </div>

      {/* Code list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">초대 코드 목록</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">불러오는 중...</div>
        ) : codes.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">생성된 초대 코드가 없습니다.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-100">
                <th className="text-left px-5 py-2 font-medium">코드</th>
                <th className="text-left px-5 py-2 font-medium">상태</th>
                <th className="text-left px-5 py-2 font-medium">생성자</th>
                <th className="text-left px-5 py-2 font-medium">사용자</th>
                <th className="text-left px-5 py-2 font-medium">만료일</th>
                <th className="text-left px-5 py-2 font-medium">생성일</th>
                <th className="text-right px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <tr key={code.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <span className="font-mono text-sm font-bold text-slate-900 tracking-wider">{code.code}</span>
                  </td>
                  <td className="px-5 py-3">{getStatusBadge(code)}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{code.createdByName ?? '-'}</td>
                  <td className="px-5 py-3 text-sm text-slate-600">{code.usedByName ?? '-'}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{formatDate(code.expiresAt)}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{formatDate(code.createdAt)}</td>
                  <td className="px-5 py-3 text-right">
                    {!code.isUsed && (
                      <button
                        onClick={() => handleDelete(code.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
