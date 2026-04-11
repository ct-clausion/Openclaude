import { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import VideoPanel from '../../components/consultation/VideoPanel';

export default function VideoCall() {
  const { consultationId } = useParams<{ consultationId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomName = searchParams.get('room') ?? undefined;

  const handleEndCall = () => {
    navigate('/student/consultation');
  };

  return (
    <div className="h-[calc(100vh-120px)]">
      <VideoPanel
        consultationId={consultationId ? Number(consultationId) : 1}
        role="student"
        onEndCall={handleEndCall}
      />
    </div>
  );
}
