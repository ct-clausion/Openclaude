-- Set max_capacity to at least (current enrollment + 10), minimum 30
UPDATE courses c
SET max_capacity = GREATEST(
    30,
    (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id AND ce.status = 'APPROVED') + 10
)
WHERE max_capacity IS NULL OR max_capacity < (
    SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id AND ce.status = 'APPROVED'
);
