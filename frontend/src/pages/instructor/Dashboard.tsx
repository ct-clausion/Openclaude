import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import RiskAlertBanner from '../../components/instructor/RiskAlertBanner';
import RiskHeatmap from '../../components/instructor/RiskHeatmap';
import UpcomingConsultationPanel from '../../components/instructor/UpcomingConsultationPanel';
import QuestionReviewPanel from '../../components/instructor/QuestionReviewPanel';
import CourseProgressChart from '../../components/instructor/CourseProgressChart';
import { useAuthStore } from '../../store/authStore';
import { getDisplayInitial } from '../../utils/userDisplay';
import { useCourseId, useCourses } from '../../hooks/useCourseId';
import { instructorApi } from '../../api/instructor';

export default function InstructorDashboard() {
  const { user } = useAuthStore();
  const courseId = useCourseId();
  const { data: courses } = useCourses();
  const currentCourse = courses?.find((c) => String(c.id) === courseId);
  const [showRiskLegend, setShowRiskLegend] = useState(false);
  const displayName = user?.name ?? '강사';

  const { data: students = [] } = useQuery({
    queryKey: ['instructor', 'risk-alerts', courseId],
    queryFn: () => instructorApi.getCourseStudents(courseId!),
    enabled: !!courseId,
    staleTime: 30_000,
  });

  const dangerCount = students.filter((s) => Number(s.overallRiskScore) >= 70).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
              {getDisplayInitial(displayName)}
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">{displayName}님의 대시보드</h1>
              <p className="text-xs text-slate-500">
                {currentCourse ? currentCourse.title : '과정을 선택해주세요'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Risk legend info button */}
            <div className="relative">
              <button
                onClick={() => setShowRiskLegend((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600 hover:bg-slate-200 transition-colors"
                title="위험도 기준 보기"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                위험도 기준
              </button>
              {showRiskLegend && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowRiskLegend(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-white rounded-xl shadow-lg border border-slate-200 p-4">
                    <h4 className="text-xs font-bold text-slate-700 mb-3">학생 위험도 분류 기준</h4>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-sm bg-emerald-200 border border-emerald-300 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-emerald-700">안전</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">위험 점수 &lt; 40 · 정상 학습 상태</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-sm bg-amber-200 border border-amber-300 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-amber-700">주의</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">40 ≤ 위험 점수 &lt; 70 · 모니터링 필요</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-sm bg-rose-200 border border-rose-300 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-rose-700">위험</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">위험 점수 ≥ 70 · 즉시 개입 필요</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
                      위험 점수는 이해도, 동기, 출석, 과제 수행 등을 종합하여 AI가 산출합니다.
                    </p>
                  </div>
                </>
              )}
            </div>

            {dangerCount > 0 && (
              <div className="relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                </span>
                <span className="text-xs font-semibold text-rose-700">
                  위험 학생 {dangerCount}명
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Risk Alert Banner */}
        <RiskAlertBanner />

        {/* Row 1: Heatmap + Upcoming Consultations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <RiskHeatmap />
          </div>
          <div>
            <UpcomingConsultationPanel />
          </div>
        </div>

        {/* Row 2: Question Review + Course Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <QuestionReviewPanel />
          <CourseProgressChart />
        </div>
      </main>
    </div>
  );
}
