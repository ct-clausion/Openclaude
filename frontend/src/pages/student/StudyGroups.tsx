import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { studyGroupApi } from '../../api/studyGroup';
import { useAuthStore } from '../../store/authStore';
import { useCourseId } from '../../hooks/useCourseId';
import Skeleton from '../../components/common/Skeleton';
import type { StudyGroup, StudyGroupMember } from '../../types';

type Tab = 'my' | 'explore' | 'matches';

export default function StudyGroups() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userId = user?.id?.toString() ?? '';
  const courseId = useCourseId();

  const [tab, setTab] = useState<Tab>('my');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newMax, setNewMax] = useState(5);
  const [confirm, setConfirm] = useState<{ type: 'join' | 'leave' | 'kick' | 'delete'; groupId: string; groupName: string; targetStudentId?: string; targetName?: string } | null>(null);

  // --- Queries ---
  const { data: myGroups = [], isLoading: myLoading } = useQuery<StudyGroup[]>({
    queryKey: ['my-study-groups'],
    queryFn: () => studyGroupApi.getMyGroups(),
  });

  const { data: courseGroups = [], isLoading: courseLoading } = useQuery<StudyGroup[]>({
    queryKey: ['course-study-groups', courseId],
    queryFn: () => studyGroupApi.getByCourse(courseId!),
    enabled: !!courseId && tab === 'explore',
  });

  const { data: matches = [], isLoading: matchesLoading } = useQuery<StudyGroupMember[]>({
    queryKey: ['study-group-matches', userId, courseId],
    queryFn: () => studyGroupApi.getMatches(userId, courseId!),
    enabled: !!userId && !!courseId && tab === 'matches',
  });

  // --- Mutations ---
  const joinMut = useMutation({
    mutationFn: (groupId: string) => studyGroupApi.joinGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-study-groups'] });
      queryClient.invalidateQueries({ queryKey: ['course-study-groups'] });
    },
  });

  const leaveMut = useMutation({
    mutationFn: (groupId: string) => studyGroupApi.leaveGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-study-groups'] });
      queryClient.invalidateQueries({ queryKey: ['course-study-groups'] });
    },
  });

  const kickMut = useMutation({
    mutationFn: ({ groupId, studentId }: { groupId: string; studentId: string }) =>
      studyGroupApi.kickMember(groupId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-study-groups'] });
      queryClient.invalidateQueries({ queryKey: ['course-study-groups'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (groupId: string) => studyGroupApi.deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-study-groups'] });
      queryClient.invalidateQueries({ queryKey: ['course-study-groups'] });
    },
  });

  const createMut = useMutation({
    mutationFn: () =>
      studyGroupApi.createStudyGroup({
        courseId: courseId!,
        name: newName,
        description: newDesc,
        maxMembers: newMax,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-study-groups'] });
      queryClient.invalidateQueries({ queryKey: ['course-study-groups'] });
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewMax(5);
    },
  });

  const isMember = (group: StudyGroup) =>
    group.members.some((m) => String(m.studentId) === userId);

  const isLeader = (group: StudyGroup) =>
    group.members.some((m) => String(m.studentId) === userId && m.role === 'LEADER');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'my', label: '내 그룹' },
    { key: 'explore', label: '그룹 탐색' },
    { key: 'matches', label: 'AI 추천' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <header className="sticky top-[41px] lg:top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-800">스터디 그룹</h1>
            <p className="text-xs text-slate-500">
              함께 학습할 그룹을 찾거나 만들어보세요
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            disabled={!courseId}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            그룹 만들기
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-300 p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Create modal */}
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6 space-y-4"
          >
            <h3 className="text-sm font-semibold text-slate-800">새 스터디 그룹</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="그룹 이름 (예: React 스터디)"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="그룹 설명"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
            />
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600">최대 인원</label>
              <input
                type="number"
                min={2}
                max={10}
                value={newMax}
                onChange={(e) => setNewMax(Number(e.target.value))}
                className="w-20 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={!newName.trim() || createMut.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {createMut.isPending ? '생성 중...' : '생성'}
              </button>
            </div>
          </motion.div>
        )}

        {/* My Groups */}
        {tab === 'my' && (
          <div className="space-y-4">
            {myLoading && <Skeleton variant="list" rows={3} />}
            {!myLoading && myGroups.length === 0 && (
              <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-12 text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-2">참여 중인 그룹이 없습니다</h3>
                <p className="text-sm text-slate-500 mb-4">"그룹 탐색"에서 기존 그룹에 참여하거나 새로 만들어보세요</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => setTab('explore')}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
                  >
                    그룹 탐색
                  </button>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    그룹 만들기
                  </button>
                </div>
              </div>
            )}
            {myGroups.map((group, i) => (
              <GroupCard
                key={group.id}
                group={group}
                index={i}
                isMine
                isLeader={isLeader(group)}
                userId={userId}
                onLeave={() => setConfirm({ type: 'leave', groupId: group.id, groupName: group.name })}
                onDelete={() => setConfirm({ type: 'delete', groupId: group.id, groupName: group.name })}
                onKick={(studentId, name) => setConfirm({ type: 'kick', groupId: group.id, groupName: group.name, targetStudentId: studentId, targetName: name })}
                leaving={leaveMut.isPending}
                deleting={deleteMut.isPending}
                onChat={() => navigate(`/student/study-groups/${group.id}/chat`)}
              />
            ))}
          </div>
        )}

        {/* Explore */}
        {tab === 'explore' && (
          <div className="space-y-4">
            {!courseId && <p className="text-sm text-slate-400 text-center py-12">수강 중인 과정이 없습니다</p>}
            {courseId && courseLoading && <Skeleton variant="list" rows={3} />}
            {courseId && !courseLoading && courseGroups.length === 0 && (
              <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-12 text-center">
                <h3 className="text-base font-bold text-slate-800 mb-2">아직 그룹이 없습니다</h3>
                <p className="text-sm text-slate-500 mb-4">첫 번째 스터디 그룹을 만들어보세요!</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  그룹 만들기
                </button>
              </div>
            )}
            {courseGroups.map((group, i) => (
              <GroupCard
                key={group.id}
                group={group}
                index={i}
                isMine={isMember(group)}
                isLeader={isLeader(group)}
                userId={userId}
                onJoin={() => setConfirm({ type: 'join', groupId: group.id, groupName: group.name })}
                onLeave={() => setConfirm({ type: 'leave', groupId: group.id, groupName: group.name })}
                onDelete={() => setConfirm({ type: 'delete', groupId: group.id, groupName: group.name })}
                onKick={(studentId, name) => setConfirm({ type: 'kick', groupId: group.id, groupName: group.name, targetStudentId: studentId, targetName: name })}
                joining={joinMut.isPending}
                leaving={leaveMut.isPending}
              />
            ))}
          </div>
        )}

        {/* AI Matches */}
        {tab === 'matches' && (
          <div className="space-y-4">
            {!courseId && <p className="text-sm text-slate-400 text-center py-12">수강 중인 과정이 없습니다</p>}
            {courseId && matchesLoading && <p className="text-sm text-slate-400 text-center py-12">AI가 매칭 중...</p>}
            {courseId && !matchesLoading && matches.length === 0 && (
              <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-12 text-center">
                <h3 className="text-base font-bold text-slate-800 mb-2">추천 매칭이 없습니다</h3>
                <p className="text-sm text-slate-500">학습 데이터가 더 쌓이면 AI가 맞춤 매칭을 추천합니다</p>
              </div>
            )}
            {matches.length > 0 && (
              <div className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-6">
                <h3 className="text-sm font-semibold text-slate-800 mb-4">
                  AI 추천 학습 파트너 ({matches.length}명)
                </h3>
                <div className="space-y-3">
                  {matches.map((member, i) => (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                    >
                      <div
                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${member.avatarGradient || 'from-indigo-400 to-violet-500'} flex items-center justify-center text-white text-sm font-bold shrink-0`}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{member.name}</span>
                          <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 rounded-full px-1.5 py-0.5">
                            {member.matchScore}% 매칭
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">강점: {member.strength}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{member.complementNote}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Confirm Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4"
          >
            <h3 className="text-sm font-bold text-slate-800 mb-2">
              {confirm.type === 'join' && '그룹 참여'}
              {confirm.type === 'leave' && '그룹 탈퇴'}
              {confirm.type === 'kick' && '멤버 강퇴'}
              {confirm.type === 'delete' && '그룹 삭제'}
            </h3>
            <p className="text-sm text-slate-600 mb-5">
              {confirm.type === 'join' && (
                <><span className="font-semibold text-slate-800">{confirm.groupName}</span> 그룹에 참여하시겠습니까?</>
              )}
              {confirm.type === 'leave' && (
                <><span className="font-semibold text-slate-800">{confirm.groupName}</span> 그룹에서 탈퇴하시겠습니까?</>
              )}
              {confirm.type === 'kick' && (
                <><span className="font-semibold text-slate-800">{confirm.targetName}</span>님을 그룹에서 내보내시겠습니까?</>
              )}
              {confirm.type === 'delete' && (
                <><span className="font-semibold text-slate-800">{confirm.groupName}</span> 그룹을 삭제하시겠습니까? 채팅 기록도 모두 삭제됩니다.</>
              )}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (confirm.type === 'join') {
                    joinMut.mutate(confirm.groupId);
                  } else if (confirm.type === 'leave') {
                    leaveMut.mutate(confirm.groupId);
                  } else if (confirm.type === 'kick' && confirm.targetStudentId) {
                    kickMut.mutate({ groupId: confirm.groupId, studentId: confirm.targetStudentId });
                  } else if (confirm.type === 'delete') {
                    deleteMut.mutate(confirm.groupId);
                  }
                  setConfirm(null);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
                  confirm.type === 'join'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-rose-500 hover:bg-rose-600'
                }`}
              >
                {confirm.type === 'join' && '참여'}
                {confirm.type === 'leave' && '탈퇴'}
                {confirm.type === 'kick' && '강퇴'}
                {confirm.type === 'delete' && '삭제'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// --- Group Card Component ---

interface GroupCardProps {
  group: StudyGroup;
  index: number;
  isMine: boolean;
  isLeader?: boolean;
  userId?: string;
  onJoin?: () => void;
  onLeave?: () => void;
  onDelete?: () => void;
  onKick?: (studentId: string, name: string) => void;
  onChat?: () => void;
  joining?: boolean;
  leaving?: boolean;
  deleting?: boolean;
}

function GroupCard({ group, index, isMine, isLeader, userId, onJoin, onLeave, onDelete, onKick, onChat, joining, leaving }: GroupCardProps) {
  const isFull = group.members.length >= group.maxMembers;
  const [showMembers, setShowMembers] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white/85 backdrop-blur-[12px] border border-white/60 rounded-2xl shadow-lg p-5"
    >
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-800">{group.name}</h3>
              {isLeader && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                  방장
                </span>
              )}
            </div>
            {group.description && (
              <p className="text-xs text-slate-500 mt-0.5 break-words">{group.description}</p>
            )}
          </div>
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
            isFull ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {group.members.length}/{group.maxMembers}명
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {isMine ? (
            <>
              {onChat && (
                <button
                  onClick={onChat}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  채팅
                </button>
              )}
              {isLeader && group.members.length > 1 && (
                <button
                  onClick={() => setShowMembers(!showMembers)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  관리
                </button>
              )}
              {isLeader ? (
                <button
                  onClick={group.members.length <= 1 ? onDelete : onLeave}
                  disabled={leaving}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                >
                  {group.members.length <= 1 ? '삭제' : '탈퇴'}
                </button>
              ) : (
                <button
                  onClick={onLeave}
                  disabled={leaving}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                >
                  {leaving ? '탈퇴 중...' : '탈퇴'}
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onJoin}
              disabled={joining || isFull}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isFull ? '정원 초과' : joining ? '참여 중...' : '참여'}
            </button>
          )}
        </div>
      </div>

      {/* Members */}
      {group.members.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 mr-1">멤버:</span>
          <div className="flex -space-x-1.5">
            {group.members.slice(0, 5).map((m) => {
              const displayName = m.name || m.studentName || '?';
              const memberIsLeader = m.role === 'LEADER';
              return (
                <div
                  key={m.id}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold border-2 ${
                    memberIsLeader ? 'border-amber-300 bg-gradient-to-br from-amber-400 to-orange-500' : 'border-white bg-gradient-to-br from-indigo-400 to-violet-500'
                  }`}
                  title={`${displayName}${memberIsLeader ? ' (방장)' : ''}`}
                >
                  {displayName.charAt(0)}
                </div>
              );
            })}
          </div>
          {group.members.length > 5 && (
            <span className="text-[10px] text-slate-400">+{group.members.length - 5}명</span>
          )}
        </div>
      )}

      {/* Member Management Panel (Leader only) */}
      {showMembers && isLeader && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 pt-3 border-t border-slate-100 space-y-2"
        >
          <p className="text-[11px] font-semibold text-slate-600 mb-1">멤버 관리</p>
          {group.members.map((m) => {
            const displayName = m.name || m.studentName || '?';
            const memberIsLeader = m.role === 'LEADER';
            const isMe = String(m.studentId) === userId;
            return (
              <div key={m.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                    memberIsLeader ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-indigo-400 to-violet-500'
                  }`}>
                    {displayName.charAt(0)}
                  </div>
                  <span className="text-xs text-slate-700">{displayName}</span>
                  {memberIsLeader && (
                    <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">방장</span>
                  )}
                  {isMe && !memberIsLeader && (
                    <span className="text-[9px] text-slate-400">(나)</span>
                  )}
                </div>
                {!memberIsLeader && !isMe && onKick && (
                  <button
                    onClick={() => onKick(String(m.studentId), displayName)}
                    className="px-2 py-1 text-[10px] font-medium rounded-md text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    강퇴
                  </button>
                )}
              </div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
