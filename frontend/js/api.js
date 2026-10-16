// ================= API BASE URL =================
// Automatically uses the same host and port as the running server
const BASE_URL = window.location.origin + "/api";

// ================= GENERIC FETCH WRAPPER =================

async function apiRequest(endpoint, method = "GET", data = null) {
    try {

        const options = {
            method,
            headers: {}
        };

        const token = localStorage.getItem("auth_token");
        if (token) {
            options.headers["Authorization"] = `Bearer ${token}`;
        }

        if (data) {
            if (data instanceof FormData) {
                options.body = data;
                // Do not set Content-Type header for FormData so browser sets multipart/form-data with boundary
            } else {
                options.headers["Content-Type"] = "application/json";
                options.body = JSON.stringify(data);
            }
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, options);

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Something went wrong");
        }

        return result;

    } catch (error) {
        console.error("API Error:", error.message);
        throw error;
    }
}

// ================= LOST ITEM API =================

async function submitLostItem(formData) {
    return await apiRequest("/lost", "POST", formData);
}

// ================= FOUND ITEM API =================

async function submitFoundItem(formData) {
    return await apiRequest("/found", "POST", formData);
}

// ================= SEARCH ITEMS API =================

async function searchItems(queryParams = "") {
    return await apiRequest(`/search${queryParams}`, "GET");
}

// ================= ITEM DETAILS API =================

async function getItemById(id) {
    return await apiRequest(`/item/${id}`, "GET");
}

// ================= CONTACT API =================

async function submitContactMessage(formData) {
    return await apiRequest("/contact", "POST", formData);
}

// ================= VERIFY OWNERSHIP QUIZ API =================

async function verifyQuiz(id, answer) {
    return await apiRequest(`/item/${id}/verify-quiz`, "POST", { answer });
}

// ================= DELETE ITEM API =================

async function deleteItem(id) {
    return await apiRequest(`/item/${id}`, "DELETE");
}

// ================= OWNERSHIP VAULT & CASES API =================

async function depositVault(formData) {
    return await apiRequest("/vault/deposit", "POST", formData);
}

async function getVault(itemId) {
    return await apiRequest(`/vault/${itemId}`, "GET");
}

async function getRecoveryCase(caseNumber) {
    return await apiRequest(`/cases/${caseNumber}`, "GET");
}

async function issueOwnershipChallenge(data) {
    return await apiRequest("/claims/challenge", "POST", data);
}

async function verifyOwnershipChallenge(data) {
    return await apiRequest("/claims/challenge/verify", "POST", data);
}

// ================= EXPORT (optional global usage) =================

window.api = {
    submitLostItem,
    submitFoundItem,
    searchItems,
    getItemById,
    verifyQuiz,
    submitContactMessage,
    deleteItem,
    depositVault,
    getVault,
    getRecoveryCase,
    issueOwnershipChallenge,
    verifyOwnershipChallenge
};