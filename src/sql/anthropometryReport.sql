WITH unique_users AS (
    SELECT DISTINCT 
        u.id AS "userId"
    FROM 
        users u
    WHERE 
        ($2::int[] IS NULL OR u.id = ANY($2::int[]))
        AND (
            $1::int[] IS NULL 
            OR EXISTS (
                SELECT 1 
                FROM users_lists ul 
                WHERE 
                    ul."userId" = u.id 
                    AND ul."listId" = ANY($1::int[])
            )
        )
),
ranked_data AS (
    SELECT 
        ad."userId",
        users.first_name,
        users.last_name,
        users.birth_date,
        ad.date,
        ad.location,
        ad.height,
        LAG(ad.height) OVER (PARTITION BY ad."userId" ORDER BY ad.date) AS prev_height,
        ad.weight,
        LAG(ad.weight) OVER (PARTITION BY ad."userId" ORDER BY ad.date) AS prev_weight,
        ad.biceps,
        LAG(ad.biceps) OVER (PARTITION BY ad."userId" ORDER BY ad.date) AS prev_biceps,
        ad.triceps,
        LAG(ad.triceps) OVER (PARTITION BY ad."userId" ORDER BY ad.date) AS prev_triceps,
        ad.subscapular,
        LAG(ad.subscapular) OVER (PARTITION BY ad."userId" ORDER BY ad.date) AS prev_subscapular,
        ad.iliac,
        LAG(ad.iliac) OVER (PARTITION BY ad."userId" ORDER BY ad.date) AS prev_iliac,
        ROW_NUMBER() OVER (PARTITION BY ad."userId" ORDER BY ad.date DESC) AS rn
    FROM 
        anthropometric_data ad
        JOIN users ON ad."userId" = users.id
        INNER JOIN unique_users ON ad."userId" = unique_users."userId"
)
SELECT 
    "userId",
    first_name,
    last_name,
    birth_date,
    date,
    location,
    height,
    prev_height,
    weight,
    prev_weight,
    biceps,
    prev_biceps,
    triceps,
    prev_triceps,
    subscapular,
    prev_subscapular,
    iliac,
    prev_iliac
FROM 
    ranked_data
WHERE 
    rn = 1
ORDER BY 
    last_name;