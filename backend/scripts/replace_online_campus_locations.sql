-- Back up the Render database before running this script.
-- This replaces every online campus location with the 12 rows from the local database.
BEGIN;

DELETE FROM campus_locations;

INSERT INTO campus_locations (
    id,
    name,
    category,
    description,
    latitude,
    longitude,
    image_url,
    is_active,
    building_code,
    is_emergency_point
) VALUES
    (1, 'Faculty of Computing', 'department', 'Main building for Computer Science, Software Engineering and related programmes', 11.9758, 8.4265, NULL, TRUE, 'FC-01', FALSE),
    (2, 'New Campus Main Gate', 'admin', 'Main entrance to the New Campus', 11.9782, 8.4231, NULL, TRUE, 'GATE-NC', FALSE),
    (3, 'Old Campus Main Gate', 'admin', 'Main entrance to the Old Campus', 11.9815, 8.4780, NULL, TRUE, 'GATE-OC', FALSE),
    (4, 'University Library (New Campus)', 'other', 'Main library complex', 11.9765, 8.4250, NULL, TRUE, 'LIB-NC', FALSE),
    (5, 'Student Affairs Division', 'admin', 'Handles student welfare, ID cards and related services', 11.9770, 8.4240, NULL, TRUE, 'SA-01', FALSE),
    (6, 'BUK Clinic / Health Centre', 'emergency', 'University health centre', 11.9749, 8.4278, NULL, TRUE, 'CLINIC', TRUE),
    (7, 'Security Unit (New Campus)', 'emergency', 'Campus security headquarters', 11.9752, 8.4225, NULL, TRUE, 'SEC-NC', TRUE),
    (8, 'Male Hostel Block A (New Campus)', 'hostel', 'Undergraduate male hostel', 11.9735, 8.4290, NULL, TRUE, 'MH-A', FALSE),
    (9, 'Female Hostel Block B (New Campus)', 'hostel', 'Undergraduate female hostel', 11.9730, 8.4305, NULL, TRUE, 'FH-B', FALSE),
    (10, 'Senate Building', 'admin', 'Central administration and Senate', 11.9760, 8.4248, NULL, TRUE, 'SENATE', FALSE),
    (11, 'Faculty of Engineering', 'department', 'Engineering complex', 11.9740, 8.4285, NULL, TRUE, 'ENG-01', FALSE),
    (12, 'BUK Microfinance Bank', 'other', 'On-campus banking services', 11.9775, 8.4238, NULL, TRUE, 'BANK', FALSE);

SELECT setval(
    pg_get_serial_sequence('campus_locations', 'id'),
    (SELECT MAX(id) FROM campus_locations),
    TRUE
);

COMMIT;
