// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
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
let userCredits = 0; // Tracks the user's current credit balance

// --- reCAPTCHA Callback ---
window.onRecaptchaSuccess = function(token) {
    // This function is called by reCAPTCHA on success and triggers the generation process
    handleImageGenerationRequest(token);
};


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeUniversalScripts();

    // Page-specific initialization
    if (document.getElementById('generator-ui')) {
        initializeGeneratorPage();
    }

    // Check for payment status from URL on page load
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment') === 'success') {
        showMessage('Payment successful! Your credits have been added.', 'info');
    } else if (urlParams.get('payment') === 'failed' || urlParams.get('payment') === 'error') {
        showMessage('Payment failed or was cancelled. Please try again.', 'error');
    }
});


/**
 * Initializes scripts that run on every page (e.g., header, auth, modals).
 */
function initializeUniversalScripts() {
    // --- DOM Element References ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const authModal = document.getElementById('auth-modal');
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const creditsModal = document.getElementById('credits-modal');
    const closeCreditsModalBtn = document.getElementById('close-credits-modal-btn');
    const musicBtn = document.getElementById('music-btn');
    const lofiMusic = document.getElementById('lofi-music');
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');
    
    // --- Event Listeners ---
    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }

    if (authBtn) authBtn.addEventListener('click', handleAuthAction);
    if (mobileAuthBtn) mobileAuthBtn.addEventListener('click', handleAuthAction);
    if (googleSignInBtn) googleSignInBtn.addEventListener('click', signInWithGoogle);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));
    if (closeCreditsModalBtn) closeCreditsModalBtn.addEventListener('click', () => creditsModal.setAttribute('aria-hidden', 'true'));


    if (musicBtn && lofiMusic) {
        musicBtn.addEventListener('click', () => {
            const isPlaying = musicBtn.classList.contains('playing');
            if (isPlaying) {
                lofiMusic.pause();
            } else {
                lofiMusic.play().catch(error => console.error("Audio playback failed:", error));
            }
            musicBtn.classList.toggle('playing');
        });
    }

    if (cursorDot && cursorOutline) {
       // Your existing cursor logic here...
    }
}


/**
 * Initializes scripts specific to the main generator page.
 */
function initializeGeneratorPage() {
    const generateBtn = document.getElementById('generate-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');
    const promptInput = document.getElementById('prompt-input');

    if (generateBtn) generateBtn.addEventListener('click', () => grecaptcha.execute());
    if (regenerateBtn) regenerateBtn.addEventListener('click', () => grecaptcha.execute());
    
    if (promptInput) {
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generateBtn.click();
            }
        });
        // Your other prompt input listeners (e.g., for suggestions) can go here
    }
    // All other generator page specific initializations...
}


/**
 * Main gatekeeper for starting an image generation.
 * Checks auth and credits before proceeding.
 */
