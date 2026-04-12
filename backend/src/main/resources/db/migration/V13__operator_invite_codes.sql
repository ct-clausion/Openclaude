-- V13: Operator invite code system for controlled registration

CREATE TABLE registration_codes (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    created_by_id BIGINT REFERENCES users(id),
    used_by_id BIGINT REFERENCES users(id),
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    used_at TIMESTAMP
);

CREATE INDEX idx_registration_codes_code ON registration_codes(code);

-- Seed initial operator account (password: operator123)
-- BCrypt hash generated for 'operator123'
INSERT INTO users (email, password_hash, name, role, created_at, updated_at)
SELECT 'admin@classpulse.kr',
       '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
       '시스템 관리자',
       'OPERATOR',
       NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE role = 'OPERATOR'
);
