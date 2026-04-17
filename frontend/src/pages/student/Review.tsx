import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { questionsApi } from '../../api/questions';
import { reviewsApi } from '../../api/reviews';
import ReviewTimeline from '../../components/student/ReviewTimeline';
import { useCourseId } from '../../hooks/useCourseId';
import type { PracticeEvaluation, PracticeQuestion, ReviewTask } from '../../types';

type ReviewLocationState = {
  taskId?: string;
};

const STATUS_META: Record<
  ReviewTask['status'],
  { label: string; badge: string; summary: string }
> = {
  PENDING: {
    label: '대기',
    badge: 'bg-slate-100 text-slate-700',
    summary: '지금 바로 시작할 수 있어요.',
  },
  IN_PROGRESS: {
    label: '진행 중',
    badge: 'bg-indigo-100 text-indigo-700',
    summary: '이어서 풀면 되는 상태예요.',
  },
  COMPLETED: {
    label: '완료',
    badge: 'bg-emerald-100 text-emerald-700',
    summary: '오늘 복습 처리된 과제예요.',
  },
  SKIPPED: {
    label: '건너뜀',
    badge: 'bg-rose-100 text-rose-700',
    summary: '다시 열어서 풀 수 있어요.',
  },
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  CONCEPTUAL: '개념 확인',
  CODE_COMPLETION: '코드 완성',
  DEBUGGING: '디버깅',
  DESCRIPTIVE: '서술형',
  SCENARIO: '시나리오',
};

const SOURCE_LABELS: Record<string, { label: string; tone: string }> = {
  BANK: { label: '문제은행', tone: 'bg-emerald-50 text-emerald-700' },
  AI: { label: 'AI 생성', tone: 'bg-violet-50 text-violet-700' },
  FALLBACK: { label: '즉시 생성', tone: 'bg-amber-50 text-amber-700' },
};

const statusRank: Record<ReviewTask['status'], number> = {
  IN_PROGRESS: 0,
  PENDING: 1,
  SKIPPED: 2,
  COMPLETED: 3,
};

function isCodeQuestion(question?: PracticeQuestion | null) {
  if (!question) return false;
  return ['CODE_COMPLETION', 'DEBUGGING'].includes(question.questionType);
}

