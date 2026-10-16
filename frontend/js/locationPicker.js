// ================= LOCATION PICKER (SHARED) =================
// Used by report-lost.html and report-found.html

(function () {
    "use strict";

    let pickerMap = null;
    let pickerMarker = null;
    let searchTimeout = null;
    let geocodeAbort = null;

    // ── Reverse-geocode using Nominatim (free, no key needed) ──
    async function reverseGeocode(lat, lng) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
            const res = await fetch(url, { headers: { "Accept-Language": "en" } });
            const data = await res.json();
            return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        } catch {
            return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
    }

    // ── Forward-geocode (search box) ──
    async function forwardGeocode(query) {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        return await res.json();
    }

    // ── Update the form fields ──
    async function applyLocation(lat, lng, customLabel) {
        const locationInput = document.getElementById("location");
        const latInput = document.getElementById("latitude");
        const lngInput = document.getElementById("longitude");
        const coordsDisplay = document.getElementById("coordsDisplay");

        const label = customLabel || await reverseGeocode(lat, lng);

        if (locationInput) locationInput.value = label;
        if (latInput) latInput.value = lat.toFixed(7);
        if (lngInput) lngInput.value = lng.toFixed(7);
        if (coordsDisplay) {
            coordsDisplay.textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            coordsDisplay.classList.remove("d-none");
        }
    }

    // ── Move marker smoothly ──
    function moveMarker(lat, lng) {
        if (!pickerMap || !pickerMarker) return;
        pickerMarker.setLatLng([lat, lng]);
        pickerMap.setView([lat, lng], Math.max(pickerMap.getZoom(), 15), { animate: true });
    }

    // ── Initialize the map ──
    function initLocationPicker() {
        const container = document.getElementById("locationPickerMap");
        if (!container || typeof L === "undefined") return;
        if (pickerMap) return; // already initialized

        // Dark tile layer (CartoDB Dark Matter)
        pickerMap = L.map("locationPickerMap", {
            center: [20.5937, 78.9629], // India center
            zoom: 5,
            zoomControl: true,
            attributionControl: false
        });

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
            maxZoom: 19
        }).addTo(pickerMap);

        // Custom neon marker icon
        const neonIcon = L.divIcon({
            className: "",
            html: `<div class="lp-pin-icon"><i class="bi bi-geo-alt-fill"></i></div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -36]
        });

        pickerMarker = L.marker([20.5937, 78.9629], {
            icon: neonIcon,
            draggable: true
        }).addTo(pickerMap);

        // Drag end → update fields
        pickerMarker.on("dragend", async function () {
            const pos = pickerMarker.getLatLng();
            const loadingEl = document.getElementById("locationLoadingBadge");
            if (loadingEl) loadingEl.classList.remove("d-none");
            await applyLocation(pos.lat, pos.lng);
            if (loadingEl) loadingEl.classList.add("d-none");
        });

        // Map click → move marker + update fields
        pickerMap.on("click", async function (e) {
            moveMarker(e.latlng.lat, e.latlng.lng);
            const loadingEl = document.getElementById("locationLoadingBadge");
            if (loadingEl) loadingEl.classList.remove("d-none");
            await applyLocation(e.latlng.lat, e.latlng.lng);
            if (loadingEl) loadingEl.classList.add("d-none");
        });

        // Fix map size on reveal (it's hidden initially)
        setTimeout(() => pickerMap.invalidateSize(), 300);

        // ── GPS button ──
        const gpsBtn = document.getElementById("gpsLocationBtn");
        if (gpsBtn) {
            gpsBtn.addEventListener("click", function () {
                if (!navigator.geolocation) {
                    showAlert("Geolocation is not supported by your browser.", "warning");
                    return;
                }
                gpsBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Locating...`;
                gpsBtn.disabled = true;

                navigator.geolocation.getCurrentPosition(
                    async function (pos) {
                        const lat = pos.coords.latitude;
                        const lng = pos.coords.longitude;
                        moveMarker(lat, lng);
                        await applyLocation(lat, lng);
                        gpsBtn.innerHTML = `<i class="bi bi-crosshair2 me-1"></i> Use My GPS`;
                        gpsBtn.disabled = false;
                    },
                    function (err) {
                        showAlert("Could not get location: " + err.message, "warning");
                        gpsBtn.innerHTML = `<i class="bi bi-crosshair2 me-1"></i> Use My GPS`;
                        gpsBtn.disabled = false;
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                );
            });
        }

        // ── Address search box ──
        const searchInput = document.getElementById("mapSearchInput");
        const searchResults = document.getElementById("mapSearchResults");

        if (searchInput && searchResults) {
            searchInput.addEventListener("input", function () {
                clearTimeout(searchTimeout);
                const q = searchInput.value.trim();
                if (q.length < 3) {
                    searchResults.innerHTML = "";
                    searchResults.classList.add("d-none");
                    return;
                }
                searchTimeout = setTimeout(async () => {
                    try {
                        const results = await forwardGeocode(q);
                        searchResults.innerHTML = "";
                        if (!results || results.length === 0) {
                            searchResults.innerHTML = `<div class="lp-search-item text-muted">No results found</div>`;
                        } else {
                            results.forEach(r => {
                                const item = document.createElement("div");
                                item.className = "lp-search-item";
                                item.innerHTML = `<i class="bi bi-geo-alt me-2 text-info"></i>${r.display_name}`;
                                item.addEventListener("click", async () => {
                                    const lat = parseFloat(r.lat);
                                    const lng = parseFloat(r.lon);
                                    moveMarker(lat, lng);
                                    await applyLocation(lat, lng, r.display_name);
                                    searchInput.value = r.display_name;
                                    searchResults.innerHTML = "";
                                    searchResults.classList.add("d-none");
                                });
                                searchResults.appendChild(item);
                            });
                        }
                        searchResults.classList.remove("d-none");
                    } catch {
                        searchResults.innerHTML = `<div class="lp-search-item text-danger">Search failed. Try again.</div>`;
                        searchResults.classList.remove("d-none");
                    }
                }, 500);
            });

            // Close results on outside click
            document.addEventListener("click", function (e) {
                if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                    searchResults.classList.add("d-none");
                }
            });
        }

        // ── Toggle map show/hide ──
        const toggleBtn = document.getElementById("toggleMapBtn");
        const mapWrapper = document.getElementById("locationMapWrapper");
        if (toggleBtn && mapWrapper) {
            toggleBtn.addEventListener("click", function () {
                const isHidden = mapWrapper.classList.contains("d-none");
                mapWrapper.classList.toggle("d-none");
                if (isHidden) {
                    // Map was hidden → now shown
                    setTimeout(() => {
                        if (pickerMap) pickerMap.invalidateSize();
                    }, 200);
                    toggleBtn.innerHTML = `<i class="bi bi-map-fill me-1"></i> Hide Map`;
                } else {
                    toggleBtn.innerHTML = `<i class="bi bi-map me-1"></i> Pick on Map`;
                }
            });
        }
    }

    // ── Boot when DOM + Leaflet both ready ──
    function waitForLeaflet() {
        if (typeof L !== "undefined") {
            initLocationPicker();
        } else {
            setTimeout(waitForLeaflet, 100);
        }
    }

    document.addEventListener("DOMContentLoaded", waitForLeaflet);
})();
