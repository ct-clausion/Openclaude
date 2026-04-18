import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { operatorApi } from '../../api/operator';
import GlassCard from '../../components/common/GlassCard';
import Skeleton from '../../components/common/Skeleton';

export default function InstructorAnalysis() {
  const { data: effectiveness, isLoading: effLoading } = useQuery({
    queryKey: ['operator', 'instructors', 'effectiveness'],
    queryFn: operatorApi.getInstructorEffectiveness,
  });

  const { data: workload, isLoading: wlLoading } = useQuery({
    queryKey: ['operator', 'instructors', 'workload'],
    queryFn: operatorApi.getInstructorWorkload,
  });

  const isLoading = effLoading || wlLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">강사 효과성 분석</h1>
        <p className="text-sm text-slate-500 mt-1">강사 간 성과 비교 및 업무 부하 균형 분석 - 강사가 볼 수 없는 횡단 비교</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton variant="card" />
          <Skeleton variant="chart" />
        </div>
      ) : (
        <>
          {/* Workload Balance */}
          <GlassCard className="p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4">업무 부하 균형</h2>
            {workload && workload.length > 0 ? (
              <div className="space-y-3">
                {workload.map((inst) => {
                  const cap = inst.totalCapacity ?? 1;
                  const fillPct = cap > 0 ? Math.min(Math.round((inst.studentCount / cap) * 100), 100) : 0;
                  const barColor =
                    fillPct >= 90 ? 'bg-rose-500'
                    : fillPct >= 70 ? 'bg-orange-400'
                    : fillPct >= 50 ? 'bg-amber-400'
                    : fillPct >= 30 ? 'bg-sky-400'
                    : 'bg-emerald-400';
                  const pctColor =
                    fillPct >= 90 ? 'text-rose-600'
                    : fillPct >= 70 ? 'text-orange-600'
                    : 'text-slate-500';
                  return (
                    <div key={inst.id} className="flex items-center gap-4">
                      <div className="w-24 text-sm font-medium text-slate-800 truncate">{inst.name}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${fillPct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold w-10 ${pctColor}`}>
                            {fillPct}%
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-3 text-xs text-slate-500">
                        <span>{inst.studentCount}/{cap}명</span>
                        <span>상담 {inst.consultationCount}</span>
                        <span>과정 {inst.courseCount}</span>
                      </div>
                      {inst.isOverloaded && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">과부하</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400">강사 데이터가 없습니다.</p>
            )}
          </GlassCard>

          {/* Performance Comparison Chart */}
          <GlassCard className="p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4">학생 성과 비교 (강사별 평균 Twin 점수)</h2>
            {effectiveness && effectiveness.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={effectiveness} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="avgMastery" name="숙련도" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgMotivation" name="동기" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">비교할 강사 데이터가 없습니다.</p>
            )}
          </GlassCard>

          {/* Detailed Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {effectiveness?.map((inst) => (
              <GlassCard key={inst.id} className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">{inst.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{inst.name}</p>
                    <p className="text-xs text-slate-400">과정 {inst.courseCount}개 | 학생 {inst.studentCount}명</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-blue-50 text-center">
                    <p className="text-lg font-bold text-blue-700">{inst.avgMastery.toFixed(0)}</p>
                    <p className="text-[10px] text-blue-500">평균 숙련도</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 text-center">
                    <p className="text-lg font-bold text-amber-700">{inst.avgMotivation.toFixed(0)}</p>
                    <p className="text-[10px] text-amber-500">평균 동기</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 text-center">
                    <p className="text-lg font-bold text-slate-700">{inst.consultationCount}</p>
                    <p className="text-[10px] text-slate-500">총 상담</p>
                  </div>
                  <div className={`p-2 rounded-lg text-center ${inst.atRiskStudentCount > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                    <p className={`text-lg font-bold ${inst.atRiskStudentCount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {inst.atRiskStudentCount}
                    </p>
                    <p className={`text-[10px] ${inst.atRiskStudentCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>위험 학생</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
