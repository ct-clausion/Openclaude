import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import IncomingCallModal from '../consultation/IncomingCallModal';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuthStore } from '../../store/authStore';

interface AppShellProps {
  role: 'student' | 'instructor';
}

interface CallInfo {
  consultationId: number;
  roomName: string;
  callerName: string;
  courseName?: string;
}

export default function AppShell({ role }: AppShellProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { notifications } = useNotifications();
  const [incomingCall, setIncomingCall] = useState<CallInfo | null>(null);

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
      const data = latest.data as Record<string, unknown>;
      setIncomingCall({
        consultationId: Number(data.consultationId),
        roomName: String(data.roomName),
        callerName: String(data.callerName),
        courseName: latest.message,
      });
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
        <IncomingCallModal
          visible={!!incomingCall}
          callerName={incomingCall?.callerName ?? ''}
          courseName={incomingCall?.courseName}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
