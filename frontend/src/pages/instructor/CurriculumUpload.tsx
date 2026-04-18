import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { coursesApi } from '../../api/courses';
import { pollJob } from '../../api/jobs';
import type { JobStatus } from '../../api/jobs';
import { useCourses } from '../../hooks/useCourseId';
import type { CurriculumSkill } from '../../types';
import TagChip from '../../components/common/TagChip';

interface ExtractedSkill {
  name: string;
  description: string;
  difficulty: string;
  prerequisite_names: string[];
}

interface WeeklyConcept {
  week: number;
  title: string;
  key_concepts: string[];
  summary: string;
}

interface Misconception {
  skill_name: string;
  misconception: string;
  correction: string;
}

interface ReviewPoint {
  skill_name: string;
  review_reason: string;
  suggested_interval_days: number;
}

interface AnalysisResult {
  skills: ExtractedSkill[];
  weekly_concepts: WeeklyConcept[];
  common_misconceptions: Misconception[];
  review_points: ReviewPoint[];
}

type Phase = 'loading' | 'view' | 'input' | 'analyzing' | 'results';

const diffColor = (d: string) => {
  if (d === 'EASY') return 'emerald' as const;
  if (d === 'HARD') return 'rose' as const;
  return 'amber' as const;
};

const diffLabel = (d: string) => {
  if (d === 'EASY') return '기초';
  if (d === 'HARD') return '고급';
  return '중급';
};

