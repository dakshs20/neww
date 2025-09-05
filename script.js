// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
let selectedAspectRatio = '1:1';
let isRegenerating = false;
let lastPrompt = '';
let currentUser = null;
let userCredits = 0;
let userUnsubscribe = null; // To hold the listener unsubscribe function

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeUniversalScripts();

    // Page-specific initialization
    if (document.getElementById('generator-ui')) {
        initializeGeneratorPage();
    }
});

/**
 * Initializes scripts that run on every page (e.g., header, auth, cursor).
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
    
    // --- Event Listeners ---
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUser = user;
            setupUserListener(user.uid);
        } else {
            currentUser = null;
            userCredits = 0;
            if (userUnsubscribe) {
                userUnsubscribe(); // Detach the listener
                userUnsubscribe = null;
            }
            updateUIForAuthState(false);
        }
    });

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }

    if (authBtn) authBtn.addEventListener('click', handleAuthAction);
    if (mobileAuthBtn) mobileAuthBtn.addEventListener('click', handleAuthAction);
    if (googleSignInBtn) googleSignInBtn.addEventListener('click', signInWithGoogle);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));

    initializeCursor();
    initializeMusicPlayer();
}

/**
 * Sets up a real-time listener for the user's data in Firestore.
 * @param {string} userId The Firebase user ID.
 */
function setupUserListener(userId) {
    const userDocRef = doc(db, "users", userId);
    
    userUnsubscribe = onSnapshot(userDocRef, async (docSnap) => {
        if (docSnap.exists()) {
            // User document exists, update credits
            const userData = docSnap.data();
            userCredits = userData.credits;
            updateUIForAuthState(true);
        } else {
            // First sign-in, create the user document with free credits
            try {
                await setDoc(userDocRef, {
                    email: currentUser.email,
                    displayName: currentUser.displayName,
                    credits: 5, // Grant 5 free credits
                    createdAt: serverTimestamp()
                });
                console.log("New user document created with 5 free credits.");
                // The listener will automatically pick up the new data, so no manual update is needed here.
            } catch (error) {
                console.error("Error creating user document:", error);
            }
        }
    }, (error) => {
        console.error("Error listening to user document:", error);
    });
}


/**
 * Initializes scripts specific to the main generator page.
 */
function initializeGeneratorPage() {
    // --- DOM Element References ---
    const promptInput = document.getElementById('prompt-input');
    const generateBtn = document.getElementById('generate-btn');
    const examplePrompts = document.querySelectorAll('.example-prompt');
    const imageUploadBtn = document.getElementById('image-upload-btn');
    const imageUploadInput = document.getElementById('image-upload-input');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const aspectRatioBtns = document.querySelectorAll('.aspect-ratio-btn');
    const copyPromptBtn = document.getElementById('copy-prompt-btn');
    const enhancePromptBtn = document.getElementById('enhance-prompt-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');
    const noCreditsModal = document.getElementById('no-credits-modal');
    const closeNoCreditsModalBtn = document.getElementById('close-no-credits-modal-btn');
    
    // --- Event Listeners ---
    if(generateBtn) generateBtn.addEventListener('click', handleGenerationClick);
    if(regenerateBtn) regenerateBtn.addEventListener('click', () => handleGenerationClick(true));
    if(closeNoCreditsModalBtn) closeNoCreditsModalBtn.addEventListener('click', () => noCreditsModal.classList.add('hidden'));

    if (promptInput) {
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generateBtn.click();
            }
        });
    }

    if(examplePrompts) {
        examplePrompts.forEach(button => {
            button.addEventListener('click', () => {
                promptInput.value = button.innerText.trim();
                promptInput.focus();
            });
        });
    }

    if(aspectRatioBtns) {
        aspectRatioBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                aspectRatioBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedAspectRatio = btn.dataset.ratio;
            });
        });
    }

    if(copyPromptBtn) copyPromptBtn.addEventListener('click', copyPrompt);
    if(enhancePromptBtn) enhancePromptBtn.addEventListener('click', handleEnhancePrompt);

    if(imageUploadBtn) imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
    if(imageUploadInput) imageUploadInput.addEventListener('change', handleImageUpload);
    if(removeImageBtn) removeImageBtn.addEventListener('click', removeUploadedImage);
}

/**
 * Handles the logic for the generate and regenerate buttons.
 * @param {boolean} isRegen - True if regenerating.
 */
