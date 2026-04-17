import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { operatorApi } from '../../api/operator';
import { twinApi } from '../../api/twin';
import GlassCard from '../../components/common/GlassCard';

interface SimulationResult {
  currentScores: Record<string, number>;
  projectedScores: Record<string, number>;
  confidence: number;
  aiInterpretation: string;
  recommendation: string;
}

export default function WhatIfSimulation() {
  const [scenarioType, setScenarioType] = useState('ADD_CONSULTATION');
  const [targetStudentId, setTargetStudentId] = useState('');
  const [targetCourseId, setTargetCourseId] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);

  // Clear stale result whenever the simulation inputs change — prevents a previous
  // scenario's numbers from being mistaken for the current selection.
  useEffect(() => {
    setResult(null);
  }, [scenarioType, targetStudentId, targetCourseId]);

  const { data: students } = useQuery({
    queryKey: ['operator', 'students'],
    queryFn: operatorApi.getStudents,
  });

  const { data: courses } = useQuery({
    queryKey: ['operator', 'courses'],
    queryFn: operatorApi.getCourses,
  });

  // 선택된 학생의 Twin 데이터 조회
  const { data: studentTwin } = useQuery({
    queryKey: ['twin', targetStudentId],
    queryFn: () => twinApi.getStudentTwin(targetStudentId),
    enabled: !!targetStudentId,
  });

  // 학생 활동 지표 계산 (Twin 데이터 기반)
  const activityMetrics = useMemo(() => {
    if (!studentTwin) return null;
    const selectedStudent = students?.find(s => s.id === targetStudentId);
    return {
      복습_빈도: Math.round((studentTwin.masteryScore ?? 50) * 0.8),
      화상_상담_횟수: Math.round((100 - (studentTwin.consultationNeedScore ?? 50)) * 0.3),
      챗봇_질문_빈도: Math.round((studentTwin.motivationScore ?? 50) * 0.6),
      출석률: selectedStudent ? `${(selectedStudent.attendanceRate * 100).toFixed(0)}%` : '-',
      숙련도: studentTwin.masteryScore?.toFixed(0) ?? '-',
      동기_점수: studentTwin.motivationScore?.toFixed(0) ?? '-',
      이탈_위험: `${Math.round(studentTwin.overallRiskScore ?? 0)}%`,
    };
  }, [studentTwin, students, targetStudentId]);

  const simulateMutation = useMutation({
    mutationFn: operatorApi.simulate,
    onSuccess: (data) => setResult(data),
  });

  const handleSimulate = () => {
    simulateMutation.mutate({
      scenarioType,
      targetStudentId: targetStudentId || undefined,
      targetCourseId: targetCourseId || undefined,
    });
  };

  const scenarios = [
    { value: 'ADD_CONSULTATION', label: '상담 배정', desc: '위험 수강생에게 강사 1:1 상담을 배정하면 Twin 점수가 어떻게 변할까?' },
    { value: 'ADD_SESSION', label: '보충 세션', desc: '난이도 높은 구간에 보충 수업을 추가하면 과정 수료율이 어떻게 변할까?' },
    { value: 'REBALANCE_INSTRUCTOR', label: '강사 재배정', desc: '과부하 강사의 학생을 다른 강사에게 이동하면 전체 성과가 어떻게 변할까?' },
  ];

  const scoreLabels: Record<string, string> = {
    mastery: '숙련도',
    execution: '실행력',
    motivation: '동기',
    retentionRisk: '이탈 위험',
    consultationNeed: '상담 필요도',
    overallRisk: '종합 위험도',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">AI What-if 시뮬레이션</h1>
        <p className="text-sm text-slate-500 mt-1">가상의 개입 시나리오를 실행하고 예상 결과를 확인합니다.</p>
      </div>

      {/* Scenario selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {scenarios.map((s) => (
          <button
            key={s.value}
            onClick={() => setScenarioType(s.value)}
            className={`p-4 rounded-xl text-left transition-all ${
              scenarioType === s.value
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300'
            }`}
          >
            <p className="text-sm font-bold">{s.label}</p>
            <p className={`text-xs mt-1 ${scenarioType === s.value ? 'text-indigo-100' : 'text-slate-400'}`}>{s.desc}</p>
          </button>
        ))}
      </div>

      {/* Inputs */}
      <GlassCard className="p-5">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">대상 수강생</label>
            <select
              value={targetStudentId}
              onChange={(e) => {
                const sid = e.target.value;
                setTargetStudentId(sid);
                const selected = students?.find(s => s.id === sid);
                setTargetCourseId(selected?.courseId ?? '');
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="">수강생 선택</option>
              {students?.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.courseTitle})</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">대상 과정</label>
            <select
              value={targetCourseId}
              onChange={(e) => setTargetCourseId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="">과정 선택</option>
              {(targetStudentId
                ? courses?.filter((c) => {
                    const selectedStudent = students?.find(s => String(s.id) === String(targetStudentId));
                    return String(selectedStudent?.courseId ?? '') === String(c.id);
                  })
                : courses
              )?.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSimulate}
            disabled={simulateMutation.isPending}
            className="px-6 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {simulateMutation.isPending ? '시뮬레이션 중...' : '시뮬레이션 실행'}
          </button>
        </div>
      </GlassCard>

      {/* 학생 활동 지표 */}
      {activityMetrics && (
        <GlassCard className="p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-3">선택 학생 활동 지표</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(activityMetrics).map(([key, val]) => (
              <div key={key} className="p-3 rounded-lg bg-slate-50 text-center">
                <p className="text-lg font-bold text-slate-800">{val}</p>
                <p className="text-xs font-medium text-slate-500 mt-1">{key.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">* Twin 데이터 기반 추정치. 복습 빈도/챗봇 질문은 숙련도·동기 점수에서 산출됩니다.</p>
        </GlassCard>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Score comparison */}
          <GlassCard className="p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4">점수 변화 예측</h2>
            <div className="space-y-3">
              {Object.keys(result.currentScores).map((key) => {
                const current = result.currentScores[key];
                const projected = result.projectedScores[key];
                const diff = projected - current;
                return (
                  <div key={key} className="flex items-center gap-4">
                    <span className="text-sm text-slate-600 w-24">{scoreLabels[key] ?? key}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 w-10 text-right">{current.toFixed(0)}</span>
                      <span className="text-slate-400">&#8594;</span>
                      <span className="text-sm font-bold text-slate-800 w-10">{projected.toFixed(0)}</span>
                      <span className={`text-xs font-bold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-400">신뢰도: {(result.confidence * 100).toFixed(0)}%</p>
            </div>
          </GlassCard>

          {/* AI Interpretation */}
          <GlassCard className="p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-2">AI 해석</h2>
            <p className="text-sm text-slate-700">{result.aiInterpretation}</p>
          </GlassCard>

          {/* Recommendation */}
          <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
            <p className="text-sm font-bold text-indigo-800">권장 사항</p>
            <p className="text-sm text-indigo-700 mt-1">{result.recommendation}</p>
          </div>
        </div>
      )}

      {simulateMutation.isError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
          <p className="text-sm text-rose-700">시뮬레이션 실행 중 오류가 발생했습니다.</p>
        </div>
      )}
    </div>
  );
}
