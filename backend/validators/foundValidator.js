const validateFoundItem = (data) => {

    const errors = [];

    if (!data.itemName || data.itemName.trim() === "") {
        errors.push("Item name is required");
    }

    if (!data.category) {
        errors.push("Category is required");
    }

    if (!data.foundDate) {
        errors.push("Found date is required");
    }

    if (!data.location || data.location.trim() === "") {
        errors.push("Location is required");
    }

    if (!data.finderName || data.finderName.trim() === "") {
        errors.push("Finder name is required");
    }

    if (!data.phone || !/^[0-9]{10,15}$/.test(data.phone)) {
        errors.push("Valid phone number is required");
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push("Invalid email format");
    }

    return errors;
};

module.exports = validateFoundItem;