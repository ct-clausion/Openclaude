package com.classpulse.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;

import java.util.List;

/**
 * Best-effort S3 cleanup helper. Called when DB rows that referenced S3 keys are
 * deleted (e.g., a study group being removed). Runs async so the main request
 * path doesn't block on AWS. If S3 isn't configured, it logs and no-ops.
 */
@Slf4j
@Service
public class S3FileCleanupService {

    private final S3Client s3Client;
    private final String bucket;

    public S3FileCleanupService(
            @Autowired(required = false) S3Client s3Client,
            @Value("${app.aws.s3.bucket:classpulse}") String bucket) {
        this.s3Client = s3Client;
        this.bucket = bucket;
    }

    /** Delete a batch of object keys. Null/blank keys are ignored. */
    @Async("aiTaskExecutor")
    public void deleteObjects(List<String> keys) {
        if (s3Client == null || keys == null || keys.isEmpty()) return;

        List<ObjectIdentifier> ids = keys.stream()
                .filter(k -> k != null && !k.isBlank())
                .map(k -> ObjectIdentifier.builder().key(k).build())
                .toList();
        if (ids.isEmpty()) return;

        try {
            // S3 DeleteObjects caps at 1000 per call.
            int batchSize = 1000;
            for (int i = 0; i < ids.size(); i += batchSize) {
                List<ObjectIdentifier> batch = ids.subList(i, Math.min(i + batchSize, ids.size()));
                s3Client.deleteObjects(DeleteObjectsRequest.builder()
                        .bucket(bucket)
                        .delete(Delete.builder().objects(batch).build())
                        .build());
            }
            log.info("Deleted {} S3 objects from cleanup", ids.size());
        } catch (Exception e) {
            log.warn("S3 cleanup failed (best-effort): {}", e.getMessage());
        }
    }
}
