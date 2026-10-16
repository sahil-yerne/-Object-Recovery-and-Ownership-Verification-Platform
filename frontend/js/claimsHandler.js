// ================= CLAIMS & OTP HANDOVER HANDLER =================

document.addEventListener("DOMContentLoaded", function () {
    const claimForm = document.getElementById("submitClaimForm");
    const otpForm = document.getElementById("verifyOtpForm");

    // ================= OCR BILL & SERIAL NUMBER SCANNER =================
    const ocrInput = document.getElementById("ocrBillInput");
    const ocrStatus = document.getElementById("ocrStatus");
    const ocrBtn = document.getElementById("ocrScanBtn");
    const claimProofTextarea = document.getElementById("claimProof");

    if (ocrInput) {
        ocrInput.addEventListener("change", async function (e) {
            if (!e.target.files || e.target.files.length === 0) return;
            const file = e.target.files[0];

            if (ocrStatus) ocrStatus.innerHTML = `<span class="text-warning"><span class="spinner-border spinner-border-sm me-1"></span> AI OCR analyzing document text and extracting serials...</span>`;
            if (ocrBtn) ocrBtn.classList.add("disabled");

            const formData = new FormData();
            formData.append("document", file);

            try {
                const response = await fetch("/api/ai/ocr-scan", {
                    method: "POST",
                    body: formData
                });
                const data = await response.json();

                if (data.success) {
                    let extractedNotes = [];
                    if (data.extracted?.serials?.length > 0) {
                        extractedNotes.push(`Serial / Identifiers: ${data.extracted.serials.join(", ")}`);
                    }
                    if (data.extracted?.dates?.length > 0) {
                        extractedNotes.push(`Invoice Date: ${data.extracted.dates.join(", ")}`);
                    }
                    if (data.extracted?.prices?.length > 0) {
                        extractedNotes.push(`Purchase Amount: ${data.extracted.prices.join(", ")}`);
                    }

                    let appendText = "";
                    if (extractedNotes.length > 0) {
                        appendText = `[AI OCR Extracted Verification]\n` + extractedNotes.join("\n") + `\n\n`;
                    } else if (data.rawText) {
                        appendText = `[AI OCR Document Excerpt]\n${data.rawText.substring(0, 200)}...\n\n`;
                    }

                    if (claimProofTextarea) {
                        claimProofTextarea.value = appendText + claimProofTextarea.value;
                    }

                    if (ocrStatus) {
                        ocrStatus.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i> OCR extracted ${data.extracted?.serials?.length || 0} serial/ID match(es) and inserted into proof description!</span>`;
                    }
                } else {
                    if (ocrStatus) ocrStatus.innerHTML = `<span class="text-danger">OCR scan failed: ${data.message || 'Unknown error'}</span>`;
                }
            } catch (err) {
                console.error("OCR Error:", err);
                if (ocrStatus) ocrStatus.innerHTML = `<span class="text-danger">Error connecting to OCR engine.</span>`;
            } finally {
                if (ocrBtn) ocrBtn.classList.remove("disabled");
            }
        });
    }

    // ================= SUBMIT CLAIM =================
    if (claimForm) {
        claimForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const token = localStorage.getItem("auth_token");
            if (!token) {
                alert("Please log in to submit an ownership claim.");
                window.location.href = "login.html";
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const itemId = urlParams.get("id");
            const proofDescription = document.getElementById("claimProof").value.trim();
            const evidenceInput = document.getElementById("claimEvidence");
            const btn = document.getElementById("submitClaimBtn");

            if (!itemId || !proofDescription) {
                alert("Please describe your proof of ownership.");
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Submitting Proof...';

            try {
                const formData = new FormData();
                formData.append("itemId", itemId);
                formData.append("proofDescription", proofDescription);

                if (evidenceInput && evidenceInput.files.length > 0) {
                    Array.from(evidenceInput.files).forEach(file => {
                        formData.append("evidence", file);
                    });
                }

                const response = await fetch("/api/claims/submit", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`
                    },
                    body: formData
                });

                const data = await response.json();

                if (!response.ok) throw new Error(data.message || "Failed to submit claim.");

                alert("🎉 " + data.message);
                const modalEl = document.getElementById("claimModal");
                if (modalEl && typeof bootstrap !== "undefined") {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
                claimForm.reset();

            } catch (err) {
                alert("Error: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = "Submit Claim";
            }
        });
    }

    // ================= VERIFY HANDOVER OTP =================
    if (otpForm) {
        otpForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            const token = localStorage.getItem("auth_token");
            if (!token) {
                alert("Please log in to verify handover.");
                window.location.href = "login.html";
                return;
            }

            const urlParams = new URLSearchParams(window.location.search);
            const itemId = urlParams.get("id");
            const otp = document.getElementById("otpInput").value.trim();
            const btn = document.getElementById("verifyOtpSubmitBtn");

            if (!otp || otp.length !== 6) {
                alert("Please enter a valid 6-digit OTP.");
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Verifying OTP...';

            try {
                // First get claims for this item
                const claimRes = await fetch(`/api/claims/item/${itemId}`);
                const claimData = await claimRes.json();

                if (!claimData.claims || claimData.claims.length === 0) {
                    throw new Error("No approved claims found for this item to verify.");
                }

                // Find approved claim
                const approvedClaim = claimData.claims.find(c => c.status === 'approved') || claimData.claims[0];
                const claimId = approvedClaim.id;

                const response = await fetch("/api/claims/verify-otp", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ claimId, otp })
                });

                const data = await response.json();

                if (!response.ok) throw new Error(data.message || "OTP verification failed.");

                alert(data.message);
                const modalEl = document.getElementById("otpModal");
                if (modalEl && typeof bootstrap !== "undefined") {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
                otpForm.reset();

                // Reload page to reflect status
                setTimeout(() => window.location.reload(), 1000);

            } catch (err) {
                alert("Error: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = "Verify OTP & Claim 200 Points 🎉";
            }
        });
    }
});

