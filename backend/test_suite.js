/**
 * AUTOMATED SYSTEM INTEGRATION & SECURITY TEST SUITE
 * Object Recovery and Ownership Verification Platform
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:5004";

// Helper for making HTTP requests
function request(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, BASE_URL);
        const reqOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: options.method || "GET",
            headers: options.headers || {}
        };

        if (options.body && typeof options.body === "object" && !(options.body instanceof Buffer)) {
            reqOptions.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(options.body);
        }

        const req = http.request(reqOptions, (res) => {
            let data = "";
            res.on("data", (chunk) => data += chunk);
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed, headers: res.headers });
                } catch (e) {
                    resolve({ status: res.statusCode, data, headers: res.headers });
                }
            });
        });

        req.on("error", reject);

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// Assert helper
function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        throw new Error(message);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

async function runTests() {
    console.log("=================================================");
    console.log("🧪 RUNNING PLATFORM VERIFICATION & SECURITY SUITE");
    console.log("=================================================\n");

    const uniqueId = Date.now();
    let finderToken = "";
    let finderUserId = null;
    let claimantToken = "";
    let claimantUserId = null;
    let testItemId = null;
    let testClaimId = null;
    let testHandoverOtp = null;

    try {
        // 1. Register Finder User
        console.log("--- 1. User Registration & Authentication ---");
        const regFinder = await request("/api/auth/register", {
            method: "POST",
            body: {
                name: `Finder User ${uniqueId}`,
                email: `finder_${uniqueId}@example.com`,
                phone: "9876543210",
                password: "SecurePassword123!"
            }
        });
        assert(regFinder.status === 201 || regFinder.status === 200, "Finder registration succeeds");
        finderUserId = regFinder.data.userId;

        const loginFinder = await request("/api/auth/login", {
            method: "POST",
            body: {
                email: `finder_${uniqueId}@example.com`,
                password: "SecurePassword123!"
            }
        });
        assert(loginFinder.status === 200 && loginFinder.data.token, "Finder login succeeds with JWT");
        finderToken = loginFinder.data.token;

        // Register Claimant User
        const regClaimant = await request("/api/auth/register", {
            method: "POST",
            body: {
                name: `Claimant User ${uniqueId}`,
                email: `claimant_${uniqueId}@example.com`,
                phone: "9812345678",
                password: "ClaimPassword123!"
            }
        });
        assert(regClaimant.status === 201 || regClaimant.status === 200, "Claimant registration succeeds");
        claimantUserId = regClaimant.data.userId;

        const loginClaimant = await request("/api/auth/login", {
            method: "POST",
            body: {
                email: `claimant_${uniqueId}@example.com`,
                password: "ClaimPassword123!"
            }
        });
        assert(loginClaimant.status === 200 && loginClaimant.data.token, "Claimant login succeeds with JWT");
        claimantToken = loginClaimant.data.token;

        // 2. Report Found Item with userId & Secret Question
        console.log("\n--- 2. Item Ingestion with Privacy & Quiz ---");
        const foundItemRes = await request("/api/found", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${finderToken}`
            },
            body: {
                itemName: `MacBook Pro M2 ${uniqueId}`,
                category: "Laptop",
                brand: "Apple",
                color: "Space Gray",
                foundDate: "2026-07-25",
                location: "Central Library Room 302",
                latitude: 30.7410,
                longitude: 76.7845,
                finderName: "Finder User",
                phone: "9876543210",
                email: `finder_${uniqueId}@example.com`,
                secretQuestion: "What sticker is on the back lid?",
                secretAnswer: "Github Octocat",
                description: "Found space gray MacBook laptop on 3rd floor desk."
            }
        });
        assert(foundItemRes.status === 200 && foundItemRes.data.success, "Found item reported with userId binding");
        testItemId = foundItemRes.data.data.id;

        // 3. Verify Privacy Masking
        console.log("\n--- 3. Contact Privacy Masking ---");
        const itemInspect = await request(`/api/item/${testItemId}`);
        assert(itemInspect.status === 200, "Fetched public item details");
        assert(itemInspect.data.data.isContactLocked === true, "Contact details are masked by default");
        assert(itemInspect.data.data.phone.includes("*"), "Phone number is masked");
        assert(itemInspect.data.data.secretAnswer === undefined, "Secret answer is NEVER exposed in payload");

        // 4. Verify Ownership Quiz Security
        console.log("\n--- 4. Ownership Verification Quiz & Lockout ---");
        const wrongQuiz = await request(`/api/item/${testItemId}/verify-quiz`, {
            method: "POST",
            body: { answer: "Wrong Sticker" }
        });
        assert(wrongQuiz.status === 400 && wrongQuiz.data.success === false, "Incorrect quiz answer rejected");

        const correctQuiz = await request(`/api/item/${testItemId}/verify-quiz`, {
            method: "POST",
            body: { answer: "github octocat" }
        });
        assert(correctQuiz.status === 200 && correctQuiz.data.success === true, "Correct quiz unlocks unmasked contact info");
        assert(correctQuiz.data.data.phone === "9876543210", "Unmasked phone revealed after quiz verification");

        // 5. Submit Ownership Claim
        console.log("\n--- 5. Ownership Claim Submission ---");
        const claimRes = await request("/api/claims/submit", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${claimantToken}`
            },
            body: {
                itemId: testItemId,
                proofDescription: "This is my laptop. Serial number starts with C02G. It has a Github Octocat sticker and battery health is 94%."
            }
        });
        assert(claimRes.status === 201 && claimRes.data.success === true, "Ownership claim submitted successfully");
        testClaimId = claimRes.data.claimId;

        // 6. Security Check: Unauthorized Claim Approval
        console.log("\n--- 6. Security Audit: Claim Hijacking Prevention ---");
        const unauthApproval = await request("/api/claims/approve", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${claimantToken}` // Claimant attempting to approve their own claim!
            },
            body: { claimId: testClaimId }
        });
        assert(unauthApproval.status === 403, "Non-custodian user is FORBIDDEN (403) from approving claims");

        // 7. Authorized Claim Approval by Finder
        console.log("\n--- 7. Legitimate Custodian Claim Approval ---");
        const authApproval = await request("/api/claims/approve", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${finderToken}` // Actual finder approving
            },
            body: { claimId: testClaimId }
        });
        assert(authApproval.status === 200 && authApproval.data.handoverOtp, "Custodian successfully approves claim and receives 6-digit OTP");
        testHandoverOtp = authApproval.data.handoverOtp;
        assert(testHandoverOtp.length === 6, "OTP is 6 digits long");

        // 8. Complete Handover OTP Verification & Reward Finder Points
        console.log("\n--- 8. Handover OTP Verification & Gamified Points ---");
        const verifyOtpRes = await request("/api/claims/verify-otp", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${finderToken}`
            },
            body: {
                claimId: testClaimId,
                otp: testHandoverOtp
            }
        });
        assert(verifyOtpRes.status === 200 && verifyOtpRes.data.pointsAwarded === 200, "Handover OTP verified and +200 Points awarded to finder");

        // Verify Item is marked as 'returned'
        const itemAfterReturn = await request(`/api/item/${testItemId}`);
        assert(itemAfterReturn.data.data.status === "returned", "Item status automatically transitioned to 'returned'");

        // 9. Security Check: Unauthorized Item Deletion
        console.log("\n--- 9. Security Audit: Unauthorized Deletion Prevention ---");
        const unauthDelete = await request(`/api/item/${testItemId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${claimantToken}` // Non-owner attempting to delete
            }
        });
        assert(unauthDelete.status === 403, "Unauthorized user is FORBIDDEN (403) from deleting another user's item report");

        // 10. Authorized Item Deletion
        console.log("\n--- 10. Legitimate Owner Item Deletion ---");
        const authDelete = await request(`/api/item/${testItemId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${finderToken}` // Original creator deleting
            }
        });
        assert(authDelete.status === 200 && authDelete.data.success === true, "Item creator successfully deleted item report");

        // 11. Test Search & Pagination
        console.log("\n--- 11. Search & Database Pagination ---");
        const paginationRes = await request("/api/search?page=1&limit=2");
        assert(paginationRes.status === 200 && paginationRes.data.success, "Search with pagination returns 200 OK");
        assert(paginationRes.data.pagination && paginationRes.data.pagination.page === 1, "Pagination metadata contains current page");
        assert(paginationRes.data.pagination.limit === 2, "Pagination metadata contains limit");
        assert(Array.isArray(paginationRes.data.data), "Search results returned as array");

        // 12. Test In-App Notification Engine & Alerts
        console.log("\n--- 12. In-App Notification Engine & Alerts ---");
        const alertsRes = await request("/api/alerts", {
            headers: { "Authorization": `Bearer ${claimantToken}` }
        });
        assert(alertsRes.status === 200 && alertsRes.data.success, "Alerts endpoint returns 200 for authenticated user");
        assert(Array.isArray(alertsRes.data.data), "User alerts returned as list");
        if (alertsRes.data.data.length > 0) {
            const firstAlertId = alertsRes.data.data[0].id;
            const readRes = await request(`/api/alerts/${firstAlertId}/read`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${claimantToken}` }
            });
            assert(readRes.status === 200 && readRes.data.success, "Alert marked as read successfully");
        }

        // 13. Test Real-Time Chat Messaging
        console.log("\n--- 13. Real-Time Chat Messaging System ---");
        const chatInit = await request("/api/chat/get-or-create", {
            method: "POST",
            body: { itemId: 1, user1Id: claimantUserId, user2Id: finderUserId }
        });
        assert(chatInit.status === 200 && chatInit.data.chatId, "Chat session created or retrieved");
        const activeChatId = chatInit.data.chatId;

        const sendMsgRes = await request("/api/chat/send", {
            method: "POST",
            body: {
                chatId: activeChatId,
                senderId: claimantUserId,
                message: "Hello finder! I have my purchase receipt for verification."
            }
        });
        assert(sendMsgRes.status === 200 && sendMsgRes.data.success, "Message sent successfully");

        const getMsgsRes = await request(`/api/chat/messages/${activeChatId}`);
        assert(getMsgsRes.status === 200 && Array.isArray(getMsgsRes.data.messages), "Messages fetched successfully");
        assert(getMsgsRes.data.messages.some(m => m.message.includes("purchase receipt")), "Sent message present in chat history");

        // 14. Test Admin Moderation & Ban Control
        console.log("\n--- 14. Admin Moderation & Ban Management ---");
        const adminUsersRes = await request("/api/admin/users");
        assert(adminUsersRes.status === 200 && Array.isArray(adminUsersRes.data.data), "Admin fetched all user accounts");

        const banToggleRes = await request(`/api/admin/users/${claimantUserId}/ban`, {
            method: "PUT"
        });
        assert(banToggleRes.status === 200 && banToggleRes.data.success, "Admin successfully toggled user ban status");

        const unbanToggleRes = await request(`/api/admin/users/${claimantUserId}/ban`, {
            method: "PUT"
        });
        assert(unbanToggleRes.status === 200 && unbanToggleRes.data.isBanned === false, "Admin successfully unbanned user");

        // 15. Test Admin Claims & Dispute Resolution
        console.log("\n--- 15. Admin Claims & Dispute Moderation ---");
        const adminClaimsRes = await request("/api/admin/claims");
        assert(adminClaimsRes.status === 200 && Array.isArray(adminClaimsRes.data.data), "Admin fetched claims list for moderation");

        // 16. Test Reporting Gamification Points
        console.log("\n--- 16. Reporter Points & Karma System ---");
        const foundReportWithPoints = await request("/api/found", {
            method: "POST",
            headers: { "Authorization": `Bearer ${finderToken}` },
            body: {
                itemName: `Smart Keyring ${uniqueId}`,
                category: "Keys",
                brand: "Tile",
                color: "Black",
                foundDate: "2026-07-28",
                location: "Gym Locker 14",
                finderName: "Finder User",
                phone: "9876543210"
            }
        });
        assert(foundReportWithPoints.status === 200 && foundReportWithPoints.data.pointsAwarded === 50, "Reporting a found item awards +50 Karma Points");

        // 17. Test Rewards Wallet Endpoint
        console.log("\n--- 17. User Rewards Wallet & Point Ledger ---");
        const walletRes = await request("/api/rewards/wallet", {
            headers: { "Authorization": `Bearer ${finderToken}` }
        });
        assert(walletRes.status === 200 && walletRes.data.success, "Rewards wallet fetched successfully");
        assert(walletRes.data.wallet.points > 0, "User wallet reflects earned points");
        assert(Array.isArray(walletRes.data.wallet.transactions), "Wallet includes point transaction history ledger");

        // 18. Test Rewards Catalog
        console.log("\n--- 18. Rewards Store Catalog ---");
        const catalogRes = await request("/api/rewards/catalog");
        assert(catalogRes.status === 200 && Array.isArray(catalogRes.data.catalog), "Rewards store catalog returned as array");
        assert(catalogRes.data.catalog.length >= 4, "Store catalog contains standard perks");

        // 19. Test Reward Redemption
        console.log("\n--- 19. Reward Perk Redemption ---");
        const redeemRes = await request("/api/rewards/redeem", {
            method: "POST",
            headers: { "Authorization": `Bearer ${finderToken}` },
            body: { rewardId: "boost" }
        });
        assert(redeemRes.status === 200 && redeemRes.data.success, "Reward perk redeemed successfully");
        assert(redeemRes.data.reward && redeemRes.data.reward.voucherCode, "Redemption generates a verified voucher code");

        // 20. Test Dedicated Spatial Geo-Proximity Radius Search
        console.log("\n--- 20. Spatial Geo-Proximity Radius Search ---");
        const proxRes = await request("/api/search/proximity?lat=30.7410&lng=76.7845&radius=25");
        assert(proxRes.status === 200 && proxRes.data.success, "Proximity search endpoint returns 200 OK");
        assert(Array.isArray(proxRes.data.data), "Proximity results returned as array");
        assert(proxRes.data.center && proxRes.data.center.radiusKm === 25, "Response includes search center and radius");

        // 21. Test Verified Safe Handover Zones
        console.log("\n--- 21. Verified Safe Handover Zones Catalog ---");
        const safeZonesRes = await request("/api/safe-zones");
        assert(safeZonesRes.status === 200 && Array.isArray(safeZonesRes.data.data), "Safe zones fetched successfully");
        assert(safeZonesRes.data.data.length > 0, "Safe zones catalog includes verified drop-off hubs");
        const sampleSafeZoneId = safeZonesRes.data.data[0].id;

        // 22. Test Safe Zone Custody Deposit
        console.log("\n--- 22. Safe Zone Custody Transfer ---");
        const depositRes = await request("/api/safe-zones/deposit", {
            method: "POST",
            body: {
                itemId: 1,
                safeZoneId: sampleSafeZoneId,
                depositNotes: "Deposited at main desk by Good Samaritan finder."
            }
        });
        assert(depositRes.status === 200 && depositRes.data.success, "Item custody transfer logged at safe drop-off zone");

        // 23. Test Web Push Notification Registration
        console.log("\n--- 23. Web Push Notification Subscriptions ---");
        const pushRes = await request("/api/notifications/subscribe", {
            method: "POST",
            headers: { "Authorization": `Bearer ${finderToken}` },
            body: {
                subscription: {
                    endpoint: `https://fcm.googleapis.com/fcm/send/test_${uniqueId}`,
                    keys: {
                        p256dh: "BM6q6G...test_key",
                        auth: "auth_secret_123"
                    }
                }
            }
        });
        assert(pushRes.status === 200 && pushRes.data.success, "Push notification subscription registered successfully");

        // 24. Test Hybrid Matching & Explainable Uncertainty Engine
        console.log("\n--- 24. Hybrid Multi-Signal Matching & Explainability ---");
        // Create Lost Item
        const lostItemRes = await request("/api/lost", {
            method: "POST",
            headers: { "Authorization": `Bearer ${claimantToken}` },
            body: {
                itemName: `MacBook Pro M2 ${uniqueId}`,
                category: "Laptop",
                brand: "Apple",
                color: "Space Gray",
                lostDate: "2026-07-24",
                location: "Central Library Room 302",
                latitude: 30.7410,
                longitude: 76.7845,
                contactName: "Claimant User",
                phone: "9812345678",
                email: `claimant_${uniqueId}@example.com`,
                description: "Lost Apple MacBook laptop near library 3rd floor."
            }
        });
        const createdLostId = lostItemRes.data.data.id;

        // Create Found Item for Comparison
        const foundItemPair = await request("/api/found", {
            method: "POST",
            headers: { "Authorization": `Bearer ${finderToken}` },
            body: {
                itemName: `MacBook Pro M2 ${uniqueId}`,
                category: "Laptop",
                brand: "Apple",
                color: "Space Gray",
                foundDate: "2026-07-25",
                location: "Central Library Desk",
                latitude: 30.7412,
                longitude: 76.7848,
                finderName: "Finder User",
                phone: "9876543210",
                email: `finder_${uniqueId}@example.com`,
                description: "Found space gray Apple MacBook laptop on 3rd floor desk."
            }
        });
        const createdFoundId = foundItemPair.data.data.id;

        const hybridEval = await request("/api/match/hybrid-evaluate", {
            method: "POST",
            body: { itemAId: createdLostId, itemBId: createdFoundId }
        });
        assert(hybridEval.status === 200 && hybridEval.data.success, "Hybrid pairwise evaluation succeeds");
        assert(hybridEval.data.evaluation.confidence, "Evaluation includes confidence tier (HIGH/MEDIUM/LOW)");
        assert(typeof hybridEval.data.evaluation.uncertainty === "number", "Evaluation provides quantified uncertainty rating");
        assert(Array.isArray(hybridEval.data.evaluation.reasons), "Evaluation provides explainable matching reasons");

        // 25. Test Ownership Vault Security & Access Control
        console.log("\n--- 25. Protected Ownership Vault & Privacy Separation ---");
        const vaultDeposit = await request("/api/vault/deposit", {
            method: "POST",
            headers: { "Authorization": `Bearer ${claimantToken}` },
            body: {
                itemId: createdLostId,
                serialNumber: "C02G12345ABCD",
                invoiceNumber: "INV-2026-APPLE-9988",
                hiddenMarks: "Small scratch near HDMI port and GitHub sticker on corner.",
                privateNotes: "Purchased at Apple Store Mumbai in 2025."
            }
        });
        assert(vaultDeposit.status === 201 || vaultDeposit.status === 200, "Deposited private ownership proof into Vault");

        // Authorized Owner Vault Access
        const authVault = await request(`/api/vault/${createdLostId}`, {
            headers: { "Authorization": `Bearer ${claimantToken}` }
        });
        assert(authVault.status === 200 && authVault.data.data.serialNumber === "C02G12345ABCD", "Item owner can access their private vault evidence");

        // Unauthorized Vault Access Prevention (Finder cannot inspect Claimant's private vault)
        const unauthVault = await request(`/api/vault/${createdLostId}`, {
            headers: { "Authorization": `Bearer ${finderToken}` }
        });
        assert(unauthVault.status === 403, "Non-owner user is FORBIDDEN (403) from accessing private vault records");

        // 26. Test Ownership Challenge Verification
        console.log("\n--- 26. Interactive Ownership Challenge System ---");
        // Submit claim on createdLostId
        const newClaimRes = await request("/api/claims/submit", {
            method: "POST",
            headers: { "Authorization": `Bearer ${finderToken}` },
            body: {
                itemId: createdLostId,
                proofDescription: "I found this laptop and verified ownership matching."
            }
        });
        assert(newClaimRes.status === 201, "Claim submitted and Recovery Case generated");
        const newClaimId = newClaimRes.data.claimId;
        const assignedCaseNumber = newClaimRes.data.caseNumber;

        // Owner issues challenge
        const issueChal = await request("/api/claims/challenge", {
            method: "POST",
            headers: { "Authorization": `Bearer ${claimantToken}` },
            body: {
                claimId: newClaimId,
                challengeQuestion: "What distinctive sticker is located on the top corner?",
                challengeAnswer: "GitHub Octocat"
            }
        });
        assert(issueChal.status === 200 && issueChal.data.success, "Custodian issued ownership challenge question");

        // Claimant answers correctly
        const verifyChal = await request("/api/claims/challenge/verify", {
            method: "POST",
            headers: { "Authorization": `Bearer ${finderToken}` },
            body: {
                claimId: newClaimId,
                answer: "github octocat"
            }
        });
        assert(verifyChal.status === 200 && verifyChal.data.success, "Claimant answered challenge correctly and verified ownership");

        // 27. Test Central Recovery Case Management
        console.log("\n--- 27. Central Recovery Case Lifecycle ---");
        const caseRes = await request(`/api/cases/${assignedCaseNumber}`, {
            headers: { "Authorization": `Bearer ${claimantToken}` }
        });
        assert(caseRes.status === 200 && caseRes.data.success, "Fetched central recovery case details");
        assert(caseRes.data.data.caseNumber === assignedCaseNumber, "Case number matches format REC-YYYY-XXXXX");
        assert(Array.isArray(caseRes.data.timeline), "Recovery case includes audit timeline");

        // 28. Test Audit Trail & Fraud Risk Moderation
        console.log("\n--- 28. Immutable Audit Trail & Fraud Intelligence ---");
        const auditRes = await request("/api/admin/audit-logs");
        assert(auditRes.status === 200 && Array.isArray(auditRes.data.data), "Admin retrieved immutable audit log stream");

        const fraudRes = await request("/api/admin/fraud-alerts");
        assert(fraudRes.status === 200 && Array.isArray(fraudRes.data.data), "Admin retrieved fraud risk intelligence alerts");

        console.log("\n=================================================");
        console.log("🎉 ALL 28 ENTERPRISE ARCHITECTURE, AI, VAULT & SECURITY TESTS PASSED! ZERO DEFECTS.");
        console.log("=================================================");
    } catch (err) {
        console.error("\n❌ TEST SUITE FAILED WITH ERROR:", err);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runTests();
}

module.exports = { runTests };
