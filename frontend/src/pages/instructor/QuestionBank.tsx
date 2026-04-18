import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { questionsApi } from '../../api/questions';
import { coursesApi } from '../../api/courses';
import { pollJob } from '../../api/jobs';
import { useCourseId } from '../../hooks/useCourseId';
import type { Question } from '../../types';
import TagChip from '../../components/common/TagChip';
import Modal from '../../components/common/Modal';
import Skeleton from '../../components/common/Skeleton';
import { useConfirm } from '../../hooks/useConfirm';

type FilterStatus = 'ALL' | Question['approvalStatus'];

const statusConfig: Record<string, { label: string; color: 'emerald' | 'amber' | 'rose' | 'slate' }> = {
  APPROVED: { label: '승인', color: 'emerald' },
  PENDING: { label: '대기', color: 'amber' },
  REJECTED: { label: '반려', color: 'rose' },
};

const DIFF_LABEL = (d: number | string) => {
  const n = typeof d === 'string' ? parseInt(d) || 3 : d;
  return n <= 2 ? '기초' : n <= 3 ? '중급' : '고급';
};
const DIFF_COLOR = (d: number | string) => {
  const n = typeof d === 'string' ? parseInt(d) || 3 : d;
  return n <= 2 ? ('emerald' as const) : n <= 3 ? ('amber' as const) : ('rose' as const);
};

const emptyForm = {
  questionType: '서술형',
  difficulty: '3',
  content: '',
  answer: '',
  explanation: '',
  skillId: '',
};

