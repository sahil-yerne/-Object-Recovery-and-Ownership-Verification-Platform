// ================= REWARDS STORE & KARMA WALLET LOGIC =================

document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem("auth_token");
    const user = JSON.parse(localStorage.getItem("auth_user") || "{}");

    // Helper for auth headers
    function getAuthHeaders() {
        return token ? { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
    }

    let userPoints = 0;

    // 1. Fetch Store Catalog
    async function loadCatalog() {
        const grid = document.getElementById("rewardsCatalogGrid");
        if (!grid) return;

        try {
            const res = await fetch("/api/rewards/catalog");
            const data = await res.json();
            const catalog = data.catalog || [];

            if (catalog.length === 0) {
                grid.innerHTML = `<div class="col-12 text-center text-muted py-4">No rewards currently in catalog.</div>`;
                return;
            }

            const badgeCount = document.getElementById("catalogCountBadge");
            if (badgeCount) badgeCount.textContent = `${catalog.length} Items Available`;

            grid.innerHTML = catalog.map(item => {
                const canAfford = userPoints >= item.cost;
                return `
                    <div class="col-lg-3 col-md-6">
                        <div class="reward-card p-4 h-100 d-flex flex-column text-center position-relative">
                            <span class="badge bg-${item.badgeColor} position-absolute top-0 end-0 m-3 px-2 py-1 text-uppercase small">${item.category}</span>
                            
                            <div class="fs-1 text-${item.badgeColor} my-3">
                                <i class="bi ${item.icon}"></i>
                            </div>

                            <h5 class="fw-bold text-light mb-2">${item.title}</h5>
                            <p class="text-muted small mb-4 flex-grow-1">${item.description}</p>

                            <div class="mt-auto border-top border-secondary pt-3">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <span class="small text-muted">Cost:</span>
                                    <span class="fw-bold text-warning fs-5"><i class="bi bi-coin me-1"></i> ${item.cost} pts</span>
                                </div>
                                <button class="btn btn-sm ${canAfford ? 'btn-primary' : 'btn-outline-secondary'} w-100 fw-bold redeem-btn" 
                                        data-id="${item.id}" data-cost="${item.cost}" data-title="${item.title}">
                                    ${canAfford ? '<i class="bi bi-gift-fill me-1"></i> Redeem Perk' : '<i class="bi bi-lock-fill me-1"></i> Need More Points'}
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");

            // Attach Redemption Click Listeners
            grid.querySelectorAll(".redeem-btn").forEach(btn => {
                btn.addEventListener("click", async () => {
                    if (!token) {
                        alert("Please log in to redeem perks!");
                        window.location.href = "login.html";
                        return;
                    }

                    const rewardId = btn.getAttribute("data-id");
                    const rewardTitle = btn.getAttribute("data-title");
                    const cost = parseInt(btn.getAttribute("data-cost"));

                    if (userPoints < cost) {
                        alert(`You need ${cost} points to redeem this perk. You currently have ${userPoints} points.`);
                        return;
                    }

                    if (!confirm(`Are you sure you want to redeem '${rewardTitle}' for ${cost} points?`)) {
                        return;
                    }

                    try {
                        btn.disabled = true;
                        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Redeeming...`;

                        const redRes = await fetch("/api/rewards/redeem", {
                            method: "POST",
                            headers: getAuthHeaders(),
                            body: JSON.stringify({ rewardId })
                        });
                        const redData = await redRes.json();

                        if (!redRes.ok) {
                            throw new Error(redData.message || "Redemption failed.");
                        }

                        // Show Redemption Modal
                        document.getElementById("redeemedPerkTitle").textContent = redData.reward.title;
                        document.getElementById("redeemedVoucherCode").textContent = redData.reward.voucherCode;

                        const modalEl = document.getElementById("redeemModal");
                        if (modalEl && typeof bootstrap !== "undefined") {
                            const modal = new bootstrap.Modal(modalEl);
                            modal.show();
                        }

                        // Refresh wallet & catalog
                        await loadWallet();
                        await loadCatalog();

                    } catch (e) {
                        alert("Error: " + e.message);
                    } finally {
                        btn.disabled = false;
                    }
                });
            });

        } catch (e) {
            console.error("Failed to load rewards catalog:", e);
            grid.innerHTML = `<div class="col-12 text-center text-danger py-4">Failed to load rewards catalog.</div>`;
        }
    }

    // 2. Fetch User Wallet & Point History
    async function loadWallet() {
        if (!token) {
            const userEmailLabel = document.getElementById("userEmailLabel");
            if (userEmailLabel) userEmailLabel.innerHTML = `<a href="login.html" class="text-cyan text-decoration-none"><i class="bi bi-box-arrow-in-right"></i> Log in to view your points</a>`;
            return;
        }

        try {
            const res = await fetch("/api/rewards/wallet", { headers: getAuthHeaders() });
            const data = await res.json();

            if (data.success && data.wallet) {
                const w = data.wallet;
                userPoints = w.points || 0;

                // Update Wallet Banner UI
                document.getElementById("userBadgeName").textContent = w.badge || "Bronze Scout";
                document.getElementById("userEmailLabel").textContent = user.email || user.name || "Community Member";
                document.getElementById("userPointsVal").textContent = userPoints;
                document.getElementById("userTrustVal").textContent = `+${w.trustScore || 0} Trust Score`;

                document.getElementById("currentRankLabel").textContent = `Rank: ${w.badge}`;
                document.getElementById("nextRankLabel").textContent = `${w.points} / ${w.nextRankPoints} pts (${w.nextRank})`;
                document.getElementById("rankProgressBar").style.width = `${w.rankProgressPct || 0}%`;

                // Render Point Ledger Table
                const tbody = document.getElementById("transactionsTableBody");
                if (tbody) {
                    if (!w.transactions || w.transactions.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No points activity yet. Report an item to earn your first +50 points!</td></tr>`;
                        return;
                    }

                    tbody.innerHTML = w.transactions.map((tx, idx) => {
                        const isPositive = tx.points >= 0;
                        return `
                            <tr>
                                <td>#${tx.id || (idx + 1)}</td>
                                <td>
                                    <span class="badge ${isPositive ? 'bg-success' : 'bg-danger'} fs-6">
                                        ${isPositive ? '+' : ''}${tx.points} pts
                                    </span>
                                </td>
                                <td class="text-light fw-semibold">${tx.reason}</td>
                                <td class="text-muted small">${new Date(tx.createdAt || Date.now()).toLocaleDateString()} ${new Date(tx.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            </tr>
                        `;
                    }).join("");
                }
            }
        } catch (e) {
            console.error("Failed to load wallet data:", e);
        }
    }

    // 3. Load Milestones & Badges
    async function loadAchievements() {
        const grid = document.getElementById("achievementsGrid");
        const countBadge = document.getElementById("achievementCountBadge");
        if (!grid) return;

        if (!token) {
            if (countBadge) countBadge.textContent = "Log In to View";
            grid.innerHTML = `<div class="col-12 text-center text-muted py-3">Please <a href="login.html" class="text-info fw-bold">log in</a> to view your earned badges and milestone progress.</div>`;
            return;
        }

        try {
            const res = await fetch("/api/rewards/achievements", { headers: getAuthHeaders() });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to load achievements.");

            const list = data.achievements || [];
            if (countBadge) {
                countBadge.textContent = `${data.totalUnlocked || 0} / ${data.totalAvailable || list.length} Unlocked`;
                countBadge.className = data.totalUnlocked > 0 ? "badge bg-success fs-6" : "badge bg-info fs-6";
            }

            const iconMap = {
                first_report: "bi-flag-fill",
                first_recovery: "bi-check2-circle",
                trusted_finder: "bi-shield-shaded",
                five_recoveries: "bi-patch-check-fill",
                ten_recoveries: "bi-stars",
                community_hero: "bi-award-fill",
                legend: "bi-gem"
            };

            grid.innerHTML = list.map(ach => {
                const icon = iconMap[ach.key] || "bi-trophy-fill";
                const isUnlocked = ach.unlocked;
                return `
                    <div class="col-lg-4 col-md-6">
                        <div class="p-3 rounded border ${isUnlocked ? 'border-warning bg-dark' : 'border-secondary bg-dark text-muted'} h-100 d-flex align-items-center" style="${isUnlocked ? 'box-shadow: 0 0 10px rgba(255,193,7,0.2);' : 'opacity: 0.6;'}">
                            <div class="fs-2 me-3 ${isUnlocked ? 'text-warning' : 'text-secondary'}">
                                <i class="bi ${icon}"></i>
                            </div>
                            <div class="flex-grow-1">
                                <div class="d-flex justify-content-between align-items-center mb-1">
                                    <h6 class="mb-0 fw-bold ${isUnlocked ? 'text-light' : 'text-muted'}">${ach.name}</h6>
                                    ${isUnlocked ? '<span class="badge bg-success" style="font-size: 0.65rem;">UNLOCKED</span>' : '<span class="badge bg-secondary" style="font-size: 0.65rem;">LOCKED</span>'}
                                </div>
                                <p class="small mb-1 text-muted" style="font-size: 0.8rem;">${ach.description}</p>
                                ${isUnlocked && ach.earnedAt ? `<small class="text-info" style="font-size: 0.75rem;"><i class="bi bi-clock me-1"></i>Earned ${new Date(ach.earnedAt).toLocaleDateString()}</small>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        } catch (err) {
            console.error("Failed to load achievements:", err);
            grid.innerHTML = `<div class="col-12 text-center text-muted py-2">Unable to load milestones at this time.</div>`;
        }
    }

    // Copy Voucher Code button
    document.getElementById("copyVoucherBtn")?.addEventListener("click", () => {
        const code = document.getElementById("redeemedVoucherCode").textContent;
        navigator.clipboard.writeText(code);
        alert("📋 Voucher code copied to clipboard!");
    });

    document.getElementById("refreshWalletBtn")?.addEventListener("click", async () => {
        await loadWallet();
        await loadCatalog();
        await loadAchievements();
    });

    // Initial Execution
    await loadWallet();
    await loadCatalog();
    await loadAchievements();
});
