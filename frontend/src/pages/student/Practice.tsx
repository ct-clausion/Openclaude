import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { questionsApi } from '../../api/questions';
import { coursesApi } from '../../api/courses';
import { useCourseId } from '../../hooks/useCourseId';
import type { CurriculumSkill, PracticeEvaluation, PracticeQuestion } from '../../types';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  CONCEPTUAL: '개념 확인',
  CODE_COMPLETION: '코드 완성',
  DEBUGGING: '디버깅',
  DESCRIPTIVE: '서술형',
  '서술형': '서술형',
  SCENARIO: '시나리오',
};

const SOURCE_LABELS: Record<string, { label: string; tone: string }> = {
  BANK: { label: '문제은행', tone: 'bg-emerald-50 text-emerald-700' },
  AI: { label: 'AI 생성', tone: 'bg-violet-50 text-violet-700' },
  FALLBACK: { label: '즉시 생성', tone: 'bg-amber-50 text-amber-700' },
};

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  EASY: { label: '쉬움', color: 'text-emerald-600' },
  MEDIUM: { label: '보통', color: 'text-amber-600' },
  HARD: { label: '어려움', color: 'text-rose-600' },
};

function isCodeQuestion(question?: PracticeQuestion | null) {
  if (!question) return false;
  return ['CODE_COMPLETION', 'DEBUGGING'].includes(question.questionType);
}

