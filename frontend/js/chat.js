document.addEventListener("DOMContentLoaded", async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get("itemId") || 1;
    let chatId = null;
    
    // Retrieve current user from auth storage if available
    let currentUserId = 1;
    try {
        const storedUser = localStorage.getItem("auth_user") || localStorage.getItem("user");
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if (parsed.id || parsed.userId) currentUserId = parsed.id || parsed.userId;
        }
    } catch (e) {}

    const chatMessagesEl = document.getElementById("chatMessages");
    const chatForm = document.getElementById("chatForm");
    const messageInput = document.getElementById("messageInput");
    const chatSubHeader = document.getElementById("chatSubHeader");

    // Initialize Socket.IO connection
    let socket = null;
    if (typeof io !== "undefined") {
        socket = io();
        socket.on("connect", () => {
            console.log("⚡ Real-time chat socket connected:", socket.id);
            if (chatSubHeader) {
                chatSubHeader.innerHTML = `<span class="text-success"><i class="bi bi-lightning-charge-fill"></i> Real-time Encrypted P2P Session Active</span>`;
            }
            if (chatId) {
                socket.emit("join_chat", chatId);
            }
        });

        // Listen for new incoming messages in real-time
        socket.on("new_message", (msg) => {
            appendMessage(msg);
        });

        socket.on("disconnect", () => {
            console.log("Chat socket disconnected");
            if (chatSubHeader) {
                chatSubHeader.innerHTML = `<span class="text-muted">Encrypted P2P messaging session</span>`;
            }
        });
    }

    // Fetch item details for header title
    try {
        const itemRes = await fetch(`/api/item/${itemId}`);
        const itemData = await itemRes.json();
        if (itemData.success && itemData.data) {
            document.getElementById("itemTitleHeader").innerHTML = `<i class="bi bi-chat-lock-fill text-warning me-2"></i> Chat regarding: ${itemData.data.itemName}`;
        }
    } catch (e) {}

    // Initialize or fetch Chat ID
    try {
        const initRes = await fetch("/api/chat/get-or-create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itemId, user1Id: currentUserId, user2Id: 2 })
        });
        const initData = await initRes.json();
        if (initData.success) {
            chatId = initData.chatId;
            if (socket && socket.connected) {
                socket.emit("join_chat", chatId);
            }
            await loadMessages();
        }
    } catch (err) {
        console.error("Failed to init chat", err);
    }

    function appendMessage(msg) {
        if (!chatMessagesEl) return;
        // If placeholder exists, remove it
        const placeholder = chatMessagesEl.querySelector(".text-muted");
        if (placeholder) placeholder.remove();

        // Check if message ID already rendered to prevent duplicate rendering
        if (msg.id && chatMessagesEl.querySelector(`[data-msg-id="${msg.id}"]`)) {
            return;
        }

        const isSent = msg.senderId == currentUserId;
        const bubble = document.createElement("div");
        if (msg.id) bubble.setAttribute("data-msg-id", msg.id);
        bubble.className = `message-bubble ${isSent ? 'message-sent' : 'message-received'}`;
        bubble.innerHTML = `
            <div>${escapeHtml(msg.message)}</div>
            <div class="small text-end opacity-75 mt-1" style="font-size:0.7rem;">
                ${new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        `;
        chatMessagesEl.appendChild(bubble);
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.innerText = text;
        return div.innerHTML;
    }

    async function loadMessages() {
        if (!chatId) return;
        try {
            const res = await fetch(`/api/chat/messages/${chatId}`);
            const data = await res.json();

            if (data.success && data.messages) {
                if (data.messages.length === 0) return;
                
                chatMessagesEl.innerHTML = "";
                data.messages.forEach(msg => {
                    appendMessage(msg);
                });
            }
        } catch (e) {
            console.error("Load messages error", e);
        }
    }

    chatForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (!text || !chatId) return;

        messageInput.value = "";

        // Send via Socket if connected, else fallback to REST
        if (socket && socket.connected) {
            socket.emit("send_message", {
                chatId,
                senderId: currentUserId,
                message: text
            });
        } else {
            try {
                const res = await fetch("/api/chat/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chatId, senderId: currentUserId, message: text })
                });
                const resData = await res.json();
                if (resData.success && resData.message) {
                    appendMessage(resData.message);
                }
            } catch (err) {
                console.error("Send message error", err);
            }
        }
    });
});
