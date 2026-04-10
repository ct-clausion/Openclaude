ALTER TABLE study_group_messages
    ADD COLUMN file_key      VARCHAR(500),
    ADD COLUMN file_name     VARCHAR(255),
    ADD COLUMN file_size     BIGINT,
    ADD COLUMN content_type  VARCHAR(100);
