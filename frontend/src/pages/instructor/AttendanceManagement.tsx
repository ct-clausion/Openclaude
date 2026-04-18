import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { instructorApi } from '../../api/instructor';
import GlassCard from '../../components/common/GlassCard';
import Skeleton from '../../components/common/Skeleton';
import { useConfirm } from '../../hooks/useConfirm';

export default function AttendanceManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, confirmNode } = useConfirm();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [newSessionTitle, setNewSessionTitle] = useState('');

  const { data: courses, isLoading: coursesLoading, isError: coursesError } = useQuery({
    queryKey: ['instructor', 'attendance', 'courses'],
    queryFn: instructorApi.getAttendanceCourses,
  });

  const { data: sessions } = useQuery({
    queryKey: ['instructor', 'attendance', 'sessions', selectedCourseId],
    queryFn: () => instructorApi.getAttendanceSessions(selectedCourseId!),
    enabled: !!selectedCourseId,
  });

  const { data: records } = useQuery({
    queryKey: ['instructor', 'attendance', 'records', selectedSessionId],
    queryFn: () => instructorApi.getAttendanceRecords(selectedSessionId!),
    enabled: !!selectedSessionId,
  });

  const { data: stats } = useQuery({
    queryKey: ['instructor', 'attendance', 'stats', selectedCourseId],
    queryFn: () => instructorApi.getAttendanceStats(selectedCourseId!),
    enabled: !!selectedCourseId,
  });

  const bulkMutation = useMutation({
    mutationFn: instructorApi.bulkUpdateAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'attendance', 'records'] });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'attendance', 'stats'] });
      toast.success('출결을 저장했습니다.');
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: instructorApi.createAttendanceSession,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'attendance', 'sessions'] });
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

  const handleMarkAllPresent = async () => {
    if (!records) return;
    const ok = await confirm({
      title: '전원 출석 표시',
      message: `${records.length}명 전원을 '출석'으로 표시합니다.\n저장 전에 개별 조정이 가능합니다.`,
      confirmLabel: '전원 출석',
    });
    if (!ok) return;
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
        <p className="text-sm text-slate-500 mt-1">내 과정의 수업 세션 출결 관리 및 통계</p>
      </div>

      {/* 과정 선택 */}
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

      {/* 통계 */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-extrabold text-slate-900">{stats.totalSessions}</p>
            <p className="text-xs text-slate-500">총 세션</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className={`text-2xl font-extrabold ${stats.avgAttendanceRate < 0.8 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {(stats.avgAttendanceRate * 100).toFixed(0)}%
            </p>
            <p className="text-xs text-slate-500">평균 출석률</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-2xl font-extrabold text-slate-900">{stats.studentStats?.length ?? 0}</p>
            <p className="text-xs text-slate-500">수강생 수</p>
          </GlassCard>
        </div>
      )}

      {/* 출결 기록 */}
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
                  <div className="flex gap-1">
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleStatusChange(r.studentId, opt.value)}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
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

      {/* 세션 추가 */}
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

      {coursesLoading && (
        <GlassCard className="p-8 text-center">
          <Skeleton variant="card" />
        </GlassCard>
      )}

      {coursesError && (
        <GlassCard className="p-8 text-center">
          <p className="text-rose-600 font-medium mb-2">과정 목록을 불러올 수 없습니다.</p>
          <p className="text-sm text-slate-500">네트워크 연결을 확인하거나 다시 시도해주세요.</p>
        </GlassCard>
      )}

      {!coursesLoading && !coursesError && courses && courses.length === 0 && (
        <GlassCard className="p-8 text-center">
          <p className="text-slate-600 font-medium mb-2">등록된 과정이 없습니다.</p>
          <p className="text-sm text-slate-400 mb-4">과정을 먼저 생성한 후 출결 관리를 시작하세요.</p>
          <button
            onClick={() => navigate('/instructor/courses/new')}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
          >
            과정 생성하기
          </button>
        </GlassCard>
      )}

      {!selectedCourseId && courses && courses.length > 0 && (
        <GlassCard className="p-8 text-center">
          <p className="text-slate-400">과정을 선택하면 출결 관리를 시작할 수 있습니다.</p>
        </GlassCard>
      )}
      {confirmNode}
    </div>
  );
}
