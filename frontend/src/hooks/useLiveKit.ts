import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalTrackPublication,
} from 'livekit-client';
import type { RoomOptions } from 'livekit-client';

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
  const audioElementsRef = useRef<HTMLElement[]>([]);
  const isConnectedRef = useRef(false);
  const isConnectingRef = useRef(false);

  const cleanupAudioElements = useCallback(() => {
    audioElementsRef.current.forEach((el) => {
      el.remove();
    });
    audioElementsRef.current = [];
  }, []);

  const attachAudioTrack = useCallback((track: Track) => {
    if (track.kind === Track.Kind.Audio) {
      const el = track.attach();
      document.body.appendChild(el);
      audioElementsRef.current.push(el);
    }
  }, []);

  const attachRemoteTrack = useCallback(
    (publication: RemoteTrackPublication) => {
      if (!publication.track) return;
      if (
        publication.track.kind === Track.Kind.Video &&
        remoteVideoRef.current
      ) {
        publication.track.attach(remoteVideoRef.current);
      }
      attachAudioTrack(publication.track);
    },
    [attachAudioTrack],
  );

  const connect = useCallback(
    async (preToken?: string, preRoomName?: string) => {
      if (isConnectedRef.current || isConnectingRef.current) return;

      isConnectingRef.current = true;
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
            body: JSON.stringify({ consultationId, role, roomName: preRoomName }),
          });
          if (!res.ok) throw new Error('토큰 발급 실패');
          const data = await res.json();
          livekitToken = data.token;
        }

        const livekitUrl =
          import.meta.env.VITE_LIVEKIT_URL ?? 'wss://clausion-3gmrm9tj.livekit.cloud';

        const roomOpts: RoomOptions = {
          adaptiveStream: true,
          dynacast: true,
        };
        const room = new Room(roomOpts);
        roomRef.current = room;

        // Remote participant events - fires when a remote track becomes available
        room.on(
          RoomEvent.TrackSubscribed,
          (track, _publication, _participant) => {
            console.log('[LiveKit] TrackSubscribed:', track.kind, track.sid);
            if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
              track.attach(remoteVideoRef.current);
            }
            attachAudioTrack(track);
          },
        );

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          console.log('[LiveKit] TrackUnsubscribed:', track.kind, track.sid);
          const detachedElements = track.detach();
          detachedElements.forEach((el) => {
            el.remove();
            audioElementsRef.current = audioElementsRef.current.filter((a) => a !== el);
          });
        });

        room.on(RoomEvent.Disconnected, () => {
          console.log('[LiveKit] Disconnected');
          isConnectedRef.current = false;
          setIsConnected(false);
        });

        // Log when a new participant connects (for debugging)
        room.on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('[LiveKit] ParticipantConnected:', participant.identity);
        });

        await room.connect(livekitUrl, livekitToken!);
        console.log('[LiveKit] Connected to room:', room.name, 'participants:', room.remoteParticipants.size);

        // Ensure audio playback is allowed (browser autoplay policy)
        await room.startAudio();

        // Publish local camera & mic
        await room.localParticipant.enableCameraAndMicrophone();

        // Attach local video
        const localPubs = room.localParticipant.videoTrackPublications;
        localPubs.forEach((pub: LocalTrackPublication) => {
          if (pub.track && localVideoRef.current) {
            pub.track.attach(localVideoRef.current);
          }
        });

        // Attach already-connected remote participants' tracks
        room.remoteParticipants.forEach((participant: RemoteParticipant) => {
          console.log('[LiveKit] Existing remote participant:', participant.identity);
          participant.trackPublications.forEach((pub) => {
            if (pub.isSubscribed && pub.track) {
              console.log('[LiveKit] Attaching existing track:', pub.track.kind);
              if (pub.track.kind === Track.Kind.Video && remoteVideoRef.current) {
                pub.track.attach(remoteVideoRef.current);
              }
              attachAudioTrack(pub.track);
            }
          });
        });

        isConnectedRef.current = true;
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
        isConnectingRef.current = false;
        setIsConnecting(false);
      }
    },
    [consultationId, role, attachRemoteTrack, attachAudioTrack],
  );

  const disconnect = useCallback(async () => {
    // Call end-video API to update server state
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const jwt = localStorage.getItem('token');
      await fetch(`${BASE_URL}/api/consultations/${consultationId}/end-video`, {
        method: 'POST',
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
      });
    } catch {
      // Best-effort: don't block disconnect on API failure
    }

    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    // Clean up audio elements from DOM
    cleanupAudioElements();

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    isConnectedRef.current = false;
    setIsConnected(false);
    setIsMicEnabled(true);
    setIsCameraEnabled(true);
  }, [consultationId, cleanupAudioElements]);

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
      cleanupAudioElements();
    };
  }, [cleanupAudioElements]);

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
