// ================= FOUND ITEM FORM HANDLER =================

document.addEventListener("DOMContentLoaded", function() {

    const form = document.getElementById("foundItemForm");

    if (!form) return;

    // Handle Image Preview (Multiple)
    const imageInput = document.getElementById("image");
    const imagePreviewContainer = document.getElementById("imagePreviewContainer");
    if (imageInput && imagePreviewContainer) {
        imageInput.addEventListener("change", function() {
            imagePreviewContainer.innerHTML = "";
            if (this.files.length === 0) {
                imagePreviewContainer.innerHTML = `<img id="imagePreview" src="assets/images/no-image.png" alt="Preview" class="img-fluid rounded border" style="max-height:140px;">`;
                return;
            }
            Array.from(this.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement("img");
                    img.src = e.target.result;
                    img.className = "img-fluid rounded border";
                    img.style.maxHeight = "120px";
                    imagePreviewContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            });

            // Auto-trigger AI Lens Scan
            const lensBtn = document.getElementById("lensScanBtn");
            if (lensBtn) {
                setTimeout(() => lensBtn.click(), 300);
            }
        });
    }

    // AI Description Generator Handler
    const generateAiDescBtn = document.getElementById("generateAiDescBtn");
    const descriptionTextarea = document.getElementById("description");
    if (generateAiDescBtn && descriptionTextarea) {
        generateAiDescBtn.addEventListener("click", async function() {
            const itemName = document.getElementById("itemName").value.trim();
            const category = document.getElementById("category").value;
            const brand = document.getElementById("brand").value.trim();
            const color = document.getElementById("color").value.trim();
            const itemCondition = document.getElementById("itemCondition").value;

            if (!itemName && !category) {
                showAlert("Please enter at least Item Name or Category to generate description!", "warning");
                return;
            }

            generateAiDescBtn.innerHTML = `<i class="bi bi-hourglass-split me-1"></i> Generating AI Text...`;
            generateAiDescBtn.disabled = true;

            try {
                const res = await fetch("/api/ai/generate-description", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ itemName, category, brand, color, itemCondition })
                });
                const data = await res.json();

                if (data.success) {
                    descriptionTextarea.value = data.description;
                    showAlert("✨ AI description generated!", "success");
                } else {
                    showAlert("Failed to generate description", "danger");
                }
            } catch (err) {
                console.error(err);
                showAlert("Error connecting to AI service", "danger");
            } finally {
                generateAiDescBtn.innerHTML = `<i class="bi bi-magic me-1"></i> ✨ Generate AI Description`;
                generateAiDescBtn.disabled = false;
            }
        });
    }

    // AI Lens Scanner Handler
    const lensScanBtn = document.getElementById("lensScanBtn");
    if (lensScanBtn) {
        lensScanBtn.addEventListener("click", async function() {
            if (!imageInput || imageInput.files.length === 0) {
                showAlert("Please upload an image first to scan with AI Lens!", "warning");
                return;
            }

            lensScanBtn.innerHTML = `<i class="bi bi-hourglass-split me-1"></i> Scanning via AI Lens...`;
            lensScanBtn.disabled = true;

            try {
                const fd = new FormData();
                fd.append("image", imageInput.files[0]);

                const res = await fetch("/api/ai/lens-scan", {
                    method: "POST",
                    body: fd
                });
                const response = await res.json();

                if (response.success && response.data) {
                    const d = response.data;
                    if (d.itemName) document.getElementById("itemName").value = d.itemName;
                    if (d.category) {
                        const catEl = document.getElementById("category");
                        if (catEl) {
                            const match = Array.from(catEl.options).find(o => o.value && (o.value.toLowerCase() === d.category.toLowerCase() || o.text.toLowerCase().includes(d.category.toLowerCase())));
                            if (match) {
                                catEl.value = match.value;
                            } else {
                                catEl.value = "Other";
                                const otherCatInput = document.getElementById("otherCategoryInput");
                                if (otherCatInput) otherCatInput.value = d.category;
                            }
                            catEl.dispatchEvent(new Event("change"));
                        }
                    }
                    if (d.brand) {
                        const brandEl = document.getElementById("brand");
                        if (brandEl) {
                            const match = Array.from(brandEl.options).find(o => o.value && o.value.toLowerCase() === d.brand.toLowerCase());
                            if (match) {
                                brandEl.value = match.value;
                            } else {
                                brandEl.value = "Other";
                                const otherBrandInput = document.getElementById("otherBrandInput");
                                if (otherBrandInput) otherBrandInput.value = d.brand;
                            }
                            brandEl.dispatchEvent(new Event("change"));
                        }
                    }
                    if (d.color) document.getElementById("color").value = d.color;
                    if (d.itemCondition && document.getElementById("itemCondition")) {
                        document.getElementById("itemCondition").value = d.itemCondition;
                    }
                    if (d.description) document.getElementById("description").value = d.description;

                    showAlert("✨ AI Lens scanned image & auto-filled details!", "success");
                } else {
                    showAlert("AI Lens scan failed", "danger");
                }
            } catch (err) {
                console.error(err);
                showAlert("Error connecting to AI Lens service", "danger");
            } finally {
                lensScanBtn.innerHTML = `<i class="bi bi-camera me-1"></i> 🔍 AI Lens Scan & Autofill`;
                lensScanBtn.disabled = false;
            }
        });
    }

    form.addEventListener("submit", async function(e) {
        e.preventDefault();

        const submitBtn = form.querySelector("button[type='submit']");

        try {

            // ================= BASIC VALIDATION =================

            const itemName = document.getElementById("itemName").value.trim();
            let category = document.getElementById("category").value;
            if (category === "Other") {
                const otherVal = document.getElementById("otherCategoryInput")?.value.trim();
                if (otherVal) {
                    category = otherVal;
                } else {
                    showAlert("Please specify the category", "danger");
                    return;
                }
            }
            const foundDate = document.getElementById("foundDate").value;
            const location = document.getElementById("location").value.trim();
            const finderName = document.getElementById("finderName").value.trim();
            const phone = document.getElementById("phone").value.trim();

            if (!itemName || !category || !foundDate || !location || !finderName || !phone) {
                showAlert("Please fill all required fields", "danger");
                return;
            }

            if (phone.length < 10) {
                showAlert("Invalid phone number", "danger");
                return;
            }

            // ================= CONSTRUCT FORM DATA =================

            const formData = new FormData();
            formData.append("itemName", itemName);
            formData.append("category", category);
            formData.append("brand", document.getElementById("brand").value.trim());
            formData.append("color", document.getElementById("color").value.trim());
            formData.append("foundDate", foundDate);
            formData.append("foundTime", document.getElementById("foundTime").value);
            formData.append("location", location);
            formData.append("storageDetails", document.getElementById("storageDetails")?.value.trim() || "");
            formData.append("itemCondition", document.getElementById("itemCondition")?.value || "");
            formData.append("description", descriptionTextarea.value.trim());
            formData.append("finderName", finderName);
            formData.append("phone", phone);
            formData.append("email", document.getElementById("email").value.trim());

            formData.append("secretQuestion", document.getElementById("secretQuestion")?.value.trim() || "");
            formData.append("secretAnswer", document.getElementById("secretAnswer")?.value.trim() || "");

            // Add latitude and longitude if present
            const latInput = document.getElementById("latitude");
            const lngInput = document.getElementById("longitude");
            if (latInput && latInput.value) formData.append("latitude", latInput.value);
            if (lngInput && lngInput.value) formData.append("longitude", lngInput.value);

            // Add images (Multiple)
            if (imageInput && imageInput.files.length > 0) {
                Array.from(imageInput.files).forEach(file => {
                    formData.append("images", file);
                });
            }

            // ================= LOADING UI =================

            showLoading(submitBtn);

            // ================= API CALL =================

            const response = await api.submitFoundItem(formData);

            console.log("Response:", response);

            // ================= SUCCESS =================
            const ptsText = response.pointsAwarded ? ` (+${response.pointsAwarded} Karma Points Earned!)` : " (+50 Karma Points Earned!)";
            showAlert(`🎉 Found item reported successfully!${ptsText}`, "success");

            // Instant AI Match Check & Modal Trigger
            if (response && response.data && response.data.id && typeof window.showInstantMatchModal === 'function') {
                try {
                    const matchRes = await fetch(`/api/match/instant/${response.data.id}`);
                    const matchData = await matchRes.json();
                    if (matchData.success && matchData.matches && matchData.matches.length > 0) {
                        hideLoading(submitBtn);
                        window.showInstantMatchModal(matchData.matches, matchData.targetItem);
                        return;
                    }
                } catch (e) {
                    console.error("Instant match check error:", e);
                }
            }

            setTimeout(() => {
                window.location.href = "success.html";
            }, 1800);

        } catch (error) {

            console.error(error);
            hideLoading(submitBtn);
            showAlert(error.message || "Something went wrong. Please try again.", "danger");

        }
    });

});