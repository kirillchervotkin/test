WITH workout_stats AS (
    SELECT 
        user_id,
        SUM("zone1Seconds" + "zone2Seconds" + "zone3Seconds" + "zone4Seconds" + "zone5Seconds") AS total_zone_seconds,
        SUM("zone1Seconds") AS zone1_seconds,
        SUM("zone2Seconds") AS zone2_seconds,
        SUM("zone3Seconds") AS zone3_seconds,
        SUM("zone4Seconds") AS zone4_seconds,
        SUM("zone5Seconds") AS zone5_seconds,
        COUNT(DISTINCT DATE("startTime")) AS training_days
    FROM workouts
    WHERE
        ($1::DATE IS NULL OR "startTime"::DATE >= $1::DATE)
        AND ($2::DATE IS NULL OR "startTime"::DATE <= $2::DATE)
    GROUP BY user_id
),
cardio_stats AS (
    SELECT 
        user_id,
        SUM(cardio_load) AS total_cardio_load,
        COUNT(DISTINCT "date") AS cardio_days
    FROM cardio_loads
    WHERE
        ($1::DATE IS NULL OR "date" >= $1::DATE)
        AND ($2::DATE IS NULL OR "date" <= $2::DATE)
    GROUP BY user_id
)
SELECT 
    u.id AS user_id,
    u.first_name AS first_name,
    u.last_name AS last_name,
    COALESCE(w.total_zone_seconds, 0) AS total_zone_seconds,
    COALESCE(w.zone1_seconds, 0) AS zone1_seconds,
    COALESCE(w.zone2_seconds, 0) AS zone2_seconds,
    COALESCE(w.zone3_seconds, 0) AS zone3_seconds,
    COALESCE(w.zone4_seconds, 0) AS zone4_seconds,
    COALESCE(w.zone5_seconds, 0) AS zone5_seconds,
    COALESCE(w.training_days, 0) AS training_days,
    COALESCE(cl.total_cardio_load, 0) AS total_cardio_load
FROM users u
LEFT JOIN workout_stats w ON u.id = w.user_id
LEFT JOIN cardio_stats cl ON u.id = cl.user_id
WHERE
    (u.id = ANY($3) OR $3 IS NULL)
    AND (
        EXISTS (
            SELECT 1 
            FROM users_lists ul 
            WHERE ul."userId" = u.id 
                AND ul."listId" = ANY($4)
        ) 
        OR $4 IS NULL
    )