async function handleImageGenerationRequest(recaptchaToken) {
    if (!auth.currentUser) {
        document.getElementById('auth-modal').setAttribute('aria-hidden', 'false');
        grecaptcha.reset();
        return;
    }

    if (userCredits <= 0) {
        document.getElementById('credits-modal').setAttribute('aria-hidden', 'false');
        grecaptcha.reset();
        return;
    }

    // Deduct credit on the backend FIRST
    try {
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch('/api/credits', {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${idToken}` }
        });

        if (!response.ok) {
            if (response.status === 402) { // 402 Payment Required
                document.getElementById('credits-modal').setAttribute('aria-hidden', 'false');
            } else {
                showMessage('Error connecting to credit server. Please try again.', 'error');
            }
            grecaptcha.reset();
            return;
        }

        const data = await response.json();
        userCredits = data.newBalance;
        updateCreditDisplay();

        // If deduction is successful, proceed to generate the image
        await generateImage(recaptchaToken);

    } catch (error) {
        console.error('Credit deduction failed:', error);
        showMessage('Could not process request due to a credit system error.', 'error');
        grecaptcha.reset();
    }
}

/**
 * Executes the actual API call to generate an image.
 */
async function generateImage(recaptchaToken) {
    const prompt = isRegenerating 
        ? document.getElementById('regenerate-prompt-input').value.trim() 
        : document.getElementById('prompt-input').value.trim();
    lastPrompt = prompt;
    
    // UI updates for generation start
    const imageGrid = document.getElementById('image-grid');
    const messageBox = document.getElementById('message-box');
    const loadingIndicator = document.getElementById('loading-indicator');
    const resultContainer = document.getElementById('result-container');
    const generatorUI = document.getElementById('generator-ui');

    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    loadingIndicator.classList.remove('hidden');
    resultContainer.classList.remove('hidden');
    generatorUI.classList.add('hidden');
    startTimer();

    try {
        const imageUrl = await generateImageWithRetry(prompt, uploadedImageData, recaptchaToken, selectedAspectRatio);
        displayImage(imageUrl, prompt, false);
        incrementTotalGenerations();
    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
        await refundCredit(); // IMPORTANT: Refund credit on failure
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        document.getElementById('regenerate-prompt-input').value = lastPrompt;
        document.getElementById('post-generation-controls').classList.remove('hidden');
        addNavigationButtons();
        grecaptcha.reset();
        isRegenerating = false;
    }
}


// --- Authentication & Credit Management ---

function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth);
    } else {
        signInWithGoogle();
    }
}

function signInWithGoogle() {
    const authModal = document.getElementById('auth-modal');
    signInWithPopup(auth, provider)
        .then(() => {
            if (authModal) authModal.setAttribute('aria-hidden', 'true');
        })
        .catch(error => console.error("Authentication Error:", error));
}

async function updateUIForAuthState(user) {
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const creditDisplay = document.getElementById('generation-counter');
    const mobileCreditDisplay = document.getElementById('mobile-generation-counter');
    
    if (user) {
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        await fetchUserCredits();
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        userCredits = 0;
        const text = 'Sign in for credits';
        if (creditDisplay) creditDisplay.textContent = text;
        if (mobileCreditDisplay) mobileCreditDisplay.textContent = text;
    }
}

async function fetchUserCredits() {
    if (!auth.currentUser) return;
    try {
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch('/api/credits', {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch credits');
        const data = await response.json();
        userCredits = data.credits;
        updateCreditDisplay();
    } catch (error) {
        console.error('Error fetching credits:', error);
        const creditDisplay = document.getElementById('generation-counter');
        if (creditDisplay) creditDisplay.textContent = 'Credits: Error';
    }
}

function updateCreditDisplay() {
    const text = `Credits: ${userCredits}`;
    const creditDisplay = document.getElementById('generation-counter');
    const mobileCreditDisplay = document.getElementById('mobile-generation-counter');
    if (creditDisplay) creditDisplay.textContent = text;
    if (mobileCreditDisplay) mobileCreditDisplay.textContent = text;
}

async function refundCredit() {
    if (!auth.currentUser) return;
    try {
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch('/api/credits', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ amount: 1 }) // Add 1 credit back
        });
        if (response.ok) {
            await fetchUserCredits(); // Refetch credits to ensure sync
            showMessage("Image generation failed. Your credit has been refunded.", "info");
        }
    } catch (error) {
        console.error("Failed to refund credit:", error);
    }
}


// --- All other existing functions (generateImageWithRetry, displayImage, showMessage, etc.) ---
// --- Note: The old localStorage-based generation counter logic has been removed. ---

async function generateImageWithRetry(prompt, imageData, token, aspectRatio, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, imageData, recaptchaToken: token, aspectRatio: aspectRatio })
            });
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || `API Error: ${response.status}`);
            }
            const result = await response.json();
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

function displayImage(imageUrl, prompt) {
    const imageGrid = document.getElementById('image-grid');
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
        a.click();
    };

    imgContainer.append(img, downloadButton);
    imageGrid.appendChild(imgContainer);
}

function showMessage(text, type = 'info') {
    const messageBox = document.getElementById('message-box') || document.body;
    const messageEl = document.createElement('div');
    messageEl.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up fixed top-5 right-5 z-50`;
    messageEl.textContent = text;
    document.body.appendChild(messageEl);
    setTimeout(() => messageEl.remove(), 4000);
}

function addNavigationButtons() {
    const messageBox = document.getElementById('message-box');
    if (document.getElementById('start-new-btn')) return;

    const startNewButton = document.createElement('button');
    startNewButton.id = 'start-new-btn';
    startNewButton.textContent = '← Start New';
    startNewButton.className = 'text-sm sm:text-base mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
    startNewButton.onclick = () => {
        document.getElementById('generator-ui').classList.remove('hidden');
        document.getElementById('result-container').classList.add('hidden');
    };
    messageBox.prepend(startNewButton);
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

async function incrementTotalGenerations() {
    const counterRef = doc(db, "stats", "imageGenerations");
    try { await setDoc(counterRef, { count: increment(1) }, { merge: true }); } 
    catch (error) { console.error("Error incrementing total generation count:", error); }
}