const Practice: React.FC = () => {
  const courseId = useCourseId();
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [evaluation, setEvaluation] = useState<PracticeEvaluation | null>(null);
  const [questionKey, setQuestionKey] = useState(0); // for fetching new question

  // Fetch skills for the current course
  const { data: skills = [] } = useQuery<CurriculumSkill[]>({
    queryKey: ['courseSkills', courseId],
    queryFn: () => coursesApi.getSkills(courseId!),
    enabled: !!courseId,
  });

  // Fetch a practice question
  const {
    data: practiceQuestion,
    isFetching: isQuestionLoading,
    error: questionError,
  } = useQuery<PracticeQuestion>({
    queryKey: ['practice-free', courseId, selectedSkillId, questionKey],
    queryFn: () =>
      questionsApi.getPracticeQuestion({
        courseId: courseId!,
        skillId: selectedSkillId,
      }),
    enabled: !!courseId,
    staleTime: 0,
  });

  // Evaluate answer
  const evaluateMutation = useMutation({
    mutationFn: async () => {
      if (!practiceQuestion || !courseId) {
        throw new Error('문제가 아직 준비되지 않았습니다.');
      }
      return questionsApi.evaluatePracticeAnswer({
        courseId,
        skillId: selectedSkillId,
        questionType: practiceQuestion.questionType,
        questionContent: practiceQuestion.content,
        referenceAnswer: practiceQuestion.answer,
        explanation: practiceQuestion.explanation,
        studentAnswer: answerDraft,
      });
    },
    onSuccess: (result) => setEvaluation(result),
  });

  const handleNextQuestion = () => {
    setAnswerDraft('');
    setEvaluation(null);
    setQuestionKey((k) => k + 1);
  };

  const handleSkillChange = (skillId: string | null) => {
    setSelectedSkillId(skillId);
    setAnswerDraft('');
    setEvaluation(null);
    setQuestionKey((k) => k + 1);
  };

  if (!courseId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-3">
            <h1 className="text-xl font-bold text-slate-900">문제 풀기</h1>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">먼저 과정을 수강 신청해주세요.</p>
          </div>
        </main>
      </div>
    );
  }

  const diffMeta = DIFFICULTY_LABELS[practiceQuestion?.difficulty ?? 'MEDIUM'] ?? DIFFICULTY_LABELS.MEDIUM;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <h1 className="text-xl font-bold text-slate-900">문제 풀기</h1>
          <p className="text-xs text-slate-500">
            과정의 문제를 자유롭게 풀고 AI 채점을 받아보세요.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {/* Skill filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSkillChange(null)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              selectedSkillId === null
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체
          </button>
          {skills.map((skill) => (
            <button
              key={skill.id}
              onClick={() => handleSkillChange(skill.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                selectedSkillId === skill.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {skill.name}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Question + Answer section */}
          <div className="space-y-6">
            {/* Question card */}
            <motion.div
              key={questionKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
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
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${diffMeta.color}`}>
                    {diffMeta.label}
                  </span>
                  <button
                    onClick={handleNextQuestion}
                    disabled={isQuestionLoading}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    다른 문제
                  </button>
                </div>
              </div>

              {/* Problem */}
              <div className="mt-5 rounded-2xl bg-slate-950 p-5 text-slate-50">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Problem
                </p>
                {isQuestionLoading ? (
                  <div className="space-y-3">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800" />
                    <div className="h-4 w-full animate-pulse rounded bg-slate-800" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-slate-800" />
                  </div>
                ) : questionError ? (
                  <p className="text-sm text-rose-300">
                    문제를 불러오지 못했습니다. 다른 스킬을 선택해보세요.
                  </p>
                ) : (
                  <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-slate-100">
                    {practiceQuestion?.content ?? '문제를 준비하는 중입니다.'}
                  </pre>
                )}
              </div>

              {/* Answer area */}
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-bold text-slate-900">답안 작성</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {isCodeQuestion(practiceQuestion)
                    ? '코드와 설명을 함께 작성하세요.'
                    : '핵심 개념, 근거, 예시를 함께 적으면 더 정확한 피드백을 받을 수 있습니다.'}
                </p>

                <textarea
                  value={answerDraft}
                  onChange={(e) => !evaluation && setAnswerDraft(e.target.value)}
                  readOnly={!!evaluation}
                  placeholder={
                    isCodeQuestion(practiceQuestion)
                      ? '여기에 코드와 설명을 함께 작성하세요.'
                      : '여기에 자신의 답안을 작성하세요.'
                  }
                  className={`mt-4 min-h-[200px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition ${
                    isCodeQuestion(practiceQuestion) ? 'font-mono' : ''
                  } ${
                    evaluation
                      ? 'bg-slate-100 cursor-not-allowed opacity-70'
                      : 'bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100'
                  }`}
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  {!evaluation ? (
                    <button
                      onClick={() => evaluateMutation.mutate()}
                      disabled={
                        evaluateMutation.isPending ||
                        !answerDraft.trim() ||
                        !practiceQuestion
                      }
                      className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {evaluateMutation.isPending ? 'AI 채점 중...' : 'AI 채점 받기'}
                    </button>
                  ) : (
                    <button
                      onClick={handleNextQuestion}
                      className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                    >
                      다음 문제 풀기
                    </button>
                  )}
                </div>

                {evaluateMutation.error && (
                  <p className="mt-3 text-sm text-rose-500">
                    {(evaluateMutation.error as Error).message}
                  </p>
                )}
              </div>
            </motion.div>
          </div>

          {/* Right sidebar - AI Feedback */}
          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                AI Feedback
              </p>
              {!evaluation ? (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-800">
                    답안을 제출하면 AI 피드백을 보여줍니다.
                  </p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    점수, 강점, 보완점, 모범 답안, 코칭 팁을 한 번에 정리해 줍니다.
                  </p>
                </div>
              ) : (
                <>
                  {/* Score */}
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
                        {evaluation.passed ? '통과' : '한 번 더 도전'}
                      </p>
                    </div>
                    <p className="mt-3 text-sm">{evaluation.verdict}</p>
                  </div>

                  {/* Strengths */}
                  {evaluation.strengths.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-900">잘한 점</p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {evaluation.strengths.map((item, i) => (
                          <li key={i} className="rounded-xl bg-slate-50 px-3 py-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Improvements */}
                  {evaluation.improvements.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-900">보완 포인트</p>
                      <ul className="mt-3 space-y-2 text-sm text-slate-600">
                        {evaluation.improvements.map((item, i) => (
                          <li key={i} className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Model answer */}
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">모범 답안</p>
                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {evaluation.modelAnswer || practiceQuestion?.answer || '등록된 모범 답안이 없습니다.'}
                    </pre>
                  </div>

                  {/* Coaching tip */}
                  {evaluation.coachingTip && (
                    <div className="rounded-2xl bg-indigo-50 p-4">
                      <p className="text-sm font-semibold text-indigo-900">코칭 팁</p>
                      <p className="mt-2 text-sm leading-6 text-indigo-700">
                        {evaluation.coachingTip}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Question info */}
            {practiceQuestion && (
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Question Info
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {practiceQuestion.generationReason || '강사가 등록한 문제입니다.'}
                </p>
                {practiceQuestion.explanation && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-indigo-600 hover:underline">
                      힌트 보기
                    </summary>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {practiceQuestion.explanation}
                    </p>
                  </details>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

export default Practice;
