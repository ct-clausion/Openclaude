import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import IncomingCallModal from '../consultation/IncomingCallModal';
import { useNotifications } from '../../hooks/useNotifications';
import { api } from '../../api/client';

interface AppShellProps {
  role: 'student' | 'instructor' | 'operator';
}

interface CallInfo {
  consultationId: number;
  roomName: string;
  callerName: string;
  courseName?: string;
}

export default function AppShell({ role }: AppShellProps) {
  const navigate = useNavigate();
  const { notifications } = useNotifications();
  const [incomingCall, setIncomingCall] = useState<CallInfo | null>(null);
  const handledNotifKey = useRef<string | null>(null);

  // Listen for INCOMING_CALL notifications (student side)
  useEffect(() => {
    if (role !== 'student') return;

    const latest = notifications[0];
    if (
      latest &&
      !latest.isRead &&
      latest.type === 'INCOMING_CALL' &&
      latest.data
    ) {
      // Dedup key: use id if available (REST), otherwise timestamp+type
      const key = latest.id ?? `${latest.createdAt ?? ''}_${latest.type}`;
      if (key === handledNotifKey.current) return;

      try {
        const raw = latest.data;
        const data: Record<string, unknown> =
          typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>);
        handledNotifKey.current = key;
        setIncomingCall({
          consultationId: Number(data.consultationId),
          roomName: String(data.roomName),
          callerName: String(data.callerName),
          courseName: latest.message,
        });
      } catch {
        // skip malformed notification — don't mark as handled
      }
    }
  }, [notifications, role]);

  const handleAccept = useCallback(() => {
    if (!incomingCall) return;
    setIncomingCall(null);
    navigate(
      `/student/consultation/${incomingCall.consultationId}/video?room=${incomingCall.roomName}`,
    );
  }, [incomingCall, navigate]);

  const handleReject = useCallback(() => {
    setIncomingCall(null);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar role={role} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {role === 'student' && (
        <>
          <IncomingCallModal
            visible={!!incomingCall}
            callerName={incomingCall?.callerName ?? ''}
            courseName={incomingCall?.courseName}
            onAccept={handleAccept}
            onReject={handleReject}
          />
          <StudentChatbot />
        </>
      )}
    </div>
  );
}

/* ── Dashboard-style inline chatbot ──────────────── */

function StudentChatbot() {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([
    { role: 'ai', text: '안녕하세요! 학습 중 궁금한 점이 있으면 물어보세요. 복습 계획이나 코드 질문도 도와드릴 수 있어요.' },
  ]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const ensureConversation = async (): Promise<number> => {
    if (conversationId) return conversationId;
    const res = await api.post<{ id: number }>('/api/chatbot/conversations', { title: 'AI 학습 도우미' });
    setConversationId(res.id);
    return res.id;
  };

  const handleChatSend = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || sending) return;

    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
    setSending(true);

    try {
      const convId = await ensureConversation();
      const res = await api.post<{ content: string }>(`/api/chatbot/conversations/${convId}/messages`, { content: trimmed });
      setChatMessages((prev) => [...prev, { role: 'ai', text: res.content }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'ai', text: '죄송합니다. 응답을 가져오지 못했어요. 다시 시도해주세요.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-16 right-0 w-80 h-96 bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col"
          >
            <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-indigo-600 text-white">
              <span className="text-sm font-semibold">AI 학습 도우미</span>
              <button
                onClick={() => setChatOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-2">
              {chatMessages.map((msg, i) =>
                msg.role === 'ai' ? (
                  <div key={i} className="bg-indigo-50 rounded-xl p-3 max-w-[85%]">
                    <p className="text-xs text-indigo-700">{msg.text}</p>
                  </div>
                ) : (
                  <div key={i} className="flex justify-end">
                    <div className="bg-indigo-600 rounded-xl p-3 max-w-[85%]">
                      <p className="text-xs text-white">{msg.text}</p>
                    </div>
                  </div>
                ),
              )}
              {sending && (
                <div className="bg-indigo-50 rounded-xl p-3 max-w-[85%]">
                  <p className="text-xs text-indigo-400 animate-pulse">응답 생성 중...</p>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="shrink-0 px-3 py-2 pb-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                  placeholder="질문을 입력하세요..."
                  className="flex-1 text-sm rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:border-indigo-400"
                />
                <button onClick={handleChatSend} disabled={sending} className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:opacity-50">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setChatOpen(!chatOpen)}
        className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
      >
        {chatOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </motion.button>
    </div>
  );
}
