-- Back up the target database before running this script.
-- This updates the existing chief administrator account without changing its password.
BEGIN;

DO $$
DECLARE
    chief_admin_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO chief_admin_count
    FROM users
    WHERE LOWER(email) = LOWER('admin@buk.edu.ng')
      AND role = 'admin';

    IF chief_admin_count <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one existing chief administrator; found %',
            chief_admin_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM users
        WHERE LOWER(email) = LOWER('aidsfaz@gmail.com')
          AND LOWER(email) <> LOWER('admin@buk.edu.ng')
    ) THEN
        RAISE EXCEPTION
            'The replacement email already belongs to another account';
    END IF;

    UPDATE users
    SET email = 'aidsfaz@gmail.com'
    WHERE LOWER(email) = LOWER('admin@buk.edu.ng')
      AND role = 'admin';
END $$;

SELECT id, email, role, is_active, is_approved
FROM users
WHERE LOWER(email) = LOWER('aidsfaz@gmail.com');

COMMIT;
