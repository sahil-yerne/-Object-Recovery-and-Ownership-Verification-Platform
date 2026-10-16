// ================= SMART SEARCH & MAP INTEGRATION LOGIC =================

document.addEventListener("DOMContentLoaded", function() {

    const form = document.getElementById("searchForm");
    if (!form) return;

    // State Variables
    let userLat = null;
    let userLng = null;
    let leafletMap = null;
    let mapMarkers = [];
    let radiusCircle = null;
    let searchCenterMarker = null;
    let currentViewMode = "grid"; // "grid", "map", "split"
    let currentFetchedItems = [];

    // URL Parameters
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get("q") || "";
    const itemNameParam = params.get("itemName") || "";
    const categoryParam = params.get("category") || "";
    const brandParam = params.get("brand") || "";
    const colorParam = params.get("color") || "";
    const statusParam = params.get("type") || params.get("status") || "";
    const locationParam = params.get("location") || "";
    const dateParam = params.get("date") || "";
    const sortParam = params.get("sort") || "latest";

    // Populate initial inputs from URL
    if (document.getElementById("keyword")) document.getElementById("keyword").value = qParam;
    if (document.getElementById("itemNameInput")) document.getElementById("itemNameInput").value = itemNameParam;
    if (document.getElementById("category")) document.getElementById("category").value = categoryParam;
    if (document.getElementById("brandInput")) document.getElementById("brandInput").value = brandParam;
    if (document.getElementById("colorInput")) document.getElementById("colorInput").value = colorParam;
    if (document.getElementById("status")) document.getElementById("status").value = statusParam;
    if (document.getElementById("location")) document.getElementById("location").value = locationParam;
    if (document.getElementById("date")) document.getElementById("date").value = dateParam;
    if (document.getElementById("sort")) document.getElementById("sort").value = sortParam;

    // Radius Slider Listener
    const radiusInput = document.getElementById("radiusInput");
    const radiusValLabel = document.getElementById("radiusVal");
    if (radiusInput && radiusValLabel) {
        radiusInput.addEventListener("input", (e) => {
            const val = e.target.value;
            radiusValLabel.textContent = `${val} km`;
            if (userLat && userLng && leafletMap) {
                updateRadiusCircle(userLat, userLng, val);
            }
        });
    }

    // ================= VOICE SEARCH (WEB SPEECH API) =================
    const voiceSearchBtn = document.getElementById("voiceSearchBtn");
    const voiceStatus = document.getElementById("voiceStatus");
    const micIcon = document.getElementById("micIcon");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition && voiceSearchBtn) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        let isListening = false;

        voiceSearchBtn.addEventListener("click", () => {
            if (isListening) {
                recognition.stop();
            } else {
                try {
                    recognition.start();
                } catch(e) {
                    console.error("Speech recognition error:", e);
                }
            }
        });

        recognition.onstart = () => {
            isListening = true;
            voiceSearchBtn.classList.add("listening");
            if (micIcon) micIcon.className = "bi bi-mic-mute-fill fs-5 text-white";
            if (voiceStatus) voiceStatus.classList.remove("d-none");
        };

        recognition.onend = () => {
            isListening = false;
            voiceSearchBtn.classList.remove("listening");
            if (micIcon) micIcon.className = "bi bi-mic-fill fs-5";
            if (voiceStatus) voiceStatus.classList.add("d-none");
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            console.log("Voice transcript:", transcript);
            const keywordInput = document.getElementById("keyword");
            if (keywordInput) {
                keywordInput.value = transcript;
            }
            triggerSearch();
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            isListening = false;
            voiceSearchBtn.classList.remove("listening");
            if (micIcon) micIcon.className = "bi bi-mic-fill fs-5";
            if (voiceStatus) voiceStatus.classList.add("d-none");
            if (typeof showAlert === 'function') {
                showAlert(`Voice Search Error: ${event.error}`, "warning");
            }
        };
    } else if (voiceSearchBtn) {
        voiceSearchBtn.addEventListener("click", () => {
            alert("Voice Search is not supported on this browser. Try Google Chrome or Edge.");
        });
    }

    // ================= GEOLOCATION ("USE MY LOCATION") =================
    const geolocateBtn = document.getElementById("geolocateBtn");
    if (geolocateBtn) {
        geolocateBtn.addEventListener("click", () => {
            if (!navigator.geolocation) {
                alert("Geolocation is not supported by your browser.");
                return;
            }

            geolocateBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
            geolocateBtn.disabled = true;

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userLat = pos.coords.latitude;
                    userLng = pos.coords.longitude;
                    geolocateBtn.innerHTML = `<i class="bi bi-geo-alt-fill text-success"></i>`;
                    geolocateBtn.disabled = false;

                    const locInput = document.getElementById("location");
                    if (locInput) {
                        locInput.value = `Near Me (${userLat.toFixed(3)}, ${userLng.toFixed(3)})`;
                    }

                    // Select distance sorting
                    const sortSelect = document.getElementById("sort");
                    if (sortSelect) sortSelect.value = "distance";

                    // Center map on user location
                    if (leafletMap) {
                        leafletMap.setView([userLat, userLng], 12);
                        updateRadiusCircle(userLat, userLng, radiusInput ? radiusInput.value : 15);
                    }

                    triggerSearch();
                },
                (err) => {
                    geolocateBtn.innerHTML = `<i class="bi bi-geo-alt-fill"></i>`;
                    geolocateBtn.disabled = false;
                    alert("Could not detect location. Please check browser permissions.");
                    console.error("Geolocation error:", err);
                }
            );
        });
    }

    // ================= VIEW TOGGLE BUTTONS =================
    const btnGridView = document.getElementById("btnGridView");
    const btnMapView = document.getElementById("btnMapView");
    const btnSplitView = document.getElementById("btnSplitView");
    const mapWrapper = document.getElementById("mapWrapper");
    const resultsContainer = document.getElementById("resultsContainer");

    function setViewMode(mode) {
        currentViewMode = mode;

        btnGridView?.classList.remove("active");
        btnMapView?.classList.remove("active");
        btnSplitView?.classList.remove("active");
        document.body.classList.remove("split-map-active");

        if (mode === "grid") {
            btnGridView?.classList.add("active");
            mapWrapper?.classList.add("d-none");
            resultsContainer?.classList.remove("d-none");
        } else if (mode === "map") {
            btnMapView?.classList.add("active");
            mapWrapper?.classList.remove("d-none");
            resultsContainer?.classList.add("d-none");
            initOrRefreshMap();
        } else if (mode === "split") {
            btnSplitView?.classList.add("active");
            mapWrapper?.classList.remove("d-none");
            resultsContainer?.classList.remove("d-none");
            document.body.classList.add("split-map-active");
            initOrRefreshMap();
        }
    }

    btnGridView?.addEventListener("click", () => setViewMode("grid"));
    btnMapView?.addEventListener("click", () => setViewMode("map"));
    btnSplitView?.addEventListener("click", () => setViewMode("split"));

    // ================= FORM SUBMISSION & RESET =================
    form.addEventListener("submit", function(e) {
        e.preventDefault();
        triggerSearch();
    });

    const resetBtn = document.getElementById("resetBtn");
    if (resetBtn) {
        resetBtn.addEventListener("click", function() {
            form.reset();
            userLat = null;
            userLng = null;
            if (radiusValLabel) radiusValLabel.textContent = "15 km";
            window.history.pushState({}, "", "search.html");
            if (searchCenterMarker && leafletMap) {
                leafletMap.removeLayer(searchCenterMarker);
                searchCenterMarker = null;
            }
            if (radiusCircle && leafletMap) {
                leafletMap.removeLayer(radiusCircle);
                radiusCircle = null;
            }
            triggerSearch();
        });
    }

    // Toggle Text vs Lens Search Tabs
    const textMode = document.getElementById("textMode");
    const imageMode = document.getElementById("imageMode");
    const textSearchContainer = document.getElementById("text-search");
    const imageSearchContainer = document.getElementById("image-search");

    if (textMode && imageMode) {
        textMode.addEventListener("change", () => {
            if (textMode.checked) {
                textSearchContainer.classList.remove("d-none");
                textSearchContainer.classList.add("show", "active");
                imageSearchContainer.classList.add("d-none");
                imageSearchContainer.classList.remove("show", "active");
            }
        });
        imageMode.addEventListener("change", () => {
            if (imageMode.checked) {
                imageSearchContainer.classList.remove("d-none");
                imageSearchContainer.classList.add("show", "active");
                textSearchContainer.classList.add("d-none");
                textSearchContainer.classList.remove("show", "active");
            }
        });
    }

    let currentPage = parseInt(params.get("page")) || 1;
    const itemsPerPage = 6;

    // Trigger search initially
    triggerSearch(currentPage);

    // ================= TRIGGER SEARCH API FUNCTION =================
    async function triggerSearch(page = 1) {
        currentPage = page;
        const searchBtn = form.querySelector("button[type='submit']");
        try {
            const keyword = document.getElementById("keyword")?.value.trim() || "";
            const itemName = document.getElementById("itemNameInput")?.value.trim() || "";
            let category = document.getElementById("category")?.value || "";
            if (category === "Other") {
                const otherVal = document.getElementById("otherCategoryInput")?.value.trim();
                if (otherVal) category = otherVal;
            }
            const brand = document.getElementById("brandInput")?.value.trim() || "";
            const color = document.getElementById("colorInput")?.value.trim() || "";
            const location = document.getElementById("location")?.value.trim() || "";
            const date = document.getElementById("date")?.value || "";
            const status = document.getElementById("status")?.value || "";
            const sort = document.getElementById("sort")?.value || "latest";
            const radius = radiusInput ? radiusInput.value : 15;

            const queryParams = new URLSearchParams();
            if (keyword) queryParams.set("q", keyword);
            if (itemName) queryParams.set("itemName", itemName);
            if (category) queryParams.set("category", category);
            if (brand) queryParams.set("brand", brand);
            if (color) queryParams.set("color", color);
            if (location && !location.startsWith("Near Me") && !location.startsWith("Map Point")) queryParams.set("location", location);
            if (date) queryParams.set("date", date);
            if (status) queryParams.set("status", status);
            if (sort) queryParams.set("sort", sort);
            queryParams.set("page", currentPage);
            queryParams.set("limit", itemsPerPage);

            if (userLat !== null && userLng !== null) {
                queryParams.set("lat", userLat);
                queryParams.set("lng", userLng);
                queryParams.set("radius", radius);
            }

            // Update browser URL
            window.history.pushState({}, "", `search.html?${queryParams.toString()}`);

            // UI Elements reset
            const resultsContainer = document.getElementById("resultsContainer");
            const loadingSpinner = document.getElementById("loadingSpinner");
            const noResults = document.getElementById("noResults");
            const resultCount = document.getElementById("resultCount");
            const activeFilterBadge = document.getElementById("activeFilterBadge");
            const paginationUl = document.getElementById("pagination");

            if (resultsContainer) resultsContainer.innerHTML = "";
            if (paginationUl) paginationUl.innerHTML = "";
            noResults?.classList.add("d-none");
            loadingSpinner?.classList.remove("d-none");

            if (typeof showLoading === 'function') showLoading(searchBtn);

            // API fetch
            const response = await api.searchItems(`?${queryParams.toString()}`);
            loadingSpinner?.classList.add("d-none");

            currentFetchedItems = response.data || [];
            const paginationInfo = response.pagination || { total: currentFetchedItems.length, page: 1, totalPages: 1 };

            // Display Active Filter Subtitle
            let filterBadges = [];
            if (keyword) filterBadges.push(`Keyword: "${keyword}"`);
            if (itemName) filterBadges.push(`Name: "${itemName}"`);
            if (category) filterBadges.push(`Category: ${category}`);
            if (brand) filterBadges.push(`Brand: ${brand}`);
            if (color) filterBadges.push(`Color: ${color}`);
            if (status) filterBadges.push(`Status: ${status}`);
            if (userLat) filterBadges.push(`Radius: ${radius} km`);

            if (activeFilterBadge) {
                activeFilterBadge.textContent = filterBadges.length > 0 ? `Filters: ${filterBadges.join(" | ")}` : "";
            }

            if (currentFetchedItems.length === 0) {
                noResults?.classList.remove("d-none");
                if (resultCount) resultCount.innerText = "0 Items Found";
                renderMapMarkers([]);
                renderNearbyRecommendations([]);
                return;
            }

            if (resultCount) {
                resultCount.innerText = `${paginationInfo.total || currentFetchedItems.length} Items Found (Page ${paginationInfo.page || 1} of ${paginationInfo.totalPages || 1})`;
            }

            // Render Cards
            renderGridCards(currentFetchedItems);

            // Render Pagination
            renderPagination(paginationInfo);

            // Update Leaflet Map Markers
            renderMapMarkers(currentFetchedItems);

            // Render Recommendations
            renderNearbyRecommendations(currentFetchedItems);

        } catch(err) {
            console.error(err);
            if (typeof showAlert === 'function') {
                showAlert(err.message || "Search failed", "danger");
            }
        } finally {
            if (typeof hideLoading === 'function') {
                hideLoading(searchBtn, "Search Items");
            }
        }
    }

    // ================= RENDER PAGINATION =================
    function renderPagination(pagination) {
        const paginationUl = document.getElementById("pagination");
        if (!paginationUl || !pagination || pagination.totalPages <= 1) return;

        paginationUl.innerHTML = "";

        // Prev Button
        const prevLi = document.createElement("li");
        prevLi.className = `page-item ${pagination.page <= 1 ? "disabled" : ""}`;
        prevLi.innerHTML = `<a class="page-link" href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span> Prev</a>`;
        if (pagination.page > 1) {
            prevLi.querySelector("a").addEventListener("click", (e) => {
                e.preventDefault();
                triggerSearch(pagination.page - 1);
                window.scrollTo({ top: document.getElementById("resultsContainer").offsetTop - 100, behavior: 'smooth' });
            });
        }
        paginationUl.appendChild(prevLi);

        // Numeric Page Buttons
        for (let p = 1; p <= pagination.totalPages; p++) {
            const pageLi = document.createElement("li");
            pageLi.className = `page-item ${p === pagination.page ? "active" : ""}`;
            pageLi.innerHTML = `<a class="page-link" href="#">${p}</a>`;
            if (p !== pagination.page) {
                const targetPage = p;
                pageLi.querySelector("a").addEventListener("click", (e) => {
                    e.preventDefault();
                    triggerSearch(targetPage);
                    window.scrollTo({ top: document.getElementById("resultsContainer").offsetTop - 100, behavior: 'smooth' });
                });
            }
            paginationUl.appendChild(pageLi);
        }

        // Next Button
        const nextLi = document.createElement("li");
        nextLi.className = `page-item ${pagination.page >= pagination.totalPages ? "disabled" : ""}`;
        nextLi.innerHTML = `<a class="page-link" href="#" aria-label="Next">Next <span aria-hidden="true">&raquo;</span></a>`;
        if (pagination.page < pagination.totalPages) {
            nextLi.querySelector("a").addEventListener("click", (e) => {
                e.preventDefault();
                triggerSearch(pagination.page + 1);
                window.scrollTo({ top: document.getElementById("resultsContainer").offsetTop - 100, behavior: 'smooth' });
            });
        }
        paginationUl.appendChild(nextLi);
    }

    // ================= RENDER GRID CARDS =================
    function renderGridCards(items) {
        const container = document.getElementById("resultsContainer");
        if (!container) return;
        container.innerHTML = "";

        items.forEach(item => {
            const cardCol = document.createElement("div");
            cardCol.className = "col-lg-4 col-md-6 mb-4";

            const dateStr = window.helpers ? window.helpers.formatDate(item.date) : item.date;
            const badgeClass = item.status === 'lost' ? 'bg-danger' : 'bg-success';
            const badgeText = item.status === 'lost' ? 'LOST' : 'FOUND';

            let distanceBadge = '';
            if (item.distance !== undefined && item.distance !== null) {
                distanceBadge = `<span class="badge bg-info text-dark mb-2 ms-1"><i class="bi bi-geo-alt"></i> ${item.distance} km away</span>`;
            }

            let fuzzyBadge = '';
            if (item.fuzzyScore && item.fuzzyScore > 0) {
                fuzzyBadge = `<span class="badge bg-dark text-info border border-info mb-2 ms-1"><i class="bi bi-magic"></i> Smart Match</span>`;
            }

            cardCol.innerHTML = `
                <div class="card shadow-sm h-100 position-relative">
                    <div class="position-relative">
                        <img src="${getItemImage(item)}"
                             class="card-img-top"
                             alt="${item.itemName}"
                             style="height: 200px; object-fit: cover;"
                             onerror="this.src='https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=400&q=80'">
                        <span class="badge ${badgeClass} position-absolute top-0 end-0 m-3 px-3 py-2 text-uppercase fw-bold shadow">
                            ${badgeText}
                        </span>
                    </div>

                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title fw-bold mb-2">${item.itemName}</h5>

                        <div class="mb-2">
                            ${item.brand ? `<span class="badge bg-secondary me-1"><i class="bi bi-tag-fill"></i> ${item.brand}</span>` : ''}
                            ${item.color ? `<span class="badge bg-dark text-light border border-secondary me-1"><i class="bi bi-palette-fill"></i> ${item.color}</span>` : ''}
                        </div>

                        <p class="card-text text-muted mb-1 small">
                            <i class="bi bi-geo-alt-fill text-primary"></i> ${item.location || "Unknown location"}
                        </p>
                        
                        <p class="card-text text-muted small mb-3">
                            <i class="bi bi-calendar-event-fill text-success"></i> ${dateStr}
                        </p>

                        <div class="mt-auto">
                            <span class="badge bg-primary mb-2 text-capitalize">
                                ${item.category}
                            </span>
                            ${distanceBadge}
                            ${fuzzyBadge}

                            <a href="item-details.html?id=${item.id}"
                               class="btn btn-sm btn-outline-primary mt-2 w-100">
                                View Details <i class="bi bi-arrow-right"></i>
                            </a>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(cardCol);
        });
    }

    // ================= LEAFLET MAP INTEGRATION =================
    function initOrRefreshMap() {
        if (typeof L === 'undefined') {
            console.warn("Leaflet library not loaded");
            return;
        }

        if (!leafletMap) {
            const mapContainer = document.getElementById("map");
            if (!mapContainer) return;

            // Default center: Chandigarh / North India default
            const defaultLat = userLat || 30.7398;
            const defaultLng = userLng || 76.7827;

            leafletMap = L.map('map').setView([defaultLat, defaultLng], 12);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }).addTo(leafletMap);

            // On map click: update radius search center
            leafletMap.on('click', function(e) {
                userLat = e.latlng.lat;
                userLng = e.latlng.lng;

                const radius = radiusInput ? radiusInput.value : 15;
                updateRadiusCircle(userLat, userLng, radius);

                const locInput = document.getElementById("location");
                if (locInput) {
                    locInput.value = `Map Point (${userLat.toFixed(3)}, ${userLng.toFixed(3)})`;
                }

                // Switch sort to distance
                const sortSelect = document.getElementById("sort");
                if (sortSelect) sortSelect.value = "distance";

                triggerSearch();
            });
        }

        setTimeout(() => {
            leafletMap.invalidateSize();
        }, 200);

        if (currentFetchedItems.length > 0) {
            renderMapMarkers(currentFetchedItems);
        }
    }

    function updateRadiusCircle(lat, lng, radiusKm) {
        if (!leafletMap || typeof L === 'undefined') return;

        if (radiusCircle) {
            leafletMap.removeLayer(radiusCircle);
        }

        if (searchCenterMarker) {
            leafletMap.removeLayer(searchCenterMarker);
        }

        // Draw search center marker
        searchCenterMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'custom-center-pin',
                html: `<div style="background:#00f3ff; width:16px; height:16px; border-radius:50%; border:3px solid #000; box-shadow:0 0 15px #00f3ff;"></div>`,
                iconSize: [16, 16]
            })
        }).addTo(leafletMap).bindPopup("<b>Search Center</b>");

        // Draw radius circle
        radiusCircle = L.circle([lat, lng], {
            color: '#00f3ff',
            fillColor: '#00f3ff',
            fillOpacity: 0.15,
            radius: radiusKm * 1000
        }).addTo(leafletMap);
    }

    function renderMapMarkers(items) {
        if (!leafletMap || typeof L === 'undefined') return;

        // Clear existing markers
        mapMarkers.forEach(m => leafletMap.removeLayer(m));
        mapMarkers = [];

        const bounds = [];

        items.forEach(item => {
            if (item.latitude && item.longitude) {
                const lat = parseFloat(item.latitude);
                const lng = parseFloat(item.longitude);

                if (isNaN(lat) || isNaN(lng)) return;

                bounds.push([lat, lng]);

                const markerColor = item.status === 'lost' ? '#ff003c' : '#10b981';
                const markerIcon = L.divIcon({
                    className: 'custom-map-marker',
                    html: `<div style="background-color: ${markerColor}; color: white; padding: 6px 10px; border-radius: 4px; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                            ${item.status === 'lost' ? '🔴 LOST' : '🟢 FOUND'}
                           </div>`,
                    iconSize: [60, 30],
                    iconAnchor: [30, 15]
                });

                const popupHtml = `
                    <div class="map-popup-card" style="width: 220px;">
                        <img src="${getItemImage(item)}" 
                             style="width:100%; height:110px; object-fit:cover; border-radius:4px;"
                             onerror="this.src='https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=400&q=80'">
                        <h6 class="mt-2 mb-1 text-truncate">${item.itemName}</h6>
                        <span class="badge ${item.status === 'lost' ? 'bg-danger' : 'bg-success'} text-uppercase mb-2">${item.status}</span>
                        <p class="mb-1 text-muted small"><i class="bi bi-geo-alt-fill text-primary"></i> ${item.location}</p>
                        <p class="mb-2 text-muted small"><i class="bi bi-calendar-event"></i> ${item.date}</p>
                        ${item.distance ? `<p class="mb-2 text-info small fw-bold"><i class="bi bi-radar"></i> ${item.distance} km away</p>` : ''}
                        <a href="item-details.html?id=${item.id}" class="btn btn-sm btn-primary w-100">View Details</a>
                    </div>
                `;

                const marker = L.marker([lat, lng], { icon: markerIcon })
                    .addTo(leafletMap)
                    .bindPopup(popupHtml);

                mapMarkers.push(marker);
            }
        });

        if (bounds.length > 0 && !userLat) {
            leafletMap.fitBounds(bounds, { padding: [40, 40] });
        }
    }

    // ================= NEARBY LOST & FOUND RECOMMENDATIONS =================
    function renderNearbyRecommendations(items) {
        const nearbySection = document.getElementById("nearbySection");
        const nearbyContainer = document.getElementById("nearbyContainer");
        const nearbySubtext = document.getElementById("nearbySubtext");

        if (!nearbySection || !nearbyContainer) return;

        // Pick top items sort by proximity or distance or latest
        let recommendedItems = [...items];

        if (userLat && userLng) {
            recommendedItems.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
            if (nearbySubtext) nearbySubtext.textContent = `Showing items closest to your location`;
        } else {
            if (nearbySubtext) nearbySubtext.textContent = `Recent lost and found items in nearby regions`;
        }

        // Take top 4 recommendations
        recommendedItems = recommendedItems.slice(0, 4);

        if (recommendedItems.length === 0) {
            nearbySection.classList.add("d-none");
            return;
        }

        nearbySection.classList.remove("d-none");
        nearbyContainer.innerHTML = "";

        recommendedItems.forEach(item => {
            const col = document.createElement("div");
            col.className = "col-lg-3 col-md-6 mb-3";

            const badgeClass = item.status === 'lost' ? 'bg-danger' : 'bg-success';

            col.innerHTML = `
                <div class="card recommend-card h-100 p-3 shadow-sm">
                    <div class="d-flex align-items-center mb-2">
                        <span class="badge ${badgeClass} me-2 text-uppercase">${item.status}</span>
                        <span class="badge bg-secondary text-truncate">${item.category}</span>
                    </div>
                    <h6 class="fw-bold text-light text-truncate mb-2">${item.itemName}</h6>
                    <p class="text-muted small mb-1"><i class="bi bi-geo-alt text-info"></i> ${item.location}</p>
                    ${item.distance ? `<p class="text-info small fw-bold mb-2"><i class="bi bi-radar"></i> ${item.distance} km away</p>` : ''}
                    <a href="item-details.html?id=${item.id}" class="btn btn-sm btn-outline-info mt-auto">View Item</a>
                </div>
            `;
            nearbyContainer.appendChild(col);
        });
    }

    // ================= LENS IMAGE SEARCH LOGIC =================
    const imageInput = document.getElementById("imageInput");
    const cameraBtn = document.getElementById("cameraBtn");
    const cameraContainer = document.getElementById("cameraContainer");
    const videoElement = document.getElementById("videoElement");
    const captureBtn = document.getElementById("captureBtn");
    const closeCameraBtn = document.getElementById("closeCameraBtn");
    
    const previewContainer = document.getElementById("previewContainer");
    const imagePreview = document.getElementById("imagePreview");
    const searchImageBtn = document.getElementById("searchImageBtn");

    let stream = null;
    let selectedFile = null;

    if (imageInput && cameraBtn) {
        imageInput.addEventListener("change", function(e) {
            if(e.target.files && e.target.files[0]) {
                selectedFile = e.target.files[0];
                const reader = new FileReader();
                reader.onload = function(e) {
                    imagePreview.src = e.target.result;
                    previewContainer.classList.remove("d-none");
                    cameraContainer.classList.add("d-none");
                    stopCamera();
                }
                reader.readAsDataURL(selectedFile);
            }
        });

        cameraBtn.addEventListener("click", async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                videoElement.srcObject = stream;
                cameraContainer.classList.remove("d-none");
                previewContainer.classList.add("d-none");
            } catch(err) {
                alert("Camera access denied or unavailable.");
                console.error(err);
            }
        });

        closeCameraBtn.addEventListener("click", () => {
            stopCamera();
            cameraContainer.classList.add("d-none");
        });

        captureBtn.addEventListener("click", () => {
            if(!stream) return;
            const canvas = document.createElement("canvas");
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            canvas.getContext("2d").drawImage(videoElement, 0, 0);
            
            canvas.toBlob((blob) => {
                selectedFile = new File([blob], "capture.jpg", { type: "image/jpeg" });
                imagePreview.src = URL.createObjectURL(blob);
                previewContainer.classList.remove("d-none");
                cameraContainer.classList.add("d-none");
                stopCamera();
            }, "image/jpeg", 0.9);
        });

        function stopCamera() {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
        }

        searchImageBtn.addEventListener("click", async () => {
            if(!selectedFile) return;

            const resultsContainer = document.getElementById("resultsContainer");
            const loadingSpinner = document.getElementById("loadingSpinner");
            const noResults = document.getElementById("noResults");
            const resultCount = document.getElementById("resultCount");

            if (resultsContainer) resultsContainer.innerHTML = "";
            noResults?.classList.add("d-none");
            loadingSpinner?.classList.remove("d-none");
            if (resultCount) resultCount.textContent = "Searching by AI Image Match...";

            const formData = new FormData();
            formData.append("image", selectedFile);

            try {
                const response = await fetch("/api/match", {
                    method: "POST",
                    body: formData
                });
                const resData = await response.json();

                loadingSpinner?.classList.add("d-none");

                if (resData.success && resData.data.length > 0) {
                    if (resultCount) resultCount.textContent = `${resData.data.length} Matches Found`;
                    renderGridCards(resData.data.map(m => m.item));
                } else {
                    if (resultCount) resultCount.textContent = "0 Items Found";
                    noResults?.classList.remove("d-none");
                }
            } catch(err) {
                loadingSpinner?.classList.add("d-none");
                alert("Error connecting to AI search service.");
                console.error(err);
            }
        });
    }

});