// This console log will appear if the script file is even loaded and parsed.
console.log(Date.now(), "script.js: File started parsing.");

// Import Firebase functions directly as a module
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, addDoc, serverTimestamp, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// getAnalytics is imported but not explicitly used in the provided snippet's logic,
// but it's part of the user's Firebase config, so it's good to keep the import if they use it elsewhere.
// import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";


// GSAP is loaded via CDN, so it's globally available as `gsap`
// Register ScrollTrigger and TextPlugin for GSAP
gsap.registerPlugin(ScrollTrigger, TextPlugin);

// Marked.js is loaded via CDN, so it's globally available as `marked`
// Configure marked.js for better security and rendering
marked.setOptions({
    gfm: true, // Use GitHub flavored markdown
    breaks: true, // Add <br> on single new line
    sanitize: true // Sanitize the output HTML to prevent XSS attacks
});

// Highlight.js is loaded via CDN, so it's globally available as `hljs`
// This will be used for syntax highlighting of code blocks.

console.log(Date.now(), "script.js: Firebase, GSAP, Marked, and Highlight.js imports attempted.");

// --- Firebase Configuration (Declared at top level) ---
// Use __firebase_config if available (provided by Canvas environment), otherwise use the user's provided config.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.firebasestorage.app",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};

// Initialize Firebase (app, auth, db instances)
let app;
let auth;
let db;
// let analytics; // Declare analytics if you plan to use it in script.js
let userId = "anonymous"; // Default to anonymous, will be updated by auth listener
let appId; // Declare appId globally, will be initialized in initApp

// Global state variables
let currentUser = null;
let isSignInModalOpen = false;
let isGeneratingImage = false; // To prevent multiple image generation requests
let isAITyping = false; // To manage AI typing indicator
let userMessageCount = 0; // For free tier limits
const MAX_FREE_MESSAGES = 5; // Max messages for unauthenticated users
let isSidebarOpen = false; // Start collapsed for mobile-first
let currentMode = 'verse'; // Default AI mode: 'verse', 'image-verse', or 'code'
let isModesDropdownOpen = false; // Track state of the modes dropdown

// Chat history array to maintain context for AI
// Each object will have { role: 'user' | 'ai', parts: [{ text: '...' }] }
let chatHistory = [];
let currentChatSessionId = null; // ID of the currently active chat session in Firestore
let chatSessionsList = []; // Array to hold metadata of all chat sessions for the sidebar

// Scroll lock state
let isScrollLocked = false;
let lastScrollTop = 0;

// AbortController for cancelling fetch requests
let currentAbortController = null;
let typingIntervalId = null; // To store the interval ID for word-by-word typing

// Gemini API Key - This should be automatically provided by the Canvas environment.
// If running outside Canvas, ensure a valid API key is set here or via environment variables.
const GEMINI_API_KEY = "AIzaSyBuIeT-NaR_owNtnDJ8IN1pjvEmzUCDlPk"; // User's provided API Key

// --- AI Persona Definition ---
// This is the core of making the AI sound more human-like and knowledgeable.
const AI_PERSONA_INSTRUCTION = {
    role: "user", // System instructions are typically given as a user message that the AI should respond to.
    parts: [{
        text: `You are GenArt Verse, an advanced, highly intelligent, and articulate AI created by GenArt.
        Your purpose is to provide precise, proper, and comprehensive answers across a vast range of topics.
        You communicate like a knowledgeable human expert, offering clear explanations, well-structured information, and insightful perspectives.
        Maintain a helpful, professional, and slightly sophisticated tone.
        When asked to generate text, provide detailed and creative responses.
        When asked about images, acknowledge the request for visual creation.
        When asked about code, act as a programming assistant, providing well-commented, correct, and efficient code, explanations, or debugging advice.
        Always strive for clarity and accuracy. Do not use emojis in your responses.`
    }]
};

