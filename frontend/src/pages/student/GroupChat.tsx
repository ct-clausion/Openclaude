import { startTransition, useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Client } from '@stomp/stompjs';
import { motion, AnimatePresence } from 'framer-motion';
import { ApiError } from '../../api/client';
import { groupChatApi } from '../../api/groupChat';
import { studyGroupApi } from '../../api/studyGroup';
import { toApiUrl } from '../../lib/apiBase';
import { useAuthStore } from '../../store/authStore';
import type { GroupChatMessage, StudyGroup } from '../../types';

export default function GroupChat() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, token } = useAuthStore();
  const userId = user?.id ? Number(user.id) : 0;

  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const roomClosedRef = useRef(false);

  const exitClosedRoom = useCallback((message: string) => {
    if (roomClosedRef.current) return;

    roomClosedRef.current = true;
    setConnected(false);
    void queryClient.invalidateQueries({ queryKey: ['my-study-groups'] });
    void queryClient.invalidateQueries({ queryKey: ['course-study-groups'] });
    void queryClient.invalidateQueries({ queryKey: ['study-group', groupId] });
    void queryClient.invalidateQueries({ queryKey: ['group-chat-history', groupId] });
    if (clientRef.current) {
      void clientRef.current.deactivate();
      clientRef.current = null;
    }
    window.alert(message);
    startTransition(() => {
      navigate('/student/study-groups', { replace: true });
    });
  }, [groupId, navigate, queryClient]);

  // Fetch group info
  const { data: group, error: groupError } = useQuery<StudyGroup>({
    queryKey: ['study-group', groupId],
    queryFn: () => studyGroupApi.getStudyGroup(groupId!),
    enabled: !!groupId,
    retry: false,
  });

  // Fetch chat history. WS is the source of truth for live updates while the user
  // is in the room, so focus-refetch is disabled (it would clobber WS deltas). On
  // remount (room re-entry), we still want fresh history — the merge effect below
  // preserves any in-flight WS messages.
  const { data: history, error: historyError } = useQuery<GroupChatMessage[]>({
    queryKey: ['group-chat-history', groupId],
    queryFn: () => groupChatApi.getMessages(groupId!),
    enabled: !!groupId,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: false,
    staleTime: 0,
    retry: false,
  });

  // Clear buffered messages when switching rooms so the next merge doesn't leak
  // the previous group's messages into the new one.
  useEffect(() => {
    setMessages([]);
  }, [groupId]);

  // Merge history with any messages already buffered from the WS subscription.
  // Prevents losing messages that arrive between first render and initial history fetch.
  useEffect(() => {
    if (!history) return;
    setMessages((prev) => {
      const byId = new Map<number, GroupChatMessage>();
      for (const m of history) byId.set(m.id, m);
      for (const m of prev) if (!byId.has(m.id)) byId.set(m.id, m);
      return Array.from(byId.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
  }, [history, groupId]);

  useEffect(() => {
    const error = groupError ?? historyError;
    if (!(error instanceof ApiError)) return;

    const normalized = error.message.toLowerCase();
    const roomMissing =
      error.status === 404 ||
      error.status === 403 ||
      (error.status === 400 && normalized.includes('group not found')) ||
      (error.status === 400 && normalized.includes('study group not found'));

    if (!roomMissing) return;

    exitClosedRoom(
      error.status === 403
        ? '더 이상 참여 중인 채팅방이 아닙니다.'
        : '채팅방이 삭제되었거나 더 이상 사용할 수 없습니다.',
    );
  }, [exitClosedRoom, groupError, historyError]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket/STOMP connection
  useEffect(() => {
    if (!groupId || !token) return;

    const apiUrl = import.meta.env.VITE_API_URL ?? '';
    const wsUrl = apiUrl ? apiUrl.replace(/^http/, 'ws') : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

    // Token is sent via the STOMP CONNECT frame (connectHeaders), never in the URL.
    // The server's StompChannelInterceptor validates it at the frame level.
    const client = new Client({
      brokerURL: `${wsUrl}/ws-chat`,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/group-chat/${groupId}`, (frame) => {
          const msg: GroupChatMessage = JSON.parse(frame.body);
          if (msg.messageType === 'ROOM_DELETED') {
            exitClosedRoom(msg.content || '채팅방이 종료되었습니다.');
            return;
          }
          setMessages((prev) => {
            // Deduplicate by id
            if (msg.id && prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        });
      },
      onDisconnect: () => setConnected(false),
      onStompError: (frame) => {
        console.error('STOMP error:', frame.headers.message);
        setConnected(false);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      void client.deactivate();
      clientRef.current = null;
    };
  }, [exitClosedRoom, groupId, token]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !clientRef.current?.connected) return;

    clientRef.current.publish({
      destination: `/app/group-chat/${groupId}/send`,
      body: JSON.stringify({ content: text }),
    });
    setInput('');
    inputRef.current?.focus();
  }, [input, groupId]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clientRef.current?.connected) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하만 가능합니다.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(toApiUrl('/api/files/upload'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();

      clientRef.current.publish({
        destination: `/app/group-chat/${groupId}/send`,
        body: JSON.stringify({
          content: file.name,
          fileKey: data.fileKey,
          fileName: data.fileName,
          fileSize: data.fileSize,
          contentType: data.contentType,
        }),
      });
    } catch {
      alert('파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [groupId, token]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const handleFileDownload = async (fileKey: string, _fileName: string) => {
    try {
      const res = await fetch(`${toApiUrl('/api/files/download-url')}?fileKey=${encodeURIComponent(fileKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      window.open(data.url, '_blank');
    } catch {
      alert('파일 다운로드에 실패했습니다.');
    }
  };

  const isImageFile = (contentType?: string) => contentType?.startsWith('image/');

  // Group messages by date
  const groupedMessages: { date: string; msgs: GroupChatMessage[] }[] = [];
  messages.forEach((msg) => {
    const date = msg.createdAt?.split('T')[0] ?? '';
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date, msgs: [msg] });
    }
  });

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)] sm:h-[calc(100vh-64px)] bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <header className="sticky top-[41px] lg:top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => navigate('/student/study-groups')}
          aria-label="스터디 그룹 목록으로 돌아가기"
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
        >
          <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-slate-800 truncate">
            {group?.name ?? '채팅방'}
          </h1>
          <p className="text-[11px] text-slate-500">
            {group?.members.length ?? 0}명 참여 중
            <span className={`ml-2 inline-block w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-300'}`} />
            <span className="ml-1">{connected ? '연결됨' : '연결 중...'}</span>
          </p>
        </div>
        {/* Online members avatars */}
        <div className="flex -space-x-1.5">
          {group?.members.slice(0, 4).map((m) => {
            const name = m.name || m.studentName || '?';
            return (
              <div
                key={m.id}
                className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold border-2 border-white"
                title={name}
              >
                {name.charAt(0)}
              </div>
            );
          })}
          {(group?.members.length ?? 0) > 4 && (
            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 border-2 border-white">
              +{(group?.members.length ?? 0) - 4}
            </div>
          )}
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">아직 메시지가 없습니다</p>
            <p className="text-xs text-slate-400 mt-1">첫 번째 메시지를 보내보세요!</p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 text-[10px] font-medium text-slate-400 bg-slate-100 rounded-full">
                  {formatDateHeader(group.date + 'T00:00:00')}
                </span>
              </div>

              {group.msgs.map((msg, i) => {
                const isSystem = msg.messageType === 'SYSTEM';
                const isMe = !isSystem && msg.senderId === userId;
                const showName =
                  !isMe &&
                  !isSystem &&
                  (i === 0 || group.msgs[i - 1].senderId !== msg.senderId || group.msgs[i - 1].messageType === 'SYSTEM');

                if (isSystem) {
                  return (
                    <motion.div
                      key={msg.id ?? `sys-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-center my-2"
                    >
                      <span className="px-3 py-1 text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-full">
                        {msg.content}
                      </span>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={msg.id ?? `temp-${i}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${showName ? 'mt-3' : 'mt-0.5'}`}
                  >
                    {/* Other user avatar */}
                    {!isMe && showName && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-[11px] font-bold shrink-0 mr-2 mt-0.5">
                        {msg.senderName?.charAt(0) ?? '?'}
                      </div>
                    )}
                    {!isMe && !showName && <div className="w-8 mr-2 shrink-0" />}

                    <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                      {showName && !isMe && (
                        <p className="text-[11px] font-medium text-slate-500 mb-0.5 ml-1">
                          {msg.senderName}
                        </p>
                      )}
                      <div className="flex items-end gap-1.5">
                        {isMe && (
                          <span className="text-[10px] text-slate-300 shrink-0 mb-0.5">
                            {formatTime(msg.createdAt)}
                          </span>
                        )}
                        <div
                          className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-br-md'
                              : 'bg-white border border-slate-100 text-slate-800 rounded-bl-md shadow-sm'
                          }`}
                        >
                          {msg.messageType === 'FILE' && msg.fileKey ? (
                            <button
                              onClick={() => handleFileDownload(msg.fileKey!, msg.fileName || 'file')}
                              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                            >
                              <svg className={`w-5 h-5 shrink-0 ${isMe ? 'text-white/80' : 'text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {isImageFile(msg.contentType) ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                )}
                              </svg>
                              <div className="text-left">
                                <p className={`text-xs font-medium truncate max-w-[180px] ${isMe ? 'text-white' : 'text-slate-700'}`}>
                                  {msg.fileName}
                                </p>
                                <p className={`text-[10px] ${isMe ? 'text-white/60' : 'text-slate-400'}`}>
                                  {formatFileSize(msg.fileSize)}
                                </p>
                              </div>
                            </button>
                          ) : (
                            msg.content
                          )}
                        </div>
                        {!isMe && (
                          <span className="text-[10px] text-slate-300 shrink-0 mb-0.5">
                            {formatTime(msg.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="sticky bottom-0 bg-white/80 backdrop-blur-md border-t border-slate-100 px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z,.py,.java,.js,.ts,.c,.cpp,.h"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!connected || uploading}
            aria-label="파일 첨부"
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="파일 첨부"
          >
            {uploading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={connected ? '메시지를 입력하세요...' : '연결 중...'}
            disabled={!connected}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 disabled:bg-slate-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !connected}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
