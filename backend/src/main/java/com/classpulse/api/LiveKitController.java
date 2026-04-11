package com.classpulse.api;

import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.consultation.Consultation;
import com.classpulse.domain.consultation.ConsultationRepository;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
import com.classpulse.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequiredArgsConstructor
public class LiveKitController {

    private final ConsultationRepository consultationRepository;
    private final UserService userService;
    private final NotificationService notificationService;

    @Value("${app.livekit.api-key:devkey}")
    private String livekitApiKey;

    @Value("${app.livekit.api-secret:devsecret}")
    private String livekitApiSecret;

    // --- DTOs ---

    public record TokenRequest(String roomName, String participantName, Long consultationId, String role) {}

    public record TokenResponse(String token, String roomName, String participantName) {}

    public record VideoSessionResponse(
            Long consultationId, String roomName, String status, String token
    ) {}

    // --- Endpoints ---

    @PostMapping("/api/livekit/token")
    public ResponseEntity<TokenResponse> generateToken(@RequestBody TokenRequest request) {
        Long userId = SecurityUtil.getCurrentUserId();
        User user = userService.findById(userId);

        String roomName = request.roomName();

        // If consultationId is provided instead of roomName, derive it from the consultation
        if ((roomName == null || roomName.isBlank()) && request.consultationId() != null) {
            Consultation consultation = consultationRepository.findById(request.consultationId())
                    .orElseThrow(() -> new IllegalArgumentException("Consultation not found: " + request.consultationId()));
            roomName = consultation.getVideoRoomName();
            if (roomName == null || roomName.isBlank()) {
                roomName = "consultation-" + request.consultationId() + "-" + UUID.randomUUID().toString().substring(0, 8);
                consultation.setVideoRoomName(roomName);
                consultationRepository.save(consultation);
            }
        }

        if (roomName == null || roomName.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        String participantName = request.participantName() != null
                ? request.participantName() : user.getName();

        String token = generateLiveKitToken(roomName, participantName);

        return ResponseEntity.ok(new TokenResponse(token, roomName, participantName));
    }

    @PostMapping("/api/consultations/{id}/start-video")
    @Transactional
    public ResponseEntity<VideoSessionResponse> startVideo(@PathVariable Long id) {
        Long userId = SecurityUtil.getCurrentUserId();
        User user = userService.findById(userId);

        Consultation consultation = consultationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Consultation not found: " + id));

        // Generate a unique room name for this consultation
        String roomName = "consultation-" + id + "-" + UUID.randomUUID().toString().substring(0, 8);
        consultation.setVideoRoomName(roomName);
        consultation.setStatus("IN_PROGRESS");
        consultationRepository.save(consultation);

        String token = generateLiveKitToken(roomName, user.getName());
        log.info("Started video session for consultation {} in room {}", id, roomName);

        // Send INCOMING_CALL notification to the student
        Long studentId = consultation.getStudent().getId();
        notificationService.createNotification(
                studentId,
                "INCOMING_CALL",
                user.getName() + " 강사님이 화상 상담을 요청합니다",
                consultation.getCourse() != null
                        ? consultation.getCourse().getTitle() + " 과목 상담"
                        : "화상 상담",
                Map.of(
                        "consultationId", id,
                        "roomName", roomName,
                        "callerName", user.getName(),
                        "callerId", userId
                )
        );

        return ResponseEntity.ok(new VideoSessionResponse(id, roomName, "IN_PROGRESS", token));
    }

    @PostMapping("/api/consultations/{id}/end-video")
    public ResponseEntity<VideoSessionResponse> endVideo(@PathVariable Long id) {
        Consultation consultation = consultationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Consultation not found: " + id));

        String roomName = consultation.getVideoRoomName();
        consultation.setStatus("VIDEO_ENDED");
        consultationRepository.save(consultation);

        log.info("Ended video session for consultation {} in room {}", id, roomName);

        return ResponseEntity.ok(new VideoSessionResponse(id, roomName, "VIDEO_ENDED", null));
    }

    // --- Helper ---

    private String generateLiveKitToken(String roomName, String participantName) {
        // LiveKit access tokens are JWTs signed with the API secret.
        // The token follows the LiveKit access token spec:
        // https://docs.livekit.io/home/get-started/authentication/
        var now = Instant.now();
        var key = Keys.hmacShaKeyFor(livekitApiSecret.getBytes(StandardCharsets.UTF_8));

        var videoGrant = Map.of(
                "roomJoin", true,
                "room", roomName,
                "canPublish", true,
                "canSubscribe", true
        );

        return Jwts.builder()
                .issuer(livekitApiKey)
                .subject(participantName)
                .claim("name", participantName)
                .claim("video", videoGrant)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(3600)))
                .id(UUID.randomUUID().toString())
                .signWith(key)
                .compact();
    }
}
