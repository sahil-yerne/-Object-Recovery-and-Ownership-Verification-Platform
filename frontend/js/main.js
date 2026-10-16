// ================= GLOBAL INITIALIZATION =================

document.addEventListener("DOMContentLoaded", function() {

    console.log("Lost & Found Portal Loaded 🚀");

    initThemeSwitcher();

    highlightActiveNav();

    initImagePreview();

    // Homepage logic
    if (document.getElementById("latestLostItems") || document.getElementById("latestFoundItems")) {
        initHomepage();
    }

    // Contact page logic
    if (document.getElementById("contactForm")) {
        initContactPage();
    }

    // Quick Search redirect handler
    initQuickSearch();

    // Global category "Other" handling
    const categorySelect = document.getElementById("category");
    const otherCategoryInput = document.getElementById("otherCategoryInput");
    if (categorySelect && otherCategoryInput) {
        categorySelect.addEventListener("change", function() {
            if (this.value === "Other") {
                otherCategoryInput.classList.remove("d-none");
                otherCategoryInput.required = true;
                otherCategoryInput.focus();
            } else {
                otherCategoryInput.classList.add("d-none");
                otherCategoryInput.value = "";
                otherCategoryInput.required = false;
            }
        });
    }
});

// ================= THEME SWITCHER =================

