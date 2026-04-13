import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { operatorApi } from '../../api/operator';
import { coursesApi } from '../../api/courses';
import GlassCard from '../../components/common/GlassCard';
import type { CurriculumSkill } from '../../types';

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`inline-block w-2 h-2 rounded-full ${
            i <= level ? 'bg-indigo-500' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['operator', 'courses', courseId],
    queryFn: () => operatorApi.getCourse(courseId!),
    enabled: !!courseId,
  });

  const { data: skills, isLoading: skillsLoading } = useQuery({
    queryKey: ['courses', courseId, 'skills'],
    queryFn: () => coursesApi.getSkills(courseId!),
    enabled: !!courseId,
  });

  const approveMutation = useMutation({
    mutationFn: () => operatorApi.approveCourse(courseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'courses', courseId] });
      queryClient.invalidateQueries({ queryKey: ['operator', 'courses'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (note: string) => operatorApi.rejectCourse(courseId!, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'courses', courseId] });
      queryClient.invalidateQueries({ queryKey: ['operator', 'courses'] });
      setShowRejectInput(false);
      setRejectNote('');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => operatorApi.rejectCourse(courseId!, '승인 해제'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'courses', courseId] });
      queryClient.invalidateQueries({ queryKey: ['operator', 'courses'] });
    },
  });

  if (courseLoading) {
    return <p className="text-sm text-slate-400">로딩 중...</p>;
  }

  if (!course) {
    return <p className="text-sm text-slate-400">과정을 찾을 수 없습니다.</p>;
  }

  const approvalStatus = course.approvalStatus;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/operator/courses')}
          className="px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          ← 뒤로가기
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">과정 상세</h1>
          <p className="text-sm text-slate-500 mt-0.5">교육 과정 정보 및 승인 관리</p>
        </div>
      </div>

      {/* Course Info */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">{course.title}</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  approvalStatus === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : approvalStatus === 'PENDING'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {approvalStatus === 'APPROVED'
                  ? '승인됨'
                  : approvalStatus === 'PENDING'
                  ? '승인 대기'
                  : '반려됨'}
              </span>
            </div>
            <p className="text-sm text-slate-600 mt-2">{course.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          {course.schedule && (
            <div>
              <p className="text-xs text-slate-400 font-medium">일정</p>
              <p className="text-sm text-slate-700 mt-0.5">{course.schedule}</p>
            </div>
          )}
          {course.classTime && (
            <div>
              <p className="text-xs text-slate-400 font-medium">수업 시간</p>
              <p className="text-sm text-slate-700 mt-0.5">{course.classTime}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400 font-medium">최대 정원</p>
            <p className="text-sm text-slate-700 mt-0.5">{course.maxCapacity ?? 30}명</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">생성일</p>
            <p className="text-sm text-slate-700 mt-0.5">{course.createdAt?.slice(0, 10)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">개설자 ID</p>
            <p className="text-sm text-slate-700 mt-0.5">{course.createdBy}</p>
          </div>
          {course.approvalNote && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-slate-400 font-medium">승인 메모</p>
              <p className="text-sm text-slate-700 mt-0.5">{course.approvalNote}</p>
            </div>
          )}
        </div>

        {/* Approval Actions */}
        <div className="pt-2 border-t border-slate-100">
          {approvalStatus === 'PENDING' && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                승인
              </button>
              <button
                onClick={() => setShowRejectInput(true)}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors"
              >
                반려
              </button>
            </div>
          )}
          {approvalStatus === 'APPROVED' && (
            <button
              onClick={() => {
                if (window.confirm('이 과정의 승인을 해제하시겠습니까?')) {
                  revokeMutation.mutate();
                }
              }}
              disabled={revokeMutation.isPending}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              승인 해제
            </button>
          )}
          {approvalStatus === 'REJECTED' && (
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              재승인
            </button>
          )}
          {showRejectInput && (
            <div className="mt-3 flex gap-2">
              <input
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="반려 사유를 입력하세요"
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
              <button
                onClick={() => rejectMutation.mutate(rejectNote)}
                disabled={rejectMutation.isPending}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium disabled:opacity-50"
              >
                확인
              </button>
              <button
                onClick={() => { setShowRejectInput(false); setRejectNote(''); }}
                className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium"
              >
                취소
              </button>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Curriculum Skills */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-3">커리큘럼 스킬</h2>
        {skillsLoading ? (
          <p className="text-sm text-slate-400">스킬 로딩 중...</p>
        ) : !skills || skills.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">등록된 스킬이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {skills.map((skill: CurriculumSkill) => (
              <GlassCard key={skill.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">{skill.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{skill.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-xs text-slate-400">난이도</p>
                    <DifficultyDots level={Number(skill.difficulty)} />
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
