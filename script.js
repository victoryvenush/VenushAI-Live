// SECURE: API Key is no longer hardcoded
function getApiKey() {
    let key = localStorage.getItem('groq_key');
    if (!key) {
        key = prompt("Please enter your Groq API Key (saved locally in your browser):");
        if (key) localStorage.setItem('groq_key', key);
    }
    return key;
}

const firebaseConfig = {
  apiKey: "AIzaSyD2fItKTkfPBozNEg-1sgJp4ahbnY4XcLM",
  authDomain: "venushai-94277.firebaseapp.com",
  projectId: "venushai-94277",
  storageBucket: "venushai-94277.firebasestorage.app",
  messagingSenderId: "279019640282",
  appId: "1:279019640282:web:7afe48d16bba9489621ce3",
  measurementId: "G-RLPQ1J6HWB"
};

// Initialize Firebase Production Engine
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// UI Elements Dom Selections
const authContainer = document.getElementById("authContainer");
const authTitle = document.getElementById("authTitle");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authToggleLink = document.getElementById("authToggleLink");
const authToggleText = document.getElementById("authToggleText");
const authError = document.getElementById("authError");

const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const clearChat = document.getElementById("clearChat");
const newChatBtn = document.getElementById("newChatBtn");
const historyList = document.getElementById("historyList");

let conversationHistory = [];
let savedChats = [];
let currentChatId = null;
let currentUserName = "Guest";
let isSignUpMode = false;

function extractNameFromEmail(email) {
    if (!email || !email.includes('@')) return "Guest";
    let handle = email.split('@')[0];
    let clean = handle.replace(/[0-9]/g, '').replace(/[\._\-]/g, ' ');
    return clean.replace(/\b\w/g, c => c.toUpperCase()).trim() || "User";
}

