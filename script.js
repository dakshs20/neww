// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.appspot.com",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- DOM Element References ---
const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');
const resultContainer = document.getElementById('result-container');
const loadingIndicator = document.getElementById('loading-indicator');
const imageGrid = document.getElementById('image-grid');
const timerEl = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const messageBox = document.getElementById('message-box');
const generatorUI = document.getElementById('generator-ui');
const imageUploadBtn = document.getElementById('image-upload-btn');
const imageUploadInput = document.getElementById('image-upload-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const authBtn = document.getElementById('auth-btn');
const mobileAuthBtn = document.getElementById('mobile-auth-btn');
const authModal = document.getElementById('auth-modal');
const googleSignInBtn = document.getElementById('google-signin-btn');
const closeModalBtn = document.getElementById('close-auth-modal-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const regenerateBtn = document.getElementById('regenerate-btn');
const regeneratePromptInput = document.getElementById('regenerate-prompt-input');
const postGenerationControls = document.getElementById('post-generation-controls');
const cursorDot = document.querySelector('.cursor-dot');
const cursorOutline = document.querySelector('.cursor-outline');

// --- Credit System UI References ---
const creditBalanceDisplay = document.getElementById('credit-balance-display');
const mobileCreditBalanceDisplay = document.getElementById('mobile-credit-balance-display');
const buyCreditsBtn = document.getElementById('buy-credits-btn');
const mobileBuyCreditsBtn = document.getElementById('mobile-buy-credits-btn');
const creditsModal = document.getElementById('credits-modal');
const closeCreditsModalBtn = document.getElementById('close-credits-modal-btn');

// --- App State ---
let timerInterval;
let uploadedImageData = null;
let selectedAspectRatio = '1:1';
let isRegenerating = false;
let lastPrompt = '';
let currentUserState = null;
let currentUserCredits = 0;
let unsubscribeUserDoc = null; // To store the listener unsubscribe function

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        currentUserState = user;
        updateUIForAuthState(user);
        if (user) {
            listenToUserData(user.uid);
        } else if (unsubscribeUserDoc) {
            unsubscribeUserDoc(); // Stop listening if user logs out
        }
    });

    mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    authBtn.addEventListener('click', handleAuthAction);
    mobileAuthBtn.addEventListener('click', handleAuthAction);
    googleSignInBtn.addEventListener('click', signInWithGoogle);
    closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));
    closeCreditsModalBtn.addEventListener('click', () => creditsModal.setAttribute('aria-hidden', 'true'));
    
    generateBtn.addEventListener('click', () => handleGeneration(false));
    regenerateBtn.addEventListener('click', () => handleGeneration(true));
    
    // Other event listeners
    setupOtherEventListeners();
    setupCustomCursor();
});

function handleAuthAction() {
    if (currentUserState) {
        signOut(auth);
    } else {
        authModal.setAttribute('aria-hidden', 'false');
    }
}

async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const idToken = await user.getIdToken(true);

        // Call provisioning endpoint, which is idempotent
        await fetch('/api/provision-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: idToken }),
        });
        
        authModal.setAttribute('aria-hidden', 'true');
    } catch (error) {
        console.error("Authentication or Provisioning Error:", error);
        showMessage('Could not sign you in. Please try again.', 'error');
    }
}

function updateUIForAuthState(user) {
    if (user) {
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        authModal.setAttribute('aria-hidden', 'true');
    } else {
        // Logged out state
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        creditBalanceDisplay.classList.add('hidden');
        mobileCreditBalanceDisplay.classList.add('hidden');
        buyCreditsBtn.classList.add('hidden');
        mobileBuyCreditsBtn.classList.add('hidden');
    }
}

function listenToUserData(uid) {
    const userDocRef = doc(db, 'users', uid);
    unsubscribeUserDoc = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const userData = doc.data();
            currentUserCredits = userData.creditBalance || 0;
            updateCreditDisplay(currentUserCredits);
        }
    }, (error) => {
        console.error("Error listening to user data:", error);
    });
}

function updateCreditDisplay(balance) {
    const balanceText = `Credits: ${balance}`;
    creditBalanceDisplay.textContent = balanceText;
    mobileCreditBalanceDisplay.textContent = balanceText;

    creditBalanceDisplay.classList.remove('hidden');
    mobileCreditBalanceDisplay.classList.remove('hidden');

    if (balance <= 0) {
        buyCreditsBtn.classList.remove('hidden');
        mobileBuyCreditsBtn.classList.remove('hidden');
    } else {
        buyCreditsBtn.classList.add('hidden');
        mobileBuyCreditsBtn.classList.add('hidden');
    }
}