function formatTaskDate(date: string) {
  return new Date(date).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

const Review: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const courseId = useCourseId();
  const initialTaskId = (location.state as ReviewLocationState | null)?.taskId;

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialTaskId ?? null,
  );
  const [answerDraft, setAnswerDraft] = useState('');
  const [evaluation, setEvaluation] = useState<PracticeEvaluation | null>(null);

  const { data: tasks = [], isLoading: isTaskLoading } = useQuery<ReviewTask[]>({
    queryKey: ['reviewsToday', courseId],
    queryFn: () => reviewsApi.getTodayReviews(courseId ?? undefined),
    staleTime: 0,
  });

  const orderedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        const statusGap = statusRank[a.status] - statusRank[b.status];
        if (statusGap !== 0) return statusGap;
        return a.scheduledFor.localeCompare(b.scheduledFor);
      }),
    [tasks],
  );

  useEffect(() => {
    if (!orderedTasks.length) return;
    if (selectedTaskId && orderedTasks.some((task) => task.id === selectedTaskId)) {
      return;
    }

    const preferredTask =
      orderedTasks.find((task) => task.id === initialTaskId) ??
      orderedTasks.find((task) => task.status !== 'COMPLETED') ??
      orderedTasks[0];

    setSelectedTaskId(preferredTask.id);
  }, [initialTaskId, orderedTasks, selectedTaskId]);

  useEffect(() => {
    setAnswerDraft('');
    setEvaluation(null);
  }, [selectedTaskId]);

  const selectedTask = useMemo(
    () => orderedTasks.find((task) => task.id === selectedTaskId) ?? null,
    [orderedTasks, selectedTaskId],
  );

  const {
    data: practiceQuestion,
    isFetching: isQuestionLoading,
    error: questionError,
  } = useQuery<PracticeQuestion>({
    queryKey: [
      'practice-question',
      selectedTask?.id,
      selectedTask?.courseId,
      selectedTask?.skillId,
    ],
    queryFn: () =>
      questionsApi.getPracticeQuestion({
        courseId: selectedTask!.courseId,
        skillId: selectedTask?.skillId,
        reviewTaskId: selectedTask?.id,
      }),
    enabled: !!selectedTask,
    staleTime: 0,
  });

  const evaluateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTask || !practiceQuestion) {
        throw new Error('풀이할 문제가 아직 준비되지 않았습니다.');
      }

      return questionsApi.evaluatePracticeAnswer({
        reviewTaskId: selectedTask.id,
        courseId: selectedTask.courseId,
        skillId: selectedTask.skillId,
        questionType: practiceQuestion.questionType,
        questionContent: practiceQuestion.content,
        referenceAnswer: practiceQuestion.answer,
        explanation: practiceQuestion.explanation,
        studentAnswer: answerDraft,
      });
    },
    onSuccess: (result) => {
      setEvaluation(result);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (reviewId: string) => reviewsApi.completeReview(reviewId),
    onSuccess: (completedTask) => {
      queryClient.setQueryData<ReviewTask[]>(['reviewsToday'], (current) =>
        current?.map((task) =>
          task.id === completedTask.id ? completedTask : task,
        ) ?? [],
      );
      queryClient.invalidateQueries({ queryKey: ['reviewsToday'] });
      queryClient.invalidateQueries({ queryKey: ['reviewWeekSummary'] });

      const nextTask = orderedTasks.find(
        (task) => task.id !== completedTask.id && task.status !== 'COMPLETED',
      );
      if (nextTask) {
        setSelectedTaskId(nextTask.id);
      }
    },
  });

  const activeCount = orderedTasks.filter(
    (task) => task.status === 'PENDING' || task.status === 'IN_PROGRESS',
  ).length;
  const completedCount = orderedTasks.filter(
    (task) => task.status === 'COMPLETED',
  ).length;

  if (!isTaskLoading && orderedTasks.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-[41px] lg:top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-3">
            <h1 className="text-xl font-bold text-slate-900">복습 워크스페이스</h1>
            <p className="text-xs text-slate-500">
              오늘 바로 풀 수 있는 AI 복습 문제를 여는 공간입니다.
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">
              오늘 생성된 복습 과제가 없습니다.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              먼저 성찰을 작성하거나 다음 단계 추천을 확인하면, 복습 과제가 다시 생성됩니다.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <button
                onClick={() => navigate('/student/reflection')}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:bg-slate-100"
              >
                <p className="text-xs font-semibold text-slate-500">STEP 1</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  오늘 학습 성찰 작성
                </p>
              </button>
              <button
                onClick={() => navigate('/student/next-step')}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:bg-slate-100"
              >
                <p className="text-xs font-semibold text-slate-500">STEP 2</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  AI 다음 단계 추천 보기
                </p>
              </button>
              <button
                onClick={() => navigate('/student')}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:bg-slate-100"
              >
                <p className="text-xs font-semibold text-slate-500">STEP 3</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  대시보드에서 다시 확인
                </p>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-[41px] lg:top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <h1 className="text-xl font-bold text-slate-900">복습 워크스페이스</h1>
          <p className="text-xs text-slate-500">
            AI가 추천한 과제를 실제 문제 풀이와 피드백으로 바로 연결합니다.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Active
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{activeCount}</p>
            <p className="mt-1 text-sm text-slate-500">오늘 바로 풀어야 할 복습 과제</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Done
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-600">{completedCount}</p>
            <p className="mt-1 text-sm text-slate-500">오늘 완료한 복습 수</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Coach
            </p>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {practiceQuestion
                ? `${QUESTION_TYPE_LABELS[practiceQuestion.questionType] ?? practiceQuestion.questionType} 문제`
                : '문제 준비 중'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              문제 풀이 후 AI 채점과 코칭을 바로 받습니다.
            </p>
          </div>
        </div>

        <ReviewTimeline />

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">오늘의 복습 큐</h2>
                <p className="text-xs text-slate-500">
                  완료 전까지 문제를 바꿔가며 풀 수 있습니다.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {orderedTasks.map((task) => {
                const meta = STATUS_META[task.status];
                const active = task.id === selectedTaskId;
                return (
                  <motion.button
                    key={task.id}
                    whileHover={{ y: -1 }}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      active
                        ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatTaskDate(task.scheduledFor)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {task.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {task.reasonSummary}
                    </p>
                    <p className="mt-3 text-[11px] text-slate-400">{meta.summary}</p>
                  </motion.button>
                );
              })}
            </div>
          </aside>

          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedTask && (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_META[selectedTask.status].badge}`}
                      >
                        {STATUS_META[selectedTask.status].label}
                      </span>
                    )}
                    {practiceQuestion && (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          SOURCE_LABELS[practiceQuestion.source]?.tone ??
                          'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {SOURCE_LABELS[practiceQuestion.source]?.label ??
                          practiceQuestion.source}
                      </span>
                    )}
                    {practiceQuestion && (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {QUESTION_TYPE_LABELS[practiceQuestion.questionType] ??
                          practiceQuestion.questionType}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-2xl font-bold text-slate-900">
                    {selectedTask?.title ?? '복습 문제를 불러오는 중'}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedTask?.reasonSummary}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Difficulty
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {practiceQuestion?.difficulty ?? 'MEDIUM'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">예상 풀이 시간 10~15분</p>
                </div>
              </div>

              <div className="mt-6 rounded-3xl bg-slate-950 p-5 text-slate-50">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Problem
                  </p>
                  {questionError && (
                    <span className="text-xs text-rose-300">
                      문제 로딩 실패
                    </span>
                  )}
                </div>

                {isQuestionLoading ? (
                  <div className="space-y-3">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800" />
                    <div className="h-4 w-full animate-pulse rounded bg-slate-800" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-slate-800" />
                  </div>
                ) : (
                  <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-slate-100">
                    {practiceQuestion?.content ??
                      '문제를 준비하는 중입니다. 잠시만 기다려 주세요.'}
                  </pre>
                )}
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">답안 작성</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {isCodeQuestion(practiceQuestion)
                        ? '코드, 핵심 설명, 예외 케이스까지 함께 적으면 채점 품질이 좋아집니다.'
                        : '핵심 개념, 근거, 예시를 함께 적으면 더 정확한 피드백을 받을 수 있습니다.'}
                    </p>
                  </div>
                </div>

                <textarea
                  value={answerDraft}
                  onChange={(event) => setAnswerDraft(event.target.value)}
                  placeholder={
                    isCodeQuestion(practiceQuestion)
                      ? '여기에 코드와 설명을 함께 작성하세요.'
                      : '여기에 자신의 답안을 작성하세요.'
                  }
                  className={`mt-4 min-h-[240px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 ${
                    isCodeQuestion(practiceQuestion) ? 'font-mono' : ''
                  }`}
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => evaluateMutation.mutate()}
                    disabled={
                      evaluateMutation.isPending ||
                      completeMutation.isPending ||
                      !answerDraft.trim() ||
                      !practiceQuestion
                    }
                    className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {evaluateMutation.isPending ? 'AI 채점 중...' : 'AI 채점 받기'}
                  </button>
                  <button
                    onClick={() =>
                      selectedTask && completeMutation.mutate(selectedTask.id)
                    }
                    disabled={
                      !selectedTask ||
                      selectedTask.status === 'COMPLETED' ||
                      completeMutation.isPending ||
                      !answerDraft.trim()
                    }
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {completeMutation.isPending
                      ? '제출 중...'
                      : selectedTask?.status === 'COMPLETED'
                        ? '제출됨'
                        : '답안 제출'}
                  </button>
                </div>

                {evaluateMutation.error && (
                  <p className="mt-3 text-sm text-rose-500">
                    {(evaluateMutation.error as Error).message}
                  </p>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                AI Feedback
              </p>
              {!evaluation ? (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    답안을 제출하면 바로 피드백을 보여줍니다.
                  </p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    점수, 강점, 보완점, 모범 답안을 한 번에 정리해 줍니다. 채점 후
                    답안 제출을 누르면 오늘의 할 일에서도 바로 반영됩니다.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className={`mt-4 rounded-2xl p-4 ${
                      evaluation.passed
                        ? 'bg-emerald-50 text-emerald-900'
                        : 'bg-amber-50 text-amber-900'
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                      Score
                    </p>
                    <div className="mt-2 flex items-end justify-between">
                      <p className="text-4xl font-bold">{evaluation.score}</p>
                      <p className="text-sm font-semibold">
                        {evaluation.passed ? '통과 가능' : '한 번 더 다듬기'}
                      </p>
                    </div>
                    <p className="mt-3 text-sm">{evaluation.verdict}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">잘한 점</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                      {evaluation.strengths.map((item) => (
                        <li key={item} className="rounded-xl bg-slate-50 px-3 py-2">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">보완 포인트</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                      {evaluation.improvements.map((item) => (
                        <li key={item} className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">모범 답안</p>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {evaluation.modelAnswer || practiceQuestion?.answer || '등록된 모범 답안이 없습니다.'}
                    </pre>
                  </div>

                  <div className="rounded-2xl bg-indigo-50 p-4">
                    <p className="text-sm font-semibold text-indigo-900">다음 한 걸음</p>
                    <p className="mt-2 text-sm leading-6 text-indigo-700">
                      {evaluation.coachingTip ||
                        '모범 답안을 보고 같은 문제를 더 짧고 명확하게 다시 써보세요.'}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Mission Note
              </p>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                {practiceQuestion?.generationReason ||
                  '현재 과제에 맞는 문제를 준비하고 있습니다.'}
              </p>
              <p className="mt-3 text-xs leading-6 text-slate-500">
                문제은행에 승인된 문제가 있으면 우선 사용하고, 없으면 OpenAI 기반
                맞춤 문제를 즉시 생성합니다.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Review;
