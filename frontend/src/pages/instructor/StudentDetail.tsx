import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reviewsApi } from '../../api/reviews';
import { reflectionsApi } from '../../api/reflections';
import { twinApi } from '../../api/twin';
import { useCourseId } from '../../hooks/useCourseId';
import Skeleton from '../../components/common/Skeleton';
import type { ReviewTask, Reflection, StudentTwin } from '../../types';

// ── Helpers ─────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

type Level = 'safe' | 'caution' | 'danger';

function riskLevel(score: number): Level {
  if (score >= 70) return 'danger';
  if (score >= 40) return 'caution';
  return 'safe';
}

function positiveLevel(score: number): Level {
  if (score >= 70) return 'safe';
  if (score >= 40) return 'caution';
  return 'danger';
}

const levelColor: Record<Level, string> = {
  safe: 'bg-emerald-500',
  caution: 'bg-amber-500',
  danger: 'bg-rose-500',
};

const levelText: Record<Level, string> = {
  safe: 'text-emerald-700',
  caution: 'text-amber-700',
  danger: 'text-rose-700',
};

const levelBg: Record<Level, string> = {
  safe: 'bg-emerald-50 border-emerald-200',
  caution: 'bg-amber-50 border-amber-200',
  danger: 'bg-rose-50 border-rose-200',
};

