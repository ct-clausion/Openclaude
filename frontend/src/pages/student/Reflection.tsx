import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { reflectionsApi } from '../../api/reflections';
import { twinApi } from '../../api/twin';
import ReflectionTimeline from '../../components/student/ReflectionTimeline';
import { useCourseId } from '../../hooks/useCourseId';
import { useAuthStore } from '../../store/authStore';

interface ReflectionForm {
  todayContent: string;
  stuckPoint: string;
  confidence: number;
  freeText: string;
}

const initialForm: ReflectionForm = {
  todayContent: '',
  stuckPoint: '',
  confidence: 3,
  freeText: '',
};

const Reflection: React.FC = () => {
  const [form, setForm] = useState<ReflectionForm>(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const courseId = useCourseId();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const studentId = user?.id?.toString() ?? '';

  // Fetch Twin data for AI sidebar (replaces hardcoded constants)
  const { data: twin } = useQuery({
    queryKey: ['twin', studentId, courseId],
    queryFn: () => twinApi.getStudentTwin(studentId, courseId),
    enabled: !!studentId && !!courseId,
  });

  const { data: prevReflections } = useQuery({
    queryKey: ['reflections', studentId, courseId],
    queryFn: () => reflectionsApi.getReflections(studentId, courseId),
    enabled: !!studentId && !!courseId,
  });

  // Dynamic AI sidebar content based on real data
  const aiReason = twin?.aiInsight
    ?? '학습 데이터가 쌓이면 AI가 맞춤 분석을 제공합니다. 오늘의 성찰을 작성해보세요.';
  const prevComparison = (() => {
    if (!prevReflections || prevReflections.length < 2) return '이전 성찰이 쌓이면 자신감 추이를 비교해드립니다.';
    const prev = prevReflections[prevReflections.length - 1];
    const latest = prevReflections[0];
    const diff = (latest.selfConfidenceScore ?? 0) - (prev.selfConfidenceScore ?? 0);
    if (diff > 0) return `이전 성찰 대비 자신감이 ${diff}점 상승했습니다. 꾸준한 성장이 보입니다!`;
    if (diff < 0) return `이전 성찰 대비 자신감이 ${Math.abs(diff)}점 하락했습니다. 어려운 부분을 복습해보세요.`;
    return '이전 성찰과 동일한 자신감 수준입니다. 꾸준히 유지하고 있어요.';
  })();
  const nextReviewDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]})`;
  })();

  const mutation = useMutation({
    mutationFn: () => {
      if (!courseId) throw new Error('과정이 선택되지 않았습니다');
      return reflectionsApi.createReflection({
        courseId: Number(courseId),
        content: [
          `[오늘 학습] ${form.todayContent}`,
          `[자유 성찰] ${form.freeText}`,
        ].join('\n'),
        stuckPoint: form.stuckPoint,
        selfConfidenceScore: form.confidence,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reflections', studentId, courseId] });
      setSubmitted(true);
    },
  });

  const update = (key: keyof ReflectionForm, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-[41px] lg:top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">학습 성찰</h1>
          <p className="text-xs text-slate-500">
            오늘의 학습을 돌아보고 트윈을 업데이트하세요
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* Form (3/5) */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6">
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl bg-white p-8 shadow-sm border border-slate-100 text-center"
              >
                <div className="text-4xl mb-3">🎉</div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">
                  학습 성찰이 저장되었습니다!
                </h2>
                <p className="text-sm text-slate-500 mb-4">
                  트윈이 업데이트되었어요. 다음 복습은{' '}
                  <span className="font-semibold text-indigo-600">
                    {nextReviewDate}
                  </span>{' '}
                  에 예정되어 있습니다.
                </p>
                <button
                  onClick={() => {
                    setForm(initialForm);
                    setSubmitted(false);
                  }}
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  새 성찰 작성
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 space-y-5"
              >
                {/* 오늘 학습한 내용 */}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    오늘 학습한 내용
                  </label>
                  <textarea
                    value={form.todayContent}
                    onChange={(e) => update('todayContent', e.target.value)}
                    rows={3}
                    placeholder="오늘 어떤 내용을 학습했나요?"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-y"
                  />
                </div>

                {/* 막힌 지점 */}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    막힌 지점
                  </label>
                  <textarea
                    value={form.stuckPoint}
                    onChange={(e) => update('stuckPoint', e.target.value)}
                    rows={2}
                    placeholder="학습 중 이해가 안 되거나 어려웠던 부분이 있나요?"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-y"
                  />
                </div>

                {/* 자신감 점수 */}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    자신감 점수
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => update('confidence', star)}
                        className="focus:outline-none"
                      >
                        <span
                          className={`text-2xl transition-colors ${
                            star <= form.confidence
                              ? 'text-amber-400'
                              : 'text-slate-300 hover:text-amber-300'
                          }`}
                        >
                          ★
                        </span>
                      </button>
                    ))}
                    <span className="ml-2 text-sm text-slate-500">
                      {form.confidence}/5
                    </span>
                  </div>
                </div>

                {/* 자유 성찰 */}
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    자유 성찰
                  </label>
                  <textarea
                    value={form.freeText}
                    onChange={(e) => update('freeText', e.target.value)}
                    rows={3}
                    placeholder="자유롭게 오늘의 학습을 돌아보세요"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 resize-y"
                  />
                </div>

                <button
                  onClick={() => mutation.mutate()}
                  disabled={
                    mutation.isPending || !form.todayContent.trim() || !courseId
                  }
                  className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {mutation.isPending ? (
                    <>
                      <svg
                        className="animate-spin w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      저장 중...
                    </>
                  ) : (
                    '성찰 저장 및 트윈 업데이트'
                  )}
                </button>
              </motion.div>
            )}

            {/* Previous reflections */}
            <ReflectionTimeline />
          </div>

          {/* Right sidebar (2/5) */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5">
            {/* AI 추천 이유 */}
            <div className="rounded-2xl bg-indigo-50/60 border border-indigo-200 p-5">
              <h3 className="text-sm font-bold text-indigo-800 mb-2">
                AI 추천 이유
              </h3>
              <p className="text-xs text-indigo-600 leading-relaxed">
                {aiReason}
              </p>
            </div>

            {/* 이전 성찰 비교 */}
            <div className="rounded-2xl bg-emerald-50/60 border border-emerald-100 p-5">
              <h3 className="text-sm font-bold text-emerald-800 mb-2">
                이전 성찰 비교
              </h3>
              <p className="text-xs text-emerald-600 leading-relaxed">
                {prevComparison}
              </p>
            </div>

            {/* 다음 복습 예정일 */}
            <div className="rounded-2xl bg-amber-50/60 border border-amber-100 p-5">
              <h3 className="text-sm font-bold text-amber-800 mb-2">
                다음 복습 예정일
              </h3>
              <p className="text-lg font-bold text-amber-700">
                {nextReviewDate}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                망각 곡선 기반 최적 타이밍
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Reflection;
