import { useQuery } from '@tanstack/react-query';
import { operatorApi } from '../../api/operator';
import GlassCard from '../../components/common/GlassCard';
import Skeleton from '../../components/common/Skeleton';

function RiskBadge({ risk }: { risk: number }) {
  const color = risk >= 80 ? 'bg-rose-100 text-rose-700' : risk >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{Math.round(risk)}%</span>;
}

export default function StudentManagement() {
  const { data: students, isLoading } = useQuery({
    queryKey: ['operator', 'students'],
    queryFn: operatorApi.getStudents,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">수강생 관리</h1>
        <p className="text-sm text-slate-500 mt-1">전체 수강생 현황 및 Twin 위험도 모니터링</p>
      </div>

      {isLoading ? (
        <Skeleton variant="table" rows={6} />
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="relative overflow-x-auto">
          <div className="md:hidden text-[11px] text-slate-400 px-4 pt-3">← 가로로 스크롤하세요</div>
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-4 font-semibold text-slate-600">이름</th>
                <th className="text-left p-4 font-semibold text-slate-600">이메일</th>
                <th className="text-left p-4 font-semibold text-slate-600">과정</th>
                <th className="text-center p-4 font-semibold text-slate-600">위험도</th>
                <th className="text-center p-4 font-semibold text-slate-600">추세</th>
                <th className="text-center p-4 font-semibold text-slate-600">출석률</th>
              </tr>
            </thead>
            <tbody>
              {students?.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-900">{s.name}</td>
                  <td className="p-4 text-slate-500">{s.email}</td>
                  <td className="p-4 text-slate-700">{s.courseTitle}</td>
                  <td className="p-4 text-center"><RiskBadge risk={s.overallRisk} /></td>
                  <td className="p-4 text-center">
                    {s.trend === 'IMPROVING' ? <span className="text-emerald-500 font-bold">&#9650;</span>
                      : s.trend === 'DECLINING' ? <span className="text-rose-500 font-bold">&#9660;</span>
                      : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="p-4 text-center">
                    <span className={s.attendanceRate < 0.8 ? 'text-amber-600 font-bold' : 'text-slate-700'}>
                      {(s.attendanceRate * 100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
              {students?.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">수강생 데이터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