const TREND: Record<string, { icon: string; label: string; cls: string }> = {
  IMPROVING: { icon: '\u2191', label: '개선 중', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  STABLE: { icon: '\u2192', label: '유지', cls: 'text-slate-600 bg-slate-50 border-slate-200' },
  DECLINING: { icon: '\u2193', label: '하락', cls: 'text-rose-600 bg-rose-50 border-rose-200' },
};

// ── Score descriptions ──────────────────────────────────────

interface ScoreConfig {
  key: string;
  label: string;
  description: string;
  value: number;
  inverse?: boolean; // true = high is bad
}

function getScoreVerdict(value: number, inverse?: boolean): string {
  const v = Math.round(value);
  if (inverse) {
    if (v >= 70) return '즉시 관리 필요';
    if (v >= 40) return '주의 관찰 필요';
    return '양호';
  }
  if (v >= 80) return '우수';
  if (v >= 60) return '양호';
  if (v >= 40) return '보강 필요';
  return '기초 부족';
}

function buildScores(twin: StudentTwin): ScoreConfig[] {
  return [
    {
      key: 'mastery',
      label: '이해도',
      description: '성찰일지 자신감, 복습 완료율, 코드 품질을 종합하여 개념 이해 수준을 측정합니다.',
      value: twin.masteryScore,
    },
    {
      key: 'execution',
      label: '수행력',
      description: '복습 과제 실행, 코드 제출 빈도, 챗봇 활용도를 기반으로 실제 학습 실행력을 측정합니다.',
      value: twin.executionScore,
    },
    {
      key: 'motivation',
      label: '동기',
      description: '자신감 점수 추이, 학습 연속일, XP 획득 속도 등 내적 동기 수준을 측정합니다.',
      value: twin.motivationScore,
    },
    {
      key: 'retention',
      label: '망각 위험',
      description: '복습 미수행, 비활동 기간, 코드 오류 빈도로 학습 내용 소실 위험을 측정합니다.',
      value: twin.retentionRiskScore,
      inverse: true,
    },
    {
      key: 'consultation',
      label: '상담 필요도',
      description: '막힌점 빈도, 낮은 자신감, 상담 부재 등으로 강사 개입 필요성을 측정합니다.',
      value: twin.consultationNeedScore,
      inverse: true,
    },
    {
      key: 'overall',
      label: '종합 위험도',
      description: '위 항목들의 가중 평균으로 학생의 전반적인 학습 위험 상태를 나타냅니다.',
      value: twin.overallRiskScore,
      inverse: true,
    },
  ];
}

// ── Score Card ───────────────────────────────────────────────

function ScoreCard({ config }: { config: ScoreConfig }) {
  const v = Math.round(config.value);
  const level = config.inverse ? riskLevel(v) : positiveLevel(v);
  const verdict = getScoreVerdict(v, config.inverse);

  return (
    <div className="rounded-xl bg-white border border-slate-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-800">{config.label}</span>
        <span className={`text-lg font-bold ${levelText[level]}`}>{v}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all ${levelColor[level]}`}
          style={{ width: `${Math.min(v, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${levelBg[level]} ${levelText[level]}`}>
          {verdict}
        </span>
        <span className="text-[10px] text-slate-400">/100</span>
      </div>
      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{config.description}</p>
    </div>
  );
}

// ── AI Analysis Section ─────────────────────────────────────

function AiAnalysisSection({ twin }: { twin: StudentTwin }) {
  const trend = twin.trendDirection ? TREND[twin.trendDirection] : null;
  const updatedDate = formatDateTime(twin.updatedAt);

  return (
    <div className="rounded-2xl bg-white/85 backdrop-blur-[12px] border border-white/60 shadow-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">AI 종합 분석</h2>
        <span className="text-[10px] text-slate-400">마지막 분석: {updatedDate}</span>
      </div>

      {/* AI Insight */}
      {twin.aiInsight ? (
        <div className="rounded-xl bg-indigo-50/70 border border-indigo-200 p-4">
          <p className="text-sm text-indigo-900 leading-relaxed">{twin.aiInsight}</p>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-sm text-slate-500">아직 AI 분석 데이터가 생성되지 않았습니다.</p>
        </div>
      )}

      {/* Trend */}
      {trend && (
        <div className={`flex items-center gap-3 rounded-xl border p-3 ${trend.cls}`}>
          <span className="text-lg font-bold">{trend.icon}</span>
          <div className="flex-1">
            <span className="text-xs font-semibold">{trend.label}</span>
            {twin.trendExplanation && (
              <p className="text-xs mt-0.5 opacity-80">{twin.trendExplanation}</p>
            )}
          </div>
        </div>
      )}

      {/* Data conflicts */}
      {twin.dataConflicts && twin.dataConflicts.length > 0 && (
        <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3">
          <p className="text-[11px] font-semibold text-amber-800 mb-1">데이터 불일치 감지</p>
          <ul className="space-y-0.5">
            {twin.dataConflicts.map((c, i) => (
              <li key={i} className="text-[11px] text-amber-700">{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Score Grid ───────────────────────────────────────────────

function ScoreGrid({ twin }: { twin: StudentTwin }) {
  const scores = buildScores(twin);
  return (
    <div>
      <h2 className="text-sm font-bold text-slate-800 mb-3">점수 상세</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {scores.map((s) => (
          <ScoreCard key={s.key} config={s} />
        ))}
      </div>
    </div>
  );
}

// ── Contextual Evidence ─────────────────────────────────────

function EvidenceSection({
  reviewTasks,
  reflections,
}: {
  reviewTasks: ReviewTask[];
  reflections: Reflection[];
}) {
  const completedTasks = reviewTasks.filter((t) => t.status === 'COMPLETED').length;
  const totalTasks = reviewTasks.length;
  const recentReflections = reflections.slice(0, 5);
  const avgConfidence = recentReflections.length > 0
    ? recentReflections.reduce((sum, r) => sum + r.selfConfidenceScore, 0) / recentReflections.length
    : 0;

  return (
    <div>
      <h2 className="text-sm font-bold text-slate-800 mb-3">근거 데이터</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Review Tasks Summary */}
        <div className="rounded-xl bg-white border border-slate-100 p-4">
          <h3 className="text-xs font-semibold text-slate-700 mb-3">복습 과제 현황</h3>
          {totalTasks > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-700">
                  {completedTasks}/{totalTasks}
                </span>
              </div>
              <div className="space-y-1.5">
                {reviewTasks.slice(0, 5).map((t) => {
                  const badge = STATUS_BADGE[t.status] ?? STATUS_BADGE.PENDING;
                  return (
                    <div key={t.id} className="flex items-center gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${badge.color}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs text-slate-600 truncate">{t.title}</span>
                      <span className="text-[10px] text-slate-400 ml-auto shrink-0">{formatDate(t.scheduledFor)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">복습 과제가 없습니다</p>
          )}
        </div>

        {/* Reflections Summary */}
        <div className="rounded-xl bg-white border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-slate-700">최근 학습 회고</h3>
            {recentReflections.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                평균 자신감 {avgConfidence.toFixed(1)}/5
              </span>
            )}
          </div>
          {recentReflections.length > 0 ? (
            <div className="space-y-2">
              {recentReflections.map((r) => (
                <div key={r.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400">{formatDateTime(r.createdAt)}</span>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className={`text-[10px] ${s <= r.selfConfidenceScore ? 'text-amber-400' : 'text-slate-200'}`}>
                          &#9733;
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{r.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">작성된 회고가 없습니다</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Status Badge ────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  PENDING: { label: '대기', color: 'bg-slate-100 text-slate-600' },
  IN_PROGRESS: { label: '진행', color: 'bg-indigo-100 text-indigo-700' },
  COMPLETED: { label: '완료', color: 'bg-emerald-100 text-emerald-700' },
  SKIPPED: { label: '건너뜀', color: 'bg-rose-100 text-rose-600' },
};

// ── Main Page ───────────────────────────────────────────────

export default function StudentDetail() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const courseId = useCourseId();

  const studentName = (location.state as { studentName?: string })?.studentName ?? '학생';

  const { data: twin, isLoading: twinLoading } = useQuery({
    queryKey: ['instructor', 'student-twin', studentId],
    queryFn: () => twinApi.getStudentTwin(studentId!),
    enabled: !!studentId,
    staleTime: 30_000,
  });

  const { data: reviewTasks = [] } = useQuery({
    queryKey: ['instructor', 'student-reviews', studentId, courseId],
    queryFn: () => reviewsApi.getByStudent(studentId!, courseId!),
    enabled: !!studentId && !!courseId,
    staleTime: 30_000,
  });

  const { data: reflections = [] } = useQuery({
    queryKey: ['instructor', 'student-reflections', studentId],
    queryFn: () => reflectionsApi.getReflections(studentId!),
    enabled: !!studentId,
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <header className="sticky top-[41px] lg:top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
              {studentName.charAt(0)}
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">{studentName}</h1>
              <p className="text-xs text-slate-500">학생 상세 분석</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/instructor/consultations', {
              state: { preselectedStudentId: studentId, preselectedStudentName: studentName },
            })}
            className="ml-auto px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            상담 예약
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {twinLoading && (
          <div className="space-y-3"><Skeleton variant="card" /><Skeleton variant="card" /></div>
        )}

        {!twinLoading && !twin && (
          <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center">
            <p className="text-sm text-slate-500">아직 이 학생의 디지털 트윈 데이터가 생성되지 않았습니다.</p>
            <p className="text-xs text-slate-400 mt-1">학생이 성찰일지를 작성하거나 코드를 제출하면 자동으로 분석이 시작됩니다.</p>
          </div>
        )}

        {twin && (
          <>
            {/* 1. AI 종합 분석 */}
            <AiAnalysisSection twin={twin} />

            {/* 2. 점수 상세 */}
            <ScoreGrid twin={twin} />

            {/* 3. 근거 데이터 */}
            <EvidenceSection reviewTasks={reviewTasks} reflections={reflections} />
          </>
        )}
      </main>
    </div>
  );
}