// --- DOM Elements ---
const unifiedInput = document.getElementById('unified-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const stopResponseBtn = document.getElementById('stop-response-btn'); // New stop button
const voiceInputBtn = document.getElementById('voice-input-btn'); // Voice input button
const chatHistoryContainer = document.getElementById('chat-history');
const typingIndicator = document.getElementById('typing-indicator');
const sidebar = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn'); // Hamburger icon on mobile navbar
const closeSidebarBtn = document.getElementById('close-sidebar-btn'); // Close button inside sidebar
const sidebarOverlay = document.getElementById('sidebar-overlay'); // New overlay for mobile drawer
const chatMainArea = document.getElementById('chat-main-area');
const promptSuggestionsContainer = document.getElementById('prompt-suggestions-container');
const userAvatarBtn = document.getElementById('user-avatar-btn'); // Desktop user avatar
const mobileUserAvatarBtn = document.getElementById('mobile-user-avatar-btn'); // Mobile user avatar
const signInOutBtn = document.getElementById('sign-in-out-btn'); // Desktop sign-in/out
const mobileSignInOutBtn = document.getElementById('mobile-sign-in-out-btn'); // Mobile sign-in/out
const userDisplayName = document.getElementById('user-display-name');
const userDisplayEmail = document.getElementById('user-display-email');
const signInModal = document.getElementById('signin-modal');
const googleSignInBtn = document.getElementById('google-signin-btn');
const closeSignInModalBtn = document.getElementById('close-signin-modal-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const chatHistorySidebar = document.getElementById('chat-history-sidebar');
const mainNavbar = document.getElementById('main-navbar'); // Get navbar element
const authDropdown = document.getElementById('auth-dropdown'); // Desktop auth dropdown
const mobileAuthDropdown = document.getElementById('mobile-auth-dropdown'); // Mobile auth dropdown


// Sidebar action buttons (only Settings remains)
const settingsBtn = document.getElementById('settings-btn');

// Mode Toggle Buttons (new structure)
const modesToggleBtn = document.getElementById('modes-toggle-btn');
const modesDropdownPanel = document.getElementById('modes-dropdown-panel');
const modeVerseBtn = document.getElementById('mode-verse-btn');
const modeImageBtn = document.getElementById('mode-image-btn');
const modeCodeBtn = document.getElementById('mode-code-btn');


// --- Utility Functions ---

/**
 * Displays a toast notification.
 * @param {string} message - The message to display.
 * @param {string} type - Type of toast (success, error, info).
 */
function showToast(message, type = 'info') {
    console.log(Date.now(), `showToast: Displaying ${type} toast: ${message}`);
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.error(Date.now(), "showToast: Toast container not found.");
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast p-3 shadow-md flex items-center space-x-2 transition-all duration-300 transform translate-y-full opacity-0`;

    // Set background and border colors based on type
    let bgColor, borderColor;
    switch (type) {
        case 'success':
            bgColor = '#3FE18F'; // Using previous success color
            borderColor = 'color-mix(in srgb, #3FE18F 50%, transparent)';
            break;
        case 'error':
            bgColor = '#F95F62'; // Using previous error color
            borderColor = 'color-mix(in srgb, #F95F62 50%, transparent)';
            break;
        case 'info':
        default:
            bgColor = 'var(--color-bluish-tint)'; // Bluish accent
            borderColor = 'color-mix(in srgb, var(--color-bluish-tint) 50%, transparent)';
            break;
    }
    toast.style.backgroundColor = bgColor;
    toast.style.borderColor = borderColor;

    toast.innerHTML = `<span class="text-white">${message}</span>`; // Text color is white for all toasts

    toastContainer.appendChild(toast);

    // Animate in
    gsap.to(toast, {
        opacity: 1,
        y: 0,
        duration: 0.3,
        ease: "power3.out",
        onComplete: () => {
            // Animate out after a delay
            gsap.to(toast, {
                opacity: 0,
                y: 20,
                delay: 3,
                duration: 0.3,
                ease: "power3.in",
                onComplete: () => {
                    toast.remove();
                    console.log(Date.now(), `showToast: Toast "${message}" removed.`);
                }
            });
        }
    });
}

/**
 * Toggles the visibility of the sign-in modal.
 * @param {boolean} show - True to show, false to hide.
 */
function toggleSignInModal(show) {
    console.log(Date.now(), `toggleSignInModal: Setting visibility to ${show}.`);
    if (signInModal) {
        isSignInModalOpen = show;
        if (show) {
            signInModal.classList.remove('hidden');
            gsap.to(signInModal, { opacity: 1, duration: 0.3, ease: "power2.out" });
            gsap.fromTo(signInModal.children[0], { scale: 0.95 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" });
            console.log(Date.now(), "toggleSignInModal: Sign-in modal shown.");
        } else {
            gsap.to(signInModal.children[0], { scale: 0.95, opacity: 0, duration: 0.3, ease: "power2.in" });
            gsap.to(signInModal, {
                opacity: 0,
                duration: 0.3,
                ease: "power2.in",
                onComplete: () => {
                    signInModal.classList.add('hidden');
                    console.log(Date.now(), "toggleSignInModal: Sign-in modal hidden.");
                }
            });
        }
    } else {
        console.error(Date.now(), "toggleSignInModal: Sign-in modal element not found.");
    }
}

/**
 * Updates UI elements based on user authentication state.
 */
function updateUI() {
    console.log(Date.now(), "updateUI: Updating user interface.");

    // Update desktop UI elements
    if (currentUser) {
        if (userAvatarBtn) userAvatarBtn.innerHTML = `<img src="${currentUser.photoURL || 'https://placehold.co/40x40/333333/FFFFFF?text=U'}" alt="User Avatar" class="w-full h-full rounded-full object-cover">`;
        if (userDisplayName) userDisplayName.textContent = currentUser.displayName || "User";
        if (userDisplayEmail) userDisplayEmail.textContent = currentUser.email || "";
        if (signInOutBtn) {
            signInOutBtn.innerHTML = '<i class="fas fa-sign-out-alt mr-2"></i>Sign Out';
            signInOutBtn.onclick = handleSignOut;
        }
    } else {
        if (userAvatarBtn) userAvatarBtn.innerHTML = `<i class="fas fa-user text-light-gray"></i>`;
        if (userDisplayName) userDisplayName.textContent = "Guest";
        if (userDisplayEmail) userDisplayEmail.textContent = "Sign in for full features";
        if (signInOutBtn) {
            signInOutBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>Sign In';
            signInOutBtn.onclick = () => toggleSignInModal(true);
        }
    }

    // Update mobile UI elements (mirroring desktop for simplicity, could be separate)
    if (mobileUserAvatarBtn) {
        if (currentUser) {
            mobileUserAvatarBtn.innerHTML = `<img src="${currentUser.photoURL || 'https://placehold.co/40x40/333333/FFFFFF?text=U'}" alt="User Avatar" class="w-full h-full rounded-full object-cover">`;
        } else {
            mobileUserAvatarBtn.innerHTML = `<i class="fas fa-user text-light-gray"></i>`;
        }
    }
    if (mobileSignInOutBtn) {
        if (currentUser) {
            mobileSignInOutBtn.innerHTML = '<i class="fas fa-sign-out-alt mr-1"></i> Sign Out';
            mobileSignInOutBtn.onclick = handleSignOut;
        } else {
            mobileSignInOutBtn.innerHTML = '<i class="fas fa-sign-in-alt mr-1"></i> Sign In';
            mobileSignInOutBtn.onclick = () => toggleSignInModal(true);
        }
    }

    // Update send button state based on input content
    updateSendButtonState();
}

/**
 * Applies the saved theme preference or defaults to dark mode.
 * (Note: This app is fixed dark mode as per requirements, but function kept for completeness)
 */
function applySavedTheme() {
    console.log(Date.now(), "applySavedTheme: Applying saved theme.");
    // Force dark mode as per requirement
    document.body.classList.remove('light-mode');
    document.body.classList.add('dark-mode');
    // Remove theme toggle button if it exists, as theme is fixed.
    const themeToggleElement = document.getElementById('theme-toggle');
    if (themeToggleElement) {
        themeToggleElement.remove();
    }
    console.log(Date.now(), `applySavedTheme: Theme forced to dark mode.`);
}

/**
 * Toggles between light and dark mode.
 * (Note: This function is effectively disabled as theme is fixed dark mode)
 */
function toggleTheme() {
    console.log(Date.now(), "toggleTheme: Toggling theme. (Functionality disabled as theme is fixed dark mode)");
    showToast("Theme is fixed to dark mode.", "info");
}

// --- Firebase Authentication Functions ---

/**
 * Handles Google Sign-in.
 */
async function handleGoogleSignIn() {
    console.log(Date.now(), "handleGoogleSignIn: Initiating Google Sign-in.");
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        toggleSignInModal(false); // Close modal on successful sign-in
        showToast("Signed in successfully!", 'success');
        console.log(Date.now(), "handleGoogleSignIn: Google Sign-in successful.");
    } catch (error) {
        console.error(Date.now(), "handleGoogleSignIn: Google Sign-in error:", error);
        showToast(`Sign-in failed: ${error.message}`, 'error');
    }
}

/**
 * Handles user Sign-out.
 */
async function handleSignOut() {
    console.log(Date.now(), "handleSignOut: Initiating Sign-out.");
    try {
        await signOut(auth);
        showToast("Signed out successfully!", 'info');
        console.log(Date.now(), "handleSignOut: Sign-out successful.");
        // Clear current session and load anonymous state
        currentChatSessionId = null;
        chatHistory = [];
        loadChatSessionsForSidebar(); // Reload sidebar for anonymous user
        addChatMessage("Hello! I'm GenArt Verse, your AI assistant. I can help you with text conversations and generate images. Just tell me what you need!", 'ai', false); // Add initial message back
    } catch (error) {
        console.error(Date.now(), "handleSignOut: Sign-out error:", error);
        showToast(`Sign-out failed: ${error.message}`, 'error');
    }
}

// --- Chat UI & Logic ---

/**
 * Adds a chat message to the chat history display.
 * @param {string} message - The message content (or prompt for image).
 * @param {'user'|'ai'} sender - The sender of the message ('user' or 'ai').
 * @param {boolean} [isMarkdown=false] - Whether the message content is Markdown.
 * @param {boolean} [isImage=false] - True if this message is an image response.
 * @param {string} [imageUrl=''] - The URL of the image if isImage is true.
 * @param {string} [messageId=null] - Optional ID for the message (e.g., Firestore doc ID)
 * @param {boolean} [isCode=false] - True if this message is a code response.
 * @param {boolean} [isTypingAnimation=true] - Whether to show typing animation for AI messages.
 */
function addChatMessage(message, sender, isMarkdown = false, isImage = false, imageUrl = '', messageId = null, isCode = false, isTypingAnimation = true) {
    console.log(Date.now(), `addChatMessage: Adding ${sender} message (Markdown: ${isMarkdown}, Image: ${isImage}, Code: ${isCode}, Typing: ${isTypingAnimation}).`);

    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-bubble', sender, 'relative', 'group'); // Added group for hover actions

    if (sender === 'user') {
        messageElement.classList.add('user');
        messageElement.innerHTML = `<p>${message}</p>`; // User messages are plain text
    } else { // AI message
        messageElement.classList.add('ai');
        if (isImage) {
            // For image, add shimmer initially, then replace with image
            messageElement.innerHTML = `
                <div class="shimmer-wrapper">
                    <div class="shimmer"></div>
                </div>
                <div class="image-actions mt-2 hidden">
                    <button class="download-image-btn"><i class="fas fa-download mr-1"></i> Download</button>
                    <button class="copy-prompt-btn"><i class="fas fa-copy mr-1"></i> Copy Prompt</button>
                    <button class="regenerate-image-btn"><i class="fas fa-redo mr-1"></i> Regenerate</button>
                </div>
            `;
            // Store data for later use by action buttons
            messageElement.dataset.imageUrl = imageUrl;
            messageElement.dataset.prompt = message; // Original prompt for regenerate/copy
            messageElement.dataset.messageId = messageId; // For deleting from Firestore if needed
        } else if (isCode) {
            // For code, prepare a pre-formatted block with a copy button
            // The content will be typed into the <code> tag
            messageElement.innerHTML = `
                <pre><code class="language-javascript"></code></pre>
                <button class="copy-code-btn" title="Copy Code"><i class="fas fa-copy"></i> Copy</button>
            `;
            // Store original message for copying
            messageElement.dataset.codeContent = message;
        } else {
            // For text, prepare for typing animation
            messageElement.innerHTML = `<p></p>`;
        }
    }

    chatHistoryContainer.appendChild(messageElement);

    // Fade-in and slide-up animation for new messages
    gsap.fromTo(messageElement,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
    );

    autoScrollChat(); // Scroll to bottom

    if (sender === 'ai' && isTypingAnimation && !isImage && !isCode) {
        // Start typing animation for AI text responses
        typeMessage(messageElement.querySelector('p'), message, isMarkdown);
    } else if (sender === 'ai' && isTypingAnimation && isCode) {
        // Start typing animation for AI code responses
        typeMessage(messageElement.querySelector('code'), message, false, true); // Pass true for isCode to trigger highlight.js
        // Attach copy button listener
        messageElement.querySelector('.copy-code-btn')?.addEventListener('click', () => copyToClipboard(messageElement.dataset.codeContent));
    }
    else if (sender === 'ai' && isImage) {
        // Load image after a short delay to show shimmer
        const shimmerWrapper = messageElement.querySelector('.shimmer-wrapper');
        const imageActions = messageElement.querySelector('.image-actions');

        setTimeout(() => {
            if (shimmerWrapper) shimmerWrapper.remove(); // Remove shimmer
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = message;
            img.classList.add('image-preview-container-img'); // Add class for styling
            messageElement.prepend(img); // Add image
            if (imageActions) imageActions.classList.remove('hidden'); // Show actions

            // Attach event listeners for image actions
            messageElement.querySelector('.download-image-btn')?.addEventListener('click', () => downloadImage(imageUrl, message));
            messageElement.querySelector('.copy-prompt-btn')?.addEventListener('click', () => copyToClipboard(message));
            messageElement.querySelector('.regenerate-image-btn')?.addEventListener('click', () => sendUnifiedMessage(message)); // Resend original prompt

            autoScrollChat(); // Scroll again after image loads
            showAITypingIndicator(false); // Hide typing indicator
            unifiedInput.disabled = false;
            sendMessageBtn.disabled = false;
            stopResponseBtn.classList.remove('active'); // Hide stop button
            voiceInputBtn.disabled = false; // Re-enable voice button
            unifiedInput.focus();
        }, 1500); // Simulate loading time for shimmer
    } else if (sender === 'ai' && (!isTypingAnimation || isImage || isCode)) {
        // If no typing animation, just set the content
        if (isCode) {
            messageElement.querySelector('code').textContent = message;
            hljs.highlightElement(messageElement.querySelector('code'));
            messageElement.querySelector('.copy-code-btn')?.addEventListener('click', () => copyToClipboard(messageElement.dataset.codeContent));
        } else if (!isImage) {
            messageElement.querySelector('p').innerHTML = isMarkdown ? marked.parse(message) : message;
        }
        // For images, the logic is already handled above to show shimmer then image.
    }


    // Add message actions menu (copy/delete) for all bubbles on hover
    if (sender === 'user' || (sender === 'ai' && !isImage)) { // Only for text/code bubbles
        const actionsMenu = document.createElement('div');
        actionsMenu.classList.add('message-actions');
        actionsMenu.innerHTML = `
            <button class="copy-message-btn" title="Copy"><i class="fas fa-copy"></i></button>
            <button class="delete-message-btn" title="Delete"><i class="fas fa-trash-alt"></i></button>
        `;
        messageElement.appendChild(actionsMenu);

        actionsMenu.querySelector('.copy-message-btn')?.addEventListener('click', () => copyToClipboard(message));
        actionsMenu.querySelector('.delete-message-btn')?.addEventListener('click', () => deleteChatMessage(messageElement, messageId, sender));
    }
}

/**
 * Types out a message word by word into a given element.
 * @param {HTMLElement} element - The DOM element to type into (usually a <p> or <code> tag).
 * @param {string} text - The full text to type.
 * @param {boolean} isMarkdown - Whether the text should be parsed as Markdown after typing.
 * @param {boolean} [isCodeElement=false] - True if the target element is a <code> tag for highlighting.
 */
function typeMessage(element, text, isMarkdown, isCodeElement = false) {
    const words = text.split(/\s+/); // Split by one or more spaces
    let wordIndex = 0;
    const speed = 70; // Typing speed in milliseconds per word (adjust for desired speed)

    // Clear any existing typing interval
    if (typingIntervalId) {
        clearInterval(typingIntervalId);
    }

    typingIntervalId = setInterval(() => {
        if (wordIndex < words.length) {
            // Append word and a space. Trim later if needed.
            element.textContent += (wordIndex > 0 ? " " : "") + words[wordIndex];
            wordIndex++;
            autoScrollChat(); // Scroll as text is added
        } else {
            clearInterval(typingIntervalId);
            typingIntervalId = null; // Clear the stored ID
            if (isMarkdown) {
                element.innerHTML = marked.parse(text); // Render markdown after typing
            }
            if (isCodeElement) {
                // Apply syntax highlighting after typing is complete
                hljs.highlightElement(element);
            }
            console.log(Date.now(), "typeMessage: AI typing animation complete.");
            showAITypingIndicator(false);
            unifiedInput.disabled = false;
            sendMessageBtn.disabled = false;
            stopResponseBtn.classList.remove('active'); // Hide stop button
            voiceInputBtn.disabled = false; // Re-enable voice button
            unifiedInput.focus();
            autoScrollChat(); // Final scroll after rendering markdown/highlighting
        }
    }, speed);
}

/**
 * Stops the typing animation for a given element.
 */
function stopTypingAnimation() {
    if (typingIntervalId) {
        clearInterval(typingIntervalId);
        typingIntervalId = null;
        console.log(Date.now(), "stopTypingAnimation: Typing animation stopped.");
    }
}

/**
 * Shows or hides the AI typing indicator.
 * @param {boolean} show - True to show, false to hide.
 */
function showAITypingIndicator(show) {
    console.log(Date.now(), `showAITypingIndicator: Setting typing indicator to ${show}.`);
    if (typingIndicator) {
        if (show) {
            typingIndicator.classList.remove('hidden');
            gsap.fromTo(typingIndicator, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3 });
            isAITyping = true;
        } else {
            gsap.to(typingIndicator, {
                opacity: 0, y: 10, duration: 0.3, onComplete: () => {
                    typingIndicator.classList.add('hidden');
                    isAITyping = false;
                }
            });
        }
    }
}

/**
 * Automatically scrolls the chat history to the bottom.
 */
function autoScrollChat() {
    // Only auto-scroll if not scroll-locked (user hasn't scrolled up)
    if (!isScrollLocked) {
        gsap.to(chatHistoryContainer, {
            scrollTop: chatHistoryContainer.scrollHeight,
            duration: 0.5,
            ease: "power2.out"
        });
    }
}

/**
 * Toggles the sidebar visibility.
 */
function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
    if (isSidebarOpen) {
        // Open sidebar
        gsap.to(sidebar, { x: '0%', duration: 0.3, ease: "power2.out" });
        // Show overlay only on mobile
        if (window.innerWidth < 768) {
            sidebarOverlay.classList.remove('hidden');
            gsap.to(sidebarOverlay, { opacity: 1, duration: 0.3, ease: "power2.out" });
        }
    } else {
        // Close sidebar
        gsap.to(sidebar, { x: '-100%', duration: 0.3, ease: "power2.in" });
        // Hide overlay only on mobile
        if (window.innerWidth < 768) {
            gsap.to(sidebarOverlay, {
                opacity: 0,
                duration: 0.3,
                ease: "power2.in",
                onComplete: () => sidebarOverlay.classList.add('hidden')
            });
        }
    }
}

/**
 * Updates the state of the send button (dimmed/active).
 */
function updateSendButtonState() {
    if (unifiedInput.value.trim().length > 0) {
        sendMessageBtn.classList.add('active');
        sendMessageBtn.style.pointerEvents = 'auto';
    } else {
        sendMessageBtn.classList.remove('active');
        sendMessageBtn.style.pointerEvents = 'none';
    }
}

/**
 * Sends a message (text or image) to the appropriate AI API.
 * @param {string} message - The user's input message.
 * @param {boolean} [isRegenerate=false] - True if this is a regenerate request.
 */
async function sendUnifiedMessage(message, isRegenerate = false) {
    console.log(Date.now(), `sendUnifiedMessage: Processing message: "${message}" (Regenerate: ${isRegenerate}) in ${currentMode} mode.`);
    if (!message.trim()) {
        showToast("Please enter a message.", "info");
        return;
    }

    // If it's a new chat session and the first message, create the session first
    if (!currentChatSessionId && currentUser) {
        try {
            const chatSessionsRef = collection(db, `artifacts/${appId}/users/${userId}/chatSessions`); // Use appId
            const newSessionDocRef = await addDoc(chatSessionsRef, {
                title: "New Chat", // Temporary title, will be updated by AI
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
            });
            currentChatSessionId = newSessionDocRef.id;
            console.log(Date.now(), `sendUnifiedMessage: New chat session created: ${currentChatSessionId}`);
            // Reload sidebar to show the new session
            await loadChatSessionsForSidebar();
        } catch (error) {
            console.error(Date.now(), "sendUnifiedMessage: Error creating new chat session:", error);
            showToast(`Failed to start new chat session: ${error.message}`, "error");
            // Re-enable input and buttons if session creation fails
            unifiedInput.disabled = false;
            sendMessageBtn.disabled = false;
            voiceInputBtn.disabled = false;
            return;
        }
    }


    if (isAITyping || isGeneratingImage) {
        showToast("Please wait for the AI to finish its current task.", "info");
        return;
    }

    // Add user message to UI and in-memory history
    if (!isRegenerate) { // Don't add user message again if regenerating
        addChatMessage(message, 'user');
        chatHistory.push({ role: "user", parts: [{ text: message }] });
        // Save user message to Firestore
        if (currentUser && currentChatSessionId) {
            await saveMessageToFirestore(currentChatSessionId, "user", message);
        }
    }

    unifiedInput.value = ''; // Clear input
    unifiedInput.style.height = 'auto'; // Reset height
    updateSendButtonState(); // Update send button state
    unifiedInput.disabled = true; // Disable input during AI response
    sendMessageBtn.disabled = true; // Disable send button
    voiceInputBtn.disabled = true; // Disable voice button
    stopResponseBtn.classList.add('active'); // Show stop button

    showAITypingIndicator(true); // Show typing indicator

    // Check free message limit if not signed in
    if (!currentUser) {
        if (userMessageCount >= MAX_FREE_MESSAGES) {
            toggleSignInModal(true);
            showToast("Please sign in to continue chatting!", "info");
            showAITypingIndicator(false); // Hide typing indicator
            unifiedInput.disabled = false;
            sendMessageBtn.disabled = false;
            stopResponseBtn.classList.remove('active'); // Hide stop button
            voiceInputBtn.disabled = false;
            return;
        }
        userMessageCount++; // Increment message count for unsigned users
        updateUI(); // Update UI to reflect new message count
    }

    currentAbortController = new AbortController(); // Create a new AbortController for this request
    const signal = currentAbortController.signal;

    try {
        let aiResponseContent;
        let isImageResponse = false;
        let isCodeResponse = false;
        let imageUrl = '';

        if (currentMode === 'image-verse') {
            console.log(Date.now(), "sendUnifiedMessage: Routing to Image Mode.");
            isGeneratingImage = true;
            isImageResponse = true; // Flag for addChatMessage
            imageUrl = await generateImage(message, signal); // Pass signal to image generation API
            if (!imageUrl) {
                if (!signal.aborted) {
                    throw new Error("Image generation failed. No valid image URL received.");
                }
            }
            addChatMessage(message, 'ai', false, isImageResponse, imageUrl, null, false, false); // No typing animation for images
        } else if (currentMode === 'code') {
            console.log(Date.now(), "sendUnifiedMessage: Routing to Code Mode.");
            isCodeResponse = true; // Flag for addChatMessage
            aiResponseContent = await getGeminiCodeResponse(message, signal); // Pass signal to code generation API
            addChatMessage(aiResponseContent, 'ai', false, false, '', null, isCodeResponse); // Typing animation for code
        } else { // Default to 'verse' mode (text)
            console.log(Date.now(), "sendUnifiedMessage: Routing to Verse (Chat) Mode.");
            aiResponseContent = await getGeminiTextResponse(message, signal); // Pass signal to text generation API
            addChatMessage(aiResponseContent, 'ai', true); // Add AI text response with typing animation
        }

        // Add AI response to in-memory history
        if (aiResponseContent) {
            chatHistory.push({ role: "ai", parts: [{ text: aiResponseContent }] });
        } else if (isImageResponse) {
            chatHistory.push({ role: "ai", parts: [{ text: `[Image Generated: ${message}]` }] });
        }

        // Save AI message to Firestore
        if (currentUser && currentChatSessionId) {
            if (isImageResponse) {
                await saveMessageToFirestore(currentChatSessionId, "ai", `[Image Generated: ${message}]`, true, imageUrl);
            } else {
                await saveMessageToFirestore(currentChatSessionId, "ai", aiResponseContent, false, '', isCodeResponse);
            }
            // Update lastUpdated timestamp for the session
            const sessionDocRef = doc(db, `artifacts/${appId}/users/${userId}/chatSessions`, currentChatSessionId); // Use appId
            await updateDoc(sessionDocRef, { lastUpdated: serverTimestamp() });

            // If it's the first AI message in a new session, generate and save the title
            if (chatHistory.length === 2 && currentChatSessionId) { // User message + AI message
                await generateChatSessionTitle(currentChatSessionId, chatHistory);
            }
        }

    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn(Date.now(), "sendUnifiedMessage: AI response stopped by user.");
            stopTypingAnimation(); // Stop any ongoing typing animation
            const lastAiMessageElement = chatHistoryContainer.lastElementChild;
            if (lastAiMessageElement && lastAiMessageElement.classList.contains('ai')) {
                const pElement = lastAiMessageElement.querySelector('p') || lastAiMessageElement.querySelector('code');
                if (pElement && !pElement.textContent.includes("(Response Stopped)")) { // Prevent appending multiple times
                    pElement.textContent += " (Response Stopped)";
                }
            }
            showToast("AI response stopped.", "info");
        } else {
            console.error(Date.now(), "sendUnifiedMessage: Error during AI processing:", error);
            addChatMessage(`Error: ${error.message}. Please try again.`, 'ai', false);
            showToast(`Error: ${error.message}`, "error");
        }
    } finally {
        isGeneratingImage = false; // Reset image generation flag
        showAITypingIndicator(false); // Hide typing indicator
        unifiedInput.disabled = false;
        sendMessageBtn.disabled = false;
        stopResponseBtn.classList.remove('active'); // Hide stop button
        voiceInputBtn.disabled = false; // Re-enable voice button
        unifiedInput.focus();
        currentAbortController = null; // Clear the controller
    }
}

/**
 * Gets a text response from the Gemini API.
 * @param {string} prompt - The user's text prompt.
 * @param {AbortSignal} signal - The AbortSignal to cancel the request.
 * @returns {Promise<string>} - The AI's text response.
 */
async function getGeminiTextResponse(prompt, signal) {
    // Prepend the AI persona instruction to the chat history for context
    const conversation = [AI_PERSONA_INSTRUCTION, ...chatHistory];
    const payload = { contents: conversation };
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    console.log(Date.now(), "getGeminiTextResponse: Sending text request to Gemini API with persona...");
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: signal // Pass the signal here
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error(Date.now(), "getGeminiTextResponse: API error response:", errorData);
        throw new Error(`API error: ${errorData.error ? errorData.error.message : response.statusText}`);
    }

    const result = await response.json();
    console.log(Date.now(), "getGeminiTextResponse: Gemini API response received.");

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        return result.candidates[0].content.parts[0].text;
    } else {
        throw new Error("No valid AI text response received.");
    }
}

/**
 * Generates an image based on the provided prompt using the Imagen API.
 * @param {string} prompt - The text prompt for image generation.
 * @param {AbortSignal} signal - The AbortSignal to cancel the request.
 * @returns {Promise<string|null>} - A promise that resolves with the image URL (base64) or null on error.
 */
async function generateImage(prompt, signal) {
    const payload = { instances: { prompt: prompt }, parameters: { "sampleCount": 1 } };
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_API_KEY}`;

    console.log(Date.now(), "generateImage: Sending image request to Imagen API...");
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: signal // Pass the signal here
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error(Date.now(), "generateImage: API error response:", errorData);
        throw new Error(`API error: ${errorData.error ? errorData.error.message : response.statusText}`);
    }

    const result = await response.json();
    console.log(Date.now(), "generateImage: Imagen API response received.");

    if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
        return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
    } else {
        throw new Error("No image data received from API.");
    }
}

