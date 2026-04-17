import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ConsultationActionCard from '../../components/student/ConsultationActionCard';
import { consultationsApi } from '../../api/consultations';
import { coursesApi } from '../../api/courses';
import type { Consultation, ActionPlan, Course } from '../../types';

const PLAN_STATUS_STYLES: Record<
  string,
  { icon: string; color: string; bg: string }
> = {
  COMPLETED: {
    icon: '✓',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  IN_PROGRESS: {
    icon: '◐',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  PENDING: {
    icon: '○',
    color: 'text-slate-400',
    bg: 'bg-slate-50',
  },
};

function parseActionPlans(con: Consultation): ActionPlan[] {
  // actionPlanJson can be a string or already-parsed array from the backend
  const raw = con.actionPlanJson;
  if (Array.isArray(raw)) return raw as unknown as ActionPlan[];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}

const ConsultationPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [editingConsultationId, setEditingConsultationId] = useState<string | null>(null);

  // Fetch enrolled courses
  const { data: enrollments = [] } = useQuery<
    { enrollmentId: number; courseId: number; studentId: number; status: string }[]
  >({
    queryKey: ['my-enrollments'],
    queryFn: () => coursesApi.getMyEnrollments(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ['courses'],
    queryFn: () => coursesApi.getCourses(),
    staleTime: 5 * 60 * 1000,
  });

  const activeCourseIds = enrollments
    .filter((e) => e.status === 'ACTIVE')
    .map((e) => e.courseId.toString());
  const enrolledCourses = courses.filter((c) => activeCourseIds.includes(c.id));

  // Auto-select first enrolled course
  const courseId = selectedCourseId ?? activeCourseIds[0] ?? undefined;

  const { data: consultations, isLoading } = useQuery<Consultation[]>({
    queryKey: ['consultations', 'student', courseId],
    queryFn: () => consultationsApi.getConsultations('student', courseId),
    enabled: !!courseId,
  });

  const [rejectModal, setRejectModal] = useState<{ id: string; title?: string } | null>(null);
  const [rejectedMessage, setRejectedMessage] = useState(false);

  const requestMutation = useMutation({
    mutationFn: () => consultationsApi.requestConsultation({
      courseId: Number(courseId),
      message: requestReason || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      setShowRequestForm(false);
      setRequestReason('');
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: () => consultationsApi.updateNotes(editingConsultationId!, requestReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      setShowRequestForm(false);
      setRequestReason('');
      setEditingConsultationId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (consultationId: string) => consultationsApi.rejectConsultation(consultationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      setRejectModal(null);
      setRejectedMessage(true);
      setTimeout(() => setRejectedMessage(false), 3000);
    },
  });

  const pastConsultations = (consultations ?? []).filter((c) => c.status === 'COMPLETED');
  const requestedConsultations = (consultations ?? []).filter((c) => c.status === 'REQUESTED');
  const existingRequest = requestedConsultations[0] ?? null;
  const hasActiveRequest = !!existingRequest;
  const scheduledConsultations = (consultations ?? []).filter((c) => c.status === 'SCHEDULED');
  const rejectedConsultations = (consultations ?? []).filter((c) => c.status === 'REJECTED');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-[41px] lg:top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">상담 관리</h1>
            <p className="text-xs text-slate-500">
              강사 상담 일정과 실행 계획을 확인하세요
            </p>
          </div>
          <div className="flex items-center gap-2">
            {enrolledCourses.length > 1 && (
              <select
                value={courseId ?? ''}
                onChange={(e) => setSelectedCourseId(e.target.value || null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
              >
                {enrolledCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
            {courseId && (
              <button
                onClick={() => {
                  if (showRequestForm) {
                    setShowRequestForm(false);
                    setEditingConsultationId(null);
                    setRequestReason('');
                  } else {
                    if (hasActiveRequest) {
                      setEditingConsultationId(existingRequest.id);
                      setRequestReason(existingRequest.notes ?? '');
                    } else {
                      setEditingConsultationId(null);
                      setRequestReason('');
                    }
                    setShowRequestForm(true);
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showRequestForm
                    ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    : hasActiveRequest
                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {showRequestForm ? '취소' : hasActiveRequest ? '요청 수정' : '상담 요청'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Request form */}
        {showRequestForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-5 ${editingConsultationId ? 'bg-amber-50 border border-amber-200' : 'bg-indigo-50 border border-indigo-200'}`}
          >
            <h3 className={`text-sm font-bold mb-2 ${editingConsultationId ? 'text-amber-800' : 'text-indigo-800'}`}>
              {editingConsultationId ? '상담 요청 수정' : '강사에게 상담 요청'}
            </h3>
            <textarea
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="상담을 요청하는 이유를 입력하세요 (선택사항)"
              rows={3}
              className={`w-full px-4 py-2.5 rounded-lg bg-white text-sm resize-none mb-3 border ${editingConsultationId ? 'border-amber-200' : 'border-indigo-200'}`}
            />
            <div className="flex gap-2">
              <button
                onClick={() => editingConsultationId ? updateNotesMutation.mutate() : requestMutation.mutate()}
                disabled={requestMutation.isPending || updateNotesMutation.isPending}
                className={`px-6 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-50 transition-colors ${
                  editingConsultationId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {(requestMutation.isPending || updateNotesMutation.isPending)
                  ? '처리 중...'
                  : editingConsultationId ? '수정 완료' : '상담 요청 보내기'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Requested consultations */}
        {requestedConsultations.length > 0 && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
            <h3 className="text-sm font-bold text-amber-800 mb-2">요청 대기 중인 상담</h3>
            {requestedConsultations.map((c) => (
              <div key={c.id} className="flex items-center gap-2 py-1">
                <span className="text-xs font-medium text-amber-800">
                  {c.courseTitle ?? '과정'}
                </span>
                <span className="text-xs text-amber-600">
                  {c.instructorName ? `${c.instructorName} 강사님` : '강사'} 에게 요청
                </span>
                {c.notes && (
                  <span className="text-xs text-amber-500 truncate max-w-[200px]">
                    — {c.notes}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Scheduled consultations - with reject option */}
        {scheduledConsultations.length > 0 && (
          <div className="rounded-2xl bg-indigo-50 border border-indigo-200 p-5">
            <h3 className="text-sm font-bold text-indigo-800 mb-3">예정된 상담</h3>
            <div className="space-y-2">
              {scheduledConsultations.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-indigo-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.courseTitle ?? '과정'}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(c.scheduledAt).toLocaleDateString('ko-KR', {
                        month: 'short', day: 'numeric', weekday: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => setRejectModal({ id: c.id, title: c.courseTitle })}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    거절
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejected consultations */}
        {rejectedConsultations.length > 0 && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-5">
            <h3 className="text-sm font-bold text-rose-800 mb-2">거절된 상담</h3>
            <div className="space-y-2">
              {rejectedConsultations.map((c) => (
                <div key={c.id} className="rounded-xl bg-white border border-rose-100 p-3">
                  <p className="text-xs font-medium text-rose-700">
                    {c.courseTitle ?? '과정'} — 거절됨
                  </p>
                  {c.rejectionReason && (
                    <p className="text-xs text-slate-600 mt-1.5 pl-3 border-l-2 border-rose-200">
                      {c.rejectionReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming consultations card */}
        <ConsultationActionCard />

        {/* Past consultations detail */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 mb-5">
            지난 상담 기록
          </h2>

          {isLoading && (
            <p className="text-sm text-slate-400 text-center py-6">불러오는 중...</p>
          )}

          {!isLoading && pastConsultations.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">지난 상담 기록이 없습니다.</p>
          )}

          <div className="space-y-6">
            {pastConsultations.map((con, i) => {
              const actionPlans = parseActionPlans(con);
              const completedPlans = actionPlans.filter(
                (p) => p.status === 'COMPLETED',
              ).length;
              const totalPlans = actionPlans.length;
              const completionRate =
                totalPlans > 0
                  ? Math.round((completedPlans / totalPlans) * 100)
                  : 0;

              return (
                <motion.div
                  key={con.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="border border-slate-100 rounded-xl p-5"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                        완료
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(con.scheduledAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      실행률 {completionRate}%
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-slate-700 leading-relaxed mb-4">
                    {con.summaryText}
                  </p>

                  {/* Action Plan Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-600">
                        실행 계획 ({completedPlans}/{totalPlans})
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                    <div className="space-y-2">
                      {actionPlans.map((plan, j) => {
                        const style =
                          PLAN_STATUS_STYLES[plan.status] ??
                          PLAN_STATUS_STYLES.PENDING;
                        return (
                          <div
                            key={j}
                            className={`flex items-center gap-3 rounded-lg p-2.5 ${style.bg}`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${style.color} bg-white`}
                            >
                              {style.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-xs font-medium ${
                                  plan.status === 'COMPLETED'
                                    ? 'text-slate-400 line-through'
                                    : 'text-slate-700'
                                }`}
                              >
                                {plan.title}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                기한:{' '}
                                {new Date(plan.dueDate).toLocaleDateString(
                                  'ko-KR',
                                  { month: 'short', day: 'numeric' },
                                )}{' '}
                                | 우선순위: {plan.priority}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Reject confirmation modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
          >
            <h3 className="text-sm font-bold text-slate-800 mb-2">상담 거절</h3>
            <p className="text-sm text-slate-600 mb-5">
              <span className="font-semibold text-slate-800">{rejectModal.title ?? '해당'}</span>
              {' 과목 상담을 거절하시겠습니까?'}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => rejectMutation.mutate(rejectModal.id)}
                disabled={rejectMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-50"
              >
                {rejectMutation.isPending ? '처리 중...' : '거절'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Rejected success toast */}
      {rejectedMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 bg-rose-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          거절되었습니다
        </div>
      )}
    </div>
  );
};

export default ConsultationPage;
