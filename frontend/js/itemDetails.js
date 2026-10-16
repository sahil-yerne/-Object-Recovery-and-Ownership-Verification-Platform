// ================= ITEM DETAILS PAGE =================

document.addEventListener("DOMContentLoaded", function() {

    loadItemDetails();

});

// ================= GET ID FROM URL =================

function getItemIdFromURL() {

    const params = new URLSearchParams(window.location.search);
    return params.get("id");

}

// ================= LOAD ITEM DETAILS =================

async function loadItemDetails() {

    const id = getItemIdFromURL();

    if (!id) {
        showAlert("Invalid item ID", "danger");
        return;
    }

    try {

        // ================= API CALL =================

        const response = await api.getItemById(id);

        const item = response.data;

        if (!item) {
            showAlert("Item not found", "danger");
            return;
        }

        // ================= FILL BASIC INFO =================

        const mainImg = document.getElementById("itemImage");
        mainImg.src = getItemImage(item);

        const allImages = getItemImages(item);
        const thumbsContainer = document.getElementById("imageGalleryThumbs");
        if (thumbsContainer && allImages.length > 1) {
            thumbsContainer.innerHTML = "";
            allImages.forEach(imgUrl => {
                const thumb = document.createElement("img");
                thumb.src = imgUrl;
                thumb.className = "img-thumbnail cursor-pointer";
                thumb.style.width = "65px";
                thumb.style.height = "65px";
                thumb.style.objectFit = "cover";
                thumb.style.cursor = "pointer";
                thumb.addEventListener("click", function() {
                    mainImg.src = imgUrl;
                });
                thumbsContainer.appendChild(thumb);
            });
        }

        document.getElementById("itemName").innerText =
            item.itemName || "-";

        document.getElementById("itemCategory").innerText =
            item.category || "-";

        document.getElementById("itemBrand").innerText =
            item.brand || "-";

        document.getElementById("itemColor").innerText =
            item.color || "-";

        document.getElementById("itemDate").innerText =
            item.date || item.createdAt || "-";

        document.getElementById("itemLocation").innerText =
            item.location || "-";

        document.getElementById("itemDescription").innerText =
            item.description || "No description available.";

        // ================= STATUS =================

        const statusBadge = document.getElementById("itemStatus");

        if (item.status === "lost") {
            statusBadge.className = "badge bg-danger";
            statusBadge.innerText = "Lost";
        } else {
            statusBadge.className = "badge bg-success";
            statusBadge.innerText = "Found";
        }

        // ================= CONTACT INFO & OWNERSHIP QUIZ =================

        let activeContactName = item.contactName || item.finderName || "-";
        let activePhone = item.phone || "";
        let activeEmail = item.email || "";

        const contactNameEl = document.getElementById("contactName");
        const contactPhoneEl = document.getElementById("contactPhone");
        const contactEmailEl = document.getElementById("contactEmail");

        if (contactNameEl) contactNameEl.innerText = activeContactName;
        if (contactPhoneEl) contactPhoneEl.innerText = activePhone || "-";
        if (contactEmailEl) contactEmailEl.innerText = activeEmail || "-";

        const startQuizBtn = document.getElementById("startQuizBtn");
        const openChatBtn = document.getElementById("openChatBtn");
        const lockedContainer = document.getElementById("contactDetailsLocked");
        const unlockedContainer = document.getElementById("contactDetailsUnlocked");

        if (startQuizBtn) {
            startQuizBtn.addEventListener("click", async function() {
                const question = item.secretQuestion || "Please answer the owner verification challenge question:";
                const answer = prompt(`🔒 OWNERSHIP VERIFICATION QUIZ:\n\n${question}`);
                
                if (answer !== null && answer.trim() !== "") {
                    try {
                        startQuizBtn.disabled = true;
                        startQuizBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Verifying...`;

                        const res = await api.verifyQuiz(item.id, answer.trim());
                        if (res.success) {
                            showAlert(res.message || "🎉 Ownership verified successfully! Contact details unlocked.", "success");
                            
                            // Dynamically reveal unmasked contact info received from secure server
                            if (res.data) {
                                if (res.data.phone) {
                                    activePhone = res.data.phone;
                                    if (contactPhoneEl) contactPhoneEl.innerText = res.data.phone;
                                }
                                if (res.data.email) {
                                    activeEmail = res.data.email;
                                    if (contactEmailEl) contactEmailEl.innerText = res.data.email;
                                }
                                if (res.data.contactName && contactNameEl) {
                                    contactNameEl.innerText = res.data.contactName;
                                }
                            }

                            if (lockedContainer) lockedContainer.classList.add("d-none");
                            if (unlockedContainer) unlockedContainer.classList.remove("d-none");
                        }
                    } catch (err) {
                        console.error("Quiz verification error:", err);
                        showAlert(err.message || "❌ Incorrect answer to verification quiz. Access denied.", "danger");
                    } finally {
                        startQuizBtn.disabled = false;
                        startQuizBtn.innerHTML = `<i class="bi bi-patch-question-fill me-1"></i> Answer Question to Unlock`;
                    }
                }
            });
        }

        if (openChatBtn) {
            openChatBtn.addEventListener("click", function() {
                window.location.href = `chat.html?itemId=${item.id}`;
            });
        }

        document.getElementById("statusBadge").innerText =
            item.status || "pending";

        const cleanPhone = phone => phone.replace(/[^+0-9]/g, "");

        const callBtn = document.getElementById("callBtn");
        const messageBtn = document.getElementById("messageBtn");

        if (callBtn) {
            callBtn.addEventListener("click", () => {
                if (!activePhone) {
                    alert("Contact phone number is not available.");
                    return;
                }
                window.location.href = `tel:${cleanPhone(activePhone)}`;
            });
        }

        if (messageBtn) {
            messageBtn.addEventListener("click", () => {
                if (activePhone) {
                    window.location.href = `sms:${cleanPhone(activePhone)}`;
                    return;
                }
                if (activeEmail) {
                    window.location.href = `mailto:${encodeURIComponent(activeEmail)}?subject=${encodeURIComponent("Lost & Found inquiry")}&body=${encodeURIComponent("Hello " + activeContactName + ",%0A%0AI found your item listing and would like to get in touch.")}`;
                    return;
                }
                alert("No contact phone or email is available to send a message.");
            });
        }

        // ================= LOAD CUSTODIAN CLAIMS =================
        if (typeof window.loadCustodianClaims === "function") {
            window.loadCustodianClaims(item.id, item.userId);
        }

        // ================= LOAD SIMILAR ITEMS =================

        loadSimilarItems(item.category, item.id);

        // ================= DELETE BUTTON HANDLER =================
        const deleteBtn = document.getElementById("deleteBtn");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", async() => {
                const confirmed = confirm("Are you sure you want to delete this report?");
                if (!confirmed) return;

                try {
                    deleteBtn.disabled = true;
                    deleteBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...`;

                    const deleteResponse = await api.deleteItem(item.id);
                    if (deleteResponse.success) {
                        alert("Report deleted successfully!");
                        window.location.href = "index.html";
                    } else {
                        throw new Error(deleteResponse.message || "Failed to delete item");
                    }
                } catch (err) {
                    console.error("Delete error:", err);
                    alert(err.message || "Failed to delete this report.");
                    deleteBtn.disabled = false;
                    deleteBtn.innerHTML = `<i class="bi bi-trash-fill"></i> Delete Report`;
                }
            });
        }

    } catch (error) {

        console.error(error);

        showAlert(error.message || "Failed to load item details", "danger");

    }

}

// ================= SIMILAR ITEMS =================

async function loadSimilarItems(category, currentId) {

    try {

        const response = await api.searchItems(`?category=${category}`);

        const items = response.data || [];

        const container = document.getElementById("similarItems");

        container.innerHTML = "";

        items
            .filter(item => item.id != currentId)
            .slice(0, 3)
            .forEach(item => {

                const card = document.createElement("div");
                card.className = "col-md-4 mb-3";

                card.innerHTML = `
                    <div class="card shadow-sm">

                        <img src="${getItemImage(item)}"
                             class="card-img-top"
                             alt="item">

                        <div class="card-body">

                            <h6>${item.itemName}</h6>

                            <p class="text-muted small">
                                ${item.location || ""}
                            </p>

                            <a href="item-details.html?id=${item.id}"
                               class="btn btn-sm btn-outline-primary">

                                View

                            </a>

                        </div>

                    </div>
                `;

                container.appendChild(card);

            });

    } catch (error) {

        console.error("Similar items error:", error);

    }

}

// ================= OWNERSHIP VAULT DEPOSIT HANDLER =================

const vaultForm = document.getElementById("vaultDepositForm");
if (vaultForm) {
    vaultForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        const itemId = getItemIdFromURL();
        if (!itemId) return;

        const serialNumber = document.getElementById("vaultSerial")?.value || "";
        const invoiceNumber = document.getElementById("vaultInvoice")?.value || "";
        const hiddenMarks = document.getElementById("vaultHiddenMarks")?.value || "";
        const receiptsInput = document.getElementById("vaultReceipts");

        const formData = new FormData();
        formData.append("itemId", itemId);
        if (serialNumber) formData.append("serialNumber", serialNumber);
        if (invoiceNumber) formData.append("invoiceNumber", invoiceNumber);
        if (hiddenMarks) formData.append("hiddenMarks", hiddenMarks);

        if (receiptsInput && receiptsInput.files.length > 0) {
            for (let i = 0; i < receiptsInput.files.length; i++) {
                formData.append("receipts", receiptsInput.files[i]);
            }
        }

        try {
            const res = await api.depositVault(formData);
            if (res.success) {
                showAlert("✅ Confidential proof securely stored in Ownership Vault!", "success");
                const modal = bootstrap.Modal.getInstance(document.getElementById("vaultModal"));
                if (modal) modal.hide();
                vaultForm.reset();
            } else {
                showAlert(res.message || "Failed to deposit into vault", "danger");
            }
        } catch (err) {
            showAlert("Error: " + err.message, "danger");
        }
    });
}