/**
 * Gets a code response from the Gemini API (acting as a programming assistant).
 * @param {string} prompt - The user's code-related prompt.
 * @param {AbortSignal} signal - The AbortSignal to cancel the request.
 * @returns {Promise<string>} - The AI's code response, typically in a markdown code block.
 */
async function getGeminiCodeResponse(prompt, signal) {
    // Combine the general AI persona with a specific instruction for code mode
    const codePersonaInstruction = {
        role: "user",
        parts: [{
            text: `You are GenArt Verse, an advanced, highly intelligent, and articulate AI programming assistant created by GenArt.
            Your purpose is to provide precise, proper, and comprehensive code, explanations, and debugging advice.
            You communicate like a knowledgeable human expert, offering clear, well-commented, and efficient code solutions.
            Always strive for clarity, accuracy, and best practices in your code.
            Respond with code blocks where appropriate, using markdown. Do not use emojis in your responses.
            The user asks: ${prompt}`
        }]
    };

    const payload = { contents: [codePersonaInstruction] }; // Only send the specific code persona for this request
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    console.log(Date.now(), "getGeminiCodeResponse: Sending code request to Gemini API with persona...");
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: signal // Pass the signal here
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error(Date.now(), "getGeminiCodeResponse: API error response:", errorData);
        throw new Error(`API error: ${errorData.error ? errorData.error.message : response.statusText}`);
    }

    const result = await response.json();
    console.log(Date.now(), "getGeminiCodeResponse: Gemini Code API response received.");

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        return result.candidates[0].content.parts[0].text;
    } else {
        throw new Error("No valid AI code response received.");
    }
}


