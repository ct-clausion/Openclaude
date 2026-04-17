-- Bind each registration code to a specific role so a code meant for INSTRUCTOR
-- can't be used to self-register as OPERATOR (and vice versa).
ALTER TABLE registration_codes
    ADD COLUMN target_role VARCHAR(20);

-- Backfill: existing codes had no constraint, so treat them as INSTRUCTOR codes
-- (the more common use case). Operators who want stricter handling can revoke
-- and regenerate codes after deployment.
UPDATE registration_codes SET target_role = 'INSTRUCTOR' WHERE target_role IS NULL;

ALTER TABLE registration_codes
    ALTER COLUMN target_role SET NOT NULL;

ALTER TABLE registration_codes
    ADD CONSTRAINT registration_codes_target_role_check
        CHECK (target_role IN ('INSTRUCTOR', 'OPERATOR'));