// ================= CUSTODIAN CLAIM ACTIONS =================

window.approveClaim = async function(claimId) {
    const token = localStorage.getItem("auth_token");
    if (!token) {
        alert("Please log in to approve claims.");
        return;
    }

    const confirmed = confirm("Are you sure you want to approve this ownership claim? This will generate a Handover OTP for safe return.");
    if (!confirmed) return;

    try {
        const res = await fetch("/api/claims/approve", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ claimId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to approve claim.");

        alert("✅ " + data.message);
        window.location.reload();
    } catch (e) {
        alert("Error: " + e.message);
    }
};

window.rejectClaim = async function(claimId) {
    const token = localStorage.getItem("auth_token");
    if (!token) {
        alert("Please log in to reject claims.");
        return;
    }

    const reason = prompt("Enter the reason for rejecting this claim (e.g. proof does not match actual object):");
    if (reason === null) return;

    try {
        const res = await fetch("/api/claims/reject", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ claimId, reason: reason.trim() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to reject claim.");

        alert("Claim marked as rejected.");
        window.location.reload();
    } catch (e) {
        alert("Error: " + e.message);
    }
};

window.loadCustodianClaims = async function(itemId, finderUserId) {
    const token = localStorage.getItem("auth_token");
    const currentUser = JSON.parse(localStorage.getItem("auth_user") || "{}");
    const custodianSection = document.getElementById("custodianClaimsSection");
    const custodianBody = document.getElementById("custodianClaimsBody");
    const countBadge = document.getElementById("custodianClaimsCount");

    if (!custodianSection || !custodianBody) return;

    // Show only if user is the finder or an admin
    const isCustodian = currentUser.id && (currentUser.id === finderUserId || currentUser.role === "admin");
    if (!isCustodian) {
        custodianSection.classList.add("d-none");
        return;
    }

    custodianSection.classList.remove("d-none");

    try {
        const res = await fetch(`/api/claims/item/${itemId}`);
        const data = await res.json();
        const claims = data.claims || [];

        if (countBadge) countBadge.textContent = `${claims.length} Claim(s)`;

        if (claims.length === 0) {
            custodianBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No ownership claims submitted for this item yet.</td></tr>`;
            return;
        }

        custodianBody.innerHTML = claims.map(c => {
            let evidenceHtml = '<span class="text-muted small">None</span>';
            if (c.evidenceImages) {
                try {
                    const imgs = typeof c.evidenceImages === 'string' ? JSON.parse(c.evidenceImages) : c.evidenceImages;
                    if (Array.isArray(imgs) && imgs.length > 0) {
                        evidenceHtml = imgs.map(img => `
                            <a href="${img}" target="_blank" class="d-inline-block me-1">
                                <img src="${img}" style="width:45px; height:45px; object-fit:cover; border-radius:4px; border:1px solid #38bdf8;">
                            </a>
                        `).join('');
                    }
                } catch(e) {}
            }

            let actionHtml = '';
            if (c.status === 'pending') {
                actionHtml = `
                    <button class="btn btn-sm btn-success me-1" onclick="approveClaim(${c.id})"><i class="bi bi-check-lg"></i> Approve</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="rejectClaim(${c.id})"><i class="bi bi-x-lg"></i> Reject</button>
                `;
            } else if (c.status === 'approved') {
                actionHtml = `<span class="badge bg-info text-dark">Approved (Awaiting OTP)</span>`;
            } else if (c.status === 'returned') {
                actionHtml = `<span class="badge bg-success">Verified Returned</span>`;
            } else {
                actionHtml = `<span class="badge bg-danger">Rejected</span>`;
            }

            return `
                <tr>
                    <td>
                        <div class="fw-bold text-light">${c.claimantName}</div>
                        <div class="small text-muted">${c.claimantEmail}</div>
                    </td>
                    <td><span class="badge bg-success">${c.claimantTrustScore || 0}/100</span></td>
                    <td class="small" style="max-width: 250px;">${c.proofDescription}</td>
                    <td>${evidenceHtml}</td>
                    <td><span class="badge ${c.status === 'approved' ? 'bg-info text-dark' : c.status === 'returned' ? 'bg-success' : c.status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'} text-uppercase">${c.status}</span></td>
                    <td>${actionHtml}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error("Failed to load custodian claims", e);
    }
};

