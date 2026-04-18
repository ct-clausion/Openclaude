import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import GlassCard from '../../components/common/GlassCard';
import Skeleton from '../../components/common/Skeleton';

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetType: string;
  isUrgent: boolean;
  createdAt: string;
  isRead?: boolean;
}

export default function InstructorAnnouncements() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['instructor', 'announcements'],
    queryFn: () => api.get<Announcement[]>('/api/announcements'),
  });

  const readMutation = useMutation({
    mutationFn: (announcementId: string) => api.post<void>(`/api/announcements/${announcementId}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor', 'announcements'] });
    },
  });

  const toggleAnnouncement = (announcement: Announcement) => {
    const willExpand = expandedId !== announcement.id;
    setExpandedId(willExpand ? announcement.id : null);

    if (willExpand && !announcement.isRead) {
      readMutation.mutate(announcement.id);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">공지사항</h1>
        <p className="text-sm text-slate-500 mt-1">운영자가 발송한 공지사항을 확인하세요</p>
      </div>

      {isLoading ? (
        <Skeleton variant="list" rows={3} />
      ) : (
        <div className="space-y-3">
          {announcements?.map((a) => (
            <GlassCard key={a.id} className="overflow-hidden">
              <button
                onClick={() => toggleAnnouncement(a)}
                className="w-full p-5 text-left hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {a.isUrgent && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold shrink-0">
                        긴급
                      </span>
                    )}
                    <h3 className={`truncate ${a.isRead ? 'text-sm font-semibold text-slate-700' : 'text-sm font-bold text-slate-900'}`}>{a.title}</h3>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-xs text-slate-400">{a.createdAt?.slice(0, 10)}</span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === a.id ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {expandedId === a.id && (
                <div className="px-5 pb-5 border-t border-slate-100">
                  <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{a.content}</p>
                  <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-50">
                    {a.createdAt?.slice(0, 16).replace('T', ' ')}
                  </p>
                </div>
              )}
            </GlassCard>
          ))}
          {(!announcements || announcements.length === 0) && (
            <p className="text-sm text-slate-400 text-center py-8">공지사항이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