/**
 * Downloads the generated image.
 * @param {string} imageUrl - The base64 image URL.
 * @param {string} prompt - The prompt used for the image, to be used in the filename.
 */
function downloadImage(imageUrl, prompt) {
    console.log(Date.now(), "downloadImage: Initiating image download.");
    const link = document.createElement('a');
    link.href = imageUrl;
    const filename = `genart_${prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50)}.png`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Image downloaded!", "info");
    console.log(Date.now(), `downloadImage: Image "${filename}" downloaded.`);
}

/**
 * Copies text to the clipboard.
 * @param {string} text - The text to copy.
 */
function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast("Copied to clipboard!", "success");
    } catch (err) {
        console.error(Date.now(), 'Failed to copy text: ', err);
        showToast("Failed to copy text.", "error");
    }
    document.body.removeChild(textarea);
}

/**
 * Deletes a chat message from the UI and optionally from Firestore.
 * @param {HTMLElement} messageElement - The DOM element of the message to delete.
 * @param {string} messageId - The Firestore document ID of the message.
 * @param {string} sender - The sender of the message ('user' or 'ai').
 */
async function deleteChatMessage(messageElement, messageId, sender) {
    // Using confirm for simplicity, can be replaced by custom modal
    if (!confirm("Are you sure you want to delete this message?")) {
        return;
    }

    messageElement.remove(); // Remove from UI

    // Remove from in-memory chatHistory
    // Note: This simple matching might fail for complex markdown or images.
    // For a robust solution, each chat message object in chatHistory should have a unique ID.
    const messageTextContent = messageElement.querySelector('p')?.textContent.trim() || messageElement.dataset.prompt?.trim() || messageElement.dataset.codeContent?.trim();
    const indexToRemove = chatHistory.findIndex(msg => msg.role === sender && msg.parts[0].text.trim() === messageTextContent);
    if (indexToRemove !== -1) {
        chatHistory.splice(indexToRemove, 1);
        console.log(Date.now(), `deleteChatMessage: Message removed from in-memory history.`);
    }

    // Optionally delete from Firestore if signed in and messageId exists
    if (currentUser && messageId && currentChatSessionId) {
        try {
            const messageDocRef = doc(db, `artifacts/${appId}/users/${userId}/chatSessions/${currentChatSessionId}/messages`, messageId); // Use appId
            await deleteDoc(messageDocRef);
            showToast("Message deleted!", "success");
            console.log(Date.now(), `deleteChatMessage: Message ${messageId} deleted from Firestore.`);
        } catch (error) {
            console.error(Date.now(), `deleteChatMessage: Error deleting message ${messageId} from Firestore:`, error);
            showToast(`Failed to delete message: ${error.message}`, "error");
        }
    } else {
        showToast("Message deleted from UI.", "info");
    }
}


