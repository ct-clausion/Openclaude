import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorApi } from '../../api/operator';
import GlassCard from '../../components/common/GlassCard';

export default function AttendanceManagement() {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [newSessionTitle, setNewSessionTitle] = useState('');

  const { data: courses } = useQuery({
    queryKey: ['operator', 'courses'],
    queryFn: operatorApi.getCourses,
  });

  const { data: sessions } = useQuery({
    queryKey: ['operator', 'sessions', selectedCourseId],
    queryFn: () => operatorApi.getSessions(selectedCourseId!),
    enabled: !!selectedCourseId,
  });

  const { data: records } = useQuery({
    queryKey: ['operator', 'attendance', selectedSessionId],
    queryFn: () => operatorApi.getAttendanceRecords(selectedSessionId!),
    enabled: !!selectedSessionId,
  });

  const { data: stats } = useQuery({
    queryKey: ['operator', 'attendance-stats', selectedCourseId],
    queryFn: () => operatorApi.getAttendanceStats(selectedCourseId!),
    enabled: !!selectedCourseId,
  });

  const bulkMutation = useMutation({
    mutationFn: operatorApi.bulkUpdateAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'attendance'] });
      queryClient.invalidateQueries({ queryKey: ['operator', 'attendance-stats'] });
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: operatorApi.createSession,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'sessions'] });
      setShowNewSession(false);
      setNewSessionTitle('');
      if (data?.id) setSelectedSessionId(data.id);
    },
  });

  const [localRecords, setLocalRecords] = useState<Record<string, string>>({});

  const handleStatusChange = (studentId: string, status: string) => {
    setLocalRecords((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleBulkSave = () => {
    if (!selectedSessionId) return;
    const updates = Object.entries(localRecords).map(([studentId, status]) => ({
      sessionId: selectedSessionId,
      studentId,
      status,
    }));
    if (updates.length > 0) {
      bulkMutation.mutate(updates);
      setLocalRecords({});
    }
  };

  const handleMarkAllPresent = () => {
    if (!records) return;
    // Explicit confirm — rare, bulk, and easy to mis-click from the toolbar.
    // (Users can still tweak individual rows before Save, but this flags intent.)
    if (!window.confirm(`${records.length}명 전원을 '출석'으로 표시하시겠습니까?`)) return;
    const all: Record<string, string> = {};
    records.forEach((r) => { all[r.studentId] = 'PRESENT'; });
    setLocalRecords(all);
  };

  const statusOptions = [
    { value: 'PRESENT', label: '출석', color: 'bg-emerald-100 text-emerald-700' },
    { value: 'LATE', label: '지각', color: 'bg-amber-100 text-amber-700' },
    { value: 'ABSENT', label: '결석', color: 'bg-rose-100 text-rose-700' },
    { value: 'EXCUSED', label: '공결', color: 'bg-sky-100 text-sky-700' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">출결 관리</h1>
        <p className="text-sm text-slate-500 mt-1">과정별 수업 세션 출결 관리 및 통계</p>
      </div>

      {/* Course selector */}
      <div className="flex gap-4 items-end">
        <div className="flex-1 max-w-xs">
          <label className="block text-sm font-medium text-slate-700 mb-1">과정 선택</label>
          <select
            value={selectedCourseId ?? ''}
            onChange={(e) => { setSelectedCourseId(e.target.value || null); setSelectedSessionId(null); }}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
          >
            <option value="">과정을 선택하세요</option>
            {courses?.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {selectedCourseId && sessions && (
          <div className="flex-1 max-w-xs">
            <label className="block text-sm font-medium text-slate-700 mb-1">수업 세션</label>
            <select
              value={selectedSessionId ?? ''}
              onChange={(e) => setSelectedSessionId(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="">세션을 선택하세요</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.sessionDate} - {s.title ?? `#${s.sessionNumber}`}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-extrabold text-slate-900">{stats.totalSessions}</p>
            <p className="text-xs text-slate-500">총 세션</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className={`text-2xl font-extrabold ${(stats.avgAttendanceRate ?? 0) < 0.8 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {((stats.avgAttendanceRate ?? 0) * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-slate-500">평균 출석률</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-extrabold text-slate-900">{stats.studentStats?.length ?? 0}</p>
            <p className="text-xs text-slate-500">수강생 수</p>
          </GlassCard>
        </div>
      )}

      {/* Attendance records */}
      {selectedSessionId && records && (
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">출결 체크</h2>
            <div className="flex gap-2">
              <button
                onClick={handleMarkAllPresent}
                className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-200 transition-colors"
              >
                전체 출석
              </button>
              <button
                onClick={handleBulkSave}
                disabled={Object.keys(localRecords).length === 0 || bulkMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                저장
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {records.map((r) => {
              const currentStatus = localRecords[r.studentId] ?? r.status;
              return (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <p className="text-sm font-medium text-slate-800">{r.studentName ?? `수강생 #${r.studentId}`}</p>
                  <div className="flex gap-1 flex-wrap">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleStatusChange(r.studentId, opt.value)}
                        className={`px-2 sm:px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          currentStatus === opt.value
                            ? opt.color + ' ring-2 ring-offset-1 ring-current'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* New session form */}
      {selectedCourseId && (
        <div className="flex items-center gap-2">
          {!showNewSession ? (
            <button
              onClick={() => setShowNewSession(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              + 세션 추가
            </button>
          ) : (
            <GlassCard className="p-4 flex gap-3 items-end w-full">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">날짜</label>
                <input
                  type="date"
                  value={newSessionDate}
                  onChange={(e) => setNewSessionDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">제목 (선택)</label>
                <input
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="예: 3주차 실습"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <button
                onClick={() => createSessionMutation.mutate({
                  courseId: selectedCourseId,
                  sessionDate: newSessionDate,
                  title: newSessionTitle || undefined,
                })}
                disabled={createSessionMutation.isPending}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                생성
              </button>
              <button
                onClick={() => setShowNewSession(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium"
              >
                취소
              </button>
            </GlassCard>
          )}
        </div>
      )}

      {!selectedCourseId && (
        <GlassCard className="p-8 text-center">
          <p className="text-slate-400">과정을 선택하면 출결 관리를 시작할 수 있습니다.</p>
        </GlassCard>
      )}
    </div>
  );
}
