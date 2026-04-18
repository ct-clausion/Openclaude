import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Conversation } from '../../types';

interface ChatHistoryProps {
  conversations: Conversation[];
  currentId?: string | null;
  onSelect: (conversationId: string) => void;
  onDelete?: (conversationId: string) => void;
  onNewChat: () => void;
  onClose: () => void;
  isOpen: boolean;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
  conversations,
  currentId,
  onSelect,
  onDelete,
  onNewChat,
  onClose,
  isOpen,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -280, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute inset-0 z-20 flex flex-col bg-white rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">대화 기록</h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
              aria-label="기록 닫기"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* New chat button */}
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => { onNewChat(); onClose(); }}
              className="w-full flex items-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-3 py-2.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              새 대화 시작
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                <svg className="w-8 h-8 mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-xs">아직 대화가 없습니다</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <motion.div
                  key={conv.id}
                  whileHover={{ x: 2 }}
                  className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                    conv.id === currentId
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'hover:bg-slate-50'
                  }`}
                  onClick={() => { onSelect(conv.id); onClose(); }}
                >
                  <svg
                    className={`w-4 h-4 shrink-0 ${
                      conv.id === currentId ? 'text-indigo-500' : 'text-slate-400'
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>

                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${
                      conv.id === currentId ? 'text-indigo-700' : 'text-slate-700'
                    }`}>
                      {conv.title || '새 대화'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {formatDate(conv.updatedAt)}
                    </p>
                  </div>

                  {onDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                      className="md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 w-6 h-6 rounded-md hover:bg-red-50 flex items-center justify-center transition-all"
                      aria-label="대화 삭제"
                    >
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default ChatHistory;