/**
 * Saves a message to Firestore.
 * @param {string} sessionId - The ID of the current chat session.
 * @param {string} role - 'user' or 'ai'.
 * @param {string} text - The message text.
 * @param {boolean} [isImage=false] - True if the message is an image.
 * @param {string} [imageUrl=''] - URL of the image if applicable.
 * @param {boolean} [isCode=false] - True if the message is code.
 */
async function saveMessageToFirestore(sessionId, role, text, isImage = false, imageUrl = '', isCode = false) {
    if (!currentUser || !sessionId) {
        console.log(Date.now(), "saveMessageToFirestore: User not signed in or no session, skipping Firestore save.");
        return;
    }
    try {
        const messagesRef = collection(db, `artifacts/${appId}/users/${userId}/chatSessions/${sessionId}/messages`); // Use appId
        await addDoc(messagesRef, {
            role: role,
            text: text,
            isImage: isImage,
            imageUrl: imageUrl,
            isCode: isCode, // Save code flag
            timestamp: serverTimestamp()
        });
        console.log(Date.now(), `saveMessageToFirestore: ${role} message saved to session ${sessionId}.`);
    } catch (error) {
        console.error(Date.now(), `saveMessageToFirestore: Error saving ${role} message to session ${sessionId}:`, error);
        showToast(`Failed to save chat history: ${error.message}`, "error");
    }
}

