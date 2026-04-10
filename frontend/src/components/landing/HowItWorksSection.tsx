import { motion } from 'framer-motion';

const steps = [
  {
    step: 1,
    icon: '\u{1F4DA}',
    title: '커리큘럼 등록',
    description: '강사가 과정 커리큘럼과 스킬 맵을 등록하면 AI가 학습 구조를 분석합니다.',
  },
  {
    step: 2,
    icon: '\u{1F9EC}',
    title: 'Twin 생성',
    description: '각 학생별 디지털 트윈이 자동 생성되어 학습 상태를 실시간 추적합니다.',
  },
  {
    step: 3,
    icon: '\u{1F52C}',
    title: 'AI 분석',
    description: '이해도, 망각 위험, 동기 부족 등을 종합 분석하여 위험 신호를 감지합니다.',
  },
  {
    step: 4,
    icon: '\u{1F4A1}',
    title: '개입 처방',
    description: '최적의 복습 과제, 상담 타이밍, 학습 자료를 자동으로 추천합니다.',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-bold text-indigo-600 uppercase tracking-wider">How it works</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-3">
            4단계로 완성되는 AI 학습 개입
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:shadow-lg transition-all group"
            >
              {/* Step number */}
              <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold">
                STEP {s.step}
              </div>
              <div className="text-3xl mb-4 mt-2">{s.icon}</div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{s.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{s.description}</p>

              {/* Connector arrow (not on last) */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 text-slate-300 text-lg">
                  &rarr;
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
