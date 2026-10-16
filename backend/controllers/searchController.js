const db = require("../config/db");

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a, b) {
    if (!a || !b) return 999;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

// Calculate Haversine distance in KM
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
    const p1 = parseFloat(lat1);
    const p2 = parseFloat(lon1);
    const p3 = parseFloat(lat2);
    const p4 = parseFloat(lon2);
    if (isNaN(p1) || isNaN(p2) || isNaN(p3) || isNaN(p4)) return null;

    const R = 6371; // Earth radius in km
    const dLat = (p3 - p1) * Math.PI / 180;
    const dLon = (p4 - p2) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1 * Math.PI / 180) * Math.cos(p3 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
}

// Calculate score for fuzzy search
function calculateFuzzyScore(item, queryTokens) {
    if (!queryTokens || queryTokens.length === 0) return 0;
    const textToSearch = [
        item.itemName,
        item.category,
        item.brand,
        item.color,
        item.location,
        item.description
    ].filter(Boolean).join(" ").toLowerCase();

    let score = 0;
    const words = textToSearch.split(/[\s,.-]+/);

    queryTokens.forEach(token => {
        const cleanToken = token.toLowerCase();
        if (textToSearch.includes(cleanToken)) {
            score += 15; // Direct substring match
        } else {
            words.forEach(word => {
                if (word.length >= 3 && cleanToken.length >= 3) {
                    const dist = levenshteinDistance(cleanToken, word);
                    const maxLen = Math.max(cleanToken.length, word.length);
                    if (dist <= 2 && dist < maxLen) {
                        score += (3 - dist) * 4; // Typo tolerance match score
                    }
                }
            });
        }
    });

    return score;
}

// ================= SEARCH ITEMS =================

exports.searchItems = async(req, res) => {
    try {
        const {
            q,
            itemName,
            category,
            brand,
            color,
            location,
            date,
            dateFrom,
            dateTo,
            status,
            sort,
            fuzzy,
            lat,
            lng,
            radius
        } = req.query;

        let sql = "SELECT * FROM items WHERE 1=1";
        let values = [];

        // Exact / LIKE SQL filters
        if (category) {
            sql += " AND category = ?";
            values.push(category);
        }

        if (status) {
            sql += " AND status = ?";
            values.push(status);
        }

        if (color) {
            sql += " AND color LIKE ?";
            values.push(`%${color}%`);
        }

        if (brand) {
            sql += " AND brand LIKE ?";
            values.push(`%${brand}%`);
        }

        if (itemName) {
            sql += " AND itemName LIKE ?";
            values.push(`%${itemName}%`);
        }

        if (location) {
            sql += " AND location LIKE ?";
            values.push(`%${location}%`);
        }

        if (date) {
            sql += " AND DATE(date) = ?";
            values.push(date);
        }

        if (dateFrom) {
            sql += " AND DATE(date) >= ?";
            values.push(dateFrom);
        }

        if (dateTo) {
            sql += " AND DATE(date) <= ?";
            values.push(dateTo);
        }

        // Query database with fallback if MySQL is offline
        let rows = [];
        try {
            // Use a race with timeout to prevent hanging when MySQL is unreachable
            const queryPromise = db.query(sql, values);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("DB query timeout")), 3000)
            );
            const [dbRows] = await Promise.race([queryPromise, timeoutPromise]);
            rows = dbRows;
        } catch (dbErr) {
            console.warn("⚠️ MySQL DB query unavailable:", dbErr.message);
            // Return empty list if DB is unreachable
            rows = global.inMemoryItems || [];
        }

        // Process distance calculations if coordinates provided
        const userLat = lat ? parseFloat(lat) : null;
        const userLng = lng ? parseFloat(lng) : null;
        const maxRadius = radius ? parseFloat(radius) : null;

        rows = rows.map(item => {
            const distance = calculateDistance(userLat, userLng, item.latitude, item.longitude);
            return { ...item, distance };
        });

        // Filter by radius if requested
        if (userLat !== null && userLng !== null && maxRadius !== null) {
            rows = rows.filter(item => item.distance !== null && item.distance <= maxRadius);
        }

        // Apply Fuzzy Search / Smart Keyword Search if 'q' is present
        const enableFuzzy = fuzzy !== "false";
        if (q && q.trim().length > 0) {
            const queryTokens = q.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);
            
            rows = rows.map(item => {
                const score = calculateFuzzyScore(item, queryTokens);
                return { ...item, fuzzyScore: score };
            });

            if (enableFuzzy) {
                // Keep items with positive fuzzy score OR matching substring
                rows = rows.filter(item => item.fuzzyScore > 0);
            } else {
                // Strict substring check
                const lowerQ = q.trim().toLowerCase();
                rows = rows.filter(item => {
                    const fullText = [item.itemName, item.category, item.brand, item.color, item.location, item.description]
                        .filter(Boolean).join(" ").toLowerCase();
                    return fullText.includes(lowerQ);
                });
            }
        }

        // ================= SORTING =================
        if (sort === "relevance" && q) {
            rows.sort((a, b) => (b.fuzzyScore || 0) - (a.fuzzyScore || 0));
        } else if (sort === "distance" && userLat !== null) {
            rows.sort((a, b) => (a.distance ?? 99999) - (b.distance ?? 99999));
        } else if (sort === "oldest") {
            rows.sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));
        } else if (sort === "name") {
            rows.sort((a, b) => a.itemName.localeCompare(b.itemName));
        } else {
            // Default sort: latest
            rows.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
        }

        // ================= PAGINATION =================
        const pageNum = Math.max(1, parseInt(req.query.page) || 1);
        const limitNum = Math.max(1, parseInt(req.query.limit) || 10);
        const totalCount = rows.length;
        const totalPages = Math.ceil(totalCount / limitNum) || 1;
        const startIndex = (pageNum - 1) * limitNum;
        const paginatedRows = rows.slice(startIndex, startIndex + limitNum);

        res.json({
            success: true,
            count: paginatedRows.length,
            pagination: {
                total: totalCount,
                page: pageNum,
                limit: limitNum,
                totalPages: totalPages
            },
            data: paginatedRows
        });

    } catch (error) {
        console.error("Search Error:", error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ================= DEDICATED PROXIMITY RADIUS SEARCH =================

exports.proximitySearch = async (req, res) => {
    try {
        const { lat, lng, radius = 10, category, status } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                message: "Latitude (lat) and Longitude (lng) are required for proximity search."
            });
        }

        const userLat = parseFloat(lat);
        const userLng = parseFloat(lng);
        const maxRadiusKm = parseFloat(radius) || 10;

        // SQL using Haversine formula
        let sql = `
            SELECT *, 
            (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distance_km
            FROM items
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        `;
        const params = [userLat, userLng, userLat];

        if (status) {
            sql += " AND status = ?";
            params.push(status);
        }
        if (category) {
            sql += " AND category = ?";
            params.push(category);
        }

        sql += " HAVING distance_km <= ? ORDER BY distance_km ASC LIMIT 50";
        params.push(maxRadiusKm);

        const [rows] = await db.query(sql, params);

        // Sanitize and format distance
        const itemsWithDistance = rows.map(item => ({
            ...item,
            distance_km: Math.round(item.distance_km * 10) / 10,
            secretAnswer: undefined
        }));

        res.json({
            success: true,
            center: { lat: userLat, lng: userLng, radiusKm: maxRadiusKm },
            count: itemsWithDistance.length,
            data: itemsWithDistance
        });

    } catch (error) {
        console.error("Proximity Search Error:", error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};