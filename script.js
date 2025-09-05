// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration - IMPORTANT: Keep this secure
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.appspot.com",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- Global State ---
let timerInterval;
let uploadedImageData = null;
let lastGeneratedImageUrl = null;
let selectedAspectRatio = '1:1';
let isRegenerating = false;
let lastPrompt = '';
let currentUserCredits = 0;
let unsubscribeUserDoc; // To stop listening for db changes when user logs out

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeUniversalScripts();
    if (document.getElementById('generator-ui')) {
        initializeGeneratorPage();
    }
});

/**
 * Initializes scripts that run on every page.
 */
function initializeUniversalScripts() {
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    
    onAuthStateChanged(auth, user => {
        if (user) {
            handleUserLogin(user);
        } else {
            handleUserLogout();
        }
    });

    if (authBtn) authBtn.addEventListener('click', handleAuthAction);
    if (mobileAuthBtn) mobileAuthBtn.addEventListener('click', handleAuthAction);
    if (googleSignInBtn) googleSignInBtn.addEventListener('click', signInWithGoogle);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => document.getElementById('auth-modal').setAttribute('aria-hidden', 'true'));

    // Other universal scripts (cursor, music player, mobile menu) remain unchanged
    setupCursor();
    setupMusicPlayer();
    setupMobileMenu();
}

/**
 * Initializes scripts specific to the main generator page.
 */
function initializeGeneratorPage() {
    const generateBtn = document.getElementById('generate-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');
    const closeNoCreditsBtn = document.getElementById('close-no-credits-modal-btn');

    if(generateBtn) generateBtn.addEventListener('click', () => handleGenerationClick(false));
    if(regenerateBtn) regenerateBtn.addEventListener('click', () => handleGenerationClick(true));
    if(closeNoCreditsBtn) closeNoCreditsBtn.addEventListener('click', () => document.getElementById('no-credits-modal').setAttribute('aria-hidden', 'true'));
    
    // Other generator page event listeners remain unchanged
    setupExamplePrompts();
    setupPromptInput();
    setupAspectRatioButtons();
    setupActionButtons();
    setupImageUpload();
}

// --- Authentication & User State ---

function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth);
    } else {
        signInWithGoogle();
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .catch(error => console.error("Authentication Error:", error));
}

async function handleUserLogin(user) {
    const userRef = doc(db, "users", user.uid);
    // Stop listening to old user data if there's an active listener
    if (unsubscribeUserDoc) unsubscribeUserDoc();

    // Listen for real-time updates to the user's document (e.g., credits)
    unsubscribeUserDoc = onSnapshot(userRef, async (docSnap) => {
        if (!docSnap.exists()) {
            // First time sign-in: create user document with 5 free credits
            try {
                await setDoc(userRef, {
                    email: user.email,
                    name: user.displayName,
                    credits: 5,
                    createdAt: new Date()
                });
                currentUserCredits = 5;
            } catch (error) {
                console.error("Error creating user document:", error);
            }
        } else {
            currentUserCredits = docSnap.data().credits;
        }
        updateUIForAuthState(user, currentUserCredits);
    });

    document.getElementById('auth-modal').setAttribute('aria-hidden', 'true');
}

function handleUserLogout() {
    // Stop listening to database changes for the logged-out user
    if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
    }
    currentUserCredits = 0;
    updateUIForAuthState(null);
}

function updateUIForAuthState(user, credits) {
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const generationCounterEl = document.getElementById('generation-counter');
    const mobileGenerationCounterEl = document.getElementById('mobile-generation-counter');
    
    if (user) {
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';

        if (credits === 0) {
            generationCounterEl.innerHTML = `<a href="/pricing.html" class="bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-blue-600 transition-colors">Buy Credits</a>`;
            mobileGenerationCounterEl.innerHTML = `<a href="/pricing.html" class="bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-blue-600 transition-colors">Buy Credits</a>`;
        } else {
            generationCounterEl.textContent = `Credits: ${credits}`;
            mobileGenerationCounterEl.textContent = `Credits: ${credits}`;
        }
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        generationCounterEl.textContent = '';
        mobileGenerationCounterEl.textContent = '';
    }
}

// --- AI & Generation Logic ---

function handleGenerationClick(isRegen) {
    isRegenerating = isRegen;
    const promptInput = isRegenerating ? document.getElementById('regenerate-prompt-input') : document.getElementById('prompt-input');
    const prompt = promptInput.value.trim();

    if (!prompt) {
        showMessage('Please describe what you want to create.', 'error');
        return;
    }

    if (!auth.currentUser) {
        document.getElementById('auth-modal').setAttribute('aria-hidden', 'false');
        return;
    }

    if (currentUserCredits <= 0) {
        document.getElementById('no-credits-modal').setAttribute('aria-hidden', 'false');
        return;
    }

    generateImage();
}

