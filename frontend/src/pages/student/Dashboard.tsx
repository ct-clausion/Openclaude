import React from 'react';
import TodayActionPanel from '../../components/student/TodayActionPanel';
import TwinStateCard from '../../components/student/TwinStateCard';
import GamificationBar from '../../components/student/GamificationBar';
import CodeEditorPanel from '../../components/student/CodeEditorPanel';
import ReviewTimeline from '../../components/student/ReviewTimeline';
import NextStepPrescriptionCard from '../../components/student/NextStepPrescriptionCard';
import StudyGroupPanel from '../../components/student/StudyGroupPanel';
import { useAuthStore } from '../../store/authStore';
import { getDisplayInitial } from '../../utils/userDisplay';

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              ClassPulse Twin
            </h1>
            <p className="text-xs text-slate-500">학생 대시보드</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold">
              {getDisplayInitial(user?.name)}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          {/* Left Column (5/7) */}
          <div className="lg:col-span-5 space-y-6">
            <TodayActionPanel />
            <CodeEditorPanel />
            <ReviewTimeline />
          </div>

          {/* Right Column (2/7) */}
          <div className="lg:col-span-2 space-y-6">
            <TwinStateCard />
            <GamificationBar />
            <NextStepPrescriptionCard />
            <StudyGroupPanel />
          </div>
        </div>
      </main>

    </div>
  );
};

export default Dashboard;