function initThemeSwitcher() {
    const savedTheme = localStorage.getItem("portal_theme") || "dark";
    applyTheme(savedTheme);

    const themeButtons = document.querySelectorAll("[data-theme-value]");
    themeButtons.forEach(btn => {
        btn.addEventListener("click", function(e) {
            e.preventDefault();
            const theme = this.getAttribute("data-theme-value");
            localStorage.setItem("portal_theme", theme);
            applyTheme(theme);
        });
    });
}

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (document.body) {
        document.body.setAttribute("data-theme", theme);
    }

    const themeLabel = document.getElementById("themeLabel");
    const themeIcon = document.getElementById("themeIcon");
    const themeButtons = document.querySelectorAll("[data-theme-value]");

    themeButtons.forEach(btn => {
        if (btn.getAttribute("data-theme-value") === theme) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    if (themeLabel && themeIcon) {
        if (theme === "basic") {
            themeLabel.textContent = "Basic";
            themeIcon.className = "bi bi-brightness-high-fill text-warning";
        } else if (theme === "midnight") {
            themeLabel.textContent = "Midnight";
            themeIcon.className = "bi bi-star-fill text-warning";
        } else {
            themeLabel.textContent = "Dark";
            themeIcon.className = "bi bi-moon-stars-fill text-info";
        }
    }
}

// Immediate theme setting to prevent UI flash
(function() {
    const savedTheme = localStorage.getItem("portal_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
})();

// ================= ACTIVE NAV LINK =================

function highlightActiveNav() {

    const currentPage = window.location.pathname.split("/").pop();

    const navLinks = document.querySelectorAll(".nav-link");

    navLinks.forEach(link => {

        const linkPage = link.getAttribute("href");

        if (linkPage === currentPage) {
            link.classList.add("active");
        }

    });

}

// ================= IMAGE PREVIEW (COMMON FUNCTION) =================

function initImagePreview() {

    const imageInputs = document.querySelectorAll('input[type="file"]');

    imageInputs.forEach(input => {

        input.addEventListener("change", function(event) {

            const file = event.target.files[0];

            if (file) {

                const reader = new FileReader();

                reader.onload = function(e) {

                    // find nearest preview image
                    const preview = event.target.closest("form").querySelector("#imagePreview");

                    if (preview) {
                        preview.src = e.target.result;
                    }

                };

                reader.readAsDataURL(file);
            }

        });

    });

}

// ================= LOADING UI HELPERS =================

function showLoading(button) {

    if (!button) return;

    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `
        <span class="spinner-border spinner-border-sm"></span>
        Processing...
    `;

}

function hideLoading(button, text = "Submit") {

    if (!button) return;

    button.disabled = false;
    button.innerHTML = button.dataset.originalText || text;

}

// ================= ALERT MESSAGE =================

function showAlert(message, type = "success") {

    const alertBox = document.createElement("div");

    alertBox.className = `alert alert-${type} position-fixed top-0 end-0 m-3 shadow`;
    alertBox.style.zIndex = "9999";
    alertBox.innerText = message;

    document.body.appendChild(alertBox);

    setTimeout(() => {
        alertBox.remove();
    }, 3000);

}

// ================= HOMEPAGE FUNCTIONS =================

async function initHomepage() {
    try {
        const response = await api.searchItems();
        const items = response.data || [];

        // Render latest lost items (first 3)
        const lostContainer = document.getElementById("latestLostItems");
        if (lostContainer) {
            const lostItems = items.filter(item => item.status === "lost").slice(0, 3);
            renderHomeItems(lostItems, lostContainer, "lost");
        }

        // Render latest found items (first 3)
        const foundContainer = document.getElementById("latestFoundItems");
        if (foundContainer) {
            const foundItems = items.filter(item => item.status === "found").slice(0, 3);
            renderHomeItems(foundItems, foundContainer, "found");
        }

        // Calculate and render statistics
        const totalLost = items.filter(item => item.status === "lost").length;
        const totalFound = items.filter(item => item.status === "found").length;
        const totalReports = items.length;
        const totalReturned = items.filter(item => item.status === "returned" || item.status === "resolved" || item.status === "claimed").length;

        if (document.getElementById("totalLost")) document.getElementById("totalLost").innerText = totalLost;
        if (document.getElementById("totalFound")) document.getElementById("totalFound").innerText = totalFound;
        if (document.getElementById("returnedItems")) document.getElementById("returnedItems").innerText = totalReturned;
        if (document.getElementById("activeUsers")) document.getElementById("activeUsers").innerText = totalReports;

    } catch (error) {
        console.error("Homepage Init Error:", error);
    }
}

function renderHomeItems(items, container, type) {
    container.innerHTML = "";
    if (items.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center text-muted py-4">
                <i class="bi bi-info-circle fs-3 text-secondary"></i>
                <p class="mt-2">No ${type} items reported recently.</p>
            </div>
        `;
        return;
    }

    items.forEach(item => {
        const col = document.createElement("div");
        col.className = "col-md-4 mb-4";

        const dateStr = window.helpers ? window.helpers.formatDate(item.date) : item.date;

        col.innerHTML = `
            <div class="card shadow-sm h-100 position-relative">
                <img src="${getItemImage(item)}" 
                     class="card-img-top" 
                     alt="item image"
                     style="height: 200px; object-fit: cover;">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title fw-bold">${item.itemName}</h5>
                    <p class="card-text text-muted mb-1">
                        <i class="bi bi-geo-alt-fill text-primary"></i> ${item.location || "Unknown"}
                    </p>
                    <p class="card-text text-muted small mb-3">
                        <i class="bi bi-calendar-event-fill text-success"></i> ${dateStr}
                    </p>
                    <div class="mt-auto">
                        <span class="badge ${type === 'lost' ? 'bg-danger' : 'bg-success'} mb-2 text-capitalize">
                            ${item.status}
                        </span>
                        <span class="badge bg-primary mb-2">${item.category}</span>
                        <br>
                        <a href="item-details.html?id=${item.id}" class="btn btn-sm btn-outline-primary mt-2 w-100">
                            View Details
                        </a>
                    </div>
                    <a href="item-details.html?id=${item.id}" class="stretched-link"></a>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}

// ================= QUICK SEARCH FUNCTION =================

function initQuickSearch() {
    const searchForm = document.getElementById("searchForm");
    if (!searchForm || window.location.pathname.includes("search.html")) return;

    searchForm.addEventListener("submit", function(e) {
        e.preventDefault();

        const keyword = document.getElementById("keyword") ? document.getElementById("keyword").value.trim() : "";
        const category = document.getElementById("category") ? document.getElementById("category").value : "";
        const type = document.getElementById("type") ? document.getElementById("type").value : "";

        // Build query params and redirect to search.html
        const params = new URLSearchParams();
        if (keyword) params.set("q", keyword);
        if (category) params.set("category", category);
        if (type) params.set("type", type);

        window.location.href = `search.html?${params.toString()}`;
    });
}

// ================= CONTACT FORM FUNCTIONS =================

function initContactPage() {
    const contactForm = document.getElementById("contactForm");
    if (!contactForm) return;

    contactForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        const submitBtn = contactForm.querySelector("button[type='submit']");
        try {
            const name = document.getElementById("name").value.trim();
            const email = document.getElementById("email").value.trim();
            const message = document.getElementById("message").value.trim();

            if (!name || !email || !message) {
                showAlert("Please fill in all required fields", "danger");
                return;
            }

            showLoading(submitBtn);

            const response = await api.submitContactMessage({ name, email, message });
            console.log("Contact response:", response);

            showAlert("Your message has been sent successfully!", "success");
            contactForm.reset();

        } catch (error) {
            console.error("Contact Form submit failed:", error);
            showAlert(error.message || "Failed to send message. Please try again.", "danger");
        } finally {
            hideLoading(submitBtn, "Send Message");
        }
    });
}

// ================= PWA SERVICE WORKER REGISTRATION =================

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/service-worker.js")
            .then(reg => console.log("[PWA] Service Worker registered with scope:", reg.scope))
            .catch(err => console.warn("[PWA] Service Worker registration failed:", err));
    });
}