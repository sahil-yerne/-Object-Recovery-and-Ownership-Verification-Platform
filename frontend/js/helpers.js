// ================= FORM VALIDATION HELPERS =================

function isEmpty(value) {
    return value === undefined || value === null || value.trim() === "";
}

function isValidPhone(phone) {
    return /^[0-9]{10,15}$/.test(phone);
}

function isValidEmail(email) {
    if (!email) return true; // optional field
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ================= FORM VALIDATION WRAPPER =================

function validateLostForm(data) {

    if (isEmpty(data.itemName)) return "Item name is required";
    if (isEmpty(data.category)) return "Category is required";
    if (isEmpty(data.lostDate)) return "Lost date is required";
    if (isEmpty(data.location)) return "Location is required";
    if (isEmpty(data.contactName)) return "Contact name is required";
    if (!isValidPhone(data.phone)) return "Invalid phone number";
    if (!isValidEmail(data.email)) return "Invalid email";

    return null;
}

function validateFoundForm(data) {

    if (isEmpty(data.itemName)) return "Item name is required";
    if (isEmpty(data.category)) return "Category is required";
    if (isEmpty(data.foundDate)) return "Found date is required";
    if (isEmpty(data.location)) return "Location is required";
    if (isEmpty(data.finderName)) return "Finder name is required";
    if (!isValidPhone(data.phone)) return "Invalid phone number";
    if (!isValidEmail(data.email)) return "Invalid email";

    return null;
}

// ================= QUERY HELPERS =================

function getQueryParams() {
    return new URLSearchParams(window.location.search);
}

function getQueryParam(key) {
    return getQueryParams().get(key);
}

// ================= DATE FORMATTER =================

function formatDate(dateStr) {

    if (!dateStr) return "-";

    const date = new Date(dateStr);

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

// ================= LOADING SKELETON =================

function showSkeleton(element) {
    if (element) {
        element.innerHTML = `
            <div class="placeholder-glow">
                <span class="placeholder col-12"></span>
            </div>
        `;
    }
}

// ================= IMAGE EXTRACTION HELPER =================

function getItemImage(item) {
    if (!item) return 'assets/images/no-image.png';
    const allImgs = getItemImages(item);
    return allImgs.length > 0 ? allImgs[0] : 'assets/images/no-image.png';
}

function getItemImages(item) {
    if (!item) return [];
    if (item.images) {
        let imgs = item.images;
        if (typeof imgs === 'string') {
            try {
                imgs = JSON.parse(imgs);
            } catch (e) {
                imgs = [imgs];
            }
        }
        if (Array.isArray(imgs) && imgs.length > 0) {
            return imgs;
        }
    }
    if (item.image) return [item.image];
    return [];
}

// ================= EXPORT GLOBAL =================

window.helpers = {
    isEmpty,
    isValidPhone,
    isValidEmail,
    validateLostForm,
    validateFoundForm,
    getQueryParam,
    formatDate,
    getItemImage,
    getItemImages
};