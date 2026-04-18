import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { operatorApi } from '../../api/operator';
import GlassCard from '../../components/common/GlassCard';
import Skeleton from '../../components/common/Skeleton';
import { useConfirm } from '../../hooks/useConfirm';

export default function InterventionCenter() {
  const queryClient = useQueryClient();
  const { confirm, confirmNode } = useConfirm();
  const [messageText, setMessageText] = useState<Record<string, string>>({});

  const { data: center, isLoading } = useQuery({
    queryKey: ['operator', 'intervention-center'],
    queryFn: operatorApi.getInterventionCenter,
  });

  const { data: directives } = useQuery({
    queryKey: ['operator', 'intervention-directives'],
    queryFn: operatorApi.getInterventionDirectives,
  });

  const directiveMutation = useMutation({
    mutationFn: operatorApi.sendInterventionDirective,
    onSuccess: () => {
      // Narrow invalidation: a directive only affects the at-risk grouping and the
      // directive history. Avoid invalidating the whole `['operator']` prefix,
      // which would force every operator page to refetch.
      queryClient.invalidateQueries({ queryKey: ['operator', 'intervention-center'] });
      queryClient.invalidateQueries({ queryKey: ['operator', 'intervention-directives'] });
      setMessageText({});
      toast.success('강사에게 지시를 전송했습니다.');
    },
  });

  const handleSendDirective = async (
    instructorId: string,
    studentIds: string[],
    _courseId: string,
    instructorName: string,
  ) => {
    const message = messageText[instructorId] || '해당 학생들에 대한 주의 및 개입을 요청합니다.';
    const ok = await confirm({
      title: '개입 지시 전송',
      message: `${instructorName} 강사에게 ${studentIds.length}명의 학생에 대한 개입 지시를 전송합니다.\n강사의 알림에 남고, 감사 로그에도 기록됩니다.`,
      confirmLabel: '전송',
    });
    if (!ok) return;
    directiveMutation.mutate({
      instructorId,
      studentIds,
      directiveType: 'ATTENTION',
      message,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">강사 개입 지시 센터</h1>
        <p className="text-sm text-slate-500 mt-1">
          AI가 감지한 위험 학생을 강사별로 그룹핑 - 강사에게 직접 주의 지시를 보냅니다.
        </p>
      </div>

      {isLoading ? (
        <Skeleton variant="list" rows={3} />
      ) : center && center.length > 0 ? (
        <div className="space-y-4">
          {center.map((group) => (
            <GlassCard key={`${group.instructorId}-${group.courseId}`} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Instructor header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">{group.instructorName?.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{group.instructorName}</p>
                      <p className="text-xs text-slate-400">{group.courseName} | 위험 학생 {group.studentCount}명</p>
                    </div>
                  </div>

                  {/* At-risk students */}
                  <div className="ml-12 space-y-2 mb-3">
                    {group.atRiskStudents.map((s: { studentId: string; studentName: string; overallRisk: number; trend: string }) => (
                      <div key={s.studentId} className="flex items-center gap-3">
                        <span className="text-sm text-slate-700">{s.studentName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          s.overallRisk >= 80 ? 'bg-rose-100 text-rose-700'
                          : s.overallRisk >= 60 ? 'bg-orange-100 text-orange-700'
                          : s.overallRisk >= 40 ? 'bg-amber-100 text-amber-700'
                          : s.overallRisk >= 20 ? 'bg-sky-100 text-sky-700'
                          : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {Math.round(s.overallRisk)}%
                        </span>
                        {s.trend === 'DECLINING' && (
                          <span className="text-rose-500 text-xs font-bold">&#9660; 하락</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* AI suggestion */}
                  <div className="ml-12 p-3 rounded-lg bg-indigo-50 border border-indigo-100 mb-3">
                    <p className="text-xs font-bold text-indigo-700 mb-1">AI 제안</p>
                    <p className="text-xs text-indigo-600">{group.aiSuggestion}</p>
                  </div>

                  {/* Message input */}
                  <div className="ml-0 sm:ml-12 flex flex-col sm:flex-row gap-2">
                    <input
                      value={messageText[group.instructorId] || ''}
                      onChange={(e) => setMessageText(prev => ({ ...prev, [group.instructorId]: e.target.value }))}
                      placeholder="강사에게 전달할 메시지 (선택)"
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                    <button
                      onClick={() => handleSendDirective(
                        group.instructorId,
                        group.atRiskStudents.map((s: { studentId: string }) => s.studentId),
                        group.courseId,
                        group.instructorName,
                      )}
                      disabled={directiveMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      강사에게 지시
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard className="p-8 text-center">
          <p className="text-slate-400">현재 강사에게 전달할 위험 학생이 없습니다.</p>
        </GlassCard>
      )}

      {/* Directive History */}
      {directives && directives.length > 0 && (
        <GlassCard className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">지시 이력</h2>
          <div className="space-y-2">
            {directives.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div>
                  <p className="text-sm text-slate-700">{d.description}</p>
                  <p className="text-xs text-slate-400">{d.createdAt?.slice(0, 16).replace('T', ' ')}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  d.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700'
                    : d.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {d.status === 'COMPLETED' ? '처리됨' : d.status === 'IN_PROGRESS' ? '진행중' : '대기중'}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
      {confirmNode}
    </div>
  );
}
