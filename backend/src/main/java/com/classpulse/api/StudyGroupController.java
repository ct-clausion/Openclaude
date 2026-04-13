package com.classpulse.api;

import com.classpulse.ai.StudyGroupMatcherAi;
import com.classpulse.config.RabbitMQConfig;
import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.course.Course;
import com.classpulse.domain.course.CourseRepository;
import com.classpulse.domain.studygroup.*;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/study-groups")
@RequiredArgsConstructor
public class StudyGroupController {

    private final StudyGroupRepository studyGroupRepository;
    private final StudyGroupMessageRepository messageRepository;
    private final CourseRepository courseRepository;
    private final UserService userService;
    private final StudyGroupMatcherAi studyGroupMatcherAi;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired(required = false)
    private RabbitTemplate rabbitTemplate;

    // --- DTOs ---

    public record CreateStudyGroupRequest(Long courseId, String name, String description, Integer maxMembers) {}

    public record MemberResponse(
            Long id, Long studentId, String studentName,
            String role, String strengthSummary, String complementNote,
            BigDecimal matchScore, LocalDateTime joinedAt
    ) {
        public static MemberResponse from(StudyGroupMember m) {
            return new MemberResponse(
                    m.getId(), m.getStudent().getId(), m.getStudent().getName(),
                    m.getRole(), m.getStrengthSummary(), m.getComplementNote(),
                    m.getMatchScore(), m.getJoinedAt()
            );
        }
    }

    public record StudyGroupResponse(
            Long id, Long courseId, String courseName,
            String name, String description,
            Integer maxMembers, String status,
            Long createdById, String createdByName,
            List<MemberResponse> members,
            LocalDateTime createdAt
    ) {
        public static StudyGroupResponse from(StudyGroup g) {
            List<MemberResponse> memberResponses = g.getMembers().stream()
                    .map(MemberResponse::from).toList();
            return new StudyGroupResponse(
                    g.getId(), g.getCourse().getId(), g.getCourse().getTitle(),
                    g.getName(), g.getDescription(),
                    g.getMaxMembers(), g.getStatus(),
                    g.getCreatedBy() != null ? g.getCreatedBy().getId() : null,
                    g.getCreatedBy() != null ? g.getCreatedBy().getName() : null,
                    memberResponses, g.getCreatedAt()
            );
        }
    }

    public record MatchResponse(
            Long studentId, String studentName,
            BigDecimal matchScore, String strengthSummary, String complementNote
    ) {}

    // --- Endpoints ---

