import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import GlassCard from '../../components/common/GlassCard';

interface TodaySession {
  sessionId: string;
  courseId: string;
  courseTitle: string;
  sessionDate: string;
  sessionTitle: string | null;
  sessionNumber: number;
  status: string;
  checkInTime: string | null;
  canCheckIn: boolean;
}

interface MyCourseAttendance {
  courseId: string;
  courseTitle: string;
  presentCount: number;
  totalCount: number;
  attendanceRate: number;
  recentRecords: Array<{ sessionDate: string; sessionTitle: string | null; status: string }>;
}

const statusLabel: Record<string, string> = {
  PRESENT: '출석',
  LATE: '지각',
  ABSENT: '결석',
  EXCUSED: '공결',
  NO_RECORD: '기록 없음',
};

const statusColor: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  LATE: 'bg-amber-100 text-amber-700',
  ABSENT: 'bg-rose-100 text-rose-700',
  EXCUSED: 'bg-sky-100 text-sky-700',
  NO_RECORD: 'bg-slate-100 text-slate-500',
};

export default function StudentAttendance() {
  const queryClient = useQueryClient();

  const { data: todaySessions, isLoading: todayLoading } = useQuery({
    queryKey: ['student', 'attendance', 'today'],
    queryFn: () => api.get<TodaySession[]>('/api/attendance/today'),
  });

  const { data: myAttendance, isLoading: myLoading } = useQuery({
    queryKey: ['student', 'attendance', 'my'],
    queryFn: () => api.get<MyCourseAttendance[]>('/api/attendance/my'),
  });

  const checkInMutation = useMutation({
    mutationFn: (sessionId: string) =>
      api.post<{ message: string }>('/api/attendance/check-in', { sessionId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', 'attendance'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">출결 관리</h1>
        <p className="text-sm text-slate-500 mt-1">오늘 수업 출석 체크 및 내 출결 현황</p>
      </div>

      {/* 오늘 출석 체크 */}
      <GlassCard className="p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4">오늘 수업</h2>
        {todayLoading ? (
          <p className="text-sm text-slate-400">로딩 중...</p>
        ) : todaySessions && todaySessions.length > 0 ? (
          <div className="space-y-3">
            {todaySessions.map((session) => (
              <div
                key={session.sessionId}
                className="flex items-center justify-between p-4 rounded-lg border border-slate-200"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">{session.courseTitle}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {session.sessionTitle ?? `${session.sessionNumber}교시`} · {session.sessionDate}
                  </p>
                  {session.checkInTime && (
                    <p className="text-xs text-emerald-600 mt-1">
                      체크인: {session.checkInTime.slice(11, 16)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusColor[session.status] ?? statusColor.NO_RECORD}`}>
                    {statusLabel[session.status] ?? session.status}
                  </span>
                  {session.canCheckIn && (
                    <button
                      onClick={() => checkInMutation.mutate(session.sessionId)}
                      disabled={checkInMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {checkInMutation.isPending ? '처리 중...' : '출석하기'}
                    </button>
                  )}
                  {session.status === 'PRESENT' && (
                    <span className="text-emerald-500 text-lg">✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">오늘 예정된 수업이 없습니다.</p>
        )}

        {checkInMutation.isError && (
          <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200">
            <p className="text-sm text-rose-700">
              {(checkInMutation.error as Error)?.message ?? '출석 처리에 실패했습니다.'}
            </p>
          </div>
        )}
      </GlassCard>

      {/* 과정별 출결 현황 */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-3">과정별 출결 현황</h2>
        {myLoading ? (
          <p className="text-sm text-slate-400">로딩 중...</p>
        ) : myAttendance && myAttendance.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myAttendance.map((course) => {
              const pct = Math.round((course.attendanceRate ?? 0) * 100);
              const noSessions = course.totalCount === 0;
              const barColor =
                pct >= 90 ? 'bg-emerald-500'
                : pct >= 70 ? 'bg-sky-500'
                : pct >= 50 ? 'bg-amber-400'
                : 'bg-rose-500';
              return (
                <GlassCard key={course.courseId} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900">{course.courseTitle}</h3>
                    {noSessions ? (
                      <span className="text-xs font-medium text-slate-400">수업 전</span>
                    ) : (
                      <span className={`text-lg font-extrabold ${pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {pct}%
                      </span>
                    )}
                  </div>

                  {noSessions ? (
                    <p className="text-xs text-slate-400">아직 진행된 수업이 없습니다.</p>
                  ) : (
                    <>
                      {/* 출석률 바 */}
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        출석 {course.presentCount} / 전체 {course.totalCount}회
                      </p>

                      {/* 최근 출결 */}
                      {course.recentRecords.length > 0 && (
                        <div className="border-t border-slate-100 pt-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">최근 기록</p>
                          <div className="flex gap-1.5 flex-wrap">
                            {course.recentRecords.map((rec, i) => (
                              <span
                                key={i}
                                title={`${rec.sessionDate} ${rec.sessionTitle ?? ''}`}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusColor[rec.status]}`}
                              >
                                {statusLabel[rec.status]}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </GlassCard>
              );
            })}
          </div>
        ) : (
          <GlassCard className="p-8 text-center">
            <p className="text-slate-400">수강 중인 과정이 없습니다.</p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
