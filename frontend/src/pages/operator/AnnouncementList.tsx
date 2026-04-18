import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { operatorApi } from '../../api/operator';
import GlassCard from '../../components/common/GlassCard';
import Skeleton from '../../components/common/Skeleton';
import { useConfirm } from '../../hooks/useConfirm';

export default function AnnouncementList() {
  const queryClient = useQueryClient();
  const { confirm, confirmNode } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState('ALL');
  const [isUrgent, setIsUrgent] = useState(false);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['operator', 'announcements'],
    queryFn: operatorApi.getAnnouncements,
  });

  const createMutation = useMutation({
    mutationFn: operatorApi.createAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'announcements'] });
      setShowForm(false);
      setTitle('');
      setContent('');
      setTargetType('ALL');
      setIsUrgent(false);
      toast.success('공지를 발송했습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: operatorApi.deleteAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operator', 'announcements'] });
      toast.success('공지를 삭제했습니다.');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">공지사항</h1>
          <p className="text-sm text-slate-500 mt-1">전체/과정별/역할별 공지 관리</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
        >
          {showForm ? '취소' : '새 공지 작성'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <GlassCard className="p-5 space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="공지 제목"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="공지 내용을 입력하세요"
            rows={4}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm resize-none"
          />
          <div className="flex gap-4 items-center">
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="ALL">전체</option>
              <option value="STUDENT_ONLY">수강생만</option>
              <option value="INSTRUCTOR_ONLY">강사만</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="rounded" />
              긴급 공지
            </label>
            <button
              onClick={() => createMutation.mutate({ title, content, targetType, isUrgent })}
              disabled={!title || !content || createMutation.isPending}
              className="ml-auto px-6 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              발송
            </button>
          </div>
        </GlassCard>
      )}

      {/* List */}
      {isLoading ? (
        <Skeleton variant="list" rows={4} />
      ) : (
        <div className="space-y-3">
          {announcements?.map((a) => (
            <GlassCard key={a.id} className="overflow-hidden">
              {/* Header — click to expand */}
              <button
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                className="w-full p-5 text-left hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {a.isUrgent && <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold shrink-0">긴급</span>}
                    <h3 className="text-sm font-bold text-slate-900 truncate">{a.title}</h3>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs shrink-0">
                      {a.targetType === 'ALL' ? '전체' : a.targetType === 'STUDENT_ONLY' ? '수강생' : a.targetType === 'INSTRUCTOR_ONLY' ? '강사' : a.targetType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className="text-xs text-slate-400">{a.createdAt?.slice(0, 10)}</span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${expandedId === a.id ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Expanded content */}
              {expandedId === a.id && (
                <div className="px-5 pb-5 border-t border-slate-100">
                  <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{a.content}</p>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                    <p className="text-xs text-slate-400">{a.createdAt?.slice(0, 16).replace('T', ' ')}</p>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await confirm({
                          title: '공지 삭제',
                          message: `"${a.title}" 공지를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
                          tone: 'danger',
                          confirmLabel: '삭제',
                        });
                        if (ok) deleteMutation.mutate(a.id);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-50 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </GlassCard>
          ))}
          {announcements?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">공지사항이 없습니다.</p>
          )}
        </div>
      )}
      {confirmNode}
    </div>
  );
}
