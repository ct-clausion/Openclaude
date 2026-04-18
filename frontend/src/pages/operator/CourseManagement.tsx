import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { operatorApi } from '../../api/operator';
import GlassCard from '../../components/common/GlassCard';
import Skeleton from '../../components/common/Skeleton';
import { useConfirm } from '../../hooks/useConfirm';
import type { Course } from '../../types';

export default function CourseManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, confirmNode } = useConfirm();
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [rejectNote, setRejectNote] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const { data: courses, isLoading } = useQuery({
    queryKey: ['operator', 'courses'],
    queryFn: operatorApi.getCourses,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => operatorApi.approveCourse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'courses'] });
      toast.success('과정을 승인했습니다.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => operatorApi.rejectCourse(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'courses'] });
      setRejectingId(null);
      setRejectNote('');
      toast.success('과정을 반려했습니다.');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => operatorApi.rejectCourse(id, '승인 해제'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'courses'] });
      toast.success('승인을 해제했습니다.');
    },
  });

  const filtered = courses?.filter((c: Course) =>
    filter === 'ALL' ? true : c.approvalStatus === filter
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">과정 관리</h1>
          <p className="text-sm text-slate-500 mt-1">전체 교육 과정의 승인, 반려, 정원 관리</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
            }`}
          >
            {f === 'ALL' ? '전체' : f === 'PENDING' ? '승인 대기' : f === 'APPROVED' ? '승인됨' : '반려됨'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton variant="list" rows={5} />
      ) : (
        <div className="space-y-3">
          {filtered?.map((course) => (
            <GlassCard key={course.id} className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      className="text-sm font-bold text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors"
                      onClick={() => navigate(`/operator/courses/${course.id}`)}
                    >{course.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      course.approvalStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700'
                        : course.approvalStatus === 'PENDING' ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {course.approvalStatus === 'APPROVED' ? '승인' : course.approvalStatus === 'PENDING' ? '대기' : '반려'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{course.description}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    정원: {course.maxCapacity ?? 30}명 | 생성일: {course.createdAt?.slice(0, 10)}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <button
                    onClick={() => navigate(`/operator/courses/${course.id}`)}
                    className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
                  >
                    상세
                  </button>
                  {course.approvalStatus === 'PENDING' && (
                    <>
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: '과정 승인',
                            message: `"${course.title}" 과정을 승인하시겠습니까?\n승인 후 수강생이 수강 신청할 수 있습니다.`,
                            confirmLabel: '승인',
                          });
                          if (ok) approveMutation.mutate(course.id);
                        }}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => setRejectingId(course.id)}
                        className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors"
                      >
                        반려
                      </button>
                    </>
                  )}
                  {course.approvalStatus === 'APPROVED' && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: '승인 해제',
                          message: `"${course.title}" 과정의 승인을 해제하시겠습니까?\n이미 수강 중인 학생들의 접근이 제한될 수 있습니다.`,
                          tone: 'danger',
                          confirmLabel: '해제',
                        });
                        if (ok) revokeMutation.mutate(course.id);
                      }}
                      disabled={revokeMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      승인 해제
                    </button>
                  )}
                {course.approvalStatus === 'REJECTED' && (
                  <button
                    onClick={() => approveMutation.mutate(course.id)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    재승인
                  </button>
                )}
              </div>
              </div>

              {/* Reject note input */}
              {rejectingId === course.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="반려 사유를 입력하세요"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm"
                  />
                  <button
                    onClick={() => rejectMutation.mutate({ id: course.id, note: rejectNote })}
                    className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium"
                  >
                    확인
                  </button>
                  <button
                    onClick={() => { setRejectingId(null); setRejectNote(''); }}
                    className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium"
                  >
                    취소
                  </button>
                </div>
              )}
            </GlassCard>
          ))}
          {filtered?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">해당하는 과정이 없습니다.</p>
          )}
        </div>
      )}
      {confirmNode}
    </div>
  );
}
