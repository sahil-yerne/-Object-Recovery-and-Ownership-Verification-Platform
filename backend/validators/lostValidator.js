const validateLostItem = (data) => {

    const errors = [];

    if (!data.itemName || data.itemName.trim() === "") {
        errors.push("Item name is required");
    }

    if (!data.category) {
        errors.push("Category is required");
    }

    if (!data.lostDate) {
        errors.push("Lost date is required");
    }

    if (!data.location || data.location.trim() === "") {
        errors.push("Location is required");
    }

    if (!data.contactName || data.contactName.trim() === "") {
        errors.push("Contact name is required");
    }

    if (!data.phone || !/^[0-9]{10,15}$/.test(data.phone)) {
        errors.push("Valid phone number is required");
    }

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push("Invalid email format");
    }

    return errors;
};

module.exports = validateLostItem;