/**
 * Generates a title for a new chat session using the AI.
 * @param {string} sessionId - The ID of the chat session to title.
 * @param {Array} history - The current chat history to base the title on.
 */
async function generateChatSessionTitle(sessionId, history) {
    if (!currentUser || !sessionId) return;

    console.log(Date.now(), `generateChatSessionTitle: Generating title for session ${sessionId}.`);

    try {
        const titlePrompt = {
            role: "user",
            parts: [{
                text: `Based on the following conversation, generate a concise, descriptive title (max 5-7 words). Do not include quotation marks or any conversational filler. Just the title.
                Conversation:
                ${history.map(msg => `${msg.role}: ${msg.parts[0].text}`).join('\n')}`
            }]
        };

        const payload = { contents: [titlePrompt] };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error generating title: ${errorData.error ? errorData.error.message : response.statusText}`);
        }

        const result = await response.json();
        let generatedTitle = "Untitled Chat";
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            generatedTitle = result.candidates[0].content.parts[0].text.trim().replace(/^["']|["']$/g, ''); // Remove quotes
            console.log(Date.now(), `generateChatSessionTitle: Generated title: "${generatedTitle}"`);
        }

        // Update the session document with the generated title
        const sessionDocRef = doc(db, `artifacts/${appId}/users/${userId}/chatSessions`, sessionId); // Use appId
        await updateDoc(sessionDocRef, { title: generatedTitle });
        console.log(Date.now(), `generateChatSessionTitle: Session ${sessionId} title updated to "${generatedTitle}".`);

        // Refresh sidebar to show new title
        await loadChatSessionsForSidebar();

    } catch (error) {
        console.error(Date.now(), `generateChatSessionTitle: Error generating or saving title for session ${sessionId}:`, error);
        showToast(`Failed to auto-title chat: ${error.message}`, "error");
    }
}


/**
 * Loads chat sessions for the sidebar.
 */
async function loadChatSessionsForSidebar() {
    console.log(Date.now(), "loadChatSessionsForSidebar: Attempting to load chat sessions for sidebar.");
    chatHistorySidebar.innerHTML = ''; // Clear current sidebar history

    if (!currentUser) {
        console.log(Date.now(), "loadChatSessionsForSidebar: User not signed in, displaying anonymous message.");
        chatHistorySidebar.innerHTML = '<div class="text-light-gray/80 p-2 text-sm">Sign in to save and view your chat history.</div>';
        chatSessionsList = []; // Clear in-memory list
        return;
    }

    try {
        const chatSessionsRef = collection(db, `artifacts/${appId}/users/${userId}/chatSessions`); // Use appId
        const q = query(chatSessionsRef, orderBy('lastUpdated', 'desc'), limit(10)); // Get most recent 10 sessions
        const querySnapshot = await getDocs(q);

        chatSessionsList = []; // Clear in-memory list before populating

        if (querySnapshot.empty) {
            console.log(Date.now(), "loadChatSessionsForSidebar: No chat sessions found in Firestore.");
            chatHistorySidebar.innerHTML = '<div class="text-light-gray/80 p-2 text-sm">No recent chats. Start a new one!</div>';
            return;
        }

        console.log(Date.now(), `loadChatSessionsForSidebar: Found ${querySnapshot.size} chat sessions.`);
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const sessionId = doc.id;
            chatSessionsList.push({ id: sessionId, title: data.title || "Untitled Chat" });

            const sessionButton = document.createElement('button');
            sessionButton.classList.add('w-full', 'text-left', 'py-2', 'px-3', 'rounded-md', 'truncate', 'text-light-gray/90', 'hover:bg-dark-gray-2', 'transition-colors', 'duration-150');
            sessionButton.textContent = data.title || "Untitled Chat";
            sessionButton.dataset.sessionId = sessionId;
            sessionButton.addEventListener('click', () => {
                loadSpecificChatSession(sessionId);
                if (window.innerWidth < 768) { // Close sidebar on mobile after selecting chat
                    toggleSidebar();
                }
            });
            chatHistorySidebar.appendChild(sessionButton);
        });

        // Automatically load the most recent session if available and no current session is active
        if (!currentChatSessionId && chatSessionsList.length > 0) {
            await loadSpecificChatSession(chatSessionsList[0].id);
        }

        showToast("Chat sessions loaded!", "success");
    } catch (error) {
        console.error(Date.now(), "loadChatSessionsForSidebar: Error loading chat sessions:", error);
        showToast(`Failed to load chat sessions: ${error.message}`, "error");
        chatHistorySidebar.innerHTML = '<div class="text-red-400 p-2 text-sm">Error loading history.</div>';
    }
}

/**
 * Loads and displays messages for a specific chat session.
 * @param {string} sessionId - The ID of the chat session to load.
 */
async function loadSpecificChatSession(sessionId) {
    console.log(Date.now(), `loadSpecificChatSession: Loading messages for session ${sessionId}.`);
    chatHistoryContainer.innerHTML = ''; // Clear main chat area
    chatHistory = []; // Clear in-memory history
    currentChatSessionId = sessionId; // Set the current active session

    // Highlight the active session in the sidebar
    document.querySelectorAll('#chat-history-sidebar button').forEach(btn => {
        if (btn.dataset.sessionId === sessionId) {
            btn.classList.add('bg-dark-gray-2', 'text-bluish-tint', 'font-semibold');
        } else {
            btn.classList.remove('bg-dark-gray-2', 'text-bluish-tint', 'font-semibold');
        }
    });

    try {
        const messagesRef = collection(db, `artifacts/${appId}/users/${userId}/chatSessions/${sessionId}/messages`); // Use appId
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.log(Date.now(), `loadSpecificChatSession: No messages found for session ${sessionId}.`);
            addChatMessage("This chat is empty. Start a conversation!", 'ai', false, false, '', null, false, false);
            return;
        }

        console.log(Date.now(), `loadSpecificChatSession: Found ${querySnapshot.size} messages for session ${sessionId}.`);
        querySnapshot.forEach(doc => {
            const data = doc.data();
            // Add messages without typing animation when loading from history
            addChatMessage(data.text, data.role, true, data.isImage || false, data.imageUrl || '', doc.id, data.isCode || false, false);
            chatHistory.push({ role: data.role, parts: [{ text: data.text }] });
        });
        showToast(`Loaded chat: "${chatSessionsList.find(s => s.id === sessionId)?.title || 'Untitled Chat'}"`, "info");
        autoScrollChat();
    } catch (error) {
        console.error(Date.now(), `loadSpecificChatSession: Error loading messages for session ${sessionId}:`, error);
        showToast(`Failed to load chat: ${error.message}`, "error");
        addChatMessage("Error loading this chat. Please try again or start a new one.", 'ai', false, false, '', null, false, false);
    }
}


/**
 * Starts a new chat session.
 */
async function startNewChat() {
    console.log(Date.now(), "startNewChat: Initiating new chat.");
    // Using confirm for simplicity, can be replaced by custom modal
    if (!confirm("Are you sure you want to start a new chat? This will clear the current conversation.")) {
        return;
    }
    chatHistoryContainer.innerHTML = ''; // Clear UI
    chatHistory = []; // Clear in-memory history
    currentChatSessionId = null; // Mark as a new session
    addChatMessage("Hello! I'm GenArt Verse, your AI assistant. How can I help you today?", 'ai', false);
    showToast("New chat started!", "info");

    // Deselect any active session in the sidebar
    document.querySelectorAll('#chat-history-sidebar button').forEach(btn => {
        btn.classList.remove('bg-dark-gray-2', 'text-bluish-tint', 'font-semibold');
    });
    unifiedInput.focus();
}

/**
 * Populates the prompt suggestions carousel.
 */
function populatePromptSuggestions() {
    const suggestions = [
        "Write a short story about a brave knight.",
        "Generate an image of a futuristic city at sunset.",
        "Explain the concept of black holes simply.",
        "Draw a cute robot playing with a cat.",
        "Give me a recipe for chocolate chip cookies.",
        "Create an image of a serene forest with a hidden waterfall."
    ];

    promptSuggestionsContainer.innerHTML = ''; // Clear existing suggestions

    suggestions.forEach(suggestion => {
        const button = document.createElement('button');
        button.classList.add('prompt-suggestion-btn');
        button.textContent = suggestion;
        button.addEventListener('click', () => {
            unifiedInput.value = suggestion;
            unifiedInput.style.height = 'auto'; // Reset height
            unifiedInput.style.height = (unifiedInput.scrollHeight) + 'px'; // Adjust height
            updateSendButtonState();
            unifiedInput.focus();
        });
        promptSuggestionsContainer.appendChild(button);
    });
}

/**
 * Updates the UI to reflect the current AI mode.
 */
function updateModeUI() {
    console.log(Date.now(), `updateModeUI: Setting mode to ${currentMode}.`);

    // Remove active class from all dropdown mode buttons
    document.querySelectorAll('.dropdown-mode-item').forEach(btn => {
        btn.classList.remove('active-mode-item');
    });

    // Add active class to the current mode button
    let activeBtn;
    let placeholderText;
    switch (currentMode) {
        case 'verse':
            activeBtn = modeVerseBtn;
            placeholderText = "Start your conversation...";
            break;
        case 'image-verse':
            activeBtn = modeImageBtn;
            placeholderText = "Describe your image in detail...";
            break;
        case 'code':
            activeBtn = modeCodeBtn;
            placeholderText = "What do you want to build or debug?";
            break;
    }

    if (activeBtn) {
        activeBtn.classList.add('active-mode-item');
    }

    // Update input placeholder
    unifiedInput.placeholder = placeholderText;

    // Optional: Animate input background/border on mode switch
    gsap.to(unifiedInput, {
        borderColor: 'var(--color-bluish-tint)', // Flash with bluish tint
        duration: 0.1,
        repeat: 1,
        yoyo: true,
        ease: "power1.inOut",
        onComplete: () => {
            gsap.to(unifiedInput, { borderColor: 'rgba(255, 255, 255, 0.05)', duration: 0.1 }); // Revert
        }
    });
}

/**
 * Toggles the visibility of the modes dropdown panel.
 */
function toggleModesDropdown() {
    isModesDropdownOpen = !isModesDropdownOpen;
    if (isModesDropdownOpen) {
        modesDropdownPanel.classList.add('open');
        modesToggleBtn.classList.add('active'); // Rotate chevron
        gsap.fromTo(modesDropdownPanel,
            { opacity: 0, scale: 0.95, y: 10 },
            { opacity: 1, scale: 1, y: 0, duration: 0.2, ease: "power2.out", pointerEvents: 'auto' }
        );
    } else {
        modesToggleBtn.classList.remove('active'); // Reset chevron
        gsap.to(modesDropdownPanel,
            { opacity: 0, scale: 0.95, y: 10, duration: 0.2, ease: "power2.in", pointerEvents: 'none' }
        );
    }
}


// --- Event Listeners ---

/**
 * Sets up all global and page-specific event listeners.
 */
function setupEventListeners() {
    console.log(Date.now(), "setupEventListeners: Setting up event listeners.");

    // Sidebar toggle (hamburger) and close button
    sidebarToggleBtn?.addEventListener('click', toggleSidebar);
    closeSidebarBtn?.addEventListener('click', toggleSidebar); // Close button inside sidebar
    sidebarOverlay?.addEventListener('click', toggleSidebar); // Close sidebar when clicking overlay

    // Sidebar action buttons (only Settings remains)
    settingsBtn?.addEventListener('click', () => {
        showToast("Settings page coming soon!", "info");
        if (window.innerWidth < 768 && isSidebarOpen) {
            toggleSidebar(); // Close sidebar on mobile after clicking settings
        }
    });

    // Modes Toggle Button
    modesToggleBtn?.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent document click from immediately closing
        toggleModesDropdown();
    });

    // Dropdown Mode Items
    modeVerseBtn?.addEventListener('click', () => {
        currentMode = 'verse';
        updateModeUI();
        toggleModesDropdown(); // Close dropdown after selection
    });
    modeImageBtn?.addEventListener('click', () => {
        currentMode = 'image-verse';
        updateModeUI();
        toggleModesDropdown(); // Close dropdown after selection
    });
    modeCodeBtn?.addEventListener('click', () => {
        currentMode = 'code';
        updateModeUI();
        toggleModesDropdown(); // Close dropdown after selection
    });


    // User profile/Sign-in dropdown (Desktop)
    userAvatarBtn?.addEventListener('click', () => {
        if (authDropdown) {
            if (authDropdown.classList.contains('opacity-0')) {
                gsap.to(authDropdown, { opacity: 1, scale: 1, duration: 0.2, ease: "power2.out", pointerEvents: 'auto' });
            } else {
                gsap.to(authDropdown, { opacity: 0, scale: 0.95, duration: 0.2, ease: "power2.in", pointerEvents: 'none' });
            }
        }
    });

    // User profile/Sign-in dropdown (Mobile)
    mobileUserAvatarBtn?.addEventListener('click', () => {
        if (mobileAuthDropdown) {
            if (mobileAuthDropdown.classList.contains('opacity-0')) {
                gsap.to(mobileAuthDropdown, { opacity: 1, scale: 1, duration: 0.2, ease: "power2.out", pointerEvents: 'auto' });
            } else {
                gsap.to(mobileAuthDropdown, { opacity: 0, scale: 0.95, duration: 0.2, ease: "power2.in", pointerEvents: 'none' });
            }
        }
    });

    // Close dropdowns if clicked outside
    document.addEventListener('click', (e) => {
        // Desktop auth dropdown
        if (authDropdown && userAvatarBtn && !userAvatarBtn.contains(e.target) && !authDropdown.contains(e.target)) {
            gsap.to(authDropdown, { opacity: 0, scale: 0.95, duration: 0.2, ease: "power2.in", pointerEvents: 'none' });
        }
        // Mobile auth dropdown
        if (mobileAuthDropdown && mobileUserAvatarBtn && !mobileUserAvatarBtn.contains(e.target) && !mobileAuthDropdown.contains(e.target)) {
            gsap.to(mobileAuthDropdown, { opacity: 0, scale: 0.95, duration: 0.2, ease: "power2.in", pointerEvents: 'none' });
        }

        // Close modes dropdown if clicked outside
        if (modesDropdownPanel && modesToggleBtn && !modesToggleBtn.contains(e.target) && !modesDropdownPanel.contains(e.target) && isModesDropdownOpen) {
            toggleModesDropdown();
        }
    });


    // Sign-in modal buttons
    googleSignInBtn?.addEventListener('click', handleGoogleSignIn);
    closeSignInModalBtn?.addEventListener('click', () => toggleSignInModal(false));

    // Unified Input behavior
    unifiedInput?.addEventListener('input', () => {
        unifiedInput.style.height = 'auto'; // Reset height
        unifiedInput.style.height = (unifiedInput.scrollHeight) + 'px'; // Adjust height
        updateSendButtonState();
    });

    unifiedInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent new line
            sendUnifiedMessage(unifiedInput.value);
        }
    });

    sendMessageBtn?.addEventListener('click', () => sendUnifiedMessage(unifiedInput.value));

    // Stop button event listener
    stopResponseBtn?.addEventListener('click', () => {
        if (currentAbortController) {
            currentAbortController.abort(); // Trigger cancellation
            console.log(Date.now(), "User initiated stop: AbortController.abort() called.");
        }
        // UI state will be reset in the finally block of sendUnifiedMessage
    });

    // New Chat button
    newChatBtn?.addEventListener('click', startNewChat);

    // Chat scroll lock logic
    chatHistoryContainer?.addEventListener('scroll', () => {
        const currentScrollTop = chatHistoryContainer.scrollTop;
        const scrollHeight = chatHistoryContainer.scrollHeight;
        const clientHeight = chatHistoryContainer.clientHeight;

        // If user is manually scrolling up
        if (currentScrollTop < lastScrollTop && (scrollHeight - clientHeight - currentScrollTop) > 10) { // 10px buffer
            isScrollLocked = true;
        }
        // If user scrolls to the very bottom, unlock scroll
        else if ((scrollHeight - clientHeight - currentScrollTop) <= 1) {
            isScrollLocked = false;
        }
        lastScrollTop = currentScrollTop;
    });

    // Persistent debug message close button
    document.getElementById('close-debug-message')?.addEventListener('click', () => {
        document.getElementById('persistent-debug-message')?.classList.add('hidden');
        console.log(Date.now(), "setupEventListeners: Debug message dismissed.");
    });

    // Populate initial prompt suggestions
    populatePromptSuggestions();

    // Handle initial sidebar state based on screen size
    function adjustLayoutOnResize() {
        if (window.innerWidth >= 768) { // Desktop view
            if (!isSidebarOpen) { // If sidebar was closed (e.g., from mobile), open it
                gsap.to(sidebar, { x: '0%', duration: 0 }); // Instantly snap open
                isSidebarOpen = true;
            }
            // Ensure desktop-specific margins are applied
            gsap.set(chatMainArea, { marginLeft: '15.625rem' }); // 250px
            gsap.set(mainNavbar, { left: '15.625rem', width: 'calc(100vw - 15.625rem)' });
            sidebarOverlay.classList.add('hidden'); // Ensure overlay is hidden on desktop
            gsap.set(sidebarOverlay, { opacity: 0 });
        } else { // Mobile view
            if (isSidebarOpen) { // If sidebar was open (e.g., from desktop), close it
                gsap.to(sidebar, { x: '-100%', duration: 0 }); // Instantly snap closed
                isSidebarOpen = false;
            }
            // Ensure mobile-specific margins are applied
            gsap.set(chatMainArea, { marginLeft: '0' });
            gsap.set(mainNavbar, { left: '0', width: '100vw' });
        }
    }

    // Adjust layout on initial load and resize
    adjustLayoutOnResize();
    window.addEventListener('resize', adjustLayoutOnResize);


    console.log(Date.now(), "setupEventListeners: All event listeners set up.");
}

// --- App Initialization ---

/**
 * Initializes the Firebase app, authentication, and Firestore.
 * Sets up the auth state listener and initial UI.
 */
async function initApp() {
    console.time("AppInitialization");
    console.log(Date.now(), "initApp: Starting application initialization.");

    try {
        // Initialize Firebase
        console.log(Date.now(), "initApp: Initializing Firebase app.");
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        // analytics = getAnalytics(app); // Initialize analytics if you plan to use it
        console.log(Date.now(), "initApp: Firebase app, auth, and db initialized.");

        // Initialize appId safely
        // The appId from firebaseConfig.appId is typically in the format "1:senderId:web:appIdHash"
        // We need the projectId part, which is usually the second segment of the appId string
        const firebaseAppIdParts = firebaseConfig.appId.split(':');
        appId = typeof __app_id !== 'undefined' ? __app_id : (firebaseAppIdParts.length > 1 ? firebaseAppIdParts[1] : 'default-app-id');


        // Set up Auth State Listener
        onAuthStateChanged(auth, async (user) => {
            console.log(Date.now(), "onAuthStateChanged: Auth state changed. User:", user ? user.uid : "null");
            currentUser = user;
            // Use Firebase UID if authenticated, otherwise generate a random UUID for anonymous sessions.
            userId = user ? user.uid : `${appId}-anonymous-${crypto.randomUUID()}`; // Use the initialized appId
            updateUI(); // Update UI whenever auth state changes
            await loadChatSessionsForSidebar(); // Load chat sessions for the sidebar
        });

        // Attempt initial sign-in with custom token if available (from Canvas environment)
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            console.log(Date.now(), "initApp: Signing in with custom token.");
            await auth.signInWithCustomToken(__initial_auth_token).catch(error => {
                console.error(Date.now(), "initApp: Custom token sign-in failed:", error);
                // Fallback: User remains unauthenticated if custom token fails
            });
        } else {
            console.log(Date.now(), "initApp: No initial auth token. User will be unauthenticated by default.");
        }
        console.log(Date.now(), "initApp: Initial authentication attempt complete (or skipped anonymous sign-in).");

        // Apply theme on load (fixed dark mode)
        applySavedTheme();

        // Setup all event listeners
        setupEventListeners();

        // Set initial mode UI (for "Verse" mode)
        updateModeUI();

        console.timeEnd("AppInitialization");
        console.log(Date.now(), "initApp: App initialization complete.");

    } catch (criticalError) {
        console.error(Date.now(), "CRITICAL ERROR: Uncaught error during initApp execution:", criticalError);
        const persistentDebugMessage = document.getElementById('persistent-debug-message');
        if (persistentDebugMessage) {
            persistentDebugMessage.classList.remove('hidden');
            persistentDebugMessage.querySelector('p').textContent = `A critical error occurred during startup: ${criticalError.message}. Please open your browser's Developer Console (F12) and copy all messages to the AI for debugging.`;
        } else {
            document.body.innerHTML = `<div style="color: var(--color-light-gray); background-color: var(--color-optional-black-tint); padding: 20px; text-align: center;">
                <h1>Application Failed to Load</h1>
                <p>A critical error occurred during startup. Please check your browser's console (F12) for details.</p>
                <p>Error: ${criticalError.message}</p>
            </div>`;
        }
    }
}

// --- DOMContentLoaded Listener (Main entry point after DOM is ready) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log(Date.now(), "script.js: DOMContentLoaded event listener triggered.");
    initApp(); // Call the main initialization function
});
