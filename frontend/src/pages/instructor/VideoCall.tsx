import { useParams, useNavigate, useLocation } from 'react-router-dom';
import VideoPanel from '../../components/consultation/VideoPanel';

export default function InstructorVideoCall() {
  const { consultationId } = useParams<{ consultationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { token?: string; roomName?: string } | null;

  const handleEndCall = () => {
    navigate('/instructor/consultations');
  };

  if (!consultationId) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-500 mb-3">유효하지 않은 상담입니다.</p>
          <button
            onClick={() => navigate('/instructor/consultations')}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            상담 목록으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)]">
      <VideoPanel
        consultationId={Number(consultationId)}
        role="instructor"
        onEndCall={handleEndCall}
        preToken={state?.token}
        preRoomName={state?.roomName}
      />
    </div>
  );
}