function handleGenerationClick(isRegen = false) {
    const authModal = document.getElementById('auth-modal');
    const noCreditsModal = document.getElementById('no-credits-modal');

    // 1. Check if signed in
    if (!currentUser) {
        authModal.setAttribute('aria-hidden', 'false');
        return;
    }

    // 2. Check for credits
    if (userCredits <= 0) {
        noCreditsModal.classList.remove('hidden');
        noCreditsModal.setAttribute('aria-hidden', 'false');
        return;
    }
    
    // 3. Check for prompt
    const promptInput = isRegen ? document.getElementById('regenerate-prompt-input') : document.getElementById('prompt-input');
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showMessage('Please describe what you want to create.', 'error');
        return;
    }

    // All checks passed, proceed to generate
    isRegenerating = isRegen;
    generateImage(prompt);
}


// --- AI & Generation Logic ---

async function handleEnhancePrompt() {
    // ... (This function remains unchanged)
}

async function generateImage(prompt) {
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
        const result = await generateImageWithRetry(prompt, uploadedImageData, selectedAspectRatio, currentUser.uid);
        displayImage(result.imageUrl, prompt);
        // Credit display will update automatically via the Firestore listener
        console.log(`Image generated. Credits remaining: ${result.remainingCredits}`);
    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, generation failed. ${error.message}`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        document.getElementById('regenerate-prompt-input').value = lastPrompt;
        postGenerationControls.classList.remove('hidden');
        addNavigationButtons();
        isRegenerating = false;
    }
}

async function generateImageWithRetry(prompt, imageData, aspectRatio, userId, maxRetries = 2) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, imageData, aspectRatio, userId }) // Pass userId to API
            });

            const result = await response.json();

            if (!response.ok) {
                if (result.code === 'NO_CREDITS') {
                    // Handle specific no credits error
                    document.getElementById('no-credits-modal').classList.remove('hidden');
                }
                throw new Error(result.error || `API Error: ${response.status}`);
            }

            const base64Data = result.predictions?.[0]?.bytesBase64Encoded;
            if (!base64Data) throw new Error("No image data received from API.");
            
            return {
                imageUrl: `data:image/png;base64,${base64Data}`,
                remainingCredits: result.remainingCredits
            };

        } catch (error) {
            if (attempt >= maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}


// --- Authentication & User State ---

function handleAuthAction() { if (currentUser) signOut(auth); else signInWithGoogle(); }

function signInWithGoogle() { 
    const authModal = document.getElementById('auth-modal');
    signInWithPopup(auth, provider)
        .then(() => {
            if (authModal) authModal.setAttribute('aria-hidden', 'true');
        })
        .catch(error => console.error("Authentication Error:", error)); 
}

function updateUIForAuthState(isLoggedIn) {
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const creditDisplay = document.getElementById('credit-display');
    const mobileCreditDisplay = document.getElementById('mobile-credit-display');
    
    if (isLoggedIn) {
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        
        creditDisplay.innerHTML = `
            <span class="text-sm font-medium text-gray-700">Credits: ${userCredits}</span>
            ${userCredits <= 0 ? `<a href="pricing.html" class="text-sm font-semibold text-white bg-blue-500 px-3 py-1.5 rounded-md hover:bg-blue-600 transition-colors">Buy Credits</a>` : ''}
        `;
        mobileCreditDisplay.innerHTML = `Credits: ${userCredits}`;
        
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        creditDisplay.innerHTML = '';
        mobileCreditDisplay.innerHTML = '';
    }
}

// --- UI & Utility Functions ---

function initializeCursor() {
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');
    if (!cursorDot || !cursorOutline) return;
    
    let mouseX = 0, mouseY = 0;
    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    const animateCursor = () => {
        cursorDot.style.left = `${mouseX}px`;
        cursorDot.style.top = `${mouseY}px`;
        cursorOutline.style.transform = `translate(calc(${mouseX}px - 50%), calc(${mouseY}px - 50%))`;
        requestAnimationFrame(animateCursor);
    };
    requestAnimationFrame(animateCursor);
}

function initializeMusicPlayer() {
    const musicBtn = document.getElementById('music-btn');
    const lofiMusic = document.getElementById('lofi-music');
    if (!musicBtn || !lofiMusic) return;

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

function handleImageUpload(event) {
    // ... (This function remains unchanged)
}

function removeUploadedImage() {
    // ... (This function remains unchanged)
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

    imgContainer.appendChild(img);
    imgContainer.appendChild(downloadButton);
    imageGrid.appendChild(imgContainer);
}

function showMessage(text, type = 'info') {
    // ... (This function remains unchanged)
}

function addNavigationButtons() {
    // ... (This function remains unchanged)
}

function copyPrompt() {
    // ... (This function remains unchanged)
}

function startTimer() {
    // ... (This function remains unchanged)
}

function stopTimer() {
    // ... (This function remains unchanged)
}