function injectBrandingAndStyles() {
    const styleTag = document.createElement("style");
    styleTag.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght=400;500;600&display=swap');
        .message p, .message-sender, #userInput {
            font-family: 'Plus Jakarta Sans', sans-serif !important;
        }
        .message-sender { font-weight: 600; font-size: 0.85rem; margin-bottom: 4px; display: block; }
        .message p { font-size: 0.95rem; line-height: 1.5; font-weight: 400; }
    `;
    document.head.appendChild(styleTag);

    let footerBranding = document.getElementById("venushFooterBranding");
    if (!footerBranding) {
        footerBranding = document.createElement("div");
        footerBranding.id = "venushFooterBranding";
        footerBranding.style.position = "fixed";
        footerBranding.style.bottom = "12px";
        footerBranding.style.left = "16px";
        footerBranding.style.zIndex = "1000";
        footerBranding.style.pointerEvents = "none";
        footerBranding.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
        footerBranding.style.fontSize = "0.72rem";
        footerBranding.style.color = "rgba(255, 255, 255, 0.35)";
        document.body.appendChild(footerBranding);
    }
    footerBranding.innerHTML = `Developed by Venush<br>User-Provided Key Active`;
}

auth.onAuthStateChanged((user) => {
    if (user) {
        authContainer.style.display = "none";
        currentUserName = extractNameFromEmail(user.email);
        const storageKey = `venush_chats_${user.uid}`;
        savedChats = JSON.parse(localStorage.getItem(storageKey)) || [];
        initChatSystem();
    } else {
        authContainer.style.display = "flex";
        chatWindow.innerHTML = "";
        historyList.innerHTML = "";
    }
});

function initChatSystem() {
    injectBrandingAndStyles();
    loadHistoryUI();
    if (savedChats.length > 0) {
        loadChatSession(savedChats[0].id);
    } else {
        startNewChatSession();
    }
}

function startNewChatSession() {
    currentChatId = Date.now().toString();
    conversationHistory = [];
    chatWindow.innerHTML = "";
    const greetings = [`Hello, ${currentUserName}!`, `What's on your mind, ${currentUserName}?`];
    const selectedGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    appendMessage("VenushAI", selectedGreeting, "ai-message");
    userInput.value = "";
    userInput.style.height = "auto";
    updateActiveHistoryHighlight();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    const apiKey = getApiKey();
    if (!apiKey) return;

    appendMessage("You", text, "user-message");
    userInput.value = "";
    userInput.style.height = "auto";
    conversationHistory.push({ role: "user", content: text });

    const typingElement = appendMessage("VenushAI", "Thinking...", "ai-message typing-indicator");
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        let apiMessages = [];
        apiMessages.push({ 
            role: "system", 
            content: `You are VenushAI. The user's name is ${currentUserName}. You must naturally address them as ${currentUserName}.` 
        });

        conversationHistory.forEach(msg => apiMessages.push(msg));

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({ 
                model: "llama-3.3-70b-versatile",
                messages: apiMessages 
            })
        });

        const data = await response.json();
        typingElement.remove();

        if (data.error) {
            appendMessage("System Alert", `Error: ${data.error.message}`, "ai-message");
            return;
        }

        const aiResponseText = data.choices[0].message.content;
        appendMessage("VenushAI", aiResponseText, "ai-message");
        conversationHistory.push({ role: "assistant", content: aiResponseText });
        saveCurrentChatState(text);
    } catch (error) {
        console.error(error);
        if (document.body.contains(typingElement)) typingElement.remove();
        appendMessage("System Alert", "Unable to connect to service.", "ai-message");
    }
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function appendMessage(senderLabel, text, className) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${className}`;
    const senderSpan = document.createElement("span");
    senderSpan.className = "message-sender";
    senderSpan.textContent = senderLabel;
    const textPara = document.createElement("p");
    textPara.textContent = text;
    msgDiv.appendChild(senderSpan);
    msgDiv.appendChild(textPara);
    chatWindow.appendChild(msgDiv);
    return msgDiv;
}

function saveCurrentChatState(firstUserMessage) {
    const user = auth.currentUser;
    if (!user) return;
    const existingChatIndex = savedChats.findIndex(c => c.id === currentChatId);
    if (existingChatIndex > -1) {
        savedChats[existingChatIndex].history = conversationHistory;
        savedChats[existingChatIndex].htmlContent = chatWindow.innerHTML;
    } else {
        const chatTitle = firstUserMessage.length > 18 ? firstUserMessage.substring(0, 18) + "..." : firstUserMessage;
        savedChats.unshift({ id: currentChatId, title: chatTitle, history: conversationHistory, htmlContent: chatWindow.innerHTML });
    }
    localStorage.setItem(`venush_chats_${user.uid}`, JSON.stringify(savedChats));
    loadHistoryUI();
}

function loadHistoryUI() {
    historyList.innerHTML = "";
    if (savedChats.length === 0) return;
    savedChats.forEach(chat => {
        const item = document.createElement("div");
        item.className = "history-item";
        item.setAttribute("data-id", chat.id);
        const titleSpan = document.createElement("span");
        titleSpan.className = "history-title";
        titleSpan.innerText = chat.title;
        titleSpan.addEventListener("click", () => loadChatSession(chat.id));
        item.appendChild(titleSpan);
        historyList.appendChild(item);
    });
    updateActiveHistoryHighlight();
}

function loadChatSession(id) {
    const targetChat = savedChats.find(c => c.id === id);
    if (!targetChat) return;
    currentChatId = targetChat.id;
    conversationHistory = targetChat.history;
    chatWindow.innerHTML = targetChat.htmlContent;
    updateActiveHistoryHighlight();
}

function updateActiveHistoryHighlight() {
    document.querySelectorAll(".history-item").forEach(item => {
        item.style.backgroundColor = (item.getAttribute("data-id") === currentChatId) ? "rgba(6, 182, 212, 0.06)" : "transparent";
    });
}

authSubmitBtn.addEventListener("click", async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value.trim();
    try {
        if (isSignUpMode) await auth.createUserWithEmailAndPassword(email, password);
        else await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
        authError.textContent = err.message;
        authError.style.display = "block";
    }
});

authToggleLink.addEventListener("click", () => {
    isSignUpMode = !isSignUpMode;
    authTitle.textContent = isSignUpMode ? "Create Account" : "Sign In to VenushAI";
    authSubmitBtn.textContent = isSignUpMode ? "Sign Up" : "Sign In";
});

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
