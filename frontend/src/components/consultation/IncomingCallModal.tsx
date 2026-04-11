import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface IncomingCallModalProps {
  visible: boolean;
  callerName: string;
  courseName?: string;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({
  visible,
  callerName,
  courseName,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (visible) {
      // Play ringtone using Web Audio oscillator (no external file needed)
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start();

      // Pulsing ring pattern
      const interval = setInterval(() => {
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      }, 1000);

      return () => {
        clearInterval(interval);
        osc.stop();
        ctx.close();
      };
    }
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-white rounded-3xl shadow-2xl p-8 w-80 text-center"
          >
            {/* Pulsing avatar */}
            <div className="relative mx-auto w-20 h-20 mb-5">
              <div className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              화상 상담 요청
            </h3>
            <p className="text-sm text-slate-600 mb-1">{callerName} 강사님</p>
            {courseName && (
              <p className="text-xs text-slate-400 mb-6">{courseName}</p>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={onReject}
                className="flex-1 py-3 rounded-xl bg-rose-50 text-rose-600 font-semibold text-sm hover:bg-rose-100 transition-colors"
              >
                거절
              </button>
              <button
                onClick={onAccept}
                className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-600 transition-colors"
              >
                수락
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
