const db = require("../config/db");

// ================= LIST ORGANIZATIONS =================
exports.getOrganizations = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT o.*, 
                   COUNT(DISTINCT m.id) as memberCount,
                   COUNT(DISTINCT i.id) as itemCount
            FROM organizations o
            LEFT JOIN organization_members m ON o.id = m.organizationId
            LEFT JOIN items i ON o.id = i.organizationId
            WHERE o.isActive = TRUE
            GROUP BY o.id
            ORDER BY o.name ASC
        `);

        res.json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (error) {
        console.error("Get Organizations Error:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= GET SINGLE ORGANIZATION BY ID OR SLUG =================
exports.getOrganizationByIdOrSlug = async (req, res) => {
    try {
        const { idOrSlug } = req.params;
        const isNumeric = /^\d+$/.test(idOrSlug);

        const sql = isNumeric 
            ? "SELECT * FROM organizations WHERE id = ?"
            : "SELECT * FROM organizations WHERE slug = ?";

        const [rows] = await db.query(sql, [idOrSlug]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Organization not found." });
        }

        const org = rows[0];

        // Member count & Item statistics
        const [stats] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM organization_members WHERE organizationId = ?) as memberCount,
                (SELECT COUNT(*) FROM items WHERE organizationId = ? AND status = 'lost') as lostCount,
                (SELECT COUNT(*) FROM items WHERE organizationId = ? AND status = 'found') as foundCount,
                (SELECT COUNT(*) FROM items WHERE organizationId = ? AND status = 'returned') as returnedCount
        `, [org.id, org.id, org.id, org.id]);

        res.json({
            success: true,
            data: {
                ...org,
                stats: stats[0]
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= CREATE NEW ORGANIZATION (ADMIN ONLY) =================
exports.createOrganization = async (req, res) => {
    try {
        const { name, slug, type, address, city, state, contactEmail, contactPhone, logoUrl, sharingPolicy, retentionDays } = req.body;

        if (!name || !slug) {
            return res.status(400).json({ success: false, message: "Name and slug are required." });
        }

        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

        const [existing] = await db.query("SELECT id FROM organizations WHERE slug = ?", [cleanSlug]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "Organization with this slug already exists." });
        }

        const [result] = await db.query(`
            INSERT INTO organizations 
            (name, slug, type, address, city, state, contactEmail, contactPhone, logoUrl, sharingPolicy, retentionDays)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name,
            cleanSlug,
            type || 'other',
            address || null,
            city || null,
            state || null,
            contactEmail || null,
            contactPhone || null,
            logoUrl || null,
            sharingPolicy || 'network',
            retentionDays || 90
        ]);

        const orgId = result.insertId;

        // Auto-add creator as institution admin
        if (req.user && req.user.id) {
            await db.query(
                "INSERT INTO organization_members (organizationId, userId, role) VALUES (?, ?, 'institution_admin')",
                [orgId, req.user.id]
            );
        }

        res.status(201).json({
            success: true,
            message: "Organization created successfully.",
            data: { id: orgId, slug: cleanSlug, name }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= JOIN AN ORGANIZATION =================
exports.joinOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const [org] = await db.query("SELECT id, name FROM organizations WHERE id = ?", [id]);
        if (org.length === 0) {
            return res.status(404).json({ success: false, message: "Organization not found." });
        }

        await db.query(`
            INSERT INTO organization_members (organizationId, userId, role)
            VALUES (?, ?, 'member')
            ON DUPLICATE KEY UPDATE isActive = TRUE
        `, [id, userId]);

        res.json({
            success: true,
            message: `Successfully joined ${org[0].name}!`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ================= GET ITEMS FOR ORGANIZATION =================
exports.getOrganizationItems = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            "SELECT * FROM items WHERE organizationId = ? ORDER BY id DESC",
            [id]
        );

        // Mask contact information for privacy
        const sanitized = rows.map(r => {
            const item = { ...r };
            delete item.secretAnswer;
            if (item.phone) item.phone = item.phone.slice(0, 3) + "****" + item.phone.slice(-3);
            if (item.email && item.email.includes("@")) {
                const parts = item.email.split("@");
                item.email = parts[0].slice(0, 2) + "***@" + parts[1];
            }
            return item;
        });

        res.json({
            success: true,
            count: sanitized.length,
            data: sanitized
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