    @GetMapping("/matches/{studentId}")
    @SuppressWarnings("unchecked")
    public ResponseEntity<List<MatchResponse>> getMatches(
            @PathVariable Long studentId,
            @RequestParam Long courseId
    ) {
        Map<String, Object> result = studyGroupMatcherAi.findMatches(studentId, courseId);

        List<Map<String, Object>> matches =
                (List<Map<String, Object>>) result.getOrDefault("matches", List.of());

        List<MatchResponse> response = matches.stream()
                .map(m -> new MatchResponse(
                        ((Number) m.get("student_id")).longValue(),
                        (String) m.get("student_name"),
                        m.get("complement_score") != null
                                ? BigDecimal.valueOf(((Number) m.get("complement_score")).doubleValue())
                                : BigDecimal.ZERO,
                        (String) m.get("strength_description"),
                        (String) m.get("complement_note")
                ))
                .toList();

        return ResponseEntity.ok(response);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<StudyGroupResponse> create(@RequestBody CreateStudyGroupRequest request) {
        Long userId = SecurityUtil.getCurrentUserId();
        User creator = userService.findById(userId);
        Course course = courseRepository.findById(request.courseId())
                .orElseThrow(() -> new IllegalArgumentException("Course not found: " + request.courseId()));

        StudyGroup group = StudyGroup.builder()
                .course(course)
                .name(request.name())
                .description(request.description())
                .maxMembers(request.maxMembers() != null ? request.maxMembers() : 5)
                .status("ACTIVE")
                .createdBy(creator)
                .build();
        group = studyGroupRepository.save(group);

        // Auto-add creator as LEADER member
        StudyGroupMember leaderMember = StudyGroupMember.builder()
                .studyGroup(group)
                .student(creator)
                .role("LEADER")
                .build();
        group.getMembers().add(leaderMember);
        group = studyGroupRepository.save(group);

        return ResponseEntity.status(HttpStatus.CREATED).body(StudyGroupResponse.from(group));
    }

    @GetMapping("/my")
    public ResponseEntity<List<StudyGroupResponse>> myGroups() {
        Long userId = SecurityUtil.getCurrentUserId();
        List<StudyGroup> groups = studyGroupRepository.findByMemberStudentId(userId);
        return ResponseEntity.ok(groups.stream().map(StudyGroupResponse::from).toList());
    }

    @GetMapping("/course/{courseId}")
    public ResponseEntity<List<StudyGroupResponse>> byCourse(@PathVariable Long courseId) {
        List<StudyGroup> groups = studyGroupRepository.findByCourseId(courseId);
        return ResponseEntity.ok(groups.stream().map(StudyGroupResponse::from).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<StudyGroupResponse> getById(@PathVariable Long id) {
        StudyGroup group = studyGroupRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Study group not found: " + id));
        return ResponseEntity.ok(StudyGroupResponse.from(group));
    }

    @PostMapping("/{id}/join")
    @Transactional
    public ResponseEntity<StudyGroupResponse> join(@PathVariable Long id) {
        Long userId = SecurityUtil.getCurrentUserId();
        User student = userService.findById(userId);

        StudyGroup group = studyGroupRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Study group not found: " + id));

        // Check if already a member
        boolean alreadyMember = group.getMembers().stream()
                .anyMatch(m -> m.getStudent().getId().equals(userId));
        if (alreadyMember) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }

        // Check capacity
        if (group.getMembers().size() >= group.getMaxMembers()) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).build();
        }

        StudyGroupMember member = StudyGroupMember.builder()
                .studyGroup(group)
                .student(student)
                .role("MEMBER")
                .build();
        group.getMembers().add(member);
        group = studyGroupRepository.save(group);

        broadcastSystemMessage(group, student.getName() + "님이 그룹에 참여했습니다.");

        return ResponseEntity.ok(StudyGroupResponse.from(group));
    }