async function generateImage() {
    const prompt = isRegenerating 
        ? document.getElementById('regenerate-prompt-input').value.trim() 
        : document.getElementById('prompt-input').value.trim();
    lastPrompt = prompt;
    
    // UI updates for generation start
    const imageGrid = document.getElementById('image-grid');
    const messageBox = document.getElementById('message-box');
    const loadingIndicator = document.getElementById('loading-indicator');
    const postGenerationControls = document.getElementById('post-generation-controls');
    const resultContainer = document.getElementById('result-container');
    const generatorUI = document.getElementById('generator-ui');

    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    if (isRegenerating) {
        loadingIndicator.classList.remove('hidden');
        postGenerationControls.classList.add('hidden');
    } else {
        resultContainer.classList.remove('hidden');
        loadingIndicator.classList.remove('hidden');
        generatorUI.classList.add('hidden');
    }
    startTimer();

    try {
        const idToken = await auth.currentUser.getIdToken();
        const imageUrl = await generateImageWithRetry(prompt, uploadedImageData, idToken, selectedAspectRatio);
        displayImage(imageUrl, prompt);
    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(error.message || `Sorry, we couldn't generate the image.`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        document.getElementById('regenerate-prompt-input').value = lastPrompt;
        postGenerationControls.classList.remove('hidden');
        addNavigationButtons();
        isRegenerating = false;
    }
}

async function generateImageWithRetry(prompt, imageData, token, aspectRatio, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // Send user token for authentication
                },
                body: JSON.stringify({ prompt, imageData, aspectRatio })
            });

            const result = await response.json();

            if (!response.ok) {
                if (result.code === 'NO_CREDITS') {
                    document.getElementById('no-credits-modal').setAttribute('aria-hidden', 'false');
                }
                throw new Error(result.error || `API Error: ${response.status}`);
            }

            let base64Data;
            if (imageData) {
                base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
            } else {
                base64Data = result.predictions?.[0]?.bytesBase64Encoded;
            }
            if (!base64Data) throw new Error("No image data received from API.");
            return `data:image/png;base64,${base64Data}`;
        } catch (error) {
            if (attempt >= maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}


// --- UI & Utility Functions ---
// The following functions are mostly unchanged but are included for completeness
function displayImage(imageUrl, prompt) {
    const imageGrid = document.getElementById('image-grid');
    imageGrid.innerHTML = ''; // Clear previous images
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group fade-in-slide-up mx-auto max-w-2xl border border-gray-200/80';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white';
    downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    downloadButton.ariaLabel = "Download Image";
    downloadButton.onclick = () => {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = 'genart-image.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    imgContainer.appendChild(img);
    imgContainer.appendChild(downloadButton);
    imageGrid.appendChild(imgContainer);
}

function showMessage(text, type = 'info') {
    const messageBox = document.getElementById('message-box');
    const messageEl = document.createElement('div');
    messageEl.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up`;
    messageEl.textContent = text;
    messageBox.innerHTML = '';
    messageBox.appendChild(messageEl);
    setTimeout(() => {
        if(messageBox.contains(messageEl)) {
            messageBox.removeChild(messageEl);
        }
    }, 5000);
}

function startTimer() {
    const timerEl = document.getElementById('timer');
    const progressBar = document.getElementById('progress-bar');
    let startTime = Date.now();
    const maxTime = 17 * 1000;
    progressBar.style.width = '0%';
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / maxTime, 1);
        progressBar.style.width = `${progress * 100}%`;
        timerEl.textContent = `${(elapsedTime / 1000).toFixed(1)}s / ~17s`;
        if (elapsedTime >= maxTime) {
            timerEl.textContent = `17.0s / ~17s`;
        }
    }, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = '100%';
}

// All other helper/setup functions (setupCursor, setupMusicPlayer, etc.) are assumed to be here and unchanged...

function setupCursor() { /* Your existing cursor code */ }
function setupMusicPlayer() { /* Your existing music player code */ }
function setupMobileMenu() { /* Your existing mobile menu code */ }
function setupExamplePrompts() { /* Your existing example prompts code */ }
function setupPromptInput() { /* Your existing prompt input code */ }
function setupAspectRatioButtons() { /* Your existing aspect ratio code */ }
function setupActionButtons() { /* Your existing action buttons code */ }
function setupImageUpload() { /* Your existing image upload code */ }
function addNavigationButtons() { /* Your existing navigation buttons code */ }