export default function QuestionBank() {
  const queryClient = useQueryClient();
  const courseId = useCourseId();
  const { confirm, confirmNode } = useConfirm();
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [skillFilter, setSkillFilter] = useState<string>('ALL');

  // Bulk review: AI often generates 20+ questions at once and reviewing them
  // one-by-one is a known slog. Hold a set of selected ids so we can approve/
  // reject them as a batch.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  // 문제 상세 모달
  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null);

  // 문제 편집 모달
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  // 문제 직접 추가 모달
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);

  // 삭제 확인
  const [deleteConfirm, setDeleteConfirm] = useState<Question | null>(null);

  // AI 문제 생성 모달
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [genSkillId, setGenSkillId] = useState<string>('');
  const [genDifficulty, setGenDifficulty] = useState<string>('');
  const [genCount, setGenCount] = useState(5);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ['instructor', 'question-bank', courseId],
    queryFn: () => questionsApi.getQuestions(courseId!),
    enabled: !!courseId,
    staleTime: 30_000,
  });

  const { data: skills = [] } = useQuery({
    queryKey: ['courses', courseId, 'skills'],
    queryFn: () => coursesApi.getSkills(courseId!),
    enabled: !!courseId,
    staleTime: 60_000,
  });

  const invalidateQuestions = () =>
    queryClient.invalidateQueries({ queryKey: ['instructor', 'question-bank'] });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) => {
      if (status === 'APPROVED') return questionsApi.approveQuestion(id);
      return questionsApi.rejectQuestion(id);
    },
    onSuccess: invalidateQuestions,
  });

  const bulkReviewMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: 'APPROVED' | 'REJECTED' }) => {
      // Backend has no batch endpoint yet — fire in parallel and wait. Keeps
      // the UI single-click even though it's N round-trips. Switch to a real
      // batch endpoint when traffic justifies it.
      const fn = status === 'APPROVED' ? questionsApi.approveQuestion : questionsApi.rejectQuestion;
      await Promise.all(ids.map((id) => fn(id)));
      return { ids, status };
    },
    onSuccess: ({ ids, status }) => {
      invalidateQuestions();
      clearSelection();
      toast.success(`${ids.length}개 문제를 ${status === 'APPROVED' ? '승인' : '반려'}했습니다.`);
    },
  });

  const handleBulkAction = async (status: 'APPROVED' | 'REJECTED') => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: status === 'APPROVED' ? '일괄 승인' : '일괄 반려',
      message: `선택한 ${ids.length}개 문제를 ${status === 'APPROVED' ? '모두 승인' : '모두 반려'}합니다.\n되돌리려면 각 문제를 개별 수정해야 합니다.`,
      tone: status === 'REJECTED' ? 'danger' : 'default',
      confirmLabel: status === 'APPROVED' ? '일괄 승인' : '일괄 반려',
    });
    if (!ok) return;
    bulkReviewMutation.mutate({ ids, status });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof questionsApi.updateQuestion>[1] }) =>
      questionsApi.updateQuestion(id, data),
    onSuccess: () => {
      invalidateQuestions();
      setEditQuestion(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof questionsApi.createQuestion>[0]) =>
      questionsApi.createQuestion(data),
    onSuccess: () => {
      invalidateQuestions();
      setShowCreate(false);
      setCreateForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => questionsApi.deleteQuestion(id),
    onSuccess: () => {
      invalidateQuestions();
      setDeleteConfirm(null);
    },
  });

  const [genStatus, setGenStatus] = useState('');

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { jobId } = await questionsApi.generateQuestions(courseId!, {
        skillId: genSkillId ? Number(genSkillId) : undefined,
        difficulty: genDifficulty || undefined,
        count: genCount,
      });
      setGenStatus('AI가 문제를 생성하고 있습니다...');
      const result = await pollJob(jobId);
      if (result.status === 'FAILED') {
        throw new Error(result.errorMessage ?? '문제 생성 실패');
      }
      return result;
    },
    onSuccess: () => {
      setGenModalOpen(false);
      setGenSkillId('');
      setGenDifficulty('');
      setGenCount(5);
      setGenStatus('');
      invalidateQuestions();
    },
    onError: () => setGenStatus(''),
  });

  const filtered = useMemo(
    () => questions.filter((q) => {
      if (filter !== 'ALL' && q.approvalStatus !== filter) return false;
      if (skillFilter !== 'ALL' && String(q.skillId ?? '') !== skillFilter) return false;
      return true;
    }),
    [questions, filter, skillFilter],
  );

  // Pending questions in the current filter — the only ones eligible for bulk review.
  const pendingInView = useMemo(
    () => filtered.filter((q) => q.approvalStatus === 'PENDING'),
    [filtered],
  );
  const allPendingSelected =
    pendingInView.length > 0 && pendingInView.every((q) => selectedIds.has(String(q.id)));
  const toggleSelectAllPending = () => {
    if (allPendingSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pendingInView.forEach((q) => next.delete(String(q.id)));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pendingInView.forEach((q) => next.add(String(q.id)));
        return next;
      });
    }
  };

  const counts = {
    ALL: questions.length,
    APPROVED: questions.filter((q) => q.approvalStatus === 'APPROVED').length,
    PENDING: questions.filter((q) => q.approvalStatus === 'PENDING').length,
    REJECTED: questions.filter((q) => q.approvalStatus === 'REJECTED').length,
  };

  const skillNameMap: Record<string, string> = {};
  skills.forEach((s) => { skillNameMap[String(s.id)] = s.name; });

  // 편집 폼 필드 렌더
  const renderFormFields = (
    form: typeof emptyForm,
    setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>,
    showSkill = true,
  ) => (
    <div className="space-y-3">
      {showSkill && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">스킬</label>
          <select
            value={form.skillId}
            onChange={(e) => setForm((f) => ({ ...f, skillId: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-indigo-400"
          >
            <option value="">선택 안 함</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">유형</label>
          <select
            value={form.questionType}
            onChange={(e) => setForm((f) => ({ ...f, questionType: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-indigo-400"
          >
            <option>객관식</option>
            <option>서술형</option>
            <option>코드작성</option>
            <option>OX</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">난이도</label>
          <select
            value={form.difficulty}
            onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-indigo-400"
          >
            <option value="1">1 - 매우 쉬움</option>
            <option value="2">2 - 쉬움</option>
            <option value="3">3 - 보통</option>
            <option value="4">4 - 어려움</option>
            <option value="5">5 - 매우 어려움</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">문제</label>
        <textarea
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          rows={3}
          placeholder="문제 내용을 입력하세요"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">정답</label>
        <textarea
          value={form.answer}
          onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
          rows={2}
          placeholder="정답을 입력하세요"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">해설</label>
        <textarea
          value={form.explanation}
          onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
          rows={2}
          placeholder="해설을 입력하세요"
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <header className="sticky top-[41px] lg:top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-800">문제 은행</h1>
            <p className="text-xs text-slate-500">총 {questions.length}개 문제</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCreateForm(emptyForm);
                setShowCreate(true);
              }}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              직접 추가
            </button>
            <button
              onClick={() => setGenModalOpen(true)}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              AI 문제 생성
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white rounded-xl border border-slate-300 p-1">
            {(['ALL', 'APPROVED', 'PENDING', 'REJECTED'] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  filter === s
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s === 'ALL' ? '전체' : statusConfig[s].label} ({counts[s]})
              </button>
            ))}
          </div>

          <select
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-indigo-400"
          >
            <option value="ALL">모든 스킬</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Bulk review toolbar — visible only when there are selected PENDING questions */}
        {selectedIds.size > 0 && (
          <div className="sticky top-[105px] lg:top-[64px] z-20 mb-4 flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/90 backdrop-blur px-4 py-3 shadow-sm">
            <span className="text-sm font-bold text-indigo-800">{selectedIds.size}개 선택됨</span>
            <button
              onClick={() => handleBulkAction('APPROVED')}
              disabled={bulkReviewMutation.isPending}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              일괄 승인
            </button>
            <button
              onClick={() => handleBulkAction('REJECTED')}
              disabled={bulkReviewMutation.isPending}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
            >
              일괄 반려
            </button>
            <button
              onClick={clearSelection}
              className="ml-auto text-xs text-slate-500 hover:text-slate-700"
            >
              선택 해제
            </button>
          </div>
        )}

        {/* Select-all for pending questions in the current filter */}
        {pendingInView.length > 0 && (
          <div className="mb-3 flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={allPendingSelected}
                onChange={toggleSelectAllPending}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
              />
              대기 문제 전체 선택 ({pendingInView.length}개)
            </label>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} variant="card" />)}
          </div>
        )}

        {/* Empty */}
        {!isLoading && questions.length === 0 && (
          <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-12 text-center">
            <h3 className="text-base font-bold text-slate-800 mb-2">등록된 문제가 없습니다</h3>
            <p className="text-sm text-slate-500">AI 문제 생성 또는 직접 추가로 문제를 등록하세요</p>
          </div>
        )}

        {/* Question List */}
        <div className="space-y-3">
          {filtered.map((q) => {
            const cfg = statusConfig[q.approvalStatus];

            const isPending = q.approvalStatus === 'PENDING';
            const isSelected = selectedIds.has(String(q.id));
            return (
              <div
                key={q.id}
                className={`bg-white/85 backdrop-blur-[12px] border rounded-2xl shadow-sm p-5 hover:shadow-md transition-shadow group ${
                  isSelected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-white/60'
                }`}
              >
                <div className="flex items-start gap-3 mb-2">
                  {isPending && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(String(q.id))}
                      aria-label={`"${q.content.slice(0, 30)}" 문제 선택`}
                      className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
                    />
                  )}
                  <p className="text-sm text-slate-700 leading-relaxed flex-1 mr-4">{q.content}</p>
                  <TagChip label={cfg.label} color={cfg.color} size="sm" />
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <TagChip label={skillNameMap[q.skillId] ?? q.skillId} color="indigo" size="sm" />
                  <TagChip label={DIFF_LABEL(q.difficulty)} color={DIFF_COLOR(q.difficulty)} size="sm" />
                  <TagChip label={q.questionType} color="slate" size="sm" />
                  <span className="text-[11px] text-slate-400 ml-auto">{q.generationReason}</span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  {q.approvalStatus === 'PENDING' && (
                    <>
                      <button
                        onClick={() => approveMutation.mutate({ id: String(q.id), status: 'APPROVED' })}
                        disabled={approveMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => approveMutation.mutate({ id: String(q.id), status: 'REJECTED' })}
                        disabled={approveMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        반려
                      </button>
                    </>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      onClick={() => {
                        setEditQuestion(q);
                        setEditForm({
                          questionType: q.questionType,
                          difficulty: String(q.difficulty),
                          content: q.content,
                          answer: q.answer ?? '',
                          explanation: q.explanation ?? '',
                          skillId: q.skillId ?? '',
                        });
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors border border-indigo-200"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => setDetailQuestion(q)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors border border-slate-300"
                    >
                      상세
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(q)}
                      aria-label="문제 삭제"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 focus-visible:opacity-100 focus-visible:text-rose-600 transition-colors md:opacity-0 md:group-hover:opacity-100"
                      title="삭제"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {!isLoading && filtered.length === 0 && questions.length > 0 && (
            <div className="text-center py-12 text-sm text-slate-400">
              조건에 맞는 문제가 없습니다
            </div>
          )}
        </div>
      </main>

      {/* 문제 상세 모달 */}
      <Modal isOpen={!!detailQuestion} onClose={() => setDetailQuestion(null)} title="문제 상세" size="lg">
        {detailQuestion && (() => {
          const dq = detailQuestion;
          const cfg = statusConfig[dq.approvalStatus];
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <TagChip label={cfg.label} color={cfg.color} size="sm" />
                <TagChip label={skillNameMap[dq.skillId] ?? dq.skillId} color="indigo" size="sm" />
                <TagChip label={DIFF_LABEL(dq.difficulty)} color={DIFF_COLOR(dq.difficulty)} size="sm" />
                <TagChip label={dq.questionType} color="slate" size="sm" />
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">문제</h4>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{dq.content}</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <h4 className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">정답</h4>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{dq.answer || '정답 없음'}</p>
              </div>
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200">
                <h4 className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2">해설</h4>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{dq.explanation || '해설 없음'}</p>
              </div>
              {dq.generationReason && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">생성 이유</h4>
                  <p className="text-sm text-slate-700">{dq.generationReason}</p>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2">
                {dq.approvalStatus === 'PENDING' && (
                  <>
                    <button
                      onClick={() => {
                        approveMutation.mutate({ id: String(dq.id), status: 'APPROVED' });
                        setDetailQuestion(null);
                      }}
                      className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => {
                        approveMutation.mutate({ id: String(dq.id), status: 'REJECTED' });
                        setDetailQuestion(null);
                      }}
                      className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      반려
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setDetailQuestion(null);
                    setEditQuestion(dq);
                    setEditForm({
                      questionType: dq.questionType,
                      difficulty: String(dq.difficulty),
                      content: dq.content,
                      answer: dq.answer ?? '',
                      explanation: dq.explanation ?? '',
                      skillId: dq.skillId ?? '',
                    });
                  }}
                  className={`${dq.approvalStatus === 'PENDING' ? '' : 'flex-1'} py-2.5 px-4 text-sm font-semibold rounded-xl border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors`}
                >
                  수정
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 문제 수정 모달 */}
      {editQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setEditQuestion(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
          >
            <h3 className="text-sm font-bold text-slate-800 mb-4">문제 수정</h3>
            {renderFormFields(editForm, setEditForm, false)}
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setEditQuestion(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() =>
                  updateMutation.mutate({
                    id: editQuestion.id,
                    data: {
                      questionType: editForm.questionType,
                      difficulty: editForm.difficulty,
                      content: editForm.content,
                      answer: editForm.answer,
                      explanation: editForm.explanation,
                    },
                  })
                }
                disabled={updateMutation.isPending || !editForm.content.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 문제 직접 추가 모달 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
          >
            <h3 className="text-sm font-bold text-slate-800 mb-4">문제 직접 추가</h3>
            {renderFormFields(createForm, setCreateForm, true)}
            <div className="flex gap-2 justify-end mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() =>
                  createMutation.mutate({
                    courseId: courseId!,
                    skillId: createForm.skillId || undefined,
                    questionType: createForm.questionType,
                    difficulty: createForm.difficulty,
                    content: createForm.content,
                    answer: createForm.answer,
                    explanation: createForm.explanation,
                  })
                }
                disabled={createMutation.isPending || !createForm.content.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? '추가 중...' : '추가'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
          >
            <h3 className="text-sm font-bold text-slate-800 mb-2">문제 삭제</h3>
            <p className="text-sm text-slate-600 mb-1 line-clamp-2">{deleteConfirm.content}</p>
            <p className="text-xs text-slate-400 mb-5">이 문제를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* AI 문제 생성 모달 */}
      <Modal isOpen={genModalOpen} onClose={() => setGenModalOpen(false)} title="AI 문제 생성" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">스킬 (선택)</label>
            {skills.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-700 mb-2">등록된 스킬이 없습니다. 기본 코딩 스킬을 추가하세요.</p>
                <button
                  onClick={() => {
                    if (!courseId) { alert('과정을 먼저 생성하세요.'); return; }
                    coursesApi.createDefaultSkills(courseId).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['courses', courseId, 'skills'] });
                    });
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                >
                  기본 코딩 스킬 추가
                </button>
              </div>
            ) : (
              <select
                value={genSkillId}
                onChange={(e) => setGenSkillId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-indigo-400"
              >
                <option value="">전체 스킬</option>
                {skills.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.name} ({s.difficulty === 'EASY' ? '기초' : s.difficulty === 'MEDIUM' ? '중급' : '고급'})</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">난이도 (선택)</label>
            <select
              value={genDifficulty}
              onChange={(e) => setGenDifficulty(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-indigo-400"
            >
              <option value="">자동</option>
              <option value="1">1 - 매우 쉬움</option>
              <option value="2">2 - 쉬움</option>
              <option value="3">3 - 보통</option>
              <option value="4">4 - 어려움</option>
              <option value="5">5 - 매우 어려움</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">생성 개수</label>
            <input
              type="number"
              min={1}
              max={20}
              value={genCount}
              onChange={(e) => setGenCount(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-indigo-400"
            />
          </div>
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="w-full py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {generateMutation.isPending ? (genStatus || '생성 중...') : `${genCount}개 문제 생성`}
          </button>
          {generateMutation.isError && (
            <p className="text-xs text-rose-500">생성 실패. 다시 시도해주세요.</p>
          )}
        </div>
      </Modal>
      {confirmNode}
    </div>
  );
}
