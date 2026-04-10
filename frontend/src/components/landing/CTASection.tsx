import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function CTASection() {
  const navigate = useNavigate();

  return (
    <section className="relative py-24 px-6 overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #312e81, #1e3a5f, #1a237e)',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.15),transparent_60%)]" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-4xl font-extrabold text-white mb-4"
        >
          AI와 함께 교육의 미래를 시작하세요
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-white/60 text-lg mb-10"
        >
          ClassPulse Twin으로 학생 이탈을 줄이고, 학습 성과를 극대화하세요.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-center justify-center gap-4 flex-wrap"
        >
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3.5 rounded-xl bg-white text-indigo-700 font-bold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            무료로 시작하기
          </button>
        </motion.div>
      </div>
    </section>
  );
}
