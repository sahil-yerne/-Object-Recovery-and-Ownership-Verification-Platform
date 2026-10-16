document.addEventListener("DOMContentLoaded", async function() {

    // Helper for Auth headers
    function getAuthHeaders() {
        const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
        return token ? { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
    }

    // 1. Fetch Stats & Leaflet Heatmap
    async function loadStats() {
        try {
            const statsRes = await fetch("/api/admin/stats", { headers: getAuthHeaders() });
            const statsData = await statsRes.json();

            if (statsData.success && statsData.stats) {
                const s = statsData.stats;
                document.getElementById("statTotalItems").innerText = s.totalItems || 0;
                document.getElementById("statLostCount").innerText = s.lostCount || 0;
                document.getElementById("statFoundCount").innerText = s.foundCount || 0;
                document.getElementById("statRecoveryRate").innerText = (s.recoveryRate || 85) + "%";

                // Populate category breakdown
                const catListEl = document.getElementById("categoryBreakdownList");
                if (catListEl && s.categories) {
                    catListEl.innerHTML = "";
                    const total = s.totalItems || 1;
                    Object.keys(s.categories).forEach(cat => {
                        const count = s.categories[cat];
                        const pct = Math.round((count / total) * 100);
                        
                        const itemEl = document.createElement("div");
                        itemEl.innerHTML = `
                            <div class="d-flex justify-content-between mb-1 small fw-bold">
                                <span>${cat}</span>
                                <span class="text-info">${count} items (${pct}%)</span>
                            </div>
                            <div class="progress" style="height:8px; background:#101a2e;">
                                <div class="progress-bar bg-info" style="width: ${pct}%"></div>
                            </div>
                        `;
                        catListEl.appendChild(itemEl);
                    });
                }
            }
        } catch (e) {
            console.error("Failed to load admin stats", e);
        }
    }

    // 2. Initialize Leaflet Heatmap Map
    let map = null;
    function initHeatmap() {
        if (!document.getElementById('heatmapCanvas') || typeof L === 'undefined') return;
        if (map) return;

        map = L.map('heatmapCanvas').setView([30.7333, 76.7794], 12); // Default Chandigarh view

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CartoDB & OpenStreetMap',
            maxZoom: 19
        }).addTo(map);

        fetch("/api/admin/heatmap-data", { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(heatData => {
                if (heatData.success && heatData.points && heatData.points.length > 0) {
                    if (typeof L.heatLayer === 'function') {
                        L.heatLayer(heatData.points, {
                            radius: 25,
                            blur: 15,
                            maxZoom: 17,
                            gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' }
                        }).addTo(map);
                    }

                    if (heatData.items) {
                        heatData.items.forEach(i => {
                            const lat = parseFloat(i.latitude);
                            const lng = parseFloat(i.longitude);
                            if (lat && lng) {
                                L.circleMarker([lat, lng], {
                                    radius: 6,
                                    color: i.status === 'lost' ? '#ff0055' : '#39ff14',
                                    fillOpacity: 0.8
                                })
                                .bindPopup(`<b>${i.itemName}</b><br>${i.location}<br><span class="badge ${i.status === 'lost' ? 'bg-danger' : 'bg-success'}">${i.status}</span>`)
                                .addTo(map);
                            }
                        });
                    }
                }
            })
            .catch(err => console.error("Failed to load heatmap data", err));
    }

    // 3. User Management
    async function loadUsers() {
        const tbody = document.getElementById("usersTableBody");
        if (!tbody) return;

        try {
            const res = await fetch("/api/admin/users", { headers: getAuthHeaders() });
            const data = await res.json();

            if (data.success && data.data) {
                const countBadge = document.getElementById("userTabCount");
                if (countBadge) countBadge.innerText = data.data.length;

                if (data.data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No users found.</td></tr>`;
                    return;
                }

                tbody.innerHTML = "";
                data.data.forEach(user => {
                    const tr = document.createElement("tr");
                    const isBanned = !!user.isBanned;
                    tr.innerHTML = `
                        <td>#${user.id}</td>
                        <td class="fw-bold text-light">${user.name}</td>
                        <td class="small text-muted">${user.email}<br>${user.phone || 'N/A'}</td>
                        <td><span class="badge ${user.role === 'admin' ? 'bg-warning text-dark' : 'bg-secondary'}">${user.role}</span></td>
                        <td><span class="badge bg-info text-dark">${user.trustScore || 0} pts</span></td>
                        <td><span class="badge bg-dark border border-info text-info">${user.badge || 'Bronze Finder'} (${user.points || 0} pts)</span></td>
                        <td><span class="badge ${isBanned ? 'bg-danger' : 'bg-success'}">${isBanned ? 'BANNED' : 'ACTIVE'}</span></td>
                        <td>
                            ${user.role !== 'admin' ? `
                                <button class="btn btn-sm ${isBanned ? 'btn-outline-success' : 'btn-outline-danger'} toggle-ban-btn" data-id="${user.id}">
                                    <i class="bi ${isBanned ? 'bi-unlock-fill' : 'bi-slash-circle'}"></i> ${isBanned ? 'Unban' : 'Ban'}
                                </button>
                            ` : `<span class="badge bg-dark text-muted">Protected</span>`}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                // Attach Ban Event Listeners
                tbody.querySelectorAll(".toggle-ban-btn").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const uid = btn.getAttribute("data-id");
                        if (confirm(`Are you sure you want to change ban status for User #${uid}?`)) {
                            try {
                                const bRes = await fetch(`/api/admin/users/${uid}/ban`, {
                                    method: "PUT",
                                    headers: getAuthHeaders()
                                });
                                const bData = await bRes.json();
                                if (bData.success) {
                                    loadUsers();
                                } else {
                                    alert(bData.message || "Failed to toggle ban");
                                }
                            } catch (e) {
                                alert("Error updating user status");
                            }
                        }
                    });
                });
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Error loading users</td></tr>`;
        }
    }

    // 4. Claims & Disputes Moderation
    async function loadClaims() {
        const tbody = document.getElementById("claimsTableBody");
        if (!tbody) return;

        try {
            const res = await fetch("/api/admin/claims", { headers: getAuthHeaders() });
            const data = await res.json();

            if (data.success && data.data) {
                const countBadge = document.getElementById("claimTabCount");
                if (countBadge) countBadge.innerText = data.data.length;

                if (data.data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No claims recorded.</td></tr>`;
                    return;
                }

                tbody.innerHTML = "";
                data.data.forEach(claim => {
                    const tr = document.createElement("tr");
                    let evidenceList = [];
                    if (claim.evidenceImages) {
                        try {
                            evidenceList = typeof claim.evidenceImages === 'string' ? JSON.parse(claim.evidenceImages) : claim.evidenceImages;
                        } catch (e) {}
                    }

                    const statusColors = {
                        pending: "bg-warning text-dark",
                        approved: "bg-success text-white",
                        rejected: "bg-danger text-white",
                        returned: "bg-info text-dark"
                    };

                    tr.innerHTML = `
                        <td><strong>#${claim.id}</strong></td>
                        <td>
                            <div class="fw-bold text-cyan">${claim.itemName || 'Item #' + claim.itemId}</div>
                            <small class="text-muted">Status: ${claim.itemStatus || 'N/A'}</small>
                        </td>
                        <td>
                            <div class="fw-bold">${claim.claimantName || 'User #' + claim.claimantId}</div>
                            <small class="text-muted">${claim.claimantEmail || ''}</small>
                        </td>
                        <td>
                            <p class="mb-1 small text-light" style="max-width:250px;">${claim.proofDescription || 'No description'}</p>
                            ${evidenceList.length > 0 ? `
                                <div class="d-flex gap-1 mt-1">
                                    ${evidenceList.map(img => `<a href="${img}" target="_blank"><img src="${img}" style="width:36px; height:36px; object-fit:cover; border-radius:4px; border:1px solid #00f3ff;"></a>`).join('')}
                                </div>
                            ` : '<small class="text-muted">No files attached</small>'}
                        </td>
                        <td>
                            <span class="badge ${statusColors[claim.status] || 'bg-secondary'} text-uppercase">${claim.status}</span>
                            ${claim.adminNotes ? `<div class="small text-info mt-1 fst-italic">Note: ${claim.adminNotes}</div>` : ''}
                        </td>
                        <td>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-success dispute-action-btn" data-id="${claim.id}" data-action="approve" title="Approve & Grant Ownership">
                                    <i class="bi bi-check-lg"></i> Approve
                                </button>
                                <button class="btn btn-outline-danger dispute-action-btn" data-id="${claim.id}" data-action="reject" title="Reject Dispute Claim">
                                    <i class="bi bi-x-lg"></i> Reject
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });

                // Attach Dispute Action Listeners
                tbody.querySelectorAll(".dispute-action-btn").forEach(btn => {
                    btn.addEventListener("click", async () => {
                        const cid = btn.getAttribute("data-id");
                        const action = btn.getAttribute("data-action");
                        const notes = prompt(`Enter admin notes/reason for ${action.toUpperCase()} of Claim #${cid}:`, `Admin verified dispute: ${action}`);
                        if (notes !== null) {
                            try {
                                const dRes = await fetch(`/api/admin/claims/${cid}/resolve`, {
                                    method: "PUT",
                                    headers: getAuthHeaders(),
                                    body: JSON.stringify({ action, adminNotes: notes })
                                });
                                const dData = await dRes.json();
                                if (dData.success) {
                                    loadClaims();
                                    loadStats();
                                } else {
                                    alert(dData.message || "Failed to resolve claim");
                                }
                            } catch (e) {
                                alert("Error updating claim dispute");
                            }
                        }
                    });
                });
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error loading claims</td></tr>`;
        }
    }

    // 5. Items Moderation
    async function loadItems() {
        const tbody = document.getElementById("itemsTableBody");
        if (!tbody) return;

        try {
            const res = await fetch("/api/items?limit=50", { headers: getAuthHeaders() });
            const data = await res.json();
            const items = data.data || [];

            if (items.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No items in database.</td></tr>`;
                return;
            }

            tbody.innerHTML = "";
            items.forEach(item => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>#${item.id}</td>
                    <td class="fw-bold text-light">${item.itemName}</td>
                    <td><span class="badge bg-secondary">${item.category}</span></td>
                    <td><span class="badge ${item.status === 'lost' ? 'bg-danger' : 'bg-success'} text-uppercase">${item.status}</span></td>
                    <td class="small text-muted">${item.location || 'N/A'}</td>
                    <td class="small text-muted">${item.contactName || 'N/A'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger delete-item-btn" data-id="${item.id}">
                            <i class="bi bi-trash-fill"></i> Delete
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            tbody.querySelectorAll(".delete-item-btn").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const iid = btn.getAttribute("data-id");
                    if (confirm(`Permanently delete Item #${iid}? This action cannot be undone.`)) {
                        try {
                            const delRes = await fetch(`/api/admin/items/${iid}`, {
                                method: "DELETE",
                                headers: getAuthHeaders()
                            });
                            const delData = await delRes.json();
                            if (delData.success) {
                                loadItems();
                                loadStats();
                            } else {
                                alert(delData.message || "Failed to delete item");
                            }
                        } catch (e) {
                            alert("Error deleting item");
                        }
                    }
                });
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error loading items</td></tr>`;
        }
    }

    // 5. Audit Trail
    async function loadAuditLogs() {
        const tbody = document.getElementById("auditTableBody");
        if (!tbody) return;
        try {
            const res = await fetch("/api/admin/audit-logs", { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success && data.data) {
                if (data.data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No audit logs recorded yet.</td></tr>`;
                    return;
                }
                tbody.innerHTML = "";
                data.data.forEach(log => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td>#${log.id}</td>
                        <td>${log.actorId ? `User #${log.actorId}` : 'System'}</td>
                        <td><span class="badge bg-secondary">${log.role || 'user'}</span></td>
                        <td><span class="badge bg-info text-dark">${log.action}</span></td>
                        <td>${log.targetType || '-'}: ${log.targetId || '-'}</td>
                        <td class="small text-muted" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${JSON.stringify(log.details || {})}</td>
                        <td class="small text-muted">${new Date(log.createdAt).toLocaleString()}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error loading audit logs</td></tr>`;
        }
    }

    // 6. Fraud Intelligence
    async function loadFraudAlerts() {
        const tbody = document.getElementById("fraudTableBody");
        if (!tbody) return;
        try {
            const res = await fetch("/api/admin/fraud-alerts", { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success && data.data) {
                if (data.data.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No high-risk fraud alerts detected.</td></tr>`;
                    return;
                }
                tbody.innerHTML = "";
                data.data.forEach(a => {
                    const tr = document.createElement("tr");
                    const badgeClass = a.riskLevel === 'SUSPICIOUS' ? 'bg-danger' : 'bg-warning text-dark';
                    tr.innerHTML = `
                        <td>#${a.id}</td>
                        <td><b>${a.itemName || `Item #${a.itemId}`}</b></td>
                        <td>${a.userName || `User #${a.userId}`} (${a.userEmail || ''})</td>
                        <td><span class="badge ${badgeClass}">${a.riskLevel}</span></td>
                        <td class="fw-bold">${a.score || 0}/100</td>
                        <td class="small text-muted">${a.flags ? (typeof a.flags === 'string' ? a.flags : JSON.stringify(a.flags)) : (a.details || '-')}</td>
                        <td class="small text-muted">${new Date(a.createdAt).toLocaleString()}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error loading fraud alerts</td></tr>`;
        }
    }

    // ================= 7. AI MATCHING WEIGHTS & CONFIGURATION =================
    const configKeys = [
        "weight_visual", "weight_text", "weight_category", 
        "weight_attribute", "weight_location", "weight_temporal", 
        "match_threshold", "points_report_lost", "points_report_found", "points_handover"
    ];

    function bindSliderInput(key, isPercent = false) {
        const slider = document.getElementById(key);
        const label = document.getElementById(`label_${key}`);
        if (slider && label) {
            slider.addEventListener("input", () => {
                label.textContent = isPercent ? `${slider.value}%` : parseFloat(slider.value).toFixed(2);
            });
        }
    }

    bindSliderInput("weight_visual");
    bindSliderInput("weight_text");
    bindSliderInput("weight_category");
    bindSliderInput("weight_attribute");
    bindSliderInput("weight_location");
    bindSliderInput("weight_temporal");
    bindSliderInput("match_threshold", true);

    async function loadMatchingConfig() {
        try {
            const res = await fetch("/api/admin/matching-config", { headers: getAuthHeaders() });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to load matching config.");

            const configs = data.data || [];
            configs.forEach(cfg => {
                const slider = document.getElementById(cfg.configKey);
                const label = document.getElementById(`label_${cfg.configKey}`);
                if (slider) {
                    slider.value = cfg.configValue;
                    if (label) {
                        label.textContent = cfg.configKey === 'match_threshold' ? `${cfg.configValue}%` : parseFloat(cfg.configValue).toFixed(2);
                    }
                }
            });
        } catch (e) {
            console.error("Failed to load matching config:", e);
        }
    }

    async function saveMatchingWeights(e) {
        if (e) e.preventDefault();
        const saveBtn = document.getElementById("saveWeightsBtn");
        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Deploying...`;
            }

            const configs = [
                { configKey: "weight_visual", configValue: parseFloat(document.getElementById("weight_visual").value) },
                { configKey: "weight_text", configValue: parseFloat(document.getElementById("weight_text").value) },
                { configKey: "weight_category", configValue: parseFloat(document.getElementById("weight_category").value) },
                { configKey: "weight_attribute", configValue: parseFloat(document.getElementById("weight_attribute").value) },
                { configKey: "weight_location", configValue: parseFloat(document.getElementById("weight_location").value) },
                { configKey: "weight_temporal", configValue: parseFloat(document.getElementById("weight_temporal").value) },
                { configKey: "match_threshold", configValue: parseFloat(document.getElementById("match_threshold").value) }
            ];

            const res = await fetch("/api/admin/matching-config", {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({ configs })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to save weights.");

            alert("✅ AI Matching weights successfully deployed and active for continuous matching!");
        } catch (err) {
            alert("❌ Error: " + err.message);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> Save & Deploy AI Configuration`;
            }
        }
    }

    async function savePointsPolicy() {
        const saveBtn = document.getElementById("savePointsBtn");
        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Saving...`;
            }

            const configs = [
                { configKey: "points_report_lost", configValue: parseFloat(document.getElementById("points_report_lost").value) },
                { configKey: "points_report_found", configValue: parseFloat(document.getElementById("points_report_found").value) },
                { configKey: "points_handover", configValue: parseFloat(document.getElementById("points_handover").value) }
            ];

            const res = await fetch("/api/admin/matching-config", {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({ configs })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to save points policy.");

            alert("✅ Karma points policy successfully updated!");
        } catch (err) {
            alert("❌ Error: " + err.message);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `<i class="bi bi-save me-1"></i> Update Points Policy`;
            }
        }
    }

    function restoreDefaultWeights() {
        if (!confirm("Reset all weights to recommended baseline defaults?")) return;
        const defaults = {
            weight_visual: 0.30,
            weight_text: 0.20,
            weight_category: 0.20,
            weight_attribute: 0.15,
            weight_location: 0.10,
            weight_temporal: 0.05,
            match_threshold: 25
        };
        for (const [key, val] of Object.entries(defaults)) {
            const input = document.getElementById(key);
            const label = document.getElementById(`label_${key}`);
            if (input) {
                input.value = val;
                if (label) label.textContent = key === 'match_threshold' ? `${val}%` : parseFloat(val).toFixed(2);
            }
        }
    }

    document.getElementById("matchingConfigForm")?.addEventListener("submit", saveMatchingWeights);
    document.getElementById("savePointsBtn")?.addEventListener("click", savePointsPolicy);
    document.getElementById("restoreDefaultsBtn")?.addEventListener("click", restoreDefaultWeights);
    document.getElementById("loadConfigBtn")?.addEventListener("click", loadMatchingConfig);

    // Tab event listeners to refresh data on switch
    document.getElementById("tab-users-btn")?.addEventListener("click", loadUsers);
    document.getElementById("tab-claims-btn")?.addEventListener("click", loadClaims);
    document.getElementById("tab-items-btn")?.addEventListener("click", loadItems);
    document.getElementById("tab-audit-btn")?.addEventListener("click", loadAuditLogs);
    document.getElementById("tab-fraud-btn")?.addEventListener("click", loadFraudAlerts);
    document.getElementById("tab-config-btn")?.addEventListener("click", loadMatchingConfig);

    document.getElementById("refreshUsersBtn")?.addEventListener("click", loadUsers);
    document.getElementById("refreshClaimsBtn")?.addEventListener("click", loadClaims);
    document.getElementById("refreshItemsBtn")?.addEventListener("click", loadItems);
    document.getElementById("refreshAuditBtn")?.addEventListener("click", loadAuditLogs);
    document.getElementById("refreshFraudBtn")?.addEventListener("click", loadFraudAlerts);

    // Initial loads
    loadStats();
    initHeatmap();
    loadUsers();
    loadClaims();
    loadItems();
    loadAuditLogs();
    loadFraudAlerts();
    loadMatchingConfig();
});
