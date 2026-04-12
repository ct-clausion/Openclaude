import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import VideoPanel from '../../components/consultation/VideoPanel';

export default function VideoCall() {
  const { consultationId } = useParams<{ consultationId: string }>();
  const [searchParams] = useSearchParams();
  const roomName = searchParams.get('room') ?? undefined;
  const navigate = useNavigate();

  const handleEndCall = () => {
    navigate('/student/consultation');
  };

  if (!consultationId) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-500 mb-3">유효하지 않은 상담입니다.</p>
          <button
            onClick={() => navigate('/student/consultation')}
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
        role="student"
        onEndCall={handleEndCall}
        preRoomName={roomName}
      />
    </div>
  );
}
