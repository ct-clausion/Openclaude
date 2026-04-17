import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { coursesApi } from '../../api/courses';
import type { Course, CurriculumSkill } from '../../types';

interface Enrollment {
  enrollmentId: number;
  courseId: number;
  studentId: number;
  status: string;
}

// Course 타입에 weeks, enrollmentCount, createdByName 이미 포함됨
type CourseDetail = Course;

type Tab = 'my' | 'all';

export default function CourseEnroll() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('my');
  const [confirm, setConfirm] = useState<Course | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ['all-courses'],
    queryFn: () => coursesApi.getCourses(),
  });

  const { data: enrollments = [] } = useQuery<Enrollment[]>({
    queryKey: ['my-enrollments'],
    queryFn: () => coursesApi.getMyEnrollments(),
  });

  const { data: courseDetail, isLoading: detailLoading } = useQuery<CourseDetail>({
    queryKey: ['course-detail', detailId],
    queryFn: () => coursesApi.getCourse(detailId!),
    enabled: !!detailId,
  });

  const { data: skills = [] } = useQuery<CurriculumSkill[]>({
    queryKey: ['course-skills', detailId],
    queryFn: () => coursesApi.getSkills(detailId!),
    enabled: !!detailId,
  });

  const enrollMut = useMutation({
    mutationFn: (courseId: string) => coursesApi.enrollInCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['all-courses'] });
      // Invalidate the detail modal's query too so the enroll button label updates
      // from "수강 신청" to "수강 중" without closing/reopening the modal.
      queryClient.invalidateQueries({ queryKey: ['course-detail'] });
      setConfirm(null);
      setSuccessMessage('수강 신청이 완료되었습니다! 강사 승인을 기다려주세요.');
      setTimeout(() => setSuccessMessage(''), 4000);
    },
    onError: (err: Error) => {
      setConfirm(null);
      setErrorMessage(err.message || '수강 신청에 실패했습니다. 다시 시도해주세요.');
      setTimeout(() => setErrorMessage(''), 4000);
    },
  });

  const getEnrollmentStatus = (courseId: string | number): string | null => {
    const e = enrollments.find((en) => String(en.courseId) === String(courseId));
    return e?.status ?? null;
  };

  const STATUS_LABEL: Record<string, { label: string; color: string }> = {
    PENDING: { label: '승인 대기', color: 'bg-amber-100 text-amber-700' },
    ACTIVE: { label: '수강 중', color: 'bg-emerald-100 text-emerald-700' },
    REJECTED: { label: '거절됨', color: 'bg-rose-100 text-rose-600' },
  };

  const DIFFICULTY: Record<string, string> = { EASY: '기초', MEDIUM: '중급', HARD: '고급' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <header className="sticky top-[41px] lg:top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-0">
          <h1 className="text-base font-bold text-slate-800">과정 관리</h1>
          <p className="text-xs text-slate-500 mb-3">내 과정을 확인하거나 새 과정에 수강 신청하세요</p>
          <div className="flex gap-1">
            <button
              onClick={() => setTab('my')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                tab === 'my'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              내 과정
            </button>
            <button
              onClick={() => setTab('all')}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
                tab === 'all'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              수강 신청
            </button>
          </div>
        </div>
      </header>

      {successMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 bg-emerald-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 bg-rose-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          {errorMessage}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white animate-pulse" />
            ))}
          </div>
        )}

        {(() => {
          const enrolledCourseIds = new Set(enrollments.map((e) => String(e.courseId)));
          const displayCourses = tab === 'my'
            ? courses.filter((c) => enrolledCourseIds.has(String(c.id)))
            : courses;

          if (!isLoading && displayCourses.length === 0) {
            return (
              <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-12 text-center">
                <h3 className="text-base font-bold text-slate-800 mb-2">
                  {tab === 'my' ? '신청한 과정이 없습니다' : '개설된 과정이 없습니다'}
                </h3>
                <p className="text-sm text-slate-500">
                  {tab === 'my' ? '수강 신청 탭에서 과정을 신청해보세요' : '강사가 과정을 개설하면 여기에 표시됩니다'}
                </p>
                {tab === 'my' && (
                  <button
                    onClick={() => setTab('all')}
                    className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                  >
                    수강 신청하러 가기
                  </button>
                )}
              </div>
            );
          }

          return displayCourses.map((course, i) => {
          const status = getEnrollmentStatus(course.id);
          const badge = status ? STATUS_LABEL[status] : null;

          return (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setDetailId(course.id)}
              className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-5 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-800">{course.title}</h3>
                    {badge && (
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {course.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{course.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-400">
                    {course.startDate && course.endDate ? (
                      <span>
                        {new Date(course.startDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        {' ~ '}
                        {new Date(course.endDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                    ) : course.createdAt ? (
                      <span>
                        {new Date(course.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}
                        {' 개설'}
                      </span>
                    ) : (
                      <span>날짜 미정</span>
                    )}
                    {course.schedule && <span>{course.schedule}</span>}
                    {course.classTime && <span>{course.classTime}</span>}
                    {course.maxCapacity && (
                      <span className={(course.enrollmentCount ?? 0) >= course.maxCapacity ? 'text-rose-500 font-medium' : ''}>
                        {course.enrollmentCount ?? 0}/{course.maxCapacity}명
                      </span>
                    )}
                    <span className="text-indigo-400">커리큘럼 보기 &rarr;</span>
                  </div>
                </div>

                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                  {!status && course.maxCapacity && (course.enrollmentCount ?? 0) >= course.maxCapacity ? (
                    <span className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-100 text-slate-400 border border-slate-200">
                      마감
                    </span>
                  ) : !status && (
                    <button
                      onClick={() => setConfirm(course)}
                      className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                      수강 신청
                    </button>
                  )}
                  {status === 'PENDING' && (
                    <span className="px-4 py-2 text-xs font-medium rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                      승인 대기 중
                    </span>
                  )}
                  {status === 'ACTIVE' && (
                    <span className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                      수강 중
                    </span>
                  )}
                  {status === 'REJECTED' && (
                    <span className="px-4 py-2 text-xs font-medium rounded-lg bg-rose-50 text-rose-500 border border-rose-200">
                      거절됨
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
          });
        })()}
      </main>

      {/* Course Detail Modal */}
      <AnimatePresence>
        {detailId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDetailId(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {detailLoading ? (
                      <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />
                    ) : (
                      <>
                        <h2 className="text-base font-bold text-slate-800">
                          {courseDetail?.title}
                        </h2>
                        {courseDetail?.createdByName && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            담당: {courseDetail.createdByName}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setDetailId(null)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {courseDetail?.description && (
                  <p className="text-xs text-slate-500 mt-2">{courseDetail.description}</p>
                )}
              </div>

              {/* Modal Body - scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                {detailLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 rounded-xl bg-slate-50 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Weekly Curriculum */}
                    {courseDetail?.weeks && courseDetail.weeks.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                          주차별 커리큘럼
                        </h3>
                        <div className="space-y-2">
                          {courseDetail.weeks
                            .sort((a, b) => a.weekNo - b.weekNo)
                            .map((week) => (
                              <div
                                key={week.id}
                                className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                              >
                                <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                  {week.weekNo}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-800">{week.title}</p>
                                  {week.summary && (
                                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                                      {week.summary}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Skills */}
                    {skills.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                          학습 스킬 ({skills.length}개)
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {skills.map((skill) => (
                            <span
                              key={skill.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-medium"
                              title={skill.description}
                            >
                              {skill.name}
                              {skill.difficulty && (
                                <span className="text-[9px] text-indigo-400">
                                  {DIFFICULTY[skill.difficulty] ?? skill.difficulty}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {(!courseDetail?.weeks || courseDetail.weeks.length === 0) && skills.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-sm text-slate-400">아직 커리큘럼이 등록되지 않았습니다</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex items-center justify-between">
                <div className="text-[11px] text-slate-400">
                  {courseDetail?.enrollmentCount != null && (
                    <span>{courseDetail.enrollmentCount}명 수강 중</span>
                  )}
                </div>
                {(() => {
                  const status = detailId ? getEnrollmentStatus(detailId) : null;
                  if (status === 'ACTIVE')
                    return <span className="text-xs font-medium text-emerald-600">수강 중</span>;
                  if (status === 'PENDING')
                    return <span className="text-xs font-medium text-amber-600">승인 대기 중</span>;
                  if (status === 'REJECTED')
                    return <span className="text-xs font-medium text-rose-500">거절됨</span>;
                  return (
                    <button
                      onClick={() => {
                        const c = courses.find((c) => c.id === detailId);
                        if (c) { setDetailId(null); setConfirm(c); }
                      }}
                      className="px-4 py-2 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                      수강 신청
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
          >
            <h3 className="text-sm font-bold text-slate-800 mb-2">수강 신청</h3>
            <p className="text-sm text-slate-600 mb-1">
              <span className="font-semibold text-slate-800">{confirm.title}</span>
              {' 과정에 수강 신청하시겠습니까?'}
            </p>
            <p className="text-xs text-slate-400 mb-5">강사의 승인 후 수강이 시작됩니다</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => enrollMut.mutate(confirm.id)}
                disabled={enrollMut.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {enrollMut.isPending ? '신청 중...' : '신청'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
