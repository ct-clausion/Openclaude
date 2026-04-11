import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { instructorApi } from '../../api/instructor';
import { useCourseId } from '../../hooks/useCourseId';
import TagChip from '../common/TagChip';

interface RiskStudent {
  id: string;
  name: string;
  reasons: string[];
}

const MOCK_RISK_STUDENTS: RiskStudent[] = [
  { id: '5', name: '정예린', reasons: ['이해도 급락', '3주 연속 하락'] },
  { id: '10', name: '오민서', reasons: ['과제 미제출', '망각 위험'] },
  { id: '16', name: '황시우', reasons: ['출석률 저하', '동기 저하'] },
  { id: '24', name: '백승현', reasons: ['자신감 하락', '수행력 부족'] },
];

export default function RiskAlertBanner() {
  const courseId = useCourseId();
  const navigate = useNavigate();

  const { data: students = MOCK_RISK_STUDENTS } = useQuery({
    queryKey: ['instructor', 'risk-alerts', courseId],
    queryFn: async () => {
      const entries = await instructorApi.getCourseStudents(courseId!);
      // Filter high-risk students (overallRiskScore >= 0.5) and map to UI format
      return entries
        .filter((e) => Number(e.overallRiskScore) >= 0.5)
        .map((e) => {
          const reasons: string[] = [];
          if (Number(e.masteryScore) < 50) reasons.push('이해도 부족');
          if (Number(e.motivationScore) < 50) reasons.push('동기 저하');
          if (Number(e.overallRiskScore) >= 0.7) reasons.push('고위험');
          if (e.aiInsight) reasons.push(e.aiInsight.slice(0, 20));
          return { id: String(e.studentId), name: e.studentName, reasons };
        });
    },
    enabled: !!courseId,
    placeholderData: MOCK_RISK_STUDENTS,
    staleTime: 30_000,
  });

  if (students.length === 0) return null;

  return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex items-center justify-center w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-bold">
          {students.length}
          <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-40" />
        </span>
        <h3 className="text-sm font-semibold text-rose-800">
          즉시 개입이 필요한 학생
        </h3>
      </div>

      <div className="space-y-2">
        {students.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between p-3 rounded-xl bg-white/80 border border-rose-100"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-xs font-bold text-rose-700">
                {s.name.charAt(0)}
              </div>
              <div>
                <span className="text-sm font-medium text-slate-800">{s.name}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {s.reasons.map((r) => (
                    <TagChip key={r} label={r} color="rose" size="sm" />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => navigate('/instructor/consultations', { state: { preselectedStudentId: s.id, preselectedStudentName: s.name } })}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
              >
                상담 예약
              </button>
              <button
                onClick={() => navigate('/instructor/consultations', { state: { preselectedStudentId: s.id, preselectedStudentName: s.name, immediateContact: true } })}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors"
              >
                즉시 연락
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