// ================= GENERATE FIR DECLARATION =================
const firBtn = document.getElementById("generateFirBtn");
if (firBtn) {
    firBtn.addEventListener("click", function() {
        const itemId = getItemIdFromURL();
        if (!itemId) return;
        const token = localStorage.getItem("auth_token");
        if (!token) {
            alert("Please log in to generate an official FIR declaration.");
            window.location.href = "login.html";
            return;
        }
        window.open(`fir-report.html?itemId=${itemId}`, "_blank");
    });
}

// ================= AI CANDIDATE SCANNER =================
const viewMatchesBtn = document.getElementById("viewCandidateMatchesBtn");
if (viewMatchesBtn) {
    viewMatchesBtn.addEventListener("click", async function() {
        const itemId = getItemIdFromURL();
        if (!itemId) return;
        try {
            viewMatchesBtn.disabled = true;
            viewMatchesBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Scanning Neural Candidates...`;
            const res = await fetch(`/api/match/instant/${itemId}`);
            const data = await res.json();
            viewMatchesBtn.disabled = false;
            viewMatchesBtn.innerHTML = `<i class="bi bi-radar me-1"></i> View AI Candidate Matches (${data.totalMatches || 0})`;

            if (!data.matches || data.matches.length === 0) {
                alert("🔍 No candidate matches above the confidence threshold found yet. The continuous matching engine will keep scanning!");
                return;
            }

            if (window.showMatchModal) {
                window.showMatchModal(data.matches);
            } else {
                const top = data.matches[0];
                const reasonsText = top.reasons ? top.reasons.join("\n• ") : "Visual & semantic similarity";
                alert(`🎯 Top AI Match (${top.matchPercentage}% Confidence - ${top.confidence}):\n\n"${top.itemName}" (${top.category})\nLocation: ${top.location} (${top.distanceKm !== null ? top.distanceKm + ' km away' : 'Nearby'})\n\nMatching Signals:\n• ${reasonsText}`);
            }
        } catch (err) {
            viewMatchesBtn.disabled = false;
            viewMatchesBtn.innerHTML = `<i class="bi bi-radar me-1"></i> View AI Candidate Matches`;
            alert("Match scanner error: " + err.message);
        }
    });
}