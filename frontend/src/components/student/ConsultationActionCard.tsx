import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { consultationsApi } from '../../api/consultations';
import type { Consultation, ActionPlan } from '../../types';


function parseActionPlans(json: string): ActionPlan[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  SCHEDULED: { text: '예정', color: 'text-indigo-600 bg-indigo-50' },
  COMPLETED: { text: '완료', color: 'text-emerald-600 bg-emerald-50' },
  CANCELLED: { text: '취소', color: 'text-slate-500 bg-slate-100' },
};

const PLAN_STATUS_ICON: Record<string, string> = {
  COMPLETED: '✓',
  IN_PROGRESS: '◐',
  PENDING: '○',
};

interface ConsultationActionCardProps {
  role?: 'student' | 'instructor';
}

const ConsultationActionCard: React.FC<ConsultationActionCardProps> = ({
  role = 'student',
}) => {
  const { data: consultations, isLoading } = useQuery<Consultation[]>({
    queryKey: ['consultations', role],
    queryFn: () => consultationsApi.getConsultations(role),
  });

  const list = consultations ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100"
    >
      <h2 className="text-lg font-bold text-slate-900 mb-4">상담 현황</h2>

      {isLoading && (
        <p className="text-sm text-slate-400 text-center py-6">불러오는 중...</p>
      )}

      {!isLoading && list.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6">상담 내역이 없습니다.</p>
      )}

      <div className="space-y-4">
        {list.map((con) => {
          const statusStyle =
            STATUS_LABEL[con.status] ?? STATUS_LABEL.SCHEDULED;
          const plans = parseActionPlans(con.actionPlanJson);
          const completedPlans = plans.filter(
            (p) => p.status === 'COMPLETED',
          ).length;
          const completionRate =
            plans.length > 0
              ? Math.round((completedPlans / plans.length) * 100)
              : 0;
          const dateStr = new Date(con.scheduledAt).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={con.id}
              className="rounded-xl border border-slate-100 bg-slate-50/50 p-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle.color}`}
                >
                  {statusStyle.text}
                </span>
                <span className="text-xs text-slate-400">{dateStr}</span>
              </div>

              {/* Summary */}
              {con.summaryText && (
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  {con.summaryText}
                </p>
              )}

              {/* Action Plans */}
              {plans.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium text-slate-500">
                      실행 계획
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {completedPlans}/{plans.length} ({completionRate}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                  <div className="space-y-1">
                    {plans.map((plan, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span
                          className={`w-4 text-center ${
                            plan.status === 'COMPLETED'
                              ? 'text-emerald-500'
                              : plan.status === 'IN_PROGRESS'
                                ? 'text-amber-500'
                                : 'text-slate-400'
                          }`}
                        >
                          {PLAN_STATUS_ICON[plan.status] ?? '○'}
                        </span>
                        <span
                          className={`flex-1 ${
                            plan.status === 'COMPLETED'
                              ? 'text-slate-400 line-through'
                              : 'text-slate-600'
                          }`}
                        >
                          {plan.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming - no plans yet */}
              {con.status === 'SCHEDULED' && plans.length === 0 && (
                <div className="text-center py-2">
                  <p className="text-xs text-slate-400">
                    상담 후 실행 계획이 생성됩니다
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ConsultationActionCard;
