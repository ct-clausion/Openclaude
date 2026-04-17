package com.classpulse.api;

import com.classpulse.config.SecurityUtil;
import com.classpulse.domain.studygroup.StudyGroupMember;
import com.classpulse.domain.studygroup.StudyGroupMessage;
import com.classpulse.domain.studygroup.StudyGroupMessageRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/files")
public class FileUploadController {

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final StudyGroupMessageRepository studyGroupMessageRepository;

    @Value("${app.aws.s3.bucket:clausion}")
    private String bucket;

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    private static final Duration PRESIGNED_URL_TTL = Duration.ofMinutes(15);

    // Whitelist: the only extensions chat users can upload. Keeps executables and
    // browser-interpretable content (html/svg) out of S3.
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md",
            "png", "jpg", "jpeg", "gif", "webp", "heic",
            "mp4", "mov", "webm",
            "zip"
    );

    public FileUploadController(
            @Autowired(required = false) S3Client s3Client,
            @Autowired(required = false) S3Presigner s3Presigner,
            StudyGroupMessageRepository studyGroupMessageRepository) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.studyGroupMessageRepository = studyGroupMessageRepository;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
        if (s3Client == null) {
            log.warn("S3 not configured, upload rejected");
            return ResponseEntity.status(503).body(Map.of("error", "파일 업로드 서비스가 설정되지 않았습니다."));
        }

        Long userId = SecurityUtil.getCurrentUserId();

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "파일이 비어있습니다."));
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            return ResponseEntity.badRequest().body(Map.of("error", "파일 크기는 10MB 이하만 가능합니다."));
        }

        String originalName = file.getOriginalFilename();
        String ext = extractExtension(originalName);
        if (ext == null || !ALLOWED_EXTENSIONS.contains(ext.toLowerCase())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "허용되지 않는 파일 형식입니다.",
                    "allowed", String.join(", ", ALLOWED_EXTENSIONS)));
        }

        // Sanitize filename for Content-Disposition — strip path separators and control chars.
        String safeName = sanitizeFilename(originalName);
        String key = "group-chat/" + userId + "/" + UUID.randomUUID() + "." + ext;

        try {
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(file.getContentType())
                    .contentDisposition("inline; filename=\"" + safeName + "\"")
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));

            String downloadUrl = generatePresignedUrl(key);

            return ResponseEntity.ok(Map.of(
                    "fileKey", key,
                    "fileName", safeName,
                    "fileSize", file.getSize(),
                    "contentType", file.getContentType() != null ? file.getContentType() : "application/octet-stream",
                    "url", downloadUrl
            ));
        } catch (Exception e) {
            log.error("S3 업로드 실패: userId={}, fileName={}, error={}", userId, originalName, e.getMessage(), e);
            // Don't echo internal error messages / bucket names to the client.
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "파일 업로드에 실패했습니다."
            ));
        }
    }

    @GetMapping("/download-url")
    public ResponseEntity<?> getDownloadUrl(@RequestParam String fileKey) {
        if (s3Presigner == null) {
            return ResponseEntity.status(503).body(Map.of("error", "파일 다운로드 서비스가 설정되지 않았습니다."));
        }
        Long userId = SecurityUtil.getCurrentUserId();
        if (!canAccessFileKey(userId, fileKey)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "이 파일에 대한 접근 권한이 없습니다."));
        }
        String url = generatePresignedUrl(fileKey);
        return ResponseEntity.ok(Map.of("url", url));
    }

    /**
     * A user can pull a presigned URL for a fileKey iff:
     *  1) They are the original uploader (fileKey path segment matches their userId), OR
     *  2) They are a member of a study group that has a message referencing this fileKey.
     * This prevents a user from guessing fileKeys belonging to someone else.
     */
    private boolean canAccessFileKey(Long userId, String fileKey) {
        if (fileKey == null || fileKey.isBlank()) return false;
        // Path-based uploader check: keys are "group-chat/{userId}/{uuid}.ext"
        String[] parts = fileKey.split("/");
        if (parts.length >= 2) {
            try {
                long uploaderId = Long.parseLong(parts[1]);
                if (uploaderId == userId) return true;
            } catch (NumberFormatException ignored) {
                // Fall through to group-membership check.
            }
        }
        List<StudyGroupMessage> messages = studyGroupMessageRepository.findByFileKey(fileKey);
        for (StudyGroupMessage m : messages) {
            if (m.getStudyGroup() == null) continue;
            for (StudyGroupMember member : m.getStudyGroup().getMembers()) {
                if (member.getStudent() != null && Objects.equals(member.getStudent().getId(), userId)) {
                    return true;
                }
            }
        }
        return false;
    }

    private String generatePresignedUrl(String key) {
        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(PRESIGNED_URL_TTL)
                .getObjectRequest(GetObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .build())
                .build();
        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    private static String extractExtension(String filename) {
        if (filename == null) return null;
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return null;
        return filename.substring(dot + 1);
    }

    /** Removes path separators, control chars, and quotes that would break the header. */
    private static String sanitizeFilename(String name) {
        if (name == null || name.isBlank()) return "file";
        String stripped = name.replace('\\', '_').replace('/', '_');
        StringBuilder out = new StringBuilder(stripped.length());
        for (int i = 0; i < stripped.length(); i++) {
            char c = stripped.charAt(i);
            if (c < 0x20 || c == 0x7F || c == '"') continue;
            out.append(c);
        }
        String result = out.toString().trim();
        return result.isBlank() ? "file" : result;
    }
}
