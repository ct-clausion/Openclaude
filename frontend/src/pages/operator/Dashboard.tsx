import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { operatorApi } from '../../api/operator';
import GlassCard from '../../components/common/GlassCard';

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <GlassCard className="p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${accent ?? 'text-slate-900'}`}>{value}</p>
    </GlassCard>
  );
}

function TrendArrow({ trend }: { trend: string }) {
  if (trend === 'IMPROVING') return <span className="text-emerald-500 text-sm font-bold">&#9650;</span>;
  if (trend === 'DECLINING') return <span className="text-rose-500 text-sm font-bold">&#9660;</span>;
  return <span className="text-slate-400 text-sm font-bold">&#8212;</span>;
}

export default function OperatorDashboard() {
  const navigate = useNavigate();
  const { data: summary } = useQuery({
    queryKey: ['operator', 'dashboard', 'summary'],
    queryFn: operatorApi.getDashboardSummary,
  });

  const { data: courseTwins } = useQuery({
    queryKey: ['operator', 'dashboard', 'course-twins'],
    queryFn: operatorApi.getCourseTwins,
  });

  const { data: riskAlerts } = useQuery({
    queryKey: ['operator', 'dashboard', 'risk-alerts'],
    queryFn: operatorApi.getRiskAlerts,
  });

  const { data: workload } = useQuery({
    queryKey: ['operator', 'instructors', 'workload'],
    queryFn: operatorApi.getInstructorWorkload,
  });

  const { data: pendingActions } = useQuery({
    queryKey: ['operator', 'dashboard', 'pending-actions'],
    queryFn: operatorApi.getPendingActions,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">교육 운영 대시보드</h1>
        <p className="text-sm text-slate-500 mt-1">강사 횡단 관리 - 과정 간 비교와 운영 의사결정</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard label="진행중 과정" value={summary?.activeCourses ?? '-'} />
        <StatCard label="총 수강생" value={summary?.totalStudents ?? '-'} />
        <StatCard label="강사" value={summary?.totalInstructors ?? '-'} />
        <StatCard label="이탈 위험군" value={summary?.atRiskStudents ?? '-'} accent="text-rose-600" />
        <StatCard
          label="오늘 출석률"
          value={summary?.todayAttendanceRate != null ? `${(summary.todayAttendanceRate * 100).toFixed(0)}%` : '-'}
          accent={summary?.todayAttendanceRate != null && summary.todayAttendanceRate < 0.8 ? 'text-amber-600' : 'text-emerald-600'}
        />
      </div>

      {/* Pending Actions Banner */}
      {pendingActions && (pendingActions.pendingCourses > 0 || pendingActions.pendingInterventions > 0) && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
          <p className="text-sm font-bold text-indigo-800">
            승인 대기: 과정 {pendingActions.pendingCourses}건, 개입 지시 {pendingActions.pendingInterventions}건
          </p>
        </div>
      )}

      {/* Course Twin Chart + Instructor Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Course Twin Bar Chart */}
        <GlassCard className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">과정 트윈 - 과정 간 건강도 비교</h2>
          {courseTwins && courseTwins.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={courseTwins} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="courseTitle"
                  tick={{ fontSize: 10 }}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                />
                <Bar dataKey="healthScore" name="건강 점수" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">과정 트윈 데이터가 아직 없습니다.</p>
          )}
        </GlassCard>

        {/* Instructor Workload Summary */}
        <GlassCard className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">강사 업무 부하</h2>
          {workload && workload.length > 0 ? (
            <div className="space-y-3">
              {workload.map((inst) => {
                const pct = Math.min(inst.workloadScore, 100);
                const barColor =
                  pct >= 90 ? 'bg-rose-500'
                  : pct >= 70 ? 'bg-orange-400'
                  : pct >= 50 ? 'bg-amber-400'
                  : pct >= 30 ? 'bg-sky-400'
                  : 'bg-emerald-400';
                return (
                  <div key={inst.id} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700 w-20 truncate">{inst.name}</span>
                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-24 text-right font-medium">
                      {inst.studentCount}/{inst.totalCapacity ?? '?'}명
                    </span>
                    <span className={`text-xs font-bold w-10 text-right ${pct >= 90 ? 'text-rose-600' : pct >= 70 ? 'text-orange-600' : 'text-slate-500'}`}>
                      {pct.toFixed(0)}%
                    </span>
                    {inst.isOverloaded && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">과부하</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400">강사 데이터가 없습니다.</p>
          )}
        </GlassCard>
      </div>

      {/* Risk Alerts */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">이탈 위험 알림 (강사에게 지시 필요)</h2>
          <button
            onClick={() => navigate('/operator/intervention')}
            className="text-xs text-indigo-600 font-medium hover:text-indigo-700 transition-colors"
          >
            개입 지시 센터 &rarr;
          </button>
        </div>
        {riskAlerts && riskAlerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {riskAlerts.slice(0, 10).map((alert, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-2">
                  <TrendArrow trend={alert.trend} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{alert.studentName}</p>
                    <p className="text-xs text-slate-400">{alert.courseTitle}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  alert.overallRisk >= 80 ? 'bg-rose-100 text-rose-700'
                  : alert.overallRisk >= 60 ? 'bg-orange-100 text-orange-700'
                  : alert.overallRisk >= 40 ? 'bg-amber-100 text-amber-700'
                  : alert.overallRisk >= 20 ? 'bg-sky-100 text-sky-700'
                  : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {Math.round(alert.overallRisk)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">현재 이탈 위험 수강생이 없습니다.</p>
        )}
      </GlassCard>
    </div>
  );
}
