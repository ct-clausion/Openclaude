import { useParams, useNavigate } from 'react-router-dom';
import VideoPanel from '../../components/consultation/VideoPanel';

export default function InstructorVideoCall() {
  const { consultationId } = useParams<{ consultationId: string }>();
  const navigate = useNavigate();

  const handleEndCall = () => {
    navigate('/instructor/consultations');
  };

  return (
    <div className="h-[calc(100vh-120px)]">
      <VideoPanel
        consultationId={consultationId ? Number(consultationId) : 1}
        role="instructor"
        onEndCall={handleEndCall}
      />
    </div>
  );
}
