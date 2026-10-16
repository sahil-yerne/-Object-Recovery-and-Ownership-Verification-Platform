// ================= AUTH.JS =================
// Handles Signup, Login forms, password toggle, strength meter, and auth state

(function () {

    const AUTH_BASE = window.location.origin + "/api/auth";

    // ================= HELPER: Show Alert =================
    function showAlert(type, message) {
        const alertBox = document.getElementById("alertBox");
        const alertMessage = document.getElementById("alertMessage");
        if (!alertBox || !alertMessage) return;

        alertBox.className = `alert alert-${type} alert-dismissible fade show`;
        alertBox.style.display = "block";
        alertMessage.textContent = message;

        // Auto hide after 5 seconds
        setTimeout(() => {
            alertBox.style.display = "none";
        }, 5000);
    }

    // ================= PASSWORD TOGGLE =================
    function setupPasswordToggle(toggleId, inputId) {
        if (toggleId && inputId) {
            const toggle = document.getElementById(toggleId);
            const input = document.getElementById(inputId);
            if (toggle && input) {
                toggle.addEventListener("click", () => {
                    if (input.type === "password") {
                        input.type = "text";
                        toggle.classList.remove("bi-eye-slash-fill");
                        toggle.classList.add("bi-eye-fill");
                    } else {
                        input.type = "password";
                        toggle.classList.remove("bi-eye-fill");
                        toggle.classList.add("bi-eye-slash-fill");
                    }
                });
            }
        }

        // Also bind all class-based toggles dynamically
        document.querySelectorAll(".password-toggle").forEach(toggle => {
            if (!toggle.dataset.bound) {
                toggle.dataset.bound = "true";
                toggle.addEventListener("click", function (e) {
                    e.preventDefault();
                    const container = this.closest(".position-relative") || this.parentElement;
                    const input = container.querySelector("input");
                    if (!input) return;

                    if (input.type === "password") {
                        input.type = "text";
                        this.classList.remove("bi-eye-slash-fill");
                        this.classList.add("bi-eye-fill");
                    } else {
                        input.type = "password";
                        this.classList.remove("bi-eye-fill");
                        this.classList.add("bi-eye-slash-fill");
                    }
                });
            }
        });
    }

    // ================= PASSWORD STRENGTH METER =================
    function setupPasswordStrength() {
        const passwordInput = document.getElementById("password");
        const strengthBar = document.getElementById("strengthBar");
        const strengthText = document.getElementById("strengthText");
        if (!passwordInput || !strengthBar || !strengthText) return;

        passwordInput.addEventListener("input", () => {
            const val = passwordInput.value;
            let score = 0;

            if (val.length >= 6) score++;
            if (val.length >= 10) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            const levels = [
                { width: "0%", color: "transparent", text: "" },
                { width: "20%", color: "#ef4444", text: "Very Weak" },
                { width: "40%", color: "#f59e0b", text: "Weak" },
                { width: "60%", color: "#eab308", text: "Fair" },
                { width: "80%", color: "#22c55e", text: "Strong" },
                { width: "100%", color: "#10b981", text: "Very Strong 💪" }
            ];

            const level = levels[score] || levels[0];
            strengthBar.style.width = level.width;
            strengthBar.style.backgroundColor = level.color;
            strengthText.textContent = val.length > 0 ? level.text : "";
        });
    }

    // ================= SIGNUP FORM =================
    const signupForm = document.getElementById("signupForm");
    if (signupForm) {
        setupPasswordToggle("toggleSignupPassword", "signup_password");
        setupPasswordToggle("togglePassword", "password");
        setupPasswordToggle("toggleSignupConfirmPassword", "signup_confirmPassword");
        setupPasswordToggle("toggleConfirmPassword", "confirmPassword");
        setupPasswordStrength();

        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const nameEl = document.getElementById("signup_name") || document.getElementById("name");
            const emailEl = document.getElementById("signup_email") || document.getElementById("email");
            const phoneEl = document.getElementById("signup_phone") || document.getElementById("phone");
            const passEl = document.getElementById("signup_password") || document.getElementById("password");
            const confirmPassEl = document.getElementById("signup_confirmPassword") || document.getElementById("confirmPassword");
            const submitBtn = document.getElementById("signupSubmitBtn") || document.getElementById("submitBtn");

            const name = nameEl.value.trim();
            const email = emailEl.value.trim();
            const phone = phoneEl.value.trim();
            const password = passEl.value;
            const confirmPassword = confirmPassEl.value;

            // Validations
            if (!name || !email || !password) {
                return showAlert("danger", "Please fill in all required fields.");
            }

            if (password.length < 6) {
                return showAlert("danger", "Password must be at least 6 characters.");
            }

            if (password !== confirmPassword) {
                return showAlert("danger", "Passwords do not match!");
            }

            // Disable button
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Creating Account...';

            try {
                const response = await fetch(`${AUTH_BASE}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, phone, password })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || "Registration failed.");
                }

                showAlert("success", "🎉 Account created successfully! Please log in now.");

                // Reset form
                signupForm.reset();
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-person-plus-fill me-1"></i> Create Account';

                // Switch to Login tab if bootstrap tab exists
                const loginTabEl = document.getElementById('login-tab');
                if (loginTabEl && typeof bootstrap !== 'undefined') {
                    const loginTab = new bootstrap.Tab(loginTabEl);
                    loginTab.show();
                    // Pre-fill email in login
                    const loginEmailEl = document.getElementById("email");
                    if (loginEmailEl) loginEmailEl.value = email;
                }

            } catch (error) {
                showAlert("danger", error.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-person-plus-fill me-1"></i> Create Account';
            }
        });
    }

    // ================= LOGIN FORM =================
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        setupPasswordToggle("togglePassword", "password");

        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;
            const submitBtn = document.getElementById("submitBtn");

            // Validations
            if (!email || !password) {
                return showAlert("danger", "Please fill in all fields.");
            }

            // Disable button
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Logging in...';

            try {
                const response = await fetch(`${AUTH_BASE}/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || "Login failed.");
                }

                // Store token and user data
                localStorage.setItem("auth_token", result.token);
                localStorage.setItem("auth_user", JSON.stringify(result.user));

                showAlert("success", "✅ Login successful! Redirecting...");

                setTimeout(() => {
                    window.location.href = "index.html";
                }, 1500);

            } catch (error) {
                showAlert("danger", error.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i> Login';
            }
        });
    }

    // ================= AUTH STATE & NOTIFICATIONS (Navbar) =================
    // This runs on every page that includes auth.js
    async function updateNavbarForAuth() {
        const user = JSON.parse(localStorage.getItem("auth_user"));
        const token = localStorage.getItem("auth_token");

        // Find the navbar <ul>
        const navbarNav = document.querySelector(".navbar-nav");
        if (!navbarNav) return;

        // Check if auth buttons already exist
        if (document.getElementById("navAuthSection")) return;

        if (token && user) {
            // ===== NOTIFICATION BELL DROPDOWN =====
            const notifyLi = document.createElement("li");
            notifyLi.className = "nav-item dropdown ms-lg-2 my-1 my-lg-0";
            notifyLi.id = "navNotificationSection";
            notifyLi.innerHTML = `
                <button class="btn btn-sm btn-outline-info rounded-circle d-inline-flex align-items-center justify-content-center position-relative" style="width: 36px; height: 36px;" id="alertBellBtn" data-bs-toggle="dropdown" aria-expanded="false" title="Notifications & Alerts">
                    <i class="bi bi-bell-fill text-warning"></i>
                    <span id="unreadAlertBadge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger d-none" style="font-size:0.6rem;">0</span>
                </button>
                <div class="dropdown-menu dropdown-menu-end shadow-lg border-0 p-0" aria-labelledby="alertBellBtn" style="min-width: 320px; max-width: 380px; max-height: 400px; overflow-y: auto;">
                    <div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-dark text-light">
                        <span class="fw-bold small"><i class="bi bi-bell me-1 text-warning"></i> Notifications</span>
                        <button class="btn btn-link btn-sm text-info p-0 small text-decoration-none" id="markAllAlertsReadBtn">Mark all read</button>
                    </div>
                    <div id="alertsDropdownList" class="p-2">
                        <div class="text-center text-muted small py-3">Loading alerts...</div>
                    </div>
                </div>
            `;
            navbarNav.appendChild(notifyLi);

            // Fetch alerts
            loadAlertsDropdown(token);

            // ===== LOGGED IN: Show user profile dropdown =====
            const authLi = document.createElement("li");
            authLi.className = "nav-item dropdown ms-lg-2";
            authLi.id = "navAuthSection";
            authLi.innerHTML = `
                <a class="nav-link dropdown-toggle d-flex align-items-center gap-1" href="#" id="userDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="bi bi-person-circle"></i> 
                    <span class="fw-semibold">${user.name.split(' ')[0]}</span>
                </a>
                <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0" aria-labelledby="userDropdown">
                    <li>
                        <span class="dropdown-item-text small text-muted">
                            <i class="bi bi-envelope-fill me-1"></i> ${user.email}
                        </span>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                        <a class="dropdown-item fw-semibold text-primary" href="profile.html">
                            <i class="bi bi-speedometer2 me-1"></i> My Profile & Dashboard
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item fw-semibold text-warning" href="rewards.html">
                            <i class="bi bi-gift-fill me-1"></i> Rewards Store & Wallet
                        </a>
                    </li>
                    ${user.role === 'admin' ? `
                    <li>
                        <a class="dropdown-item fw-semibold text-warning" href="admin.html">
                            <i class="bi bi-cpu-fill me-1"></i> Admin Moderation Panel
                        </a>
                    </li>
                    ` : ''}
                    <li>
                        <span class="dropdown-item-text small">
                            <i class="bi bi-shield-fill-check me-1 text-success"></i> Trust Score: ${user.trustScore || 0}
                        </span>
                    </li>
                    <li>
                        <span class="dropdown-item-text small">
                            <i class="bi bi-person-badge-fill me-1 text-info"></i> Role: ${user.role}
                        </span>
                    </li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                        <button class="dropdown-item text-danger d-flex align-items-center gap-2" id="logoutBtn">
                            <i class="bi bi-box-arrow-right"></i> Logout
                        </button>
                    </li>
                </ul>
            `;

            navbarNav.appendChild(authLi);

            // Logout handler
            document.getElementById("logoutBtn").addEventListener("click", () => {
                localStorage.removeItem("auth_token");
                localStorage.removeItem("auth_user");
                window.location.href = "login.html";
            });
        } else {
            // ===== NOT LOGGED IN: Show single Login button in Navbar =====
            const authLi = document.createElement("li");
            authLi.className = "nav-item ms-lg-2 my-1 my-lg-0";
            authLi.id = "navAuthSection";
            authLi.innerHTML = `
                <a href="login.html" class="btn btn-sm btn-primary rounded-pill px-3 d-inline-flex align-items-center gap-1">
                    <i class="bi bi-box-arrow-in-right"></i> Login
                </a>
            `;

            navbarNav.appendChild(authLi);
        }
    }

    async function loadAlertsDropdown(token) {
        const listEl = document.getElementById("alertsDropdownList");
        const badgeEl = document.getElementById("unreadAlertBadge");
        if (!listEl) return;

        try {
            const res = await fetch("/api/alerts", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            const alerts = data.data || [];
            const unreadCount = data.unreadCount || alerts.filter(a => !a.isRead).length;

            if (badgeEl) {
                if (unreadCount > 0) {
                    badgeEl.innerText = unreadCount > 9 ? "9+" : unreadCount;
                    badgeEl.classList.remove("d-none");
                } else {
                    badgeEl.classList.add("d-none");
                }
            }

            if (alerts.length === 0) {
                listEl.innerHTML = `<div class="text-center text-muted small py-3"><i class="bi bi-check2-circle text-success me-1"></i> No new notifications</div>`;
                return;
            }

            listEl.innerHTML = alerts.slice(0, 8).map(alert => `
                <div class="p-2 mb-1 rounded ${alert.isRead ? 'bg-transparent opacity-75' : 'bg-dark border-start border-3 border-info'}" style="cursor: pointer;" onclick="markAlertRead(${alert.id})">
                    <div class="d-flex justify-content-between align-items-center">
                        <strong class="small text-light">${alert.title}</strong>
                        <small class="text-muted" style="font-size:0.65rem;">${new Date(alert.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                    <div class="small text-muted mt-1 text-truncate">${alert.message}</div>
                </div>
            `).join("");

            // Mark all read button
            document.getElementById("markAllAlertsReadBtn")?.addEventListener("click", async () => {
                for (const a of alerts.filter(x => !x.isRead)) {
                    await fetch(`/api/alerts/${a.id}/read`, {
                        method: "PUT",
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                }
                loadAlertsDropdown(token);
            });

        } catch (e) {
            listEl.innerHTML = `<div class="text-center text-muted small py-2">No alerts</div>`;
        }
    }

    window.markAlertRead = async function(alertId) {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        try {
            await fetch(`/api/alerts/${alertId}/read`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}` }
            });
            loadAlertsDropdown(token);
        } catch (e) {}
    };

    // Run on DOM load
    updateNavbarForAuth();

})();
