import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function FloatingOrb({ className }: { className: string }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-20 ${className}`}
      animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function FloatingStatCard({ label, delay }: { label: string; delay: number }) {
  return (
    <motion.div
      className="glass-card px-4 py-3 text-center"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: 'easeOut' }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <p className="text-sm font-bold text-indigo-600">{label}</p>
    </motion.div>
  );
}

export default function AnimatedGradientHero() {
  const navigate = useNavigate();

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6"
      style={{
        background: 'linear-gradient(-45deg, #1e1b4b, #312e81, #1e3a5f, #0f4c75, #1a237e, #283593)',
        backgroundSize: '400% 400%',
        animation: 'gradientShift 12s ease infinite',
      }}
    >
      {/* Floating orbs */}
      <FloatingOrb className="w-96 h-96 bg-violet-500 -top-20 -left-20" />
      <FloatingOrb className="w-80 h-80 bg-indigo-400 top-1/3 -right-16" />
      <FloatingOrb className="w-64 h-64 bg-cyan-400 bottom-10 left-1/4" />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/30 bg-white/5 backdrop-blur-sm mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-white/70 font-medium">
            AI 교육 개입 오케스트레이터 &mdash; 학습 디지털 트윈 엔진 탑재
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6"
        >
          학생별 AI 학습 분신이{' '}
          <br className="hidden md:block" />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(90deg, #c4b5fd, #a5b4fc, #67e8f9)',
            }}
          >
            최적의 개입 시점을 설계
          </span>
          합니다
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-lg text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          디지털 트윈이 학생의 이해도와 망각 위험을 실시간으로 분석하고,
          강사에게 최적의 상담 타이밍과 과제를 제안합니다.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="flex items-center justify-center gap-4 flex-wrap mb-16"
        >
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3 rounded-xl bg-white text-indigo-700 font-bold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all duration-200"
          >
            지금 시작하기 &rarr;
          </button>
        </motion.div>

        {/* Floating stat cards */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <FloatingStatCard label="15% 이탈률 감소" delay={0.6} />
          <FloatingStatCard label="70% 과정 완료율 향상" delay={0.75} />
          <FloatingStatCard label="82% 사전 예측 정확도" delay={0.9} />
        </div>
      </div>
    </section>
  );
}
