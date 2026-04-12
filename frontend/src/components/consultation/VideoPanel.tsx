import { useEffect } from 'react';
import VideoControls from './VideoControls';
import { useLiveKit } from '../../hooks/useLiveKit';

interface VideoPanelProps {
  consultationId: number;
  role?: 'student' | 'instructor';
  onEndCall?: () => void;
  preToken?: string;
  preRoomName?: string;
}

export default function VideoPanel({
  consultationId,
  role = 'student',
  onEndCall,
  preToken,
  preRoomName,
}: VideoPanelProps) {
  const {
    isConnected,
    isConnecting,
    localVideoRef,
    remoteVideoRef,
    isMicEnabled,
    isCameraEnabled,
    connect,
    disconnect,
    toggleMic,
    toggleCamera,
    error,
  } = useLiveKit({ consultationId, role });

  // Auto-connect on mount (use preToken from start-video if available)
  useEffect(() => {
    connect(preToken, preRoomName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEndCall = () => {
    disconnect();
    onEndCall?.();
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-2xl overflow-hidden">
      {/* Main Video Area */}
      <div className="relative flex-1">
        {/* Remote video (main view) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Placeholder when not connected */}
        {!isConnected && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-slate-600 mx-auto mb-3 flex items-center justify-center">
                {isConnecting ? (
                  <svg
                    className="animate-spin w-8 h-8 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-10 h-10 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                )}
              </div>
              <p className="text-sm text-slate-400">
                {isConnecting
                  ? '연결 중...'
                  : error
                    ? error
                    : '카메라 연결 대기 중...'}
              </p>
              {error && (
                <button
                  onClick={() => connect()}
                  className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline"
                >
                  다시 연결
                </button>
              )}
            </div>
          </div>
        )}

        {/* PiP Local Video (bottom-right) */}
        <div className="absolute bottom-3 right-3 w-32 h-24 rounded-lg border-2 border-slate-600 shadow-lg overflow-hidden bg-slate-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!isConnected && !isCameraEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-indigo-900/80">
              <div className="w-8 h-8 rounded-full bg-indigo-600/50 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-indigo-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
                  />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Connection Status Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div
            className={`px-2.5 py-1 rounded-lg backdrop-blur-sm text-xs font-mono text-white ${
              isConnected ? 'bg-black/40' : 'bg-black/60'
            }`}
          >
            {isConnected ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                연결됨
              </span>
            ) : isConnecting ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                연결 중
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                대기
              </span>
            )}
          </div>
        </div>

        {/* Recording Indicator */}
        {isConnected && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[11px] text-white">REC</span>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="py-4 bg-slate-800/80 backdrop-blur-sm">
        <VideoControls
          onEndCall={handleEndCall}
          micOn={isMicEnabled}
          camOn={isCameraEnabled}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
        />
      </div>
    </div>
  );
}
