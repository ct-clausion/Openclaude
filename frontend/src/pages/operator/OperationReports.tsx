import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { operatorApi } from '../../api/operator';
import GlassCard from '../../components/common/GlassCard';

const summaryKeyLabels: Record<string, string> = {
  totalStudents: '총 수강생',
  totalStudentsAnalyzed: '분석 대상 수강생',
  activeStudents: '활성 수강생',
  atRiskStudents: '위험 수강생',
  decliningStudents: '하락 추세 수강생',
  avgMastery: '평균 숙련도',
  avgMotivation: '평균 동기',
  avgAttendance: '평균 출석률',
  avgAttendanceRate: '평균 출석률',
  totalConsultations: '총 상담 수',
  interventionCount: '개입 횟수',
  completionRate: '수료율',
  activeCourses: '진행 과정',
  totalInstructors: '강사 수',
  avgOverallRisk: '평균 위험도',
  newEnrollments: '신규 등록',
};

const urgencyLabels: Record<string, string> = {
  HIGH: '긴급',
  MEDIUM: '보통',
  LOW: '낮음',
};

export default function OperationReports() {
  const { data: report, isLoading } = useQuery({
    queryKey: ['operator', 'reports', 'weekly'],
    queryFn: operatorApi.getWeeklyReport,
  });

  const { data: effectiveness } = useQuery({
    queryKey: ['operator', 'instructors', 'effectiveness'],
    queryFn: operatorApi.getInstructorEffectiveness,
  });

  const { data: suggestions } = useQuery({
    queryKey: ['operator', 'ai', 'intervention-suggestions'],
    queryFn: operatorApi.getInterventionSuggestions,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">AI 운영 리포트</h1>
        <p className="text-sm text-slate-500 mt-1">강사 횡단 분석 - 강사가 볼 수 없는 비교 인사이트</p>
      </div>

      {/* Instructor Effectiveness Comparison Chart */}
      <GlassCard className="p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4">강사 효과성 비교 (학생 트윈 평균)</h2>
        {(() => {
          // Drop rows where numeric fields are null — recharts silently fails to render
          // a stable domain when mixed with nulls.
          const cleanData = (effectiveness ?? []).map((e) => ({
            ...e,
            avgMastery: e.avgMastery ?? 0,
            avgMotivation: e.avgMotivation ?? 0,
          }));
          return cleanData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cleanData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="avgMastery" name="숙련도" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgMotivation" name="동기" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400">강사 데이터가 없습니다.</p>
        );
        })()}
        {effectiveness && effectiveness.length > 1 && (() => {
          const sorted = [...effectiveness].sort((a, b) => a.avgMastery - b.avgMastery);
          const lowest = sorted[0];
          const highest = sorted[sorted.length - 1];
          if (highest.avgMastery - lowest.avgMastery > 15) {
            return (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-800">
                  <span className="font-bold">AI 인사이트:</span> {lowest.name}의 학생 숙련도 평균({lowest.avgMastery.toFixed(0)})이
                  {highest.name}({highest.avgMastery.toFixed(0)})에 비해 {(highest.avgMastery - lowest.avgMastery).toFixed(0)}점 낮습니다.
                  과정 점검 또는 강사 지원을 권장합니다.
                </p>
              </div>
            );
          }
          return null;
        })()}
      </GlassCard>

      {isLoading ? (
        <p className="text-sm text-slate-400">리포트 로딩 중...</p>
      ) : report ? (
        <>
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900">주간 리포트</h2>
              <span className="text-xs text-slate-400">{report.periodStart} ~ {report.periodEnd}</span>
            </div>
            <div className="text-sm text-slate-700">
              {typeof report.summary === 'string' ? (
                <p>{report.summary}</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(report.summary).map(([key, val]) => (
                    <div key={key} className="p-3 rounded-lg bg-slate-50 text-center">
                      <p className="text-xl font-bold text-slate-800">{typeof val === 'number' ? val.toFixed(1) : String(val)}</p>
                      <p className="text-xs font-medium text-slate-500 mt-1">{summaryKeyLabels[key] ?? key}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>

          {report.anomalies && report.anomalies.length > 0 && (
            <GlassCard className="p-5">
              <h2 className="text-sm font-bold text-slate-900 mb-3">이상 징후 감지</h2>
              <div className="space-y-2">
                {report.anomalies.map((anomaly, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <span className="text-amber-500 mt-0.5">&#9888;</span>
                    <p className="text-sm text-amber-800">{String(anomaly)}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {report.recommendations && report.recommendations.length > 0 && (
            <GlassCard className="p-5">
              <h2 className="text-sm font-bold text-slate-900 mb-3">AI 권장 조치</h2>
              <div className="space-y-2">
                {report.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-indigo-50 border border-indigo-100">
                    <span className="text-indigo-500 mt-0.5">&#10148;</span>
                    <p className="text-sm text-indigo-800">{String(rec)}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </>
      ) : (
        <GlassCard className="p-8 text-center">
          <p className="text-slate-400">아직 생성된 리포트가 없습니다.</p>
        </GlassCard>
      )}

      {suggestions && suggestions.length > 0 && (
        <GlassCard className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">AI 개입 제안 큐</h2>
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800">{s.studentName}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      s.urgency === 'HIGH' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>{urgencyLabels[s.urgency] ?? s.urgency}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{s.courseTitle}</p>
                  <p className="text-xs text-indigo-600 mt-1">{s.suggestedAction}</p>
                </div>
                <p className="text-sm text-slate-500 max-w-[200px] text-right">{s.expectedImpact}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
