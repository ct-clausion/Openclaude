import React from 'react';
import { motion } from 'framer-motion';
import SVGRadarChart from '../common/SVGRadarChart';
import { useStudentTwin } from '../../hooks/useStudentTwin';
import { useAuthStore } from '../../store/authStore';
import type { RadarChartData } from '../../types';

const MOCK_RADAR: RadarChartData = {
  understanding: 78,
  execution: 65,
  completion: 82,
  forgettingRisk: 45,
  focus: 70,
  confidence: 60,
};

const DEFAULT_INSIGHT =
  '아직 충분한 학습 데이터가 수집되지 않았습니다. 성찰일지 작성, 코드 제출, 복습 수행 등을 통해 AI 분석이 활성화됩니다.';

const TREND_CONFIG = {
  IMPROVING: { label: '개선 중', icon: '↑', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  STABLE: { label: '유지', icon: '→', color: 'text-slate-600', bg: 'bg-slate-50' },
  DECLINING: { label: '하락 중', icon: '↓', color: 'text-rose-600', bg: 'bg-rose-50' },
} as const;

function riskLevel(score: number): {
  label: string;
  color: string;
  bg: string;
} {
  if (score >= 70)
    return { label: '높음', color: 'text-rose-600', bg: 'bg-rose-50' };
  if (score >= 40)
    return { label: '보통', color: 'text-amber-600', bg: 'bg-amber-50' };
  return { label: '낮음', color: 'text-emerald-600', bg: 'bg-emerald-50' };
}

const TwinStateCard: React.FC = () => {
  const { user } = useAuthStore();
  const studentId = user?.id?.toString() ?? '';
  const { data: twin } = useStudentTwin(studentId);

  const hasTwinData = twin && twin.masteryScore != null;
  const radar: RadarChartData = hasTwinData
    ? {
        understanding: twin.masteryScore,
        execution: twin.executionScore,
        completion: 100 - twin.retentionRiskScore,
        forgettingRisk: twin.retentionRiskScore,
        focus: twin.motivationScore,
        confidence: 100 - twin.consultationNeedScore,
      }
    : MOCK_RADAR;

  const radarValues = [
    radar.understanding,
    radar.execution,
    radar.completion,
    radar.forgettingRisk,
    radar.focus,
    radar.confidence,
  ];

  const overallRisk = twin?.overallRiskScore ?? 45;
  const risk = riskLevel(overallRisk);
  const insight = twin?.aiInsight ?? DEFAULT_INSIGHT;
  const trend = twin?.trendDirection ? TREND_CONFIG[twin.trendDirection] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100"
    >
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">나의 학습 트윈</h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          {trend && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${trend.color} ${trend.bg}`}>
              {trend.icon} {trend.label}
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${risk.color} ${risk.bg}`}
          >
            위험도: {risk.label}
          </span>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="flex justify-center my-2 w-full max-w-[220px] mx-auto">
        <SVGRadarChart data={radarValues} size={200} showLabels />
      </div>

      {/* AI Insight */}
      <div className="mt-4 rounded-xl bg-indigo-50/60 border border-indigo-200 p-3.5">
        <div className="flex items-start gap-2">
          <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </span>
          <div>
            <p className="text-xs font-semibold text-indigo-700 mb-1">
              AI 인사이트
            </p>
            <p className="text-xs text-indigo-600 leading-relaxed">
              {insight}
            </p>
          </div>
        </div>
      </div>

      {/* Score Summary */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        {[
          { label: '이해도', value: radar.understanding },
          { label: '수행력', value: radar.execution },
          { label: '자신감', value: radar.confidence },
        ].map((item) => (
          <div
            key={item.label}
            className="text-center rounded-lg bg-slate-50 py-2"
          >
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="text-sm font-bold text-slate-800">{item.value}%</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default TwinStateCard;
