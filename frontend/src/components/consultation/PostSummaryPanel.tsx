import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { consultationsApi } from '../../api/consultations';

interface ActionItem {
  id: string;
  day: string;
  task: string;
  completed: boolean;
}

export default function PostSummaryPanel({ consultationId }: { consultationId?: string }) {
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [summaryText, setSummaryText] = useState('');
  const [saved, setSaved] = useState(false);

  // Load existing consultation data
  const { data: consultation } = useQuery({
    queryKey: ['consultation-detail', consultationId],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/consultations/${consultationId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!consultationId,
  });

  useEffect(() => {
    if (!consultation) return;
    if (consultation.summaryText) setSummaryText(consultation.summaryText);
    if (consultation.actionPlanJson) {
      try {
        const plans = typeof consultation.actionPlanJson === 'string'
          ? JSON.parse(consultation.actionPlanJson)
          : consultation.actionPlanJson;
        if (Array.isArray(plans) && plans.length > 0) {
          setActionItems(plans.map((p: any, i: number) => ({
            id: `a${i}`,
            day: p.day ?? p.dueDate ?? `Day ${i + 1}`,
            task: p.task ?? p.title ?? '',
            completed: p.completed ?? p.status === 'COMPLETED',
          })));
        }
      } catch { /* ignore parse errors */ }
    }
  }, [consultation]);

  const toggleItem = (id: string) => {
    setActionItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!consultationId) throw new Error('No consultation ID');
      return consultationsApi.saveSummary(consultationId, {
        summaryText,
        actionPlanJson: JSON.stringify(actionItems),
      });
    },
    onSuccess: () => setSaved(true),
  });

  const completedCount = actionItems.filter((i) => i.completed).length;
  const hasSummary = summaryText.trim().length > 0;
  const hasActionItems = actionItems.length > 0;

  return (
    <div className="h-full bg-white rounded-2xl p-5 space-y-4 overflow-y-auto">
      {/* Summary Card */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">상담 요약</h4>
        {hasSummary ? (
          <p className="text-sm text-slate-700 leading-relaxed">{summaryText}</p>
        ) : (
          <textarea
            value={summaryText}
            onChange={(e) => setSummaryText(e.target.value)}
            placeholder="상담 내용을 요약해주세요..."
            rows={4}
            className="w-full text-sm text-slate-700 leading-relaxed border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400"
          />
        )}
      </div>

      {/* Action Plan */}
      {hasActionItems ? (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
              액션플랜
            </h4>
            <span className="text-[11px] text-indigo-500 font-medium">
              {completedCount}/{actionItems.length} 완료
            </span>
          </div>

          <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${actionItems.length > 0 ? (completedCount / actionItems.length) * 100 : 0}%` }}
            />
          </div>

          <div className="space-y-2">
            {actionItems.map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-2.5 cursor-pointer group"
              >
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    item.completed
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-indigo-300 group-hover:border-indigo-500'
                  }`}
                >
                  {item.completed && (
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div>
                  <span className="text-[11px] font-semibold text-indigo-600">{item.day}</span>
                  <p className={`text-xs leading-relaxed transition-all ${
                    item.completed ? 'text-slate-400 line-through' : 'text-slate-700'
                  }`}>
                    {item.task}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
          <p className="text-sm text-slate-400">상담 완료 후 AI가 액션플랜을 생성합니다</p>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || saved || !summaryText.trim()}
        className={`w-full py-3 text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-200 ${
          saved
            ? 'bg-emerald-600 text-white'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
        }`}
      >
        {saved ? '저장 완료' : saveMutation.isPending ? '저장 중...' : '상담 요약 저장'}
      </button>

      {saveMutation.isError && (
        <p className="text-xs text-rose-500 text-center">저장 실패. 다시 시도해주세요.</p>
      )}
    </div>
  );
}
