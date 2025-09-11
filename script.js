// --- UPDATED ---
// This script now manages user authentication and credit balance with Firestore.
// It deducts credits via the backend API for image generation.

// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase configuration
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

// Export auth to be used by pricing.js
export { auth };

// --- Global State ---
let timerInterval;
let uploadedImageData = null;
let selectedAspectRatio = '1:1';
let isRegenerating = false;
let lastPrompt = '';
let currentUserCredits = 0;
let unsubscribeUserDoc; // To store the onSnapshot listener

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeUniversalScripts();
    if (document.getElementById('generator-ui')) {
        initializeGeneratorPage();
    }
});

function initializeUniversalScripts() {
    onAuthStateChanged(auth, user => {
        if (user) {
            handleUserLogin(user);
        } else {
            handleUserLogout();
        }
    });

    // ... (rest of universal scripts like mobile menu, cursor, music player remain the same)
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }
    document.getElementById('auth-btn')?.addEventListener('click', handleAuthAction);
    document.getElementById('mobile-auth-btn')?.addEventListener('click', handleAuthAction);
    document.getElementById('google-signin-btn')?.addEventListener('click', signInWithGoogle);
    document.getElementById('close-modal-btn')?.addEventListener('click', () => document.getElementById('auth-modal')?.setAttribute('aria-hidden', 'true'));
}

function initializeGeneratorPage() {
    // ... (All generator page event listeners remain largely the same)
    document.getElementById('generate-btn').addEventListener('click', () => {
        const prompt = document.getElementById('prompt-input').value.trim();
        if (!prompt) return showMessage('Please describe what you want to create.', 'error');
        isRegenerating = false;
        triggerImageGeneration();
    });
    
    document.getElementById('regenerate-btn').addEventListener('click', () => {
        const prompt = document.getElementById('regenerate-prompt-input').value.trim();
        if (!prompt) return showMessage('Please enter a prompt to regenerate.', 'error');
        isRegenerating = true;
        triggerImageGeneration();
    });
    // ... other listeners like enhance, copy, aspect ratio etc.
}


// --- Authentication & User State ---

async function handleUserLogin(user) {
    const userRef = doc(db, "users", user.uid);
    
    // Unsubscribe from previous listener if it exists
    if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
    }

    // Check if user document exists, create if not
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
        await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName,
            createdAt: new Date(),
            credits: 5 // Give 5 free credits on first sign-up
        });
    }

    // Listen for real-time updates to the user's document
    unsubscribeUserDoc = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
            const userData = doc.data();
            currentUserCredits = userData.credits || 0;
            updateUICredits();
            updateGenerateButtonState();
        }
    });

    updateUIForAuthState(user);
}

function handleUserLogout() {
    if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
    }
    currentUserCredits = 0;
    updateUIForAuthState(null);
    updateGenerateButtonState();
}

function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth).catch(error => console.error("Sign out error:", error));
    } else {
        signInWithGoogle();
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(() => document.getElementById('auth-modal')?.setAttribute('aria-hidden', 'true'))
        .catch(error => console.error("Authentication Error:", error));
}

function updateUIForAuthState(user) {
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    if (user) {
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        updateUICredits(); // Will show "Sign in for credits"
    }
}

function updateUICredits() {
    const generationCounterEl = document.getElementById('generation-counter');
    const mobileGenerationCounterEl = document.getElementById('mobile-generation-counter');
    let text;
    if (auth.currentUser) {
        text = `Credits: ${currentUserCredits}`;
    } else {
        text = 'Sign in for credits';
    }
    if (generationCounterEl) generationCounterEl.textContent = text;
    if (mobileGenerationCounterEl) mobileGenerationCounterEl.textContent = text;
}

function updateGenerateButtonState() {
    const generateBtn = document.getElementById('generate-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');
    const isDisabled = currentUserCredits <= 0;
    
    if (generateBtn) {
        generateBtn.disabled = isDisabled;
        generateBtn.classList.toggle('opacity-50', isDisabled);
        generateBtn.classList.toggle('cursor-not-allowed', isDisabled);
    }
    if (regenerateBtn) {
        regenerateBtn.disabled = isDisabled;
        regenerateBtn.classList.toggle('opacity-50', isDisabled);
        regenerateBtn.classList.toggle('cursor-not-allowed', isDisabled);
    }
}

// --- Image Generation Logic ---

async function triggerImageGeneration() {
    const user = auth.currentUser;

    if (!user) {
        document.getElementById('auth-modal')?.setAttribute('aria-hidden', 'false');
        return;
    }

    if (currentUserCredits <= 0) {
        showMessage('You are out of credits! Please purchase a plan to continue.', 'error');
        // Maybe redirect to pricing page after a delay
        setTimeout(() => window.location.href = 'pricing.html', 2000);
        return;
    }

    const idToken = await user.getIdToken();
    generateImage(idToken);
}

async function generateImage(idToken) {
    lastPrompt = isRegenerating 
        ? document.getElementById('regenerate-prompt-input').value.trim() 
        : document.getElementById('prompt-input').value.trim();
    
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
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: lastPrompt, 
                imageData: uploadedImageData, 
                idToken, 
                aspectRatio: selectedAspectRatio 
            })
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || `API Error: ${response.status}`);
        }

        const result = await response.json();
        let base64Data;
        if (uploadedImageData) {
            base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        } else {
            base64Data = result.predictions?.[0]?.bytesBase64Encoded;
        }
        
        if (!base64Data) throw new Error("No image data received from API.");
        
        displayImage(`data:image/png;base64,${base64Data}`, lastPrompt);

    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Generation failed: ${error.message}`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        document.getElementById('regenerate-prompt-input').value = lastPrompt;
        postGenerationControls.classList.remove('hidden');
        isRegenerating = false;
    }
}


// --- UI & Utility Functions (Largely Unchanged) ---
// Note: Removed reCAPTCHA, localStorage, and blurring logic.

function displayImage(imageUrl, prompt) {
    const imageGrid = document.getElementById('image-grid');
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group fade-in-slide-up mx-auto max-w-2xl border border-gray-200/80';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    
    const downloadButton = document.createElement('button');
    downloadButton.className = 'absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300';
    downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
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
    const messageBox = document.getElementById('message-box');
    const color = type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';
    messageBox.innerHTML = `<div class="p-4 rounded-lg ${color} fade-in-slide-up">${text}</div>`;
    setTimeout(() => messageBox.innerHTML = '', 5000);
}

function startTimer() {
    const timerEl = document.getElementById('timer');
    const progressBar = document.getElementById('progress-bar');
    let startTime = Date.now();
    const maxTime = 17000;
    progressBar.style.width = '0%';
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / maxTime, 1);
        progressBar.style.width = `${progress * 100}%`;
        timerEl.textContent = `${(elapsedTime / 1000).toFixed(1)}s / ~17s`;
    }, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
    document.getElementById('progress-bar').style.width = '100%';
}

// ... (Add back other utility functions like handleImageUpload, enhancePrompt, etc. as they are unchanged)
