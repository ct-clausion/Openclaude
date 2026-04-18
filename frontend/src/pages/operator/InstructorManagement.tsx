import { useQuery } from '@tanstack/react-query';
import { operatorApi } from '../../api/operator';
import GlassCard from '../../components/common/GlassCard';
import Skeleton from '../../components/common/Skeleton';

export default function InstructorManagement() {
  const { data: instructors, isLoading } = useQuery({
    queryKey: ['operator', 'instructors'],
    queryFn: operatorApi.getInstructors,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">강사 관리</h1>
        <p className="text-sm text-slate-500 mt-1">강사 업무량 현황 및 배정 관리</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="card" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instructors?.map((inst) => (
            <GlassCard key={inst.id} className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{inst.name.charAt(0)}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{inst.name}</p>
                  <p className="text-xs text-slate-400">{inst.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-50">
                  <p className="text-lg font-bold text-slate-800">{inst.courseCount}</p>
                  <p className="text-[10px] text-slate-500">담당 과정</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50">
                  <p className="text-lg font-bold text-slate-800">{inst.studentCount}</p>
                  <p className="text-[10px] text-slate-500">수강생</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-50">
                  <p className="text-lg font-bold text-slate-800">{inst.consultationCount}</p>
                  <p className="text-[10px] text-slate-500">상담</p>
                </div>
              </div>
            </GlassCard>
          ))}
          {instructors?.length === 0 && (
            <p className="text-sm text-slate-400 col-span-full text-center py-8">등록된 강사가 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
