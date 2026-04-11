import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalTrackPublication,
} from 'livekit-client';

interface UseLiveKitOptions {
  consultationId: number;
  role: 'student' | 'instructor';
}

interface UseLiveKitReturn {
  isConnected: boolean;
  isConnecting: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  connect: (token?: string, roomName?: string) => Promise<void>;
  disconnect: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  error: string | null;
}

export function useLiveKit({
  consultationId,
  role,
}: UseLiveKitOptions): UseLiveKitReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef<Room | null>(null);

  const attachRemoteTrack = useCallback(
    (publication: RemoteTrackPublication) => {
      if (!publication.track) return;
      if (
        publication.track.kind === Track.Kind.Video &&
        remoteVideoRef.current
      ) {
        publication.track.attach(remoteVideoRef.current);
      }
      if (publication.track.kind === Track.Kind.Audio) {
        const el = publication.track.attach();
        document.body.appendChild(el);
      }
    },
    [],
  );

  const connect = useCallback(
    async (preToken?: string, preRoomName?: string) => {
      if (isConnected || isConnecting) return;

      setIsConnecting(true);
      setError(null);

      try {
        const BASE_URL = import.meta.env.VITE_API_URL ?? '';
        const jwt = localStorage.getItem('token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

        let livekitToken = preToken;
        if (!livekitToken) {
          const res = await fetch(`${BASE_URL}/api/livekit/token`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ consultationId, role }),
          });
          if (!res.ok) throw new Error('토큰 발급 실패');
          const data = await res.json();
          livekitToken = data.token;
        }

        const livekitUrl =
          import.meta.env.VITE_LIVEKIT_URL ?? 'ws://localhost:7880';

        const room = new Room();
        roomRef.current = room;

        // Remote participant events
        room.on(
          RoomEvent.TrackSubscribed,
          (track, publication, participant) => {
            if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
              track.attach(remoteVideoRef.current);
            }
            if (track.kind === Track.Kind.Audio) {
              const el = track.attach();
              document.body.appendChild(el);
            }
          },
        );

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach();
        });

        room.on(RoomEvent.Disconnected, () => {
          setIsConnected(false);
        });

        await room.connect(livekitUrl, livekitToken!);

        // Publish local camera & mic
        await room.localParticipant.enableCameraAndMicrophone();

        // Attach local video
        const localPubs = room.localParticipant.videoTrackPublications;
        localPubs.forEach((pub: LocalTrackPublication) => {
          if (pub.track && localVideoRef.current) {
            pub.track.attach(localVideoRef.current);
          }
        });

        // Attach already-connected remote participants
        room.remoteParticipants.forEach((participant: RemoteParticipant) => {
          participant.trackPublications.forEach((pub) => {
            if (pub.isSubscribed) attachRemoteTrack(pub);
          });
        });

        setIsConnected(true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to connect';
        if (
          message.includes('NotAllowedError') ||
          message.includes('Permission')
        ) {
          setError('카메라/마이크 접근 권한이 필요합니다.');
        } else {
          setError(message);
        }
      } finally {
        setIsConnecting(false);
      }
    },
    [consultationId, role, isConnected, isConnecting, attachRemoteTrack],
  );

  const disconnect = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setIsConnected(false);
    setIsMicEnabled(true);
    setIsCameraEnabled(true);
  }, []);

  const toggleMic = useCallback(() => {
    if (!roomRef.current) return;
    const next = !isMicEnabled;
    roomRef.current.localParticipant.setMicrophoneEnabled(next);
    setIsMicEnabled(next);
  }, [isMicEnabled]);

  const toggleCamera = useCallback(() => {
    if (!roomRef.current) return;
    const next = !isCameraEnabled;
    roomRef.current.localParticipant.setCameraEnabled(next);
    setIsCameraEnabled(next);
  }, [isCameraEnabled]);

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  return {
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
  };
}
