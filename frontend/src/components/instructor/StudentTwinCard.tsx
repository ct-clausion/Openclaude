import type { StudentTwinEntry } from '../../api/instructor';
import RiskIndicator from '../common/RiskIndicator';

interface StudentTwinCardProps {
  twin: StudentTwinEntry;
  onClick?: () => void;
}

function riskLevel(score: number): 'safe' | 'caution' | 'danger' {
  if (score >= 70) return 'danger';
  if (score >= 40) return 'caution';
  return 'safe';
}

function ScorePill({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const effective = invert ? 100 - value : value;
  const color =
    effective >= 70 ? 'text-emerald-700 bg-emerald-50' :
    effective >= 40 ? 'text-amber-700 bg-amber-50' :
    'text-rose-700 bg-rose-50';

  return (
    <div className={`flex flex-col items-center px-2 py-1.5 rounded-lg ${color}`}>
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

const TREND_LABEL: Record<string, { icon: string; color: string }> = {
  IMPROVING: { icon: '↑', color: 'text-emerald-600' },
  STABLE: { icon: '→', color: 'text-slate-500' },
  DECLINING: { icon: '↓', color: 'text-rose-600' },
};

export default function StudentTwinCard({ twin, onClick }: StudentTwinCardProps) {
  const risk = riskLevel(twin.overallRiskScore);
  const riskPercent = Math.round(twin.overallRiskScore);
  const trend = twin.trendDirection ? TREND_LABEL[twin.trendDirection] : null;
  const updatedDate = twin.updatedAt
    ? new Date(twin.updatedAt).toLocaleDateString('ko-KR', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div
      onClick={onClick}
      className={`bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-4 ${
        onClick ? 'cursor-pointer hover:shadow-xl transition-shadow' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
            {twin.studentName.charAt(0)}
          </div>
          <span className="text-sm font-semibold text-slate-800">{twin.studentName}</span>
        </div>
        <RiskIndicator level={risk} size="sm" />
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <ScorePill label="이해도" value={twin.masteryScore} />
        <ScorePill label="수행력" value={twin.executionScore} />
        <ScorePill label="동기" value={twin.motivationScore} />
        <ScorePill label="위험도" value={riskPercent} invert />
      </div>

      {twin.aiInsight && (
        <p className="text-[11px] text-slate-600 leading-relaxed mb-2 line-clamp-2">
          {twin.aiInsight}
        </p>
      )}

      <div className="flex items-center justify-between">
        {updatedDate && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">마지막 업데이트</span>
            <span className="text-[11px] text-slate-500">{updatedDate}</span>
          </div>
        )}
        {trend && (
          <span className={`text-[11px] font-semibold ${trend.color}`}>
            {trend.icon} {twin.trendDirection === 'IMPROVING' ? '개선' : twin.trendDirection === 'DECLINING' ? '하락' : '유지'}
          </span>
        )}
      </div>
    </div>
  );
}