export default function CurriculumUpload() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: courses, isLoading: coursesLoading } = useCourses();

  // 선택된 과정 (URL 파라미터로 초기값 설정)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    searchParams.get('courseId'),
  );
  const courseId = selectedCourseId ?? undefined;

  const [phase, setPhase] = useState<Phase>('loading');
  const [courseName, setCourseName] = useState('');
  const [courseNameInitialized, setCourseNameInitialized] = useState(false);
  const [target, setTarget] = useState('');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [saving, setSaving] = useState(false);

  // 스킬 편집 상태
  const [editSkill, setEditSkill] = useState<CurriculumSkill | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', difficulty: 'MEDIUM' });
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', description: '', difficulty: 'MEDIUM' });
  const [deleteConfirm, setDeleteConfirm] = useState<CurriculumSkill | null>(null);

  // 과정 목록 로드 시 자동 선택 (선택된 과정이 없을 때만)
  useEffect(() => {
    if (!courses || courses.length === 0) return;
    if (selectedCourseId && courses.some((c) => String(c.id) === selectedCourseId)) return;
    setSelectedCourseId(String(courses[0].id));
  }, [courses, selectedCourseId]);

  // 과정 변경 핸들러
  const handleCourseChange = (newId: string) => {
    setSelectedCourseId(newId);
    setSearchParams({ courseId: newId });
    setPhase('loading');
    setAnalysisResult(null);
    setFiles([]);
    setTarget('');
    setAdditionalPrompt('');
    setCourseName('');
    setCourseNameInitialized(false);
  };

  // 스킬 CRUD mutations
  const updateSkillMut = useMutation({
    mutationFn: (data: { skillId: string; name: string; description: string; difficulty: string }) =>
      coursesApi.updateSkill(courseId!, data.skillId, { name: data.name, description: data.description, difficulty: data.difficulty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'skills'] });
      setEditSkill(null);
    },
  });

  const createSkillMut = useMutation({
    mutationFn: (data: { name: string; description: string; difficulty: string }) =>
      coursesApi.createSkill(courseId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'skills'] });
      setShowAddSkill(false);
      setAddForm({ name: '', description: '', difficulty: 'MEDIUM' });
    },
  });

  const deleteSkillMut = useMutation({
    mutationFn: (skillId: string) => coursesApi.deleteSkill(courseId!, skillId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'skills'] });
      setDeleteConfirm(null);
    },
  });

  // 기존 스킬 로드 — 있으면 view, 없으면 input
  const { data: existingSkills, isError: skillsError } = useQuery({
    queryKey: ['courses', courseId, 'skills'],
    queryFn: () => coursesApi.getSkills(courseId!),
    enabled: !!courseId,
  });

  // 스킬 데이터가 로드되면 phase 결정 (useEffect로 이동하여 렌더 중 setState 방지)
  useEffect(() => {
    if (phase !== 'loading') return;
    if (coursesLoading) return;
    if (!courseId) return; // courseId 없으면 아래 early return에서 처리
    if (skillsError) { setPhase('input'); return; }
    if (existingSkills === undefined) return;

    if (existingSkills.length > 0) {
      const idToName: Record<string, string> = {};
      existingSkills.forEach((s) => { idToName[String(s.id)] = s.name; });

      setAnalysisResult({
        skills: existingSkills.map((s) => ({
          name: s.name,
          description: s.description ?? '',
          difficulty: String(s.difficulty ?? 'MEDIUM'),
          prerequisite_names: (s.prerequisiteIds ?? []).map((pid) => idToName[String(pid)] ?? String(pid)),
        })),
        weekly_concepts: [],
        common_misconceptions: [],
        review_points: [],
      });
      setPhase('view');
    } else {
      setPhase('input');
    }
  }, [phase, coursesLoading, courseId, existingSkills, skillsError]);

  // 과정명 자동 채우기 (선택된 과정 기준)
  useEffect(() => {
    if (!courseNameInitialized && courses && courseId) {
      const course = courses.find((c) => String(c.id) === courseId);
      if (course) {
        setCourseName(course.title);
        setCourseNameInitialized(true);
      }
    }
  }, [courses, courseId, courseNameInitialized]);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!courseId) throw new Error('과정을 먼저 선택하세요.');

      setProgress(10);

      let jobId: number;
      if (files.length > 0) {
        const res = await coursesApi.uploadCurriculum(courseId, files[0], {
          target,
          additionalPrompt,
        });
        jobId = res.jobId;
      } else {
        const res = await coursesApi.analyzeCurriculumText(courseId, {
          courseName: courseName || courses?.find((c) => String(c.id) === courseId)?.title || '',
          target: target || undefined,
          additionalPrompt: additionalPrompt || undefined,
        });
        jobId = res.jobId;
      }
      setProgress(30);

      const jobResult: JobStatus = await pollJob(jobId, { intervalMs: 2000, timeoutMs: 180_000 });
      setProgress(90);

      if (jobResult.status === 'FAILED') {
        throw new Error(jobResult.errorMessage ?? '커리큘럼 분석에 실패했습니다.');
      }

      const payload = jobResult.resultPayload as Record<string, unknown> | null;

      // Recover/generate weeks from analysis result
      await coursesApi.recoverWeeks(courseId).catch(() => {});

      const apiSkills = await coursesApi.getSkills(courseId);
      const idToName: Record<string, string> = {};
      apiSkills.forEach((s) => { idToName[String(s.id)] = s.name; });

      const skillsFromApi: ExtractedSkill[] = apiSkills.map((s) => ({
        name: s.name,
        description: s.description ?? '',
        difficulty: String(s.difficulty ?? 'MEDIUM'),
        prerequisite_names: (s.prerequisiteIds ?? []).map((pid) => idToName[String(pid)] ?? String(pid)),
      }));

      setProgress(100);

      return {
        skills: skillsFromApi.length > 0 ? skillsFromApi : ((payload?.skills ?? []) as ExtractedSkill[]),
        weekly_concepts: (payload?.weekly_concepts ?? []) as WeeklyConcept[],
        common_misconceptions: (payload?.common_misconceptions ?? []) as Misconception[],
        review_points: (payload?.review_points ?? []) as ReviewPoint[],
      } satisfies AnalysisResult;
    },
    onMutate: () => {
      setProgress(0);
      setPhase('analyzing');
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      setPhase('results');
      queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'skills'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: () => {
      setPhase('input');
    },
  });

  // 과정이 없으면 안내 메시지 (모든 hooks 선언 이후에 위치)
  if (phase === 'loading' && !coursesLoading && !courseId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-12 text-center max-w-md">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.331 0 4.472.89 6.075 2.356M12 6.042c1.624-1.466 3.744-2.292 6-2.292 1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18c-2.331 0-4.472.89-6.075 2.356" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-2">등록된 과정이 없습니다</h3>
          <p className="text-sm text-slate-500">과정을 먼저 생성한 후 커리큘럼을 업로드하세요.</p>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  // view와 results에서 공통으로 사용하는 스킬 렌더링
  const renderSkillsContent = (data: AnalysisResult) => (
    <div className="space-y-6">
      {/* Extracted Skills */}
      {data.skills.length > 0 && (
        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">추출된 스킬 ({data.skills.length}개)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.skills.map((skill, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-slate-700">{skill.name}</span>
                  <TagChip
                    label={diffLabel(skill.difficulty)}
                    color={diffColor(skill.difficulty)}
                    size="sm"
                  />
                </div>
                {skill.description && (
                  <p className="text-xs text-slate-500 mb-1.5">{skill.description}</p>
                )}
                {skill.prerequisite_names.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] text-slate-400">선행:</span>
                    {skill.prerequisite_names.map((p) => (
                      <TagChip key={p} label={p} color="slate" size="sm" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prerequisite Graph */}
      {data.skills.length > 0 && (
        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">선행 관계 그래프</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {data.skills.map((skill, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-medium border border-indigo-200">
                  {skill.name}
                </div>
                {i < data.skills.length - 1 && (
                  <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Learning Map */}
      {data.weekly_concepts.length > 0 && (
        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">주차별 학습 맵</h3>
          <div className="space-y-3">
            {data.weekly_concepts.map((w) => (
              <div key={w.week} className="flex items-start gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
                  {w.week}주
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">{w.title}</p>
                  {w.summary && (
                    <p className="text-xs text-slate-500 mt-0.5">{w.summary}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {w.key_concepts.map((c) => (
                      <TagChip key={c} label={c} color="indigo" size="sm" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Common Misconceptions */}
      {data.common_misconceptions.length > 0 && (
        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">흔한 오개념</h3>
          <div className="space-y-3">
            {data.common_misconceptions.map((m, i) => (
              <div key={i} className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2 mb-1.5">
                  <TagChip label={m.skill_name} color="amber" size="sm" />
                </div>
                <p className="text-sm text-amber-800 mb-1">
                  <span className="font-medium">오개념:</span> {m.misconception}
                </p>
                <p className="text-sm text-emerald-700">
                  <span className="font-medium">교정:</span> {m.correction}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Points */}
      {data.review_points.length > 0 && (
        <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">복습 포인트</h3>
          <div className="space-y-2">
            {data.review_points.map((r, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-[11px] font-bold text-indigo-700 flex-shrink-0">
                  {r.suggested_interval_days}일
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-700">{r.skill_name}</span>
                  <p className="text-xs text-slate-500">{r.review_reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <header className="sticky top-[41px] lg:top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-800">
              {phase === 'view' ? '커리큘럼 관리' : '커리큘럼 업로드'}
            </h1>
            <p className="text-xs text-slate-500">
              {phase === 'view'
                ? `등록된 스킬 ${analysisResult?.skills.length ?? 0}개`
                : 'AI가 커리큘럼을 분석하여 스킬 맵과 학습 계획을 생성합니다'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {courses && courses.length > 0 && (
              <select
                value={courseId ?? ''}
                onChange={(e) => handleCourseChange(e.target.value)}
                disabled={phase === 'analyzing'}
                className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 max-w-[220px] disabled:opacity-50"
              >
                {courses.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          {phase === 'view' && (
            <button
              onClick={() => setPhase('input')}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              재분석
            </button>
          )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {/* Loading */}
        {phase === 'loading' && (
          <div className="flex items-center justify-center py-20">
            <svg className="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* View - 기존 커리큘럼 보기 (편집 가능) */}
        {phase === 'view' && existingSkills && (
          <div className="space-y-6">
            {/* 스킬 목록 — 편집 가능 */}
            <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800">등록된 스킬 ({existingSkills.length}개)</h3>
                <button
                  onClick={() => setShowAddSkill(true)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  + 스킬 추가
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {existingSkills.map((skill) => (
                  <div key={skill.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-700">{skill.name}</span>
                      <div className="flex items-center gap-1">
                        <TagChip
                          label={diffLabel(String(skill.difficulty))}
                          color={diffColor(String(skill.difficulty))}
                          size="sm"
                        />
                        <button
                          onClick={() => {
                            setEditSkill(skill);
                            setEditForm({
                              name: skill.name,
                              description: skill.description ?? '',
                              difficulty: String(skill.difficulty),
                            });
                          }}
                          aria-label="스킬 수정"
                          className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 focus-visible:opacity-100 focus-visible:text-indigo-600 transition-colors md:opacity-0 md:group-hover:opacity-100"
                          title="수정"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(skill)}
                          aria-label="스킬 삭제"
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 focus-visible:opacity-100 focus-visible:text-rose-600 transition-colors md:opacity-0 md:group-hover:opacity-100"
                          title="삭제"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {skill.description && (
                      <p className="text-xs text-slate-500">{skill.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {analysisResult && analysisResult.weekly_concepts.length === 0 && analysisResult.common_misconceptions.length === 0 && (
              <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6 text-center">
                <p className="text-sm text-slate-500 mb-3">
                  주차별 학습 맵, 오개념, 복습 포인트 데이터가 없습니다.
                </p>
                <p className="text-xs text-slate-400">
                  커리큘럼을 재분석하면 AI가 더 풍부한 학습 계획을 생성합니다.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Input - 업로드 폼 */}
        {phase === 'input' && (
          <div className="space-y-6">
            <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
              <label className="block text-sm font-semibold text-slate-800 mb-2">과정명</label>
              <input
                type="text"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="예: React 심화 과정"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>

            <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
              <label className="block text-sm font-semibold text-slate-800 mb-2">대상</label>
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="예: 컴퓨터공학과 3학년, 웹 개발 입문자"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>

            <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
              <label className="block text-sm font-semibold text-slate-800 mb-2">추가 요청사항</label>
              <p className="text-xs text-slate-400 mb-2">AI 분석 시 반영할 추가 지시사항을 입력하세요</p>
              <textarea
                value={additionalPrompt}
                onChange={(e) => setAdditionalPrompt(e.target.value)}
                placeholder="예: 실습 위주로 스킬을 구성해주세요, 난이도를 점진적으로 올려주세요..."
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
              />
            </div>

            <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
              <label className="block text-sm font-semibold text-slate-800 mb-1">교재 / 자료 업로드</label>
              <p className="text-xs text-slate-400 mb-2">파일 없이도 과정명과 대상 정보만으로 AI 분석이 가능합니다</p>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-indigo-300 transition-colors">
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  id="curriculum-files"
                  accept=".pdf,.docx,.pptx,.md,.txt"
                />
                <label htmlFor="curriculum-files" className="cursor-pointer">
                  <svg className="w-10 h-10 mx-auto mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                  <p className="text-sm text-slate-500">클릭하여 파일을 선택하세요</p>
                  <p className="text-[11px] text-slate-400 mt-1">PDF, DOCX, PPTX, MD, TXT</p>
                </label>
              </div>
              {files.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                      <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      {f.name}
                      <span className="text-slate-400 ml-auto">{(f.size / 1024).toFixed(0)} KB</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {existingSkills && existingSkills.length > 0 && (
                <button
                  onClick={() => setPhase('view')}
                  className="px-6 py-3 text-sm font-semibold rounded-xl bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  취소
                </button>
              )}
              <button
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                className="flex-1 py-3 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                {analyzeMutation.isPending ? '분석 중...' : 'AI 분석 시작'}
              </button>
            </div>

            {analyzeMutation.isError && (
              <p className="text-sm text-rose-500 text-center">
                {analyzeMutation.error instanceof Error ? analyzeMutation.error.message : '분석 실패. 다시 시도해주세요.'}
              </p>
            )}
          </div>
        )}

        {/* Analyzing */}
        {phase === 'analyzing' && (
          <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">AI 분석 중...</h3>
            <p className="text-sm text-slate-500 mb-4">커리큘럼에서 스킬과 전제조건을 추출하고 있습니다</p>
            <div className="w-full max-w-xs mx-auto h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">{progress}%</p>
          </div>
        )}

        {/* Results - 분석 완료 직후 */}
        {phase === 'results' && analysisResult && (
          <div className="space-y-6">
            {renderSkillsContent(analysisResult)}

            <button
              disabled={saving}
              onClick={() => {
                setSaving(true);
                setTimeout(() => navigate('/instructor'), 1200);
              }}
              className={`w-full py-3 text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-200 ${
                saving
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {saving ? '저장 완료! 대시보드로 이동합니다...' : '커리큘럼 저장'}
            </button>
          </div>
        )}
      </main>

      {/* 스킬 수정 모달 */}
      {editSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setEditSkill(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4"
          >
            <h3 className="text-sm font-bold text-slate-800 mb-4">스킬 수정</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">스킬명</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">설명</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">난이도</label>
                <select
                  value={editForm.difficulty}
                  onChange={(e) => setEditForm((f) => ({ ...f, difficulty: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-400"
                >
                  <option value="EASY">기초</option>
                  <option value="MEDIUM">중급</option>
                  <option value="HARD">고급</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setEditSkill(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => updateSkillMut.mutate({ skillId: String(editSkill.id), ...editForm })}
                disabled={updateSkillMut.isPending || !editForm.name.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {updateSkillMut.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 스킬 추가 모달 */}
      {showAddSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowAddSkill(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4"
          >
            <h3 className="text-sm font-bold text-slate-800 mb-4">스킬 추가</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">스킬명</label>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="예: React Hooks"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">설명</label>
                <textarea
                  value={addForm.description}
                  onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="스킬에 대한 간단한 설명"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">난이도</label>
                <select
                  value={addForm.difficulty}
                  onChange={(e) => setAddForm((f) => ({ ...f, difficulty: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-400"
                >
                  <option value="EASY">기초</option>
                  <option value="MEDIUM">중급</option>
                  <option value="HARD">고급</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setShowAddSkill(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => createSkillMut.mutate(addForm)}
                disabled={createSkillMut.isPending || !addForm.name.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {createSkillMut.isPending ? '추가 중...' : '추가'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 스킬 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
          >
            <h3 className="text-sm font-bold text-slate-800 mb-2">스킬 삭제</h3>
            <p className="text-sm text-slate-600 mb-5">
              <span className="font-semibold text-slate-800">{deleteConfirm.name}</span> 스킬을 삭제하시겠습니까?
              관련된 문제와 복습 데이터에 영향을 줄 수 있습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => deleteSkillMut.mutate(String(deleteConfirm.id))}
                disabled={deleteSkillMut.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-50"
              >
                {deleteSkillMut.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