function handleGeneration(isRegen) {
    isRegenerating = isRegen;
    const prompt = isRegenerating ? regeneratePromptInput.value.trim() : promptInput.value.trim();

    if (!prompt) {
        showMessage('Please describe what you want to create.', 'error');
        return;
    }

    if (!currentUserState) {
        authModal.setAttribute('aria-hidden', 'false');
        return;
    }

    if (currentUserCredits <= 0) {
        creditsModal.setAttribute('aria-hidden', 'false');
        return;
    }

    generateImage(prompt);
}

async function generateImage(prompt) {
    lastPrompt = prompt;
    
    // UI updates for generation start
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
        const idToken = await currentUserState.getIdToken();
        const idempotencyKey = crypto.randomUUID();

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                prompt,
                imageData: uploadedImageData,
                aspectRatio: selectedAspectRatio,
                idempotencyKey
            })
        });

        if (response.status === 402) {
            showMessage("You're out of credits.", 'error');
            creditsModal.setAttribute('aria-hidden', 'false');
            // Revert UI
            generatorUI.classList.remove('hidden');
            resultContainer.classList.add('hidden');
            return;
        }

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || `API Error: ${response.status}`);
        }

        const result = await response.json();
        displayImage(result.imageUrl, prompt);
        // Credit display will update automatically via onSnapshot

    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, generation failed: ${error.message}`, 'error');
        // Show back button even on failure
        addNavigationButtons();
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        regeneratePromptInput.value = lastPrompt;
        postGenerationControls.classList.remove('hidden');
        addNavigationButtons();
        isRegenerating = false; // Reset flag
    }
}

// --- Helper Functions (some are simplified or modified) ---

function displayImage(imageUrl, prompt) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group fade-in-slide-up mx-auto max-w-2xl border border-gray-200/80';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity';
    downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
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
    const messageEl = document.createElement('div');
    messageEl.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up`;
    messageEl.textContent = text;
    messageBox.innerHTML = '';
    messageBox.appendChild(messageEl);
    setTimeout(() => {
        if (messageBox.contains(messageEl)) {
            messageBox.removeChild(messageEl);
        }
    }, 5000);
}

function addNavigationButtons() {
    const existingButton = document.getElementById('start-new-btn');
    if (existingButton) return;
    const startNewButton = document.createElement('button');
    startNewButton.id = 'start-new-btn';
    startNewButton.textContent = '← Start New';
    startNewButton.className = 'text-sm sm:text-base mt-4 text-blue-600 font-semibold hover:text-blue-800';
    startNewButton.onclick = () => {
        generatorUI.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        imageGrid.innerHTML = '';
        messageBox.innerHTML = '';
        postGenerationControls.classList.add('hidden');
        promptInput.value = '';
        regeneratePromptInput.value = '';
        removeUploadedImage();
    };
    messageBox.prepend(startNewButton);
}

function startTimer() { /* Unchanged */ 
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
function stopTimer() { /* Unchanged */ 
    clearInterval(timerInterval);
    progressBar.style.width = '100%';
}

function setupOtherEventListeners() { /* Unchanged helper to keep code clean */
    document.querySelectorAll('.aspect-ratio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.aspect-ratio-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAspectRatio = btn.dataset.ratio;
        });
    });

    imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            uploadedImageData = { mimeType: file.type, data: reader.result.split(',')[1] };
            imagePreview.src = reader.result;
            imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    });
    removeImageBtn.addEventListener('click', removeUploadedImage);
}

function removeUploadedImage() { /* Unchanged */
    uploadedImageData = null;
    imageUploadInput.value = '';
    imagePreviewContainer.classList.add('hidden');
    imagePreview.src = '';
}

function setupCustomCursor() {
    if (cursorDot && cursorOutline) {
        let mouseX = 0, mouseY = 0;
        let outlineX = 0, outlineY = 0;

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        const animateCursor = () => {
            cursorDot.style.left = `${mouseX}px`;
            cursorDot.style.top = `${mouseY}px`;
            const ease = 0.15;
            outlineX += (mouseX - outlineX) * ease;
            outlineY += (mouseY - outlineY) * ease;
            cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
            requestAnimationFrame(animateCursor);
        };
        requestAnimationFrame(animateCursor);

        const interactiveElements = document.querySelectorAll('a, button, textarea, input, label');
        interactiveElements.forEach(el => {
            el.addEventListener('mouseover', () => cursorOutline.classList.add('cursor-hover'));
            el.addEventListener('mouseout', () => cursorOutline.classList.remove('cursor-hover'));
        });
    }
}

