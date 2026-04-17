import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { recommendationsApi } from '../../api/recommendations';
import { useCourseId } from '../../hooks/useCourseId';
import { useAuthStore } from '../../store/authStore';
import type { Recommendation } from '../../types';
import { getRecommendationAction, normalizeType } from '../../utils/recommendations';

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: string; accent: string; accentBg: string }
> = {
  review: {
    label: '복습',
    icon: '📖',
    accent: 'from-indigo-500 to-violet-500',
    accentBg: 'bg-indigo-50 text-indigo-700',
  },
  practice: {
    label: '실습',
    icon: '💻',
    accent: 'from-emerald-500 to-teal-500',
    accentBg: 'bg-emerald-50 text-emerald-700',
  },
  consultation: {
    label: '상담',
    icon: '💬',
    accent: 'from-amber-500 to-orange-500',
    accentBg: 'bg-amber-50 text-amber-700',
  },
  resource: {
    label: '자료',
    icon: '📚',
    accent: 'from-sky-500 to-cyan-500',
    accentBg: 'bg-sky-50 text-sky-700',
  },
};

const TRIGGER_LABELS: Record<string, string> = {
  forgetting_curve: '망각 곡선',
  weak_skill: '약점 보강',
  confidence_drop: '자신감 하락',
  skill_gap: '스킬 갭',
  learning_style: '학습 스타일',
};

type FilterType = 'all' | 'review' | 'practice' | 'consultation' | 'resource';

const NextStep: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>('all');
  const { user } = useAuthStore();
  const studentId = user?.id?.toString() ?? '';
  const courseId = useCourseId();

  const { data: recs = [] } = useQuery<Recommendation[]>({
    queryKey: ['recommendations', studentId, courseId],
    queryFn: () => recommendationsApi.getRecommendations(studentId, courseId),
    enabled: !!studentId && !!courseId,
  });

  const list = recs;
  const filtered =
    filter === 'all'
      ? list
      : list.filter((r) => normalizeType(r.recommendationType) === filter);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-[41px] lg:top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">다음 단계 추천</h1>
          <p className="text-xs text-slate-500">
            AI가 분석한 최적의 학습 경로를 확인하세요
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(TYPE_CONFIG).map(([key, config]) => {
            const count = list.filter(
              (r) => normalizeType(r.recommendationType) === key,
            ).length;
            return (
              <div
                key={key}
                className="rounded-xl bg-white border border-slate-100 p-4 text-center"
              >
                <span className="text-xl">{config.icon}</span>
                <p className="text-xs text-slate-500 mt-1">{config.label}</p>
                <p className="text-xl font-bold text-slate-800">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { key: 'all', label: '전체' },
              { key: 'review', label: '복습' },
              { key: 'practice', label: '실습' },
              { key: 'consultation', label: '상담' },
              { key: 'resource', label: '자료' },
            ] as { key: FilterType; label: string }[]
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Recommendation cards */}
        <div className="space-y-4">
          {filtered.map((rec, i) => {
            const config =
              TYPE_CONFIG[normalizeType(rec.recommendationType)] ?? TYPE_CONFIG.review;
            const triggerLabel =
              TRIGGER_LABELS[rec.triggerEvent] ?? rec.triggerEvent;
            const action = getRecommendationAction(rec.recommendationType);

            return (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative rounded-2xl bg-white border border-slate-100 p-5 hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Gradient accent bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${config.accent}`}
                />

                <div className="flex items-start gap-4 pl-3">
                  <span className="text-2xl shrink-0 mt-0.5">
                    {config.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${config.accentBg}`}
                      >
                        {config.label}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                        {triggerLabel}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {new Date(rec.createdAt).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">
                      {rec.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed mb-2 line-clamp-2">
                      {rec.reasonSummary}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-emerald-600 font-medium flex-1 min-w-0 line-clamp-1">
                        예상 효과: {rec.expectedOutcome}
                      </p>
                      <button
                        onClick={() => navigate(action.path)}
                        className="shrink-0 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
                      >
                        {action.label}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {filtered.length === 0 && (
            filter === 'all' ? (
              <div className="rounded-2xl bg-white border border-slate-100 p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.346a3.5 3.5 0 01-4.95 0l-.347-.346z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">아직 추천이 없습니다</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    AI가 학습 데이터를 분석하여 맞춤 학습 경로를 추천합니다.
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-left space-y-2">
                  <p className="text-xs font-semibold text-slate-600 mb-2">추천이 비어 있는 이유</p>
                  <div className="flex items-start gap-2 text-xs text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                    수강 중인 과정이 없거나, 학습 데이터가 충분히 쌓이지 않았습니다.
                  </div>
                  <p className="text-xs font-semibold text-slate-600 mt-3 mb-2">추천을 받으려면</p>
                  <div className="flex items-start gap-2 text-xs text-slate-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                    과정을 수강하고, 복습과 성찰을 작성하면 추천이 시작됩니다.
                  </div>
                </div>
                <button
                  onClick={() => navigate('/student/courses')}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                >
                  과정 둘러보기
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-slate-400">해당 유형의 추천이 없습니다</p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
};

export default NextStep;
