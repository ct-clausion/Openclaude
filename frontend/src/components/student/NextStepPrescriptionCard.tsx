import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { recommendationsApi } from '../../api/recommendations';
import { useAuthStore } from '../../store/authStore';
import type { Recommendation } from '../../types';
import { getRecommendationAction } from '../../utils/recommendations';

const MOCK_RECS: Recommendation[] = [
  {
    id: 'r1',
    studentId: 's1',
    courseId: 'c1',
    recommendationType: 'review',
    title: '재귀 함수 복습 미니퀴즈',
    reasonSummary: '망각 곡선 기반 - 3일 후 기억 잔존율 38%',
    triggerEvent: 'forgetting_curve',
    expectedOutcome: '기억 정착률 40% 향상 예상',
    createdAt: '2026-04-08T09:00:00Z',
  },
  {
    id: 'r2',
    studentId: 's1',
    courseId: 'c1',
    recommendationType: 'practice',
    title: '정렬 알고리즘 코딩 연습',
    reasonSummary: '지난 과제 수행력 부족 - 버블소트 구현 실패',
    triggerEvent: 'weak_skill',
    expectedOutcome: '수행력 점수 15점 상승 예상',
    createdAt: '2026-04-08T09:00:00Z',
  },
  {
    id: 'r3',
    studentId: 's1',
    courseId: 'c1',
    recommendationType: 'consultation',
    title: '강사 상담 예약',
    reasonSummary: '학습 자신감 하락 추세 감지',
    triggerEvent: 'confidence_drop',
    expectedOutcome: '맞춤 학습 전략 수립',
    createdAt: '2026-04-08T09:00:00Z',
  },
];

const TYPE_STYLES: Record<string, { accent: string; icon: string }> = {
  review: { accent: 'from-indigo-500 to-violet-500', icon: '📖' },
  practice: { accent: 'from-emerald-500 to-teal-500', icon: '💻' },
  consultation: { accent: 'from-amber-500 to-orange-500', icon: '💬' },
};

const NextStepPrescriptionCard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const studentId = user?.id?.toString() ?? '';
  const { data: recs } = useQuery<Recommendation[]>({
    queryKey: ['recommendations', studentId],
    queryFn: () => recommendationsApi.getRecommendations(studentId),
    enabled: !!studentId,
    placeholderData: MOCK_RECS,
  });

  const list = recs ?? MOCK_RECS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100"
    >
      <h2 className="text-lg font-bold text-slate-900 mb-4">
        다음 단계 처방
      </h2>

      <div className="space-y-3">
        {list.map((rec, i) => {
          const style = TYPE_STYLES[rec.recommendationType] ?? TYPE_STYLES.review;
          const isFirst = i === 0;
          const action = getRecommendationAction(rec.recommendationType);
          return (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`relative rounded-xl border p-4 transition-all hover:shadow-sm ${
                isFirst
                  ? 'border-indigo-200 bg-indigo-50/40'
                  : 'border-slate-100 bg-slate-50/50'
              }`}
            >
              {/* Gradient accent bar */}
              {isFirst && (
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b ${style.accent}`}
                />
              )}

              <div className="flex items-start gap-3">
                <span className="text-lg">{style.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {rec.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {rec.reasonSummary}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1.5 font-medium">
                    예상: {rec.expectedOutcome}
                  </p>
                </div>
                <button
                  onClick={() => navigate(action.path)}
                  className="shrink-0 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  {action.label}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default NextStepPrescriptionCard;
