import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { instructorApi, type EnrollmentEntry } from '../../api/instructor';
import { useCourses } from '../../hooks/useCourseId';

const statusConfig: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '대기', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACTIVE: { label: '승인', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: '거절', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function Enrollments() {
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [tab, setTab] = useState<'PENDING' | 'ALL'>('PENDING');
  const [confirm, setConfirm] = useState<{ action: 'approve' | 'reject'; entry: EnrollmentEntry } | null>(null);

  // Auto-select first course
  const courseId = selectedCourseId ?? courses[0]?.id?.toString() ?? null;

  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['instructor', 'enrollments', courseId, 'PENDING'],
    queryFn: () => instructorApi.getEnrollments(courseId!, 'PENDING'),
    enabled: !!courseId,
    staleTime: 15_000,
  });

  const { data: all = [], isLoading: allLoading } = useQuery({
    queryKey: ['instructor', 'enrollments', courseId, 'ALL'],
    queryFn: () => instructorApi.getEnrollments(courseId!),
    enabled: !!courseId && tab === 'ALL',
    staleTime: 15_000,
  });

  const approveMut = useMutation({
    mutationFn: (enrollmentId: number) => instructorApi.approveEnrollment(courseId!, enrollmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'enrollments', courseId] });
      queryClient.invalidateQueries({ queryKey: ['instructor', 'students', courseId] });
      setConfirm(null);
    },
  });

  const rejectMut = useMutation({
    mutationFn: (enrollmentId: number) => instructorApi.rejectEnrollment(courseId!, enrollmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'enrollments', courseId] });
      setConfirm(null);
    },
  });

  const items = tab === 'PENDING' ? pending : all;
  const loading = tab === 'PENDING' ? pendingLoading : allLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-800">수강 승인</h1>
            <p className="text-xs text-slate-500">
              {courseId ? `대기 중 ${pending.length}건` : '과정을 선택하세요'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Course Selector */}
            {courses.length > 0 && (
              <select
                value={courseId ?? ''}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
            {/* Tab Toggle */}
            <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-300 p-1">
              <button
                onClick={() => setTab('PENDING')}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  tab === 'PENDING' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                대기 중
              </button>
              <button
                onClick={() => setTab('ALL')}
                className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  tab === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                전체
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {coursesLoading && (
          <p className="text-sm text-slate-400 text-center py-12">불러오는 중...</p>
        )}

        {!coursesLoading && !courseId && (
          <p className="text-sm text-slate-400 text-center py-12">등록된 과정이 없습니다</p>
        )}

        {courseId && loading && (
          <p className="text-sm text-slate-400 text-center py-12">불러오는 중...</p>
        )}

        {courseId && !loading && items.length === 0 && (
          <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-12 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="text-2xl">
                {tab === 'PENDING' ? '✅' : '📋'}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-2">
              {tab === 'PENDING' ? '대기 중인 신청이 없습니다' : '수강 신청 이력이 없습니다'}
            </h3>
            <p className="text-sm text-slate-500">
              {tab === 'PENDING' ? '학생이 수강 신청하면 여기에 표시됩니다' : '아직 수강 신청한 학생이 없습니다'}
            </p>
          </div>
        )}

        {courseId && !loading && items.length > 0 && (
          <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">학생</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">이메일</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500">신청일</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500">상태</th>
                  {tab === 'PENDING' && (
                    <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500">처리</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((e: EnrollmentEntry) => {
                  const cfg = statusConfig[e.status] ?? statusConfig.PENDING;
                  return (
                    <tr key={e.enrollmentId} className="border-b border-slate-50 hover:bg-indigo-50/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
                            {e.studentName.charAt(0)}
                          </div>
                          <span className="font-medium text-slate-800">{e.studentName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{e.studentEmail}</td>
                      <td className="px-5 py-3.5 text-center text-xs text-slate-500">{formatDate(e.enrolledAt)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </td>
                      {tab === 'PENDING' && (
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setConfirm({ action: 'approve', entry: e })}
                              disabled={approveMut.isPending}
                              className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => setConfirm({ action: 'reject', entry: e })}
                              disabled={rejectMut.isPending}
                              className="px-3 py-1 text-xs font-medium rounded-lg border border-rose-300 text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                            >
                              거절
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Confirm Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
          >
            <h3 className="text-sm font-bold text-slate-800 mb-2">
              {confirm.action === 'approve' ? '수강 승인' : '수강 거절'}
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              <span className="font-semibold text-slate-800">{confirm.entry.studentName}</span>
              {confirm.action === 'approve'
                ? ' 학생의 수강을 승인하시겠습니까?'
                : ' 학생의 수강 신청을 거절하시겠습니까?'}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (confirm.action === 'approve') {
                    approveMut.mutate(confirm.entry.enrollmentId);
                  } else {
                    rejectMut.mutate(confirm.entry.enrollmentId);
                  }
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
                  confirm.action === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-500 hover:bg-rose-600'
                }`}
              >
                {confirm.action === 'approve' ? '승인' : '거절'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