    @DeleteMapping("/{id}/leave")
    @Transactional
    public ResponseEntity<Void> leave(@PathVariable Long id) {
        Long userId = SecurityUtil.getCurrentUserId();
        User student = userService.findById(userId);

        StudyGroup group = studyGroupRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Study group not found: " + id));

        StudyGroupMember leavingMember = group.getMembers().stream()
                .filter(m -> m.getStudent().getId().equals(userId))
                .findFirst()
                .orElse(null);
        if (leavingMember == null) {
            return ResponseEntity.notFound().build();
        }

        boolean leaderLeaving = isLeader(leavingMember);
        group.getMembers().remove(leavingMember);

        if (shouldDeleteGroup(group)) {
            broadcastRoomDeleted(group, student.getName() + "님이 그룹을 떠나 채팅방이 종료되었습니다.");
            studyGroupRepository.delete(group);
            return ResponseEntity.noContent().build();
        }

        String systemMessage = student.getName() + "님이 그룹을 떠났습니다.";
        if (leaderLeaving || !hasLeader(group)) {
            StudyGroupMember nextLeader = promoteNextLeader(group);
            systemMessage = systemMessage + " 새로운 방장은 " + nextLeader.getStudent().getName() + "님입니다.";
        }

        studyGroupRepository.save(group);
        broadcastSystemMessage(group, systemMessage);

        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/members/{studentId}")
    @Transactional
    public ResponseEntity<Void> kickMember(@PathVariable Long id, @PathVariable Long studentId) {
        Long userId = SecurityUtil.getCurrentUserId();

        StudyGroup group = studyGroupRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Study group not found: " + id));

        // 방장만 강퇴 가능
        boolean isLeader = group.getMembers().stream()
                .anyMatch(m -> m.getStudent().getId().equals(userId) && "LEADER".equals(m.getRole()));
        if (!isLeader) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        // 자기 자신은 강퇴 불가
        if (userId.equals(studentId)) {
            return ResponseEntity.badRequest().build();
        }

        StudyGroupMember target = group.getMembers().stream()
                .filter(m -> m.getStudent().getId().equals(studentId))
                .findFirst().orElse(null);
        if (target == null) {
            return ResponseEntity.notFound().build();
        }

        String targetName = target.getStudent().getName();
        group.getMembers().remove(target);
        studyGroupRepository.save(group);
        broadcastSystemMessage(group, targetName + "님이 그룹에서 내보내졌습니다.");

        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteGroup(@PathVariable Long id) {
        Long userId = SecurityUtil.getCurrentUserId();

        StudyGroup group = studyGroupRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Study group not found: " + id));

        // 방장만 삭제 가능
        boolean isLeader = group.getMembers().stream()
                .anyMatch(m -> m.getStudent().getId().equals(userId) && "LEADER".equals(m.getRole()));
        if (!isLeader) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        // 자기밖에 없어야 삭제 가능
        if (group.getMembers().size() > 1) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }

        studyGroupRepository.delete(group);
        return ResponseEntity.noContent().build();
    }

    // ── System message helper ─────────────────────────────────────────

    private void broadcastSystemMessage(StudyGroup group, String text) {
        StudyGroupMessage msg = StudyGroupMessage.builder()
                .studyGroup(group)
                .sender(group.getCreatedBy())
                .content(text)
                .messageType("SYSTEM")
                .build();
        msg = messageRepository.save(msg);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("groupId", group.getId());
        payload.put("id", msg.getId());
        payload.put("senderId", 0);
        payload.put("senderName", "SYSTEM");
        payload.put("content", text);
        payload.put("messageType", "SYSTEM");
        payload.put("createdAt", msg.getCreatedAt().toString());

        if (rabbitTemplate != null) {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.GROUP_CHAT_EXCHANGE,
                    "group." + group.getId(),
                    payload
            );
        } else {
            messagingTemplate.convertAndSend("/topic/group-chat/" + group.getId(), payload);
        }
    }

    private void broadcastRoomDeleted(StudyGroup group, String text) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("groupId", group.getId());
        payload.put("id", null);
        payload.put("senderId", 0);
        payload.put("senderName", "SYSTEM");
        payload.put("content", text);
        payload.put("messageType", "ROOM_DELETED");
        payload.put("createdAt", LocalDateTime.now().toString());

        if (rabbitTemplate != null) {
            rabbitTemplate.convertAndSend(
                    RabbitMQConfig.GROUP_CHAT_EXCHANGE,
                    "group." + group.getId(),
                    payload
            );
        } else {
            messagingTemplate.convertAndSend("/topic/group-chat/" + group.getId(), payload);
        }
    }

    private boolean shouldDeleteGroup(StudyGroup group) {
        return group.getMembers().size() <= 1;
    }

    private boolean hasLeader(StudyGroup group) {
        return group.getMembers().stream().anyMatch(this::isLeader);
    }

    private boolean isLeader(StudyGroupMember member) {
        return "LEADER".equalsIgnoreCase(member.getRole());
    }

    private StudyGroupMember promoteNextLeader(StudyGroup group) {
        StudyGroupMember nextLeader = group.getMembers().stream()
                .min(Comparator
                        .comparing(StudyGroupMember::getJoinedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(StudyGroupMember::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElseThrow(() -> new IllegalStateException("Cannot promote leader without members"));

        group.getMembers().forEach(member -> {
            if (!member.getId().equals(nextLeader.getId()) && isLeader(member)) {
                member.setRole("MEMBER");
            }
        });
        nextLeader.setRole("LEADER");
        group.setCreatedBy(nextLeader.getStudent());
        return nextLeader;
    }
}
