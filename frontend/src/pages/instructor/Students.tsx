import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { instructorApi, type StudentTwinEntry } from '../../api/instructor';
import { useCourseId } from '../../hooks/useCourseId';
import StudentTwinCard from '../../components/instructor/StudentTwinCard';

type SortKey = 'name' | 'risk' | 'updated';
type FilterRisk = 'all' | 'danger' | 'caution' | 'safe';

export default function Students() {
  const navigate = useNavigate();
  const courseId = useCourseId();
  const [sortBy, setSortBy] = useState<SortKey>('risk');
  const [filterRisk, setFilterRisk] = useState<FilterRisk>('all');
  const [search, setSearch] = useState('');
  // Lowers filter work off the critical keystroke path on large rosters.
  const deferredSearch = useDeferredValue(search).trim().toLowerCase();

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['instructor', 'students', courseId],
    queryFn: () => instructorApi.getCourseStudents(courseId!),
    enabled: !!courseId,
    staleTime: 30_000,
  });

  const riskLevel = (score: number) => {
    if (score >= 70) return 'danger';
    if (score >= 40) return 'caution';
    return 'safe';
  };

  const filtered = students
    .filter((s: StudentTwinEntry) => {
      if (filterRisk !== 'all' && riskLevel(s.overallRiskScore) !== filterRisk) return false;
      if (deferredSearch && !s.studentName.toLowerCase().includes(deferredSearch)) return false;
      return true;
    })
    .sort((a: StudentTwinEntry, b: StudentTwinEntry) => {
      switch (sortBy) {
        case 'risk': return b.overallRiskScore - a.overallRiskScore;
        case 'name': return a.studentName.localeCompare(b.studentName);
        case 'updated': return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
        default: return 0;
      }
    });

  const counts = {
    all: students.length,
    danger: students.filter((s) => riskLevel(s.overallRiskScore) === 'danger').length,
    caution: students.filter((s) => riskLevel(s.overallRiskScore) === 'caution').length,
    safe: students.filter((s) => riskLevel(s.overallRiskScore) === 'safe').length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <header className="sticky top-[41px] lg:top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-base font-bold text-slate-800">학생 관리</h1>
          <p className="text-xs text-slate-500">총 {students.length}명 · 위험 {counts.danger}명 · 주의 {counts.caution}명</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Controls */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="학생 검색..."
            className="px-4 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-indigo-400 w-48"
          />

          <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-300 p-1">
            {(['all', 'danger', 'caution', 'safe'] as FilterRisk[]).map((f) => {
              const labels: Record<FilterRisk, string> = { all: '전체', danger: '위험', caution: '주의', safe: '안전' };
              return (
                <button
                  key={f}
                  onClick={() => setFilterRisk(f)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    filterRisk === f ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {labels[f]} ({counts[f]})
                </button>
              );
            })}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-indigo-400 ml-auto"
          >
            <option value="risk">위험도순</option>
            <option value="name">이름순</option>
            <option value="updated">최근 업데이트순</option>
          </select>
        </div>

        {/* Student Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <StudentTwinCard
              key={s.studentId}
              twin={s}
              onClick={() => navigate(`/instructor/students/${s.studentId}`, {
                state: { studentName: s.studentName },
              })}
            />
          ))}
        </div>

        {isLoading && (
          <div className="text-center py-12 text-sm text-slate-400">
            학생 데이터를 불러오는 중...
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-400">
            {students.length === 0 ? '등록된 학생이 없습니다' : '조건에 맞는 학생이 없습니다'}
          </div>
        )}
      </main>
    </div>
  );
}
