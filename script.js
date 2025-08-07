// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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
const examplePrompts = document.querySelectorAll('.example-prompt');
const generatorUI = document.getElementById('generator-ui');

// Auth Buttons
const authBtn = document.getElementById('auth-btn');
const mobileAuthBtn = document.getElementById('mobile-auth-btn');

// Counters
const generationCounterEl = document.getElementById('generation-counter');
const mobileGenerationCounterEl = document.getElementById('mobile-generation-counter');

// Modal
const authModal = document.getElementById('auth-modal');
const googleSignInBtn = document.getElementById('google-signin-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

// Mobile Menu
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

let timerInterval;
const FREE_GENERATION_LIMIT = 3;

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Auth Initialization ---
    // This listener is the single source of truth for the user's auth state.
    // It reliably fires after the page loads and after any sign-in/sign-out/redirect events.
    onAuthStateChanged(auth, user => {
        updateUIForAuthState(user);
    });

    // --- Event Listeners ---
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (event) => {
        if (!mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
            mobileMenu.classList.add('hidden');
        }
    });

    authBtn.addEventListener('click', handleAuthAction);
    mobileAuthBtn.addEventListener('click', handleAuthAction);
    googleSignInBtn.addEventListener('click', signInWithGoogle);
    closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));

    examplePrompts.forEach(button => {
        button.addEventListener('click', () => {
            promptInput.value = button.innerText.trim();
            promptInput.focus();
        });
    });

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generateImage();
        }
    });

    generateBtn.addEventListener('click', generateImage);
});


// --- Auth Functions ---
function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth);
    } else {
        signInWithGoogle();
    }
}

function signInWithGoogle() {
    signInWithRedirect(auth, provider);
}

function updateUIForAuthState(user) {
    if (user) {
        // User is signed in.
        const welcomeText = `Welcome, ${user.displayName.split(' ')[0]}`;
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        generationCounterEl.textContent = welcomeText;
        mobileGenerationCounterEl.textContent = welcomeText;
        authModal.setAttribute('aria-hidden', 'true');
    } else {
        // User is signed out.
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        updateGenerationCounter();
    }
}

// --- Generation Counter Functions ---
function getGenerationCount() {
    return parseInt(localStorage.getItem('generationCount') || '0');
}

function incrementGenerationCount() {
    const newCount = getGenerationCount() + 1;
    localStorage.setItem('generationCount', newCount);
    updateGenerationCounter();
}

function updateGenerationCounter() {
    if (auth.currentUser) return; // Don't show counter if signed in
    const count = getGenerationCount();
    const remaining = Math.max(0, FREE_GENERATION_LIMIT - count);
    const text = `${remaining} free generation${remaining !== 1 ? 's' : ''} left`;
    generationCounterEl.textContent = text;
    mobileGenerationCounterEl.textContent = text;
}


// --- Core Image Generation Logic ---
async function generateImage() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showMessage('Please describe the image you want to create.', 'error');
        return;
    }

    if (!auth.currentUser && getGenerationCount() >= FREE_GENERATION_LIMIT) {
        authModal.setAttribute('aria-hidden', 'false');
        return;
    }

    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    resultContainer.classList.remove('hidden');
    loadingIndicator.classList.remove('hidden');
    generatorUI.classList.add('hidden');
    
    startTimer();

    try {
        const imageUrl = await generateImageWithRetry(prompt);
        displayImage(imageUrl, prompt);
        if (!auth.currentUser) {
            incrementGenerationCount();
        }
    } catch (error) {
        console.error('Image generation failed after multiple retries:', error);
        showMessage(`Sorry, we couldn't generate the image. Please try again.`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        addBackButton();
    }
}

async function generateImageWithRetry(prompt, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const payload = { instances: [{ prompt }], parameters: { "sampleCount": 1 } };
            const apiKey = "AIzaSyBZxXWl9s2AeSCzMrfoEfnYWpGyfvP7jqs";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const result = await response.json();
            if (result.predictions?.[0]?.bytesBase64Encoded) return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
            else throw new Error("No image data received from API.");
        } catch (error) {
            if (attempt >= maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

// --- Helper Functions ---
function displayImage(imageUrl, prompt) {
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
    const messageEl = document.createElement('div');
    messageEl.className = `p-2 rounded-lg ${type === 'error' ? 'text-red-600' : 'text-gray-600'} fade-in-slide-up`;
    messageEl.textContent = text;
    messageBox.innerHTML = ''; 
    messageBox.appendChild(messageEl);
}

function addBackButton() {
    const backButton = document.createElement('button');
    backButton.textContent = '← Create another';
    backButton.className = 'mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
    backButton.onclick = () => {
        generatorUI.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        imageGrid.innerHTML = '';
        messageBox.innerHTML = '';
        promptInput.value = '';
    };
    messageBox.prepend(backButton);
}

function startTimer() {
    let startTime = Date.now();
    const maxTime = 17 * 1000;
    progressBar.style.width = '0%';
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / maxTime, 1);
        progressBar.style.width = `${progress * 100}%`;
        timerEl.textContent = `${(elapsedTime / 1000).toFixed(1)}s / ~17s`;
        if (elapsedTime >= maxTime) timerEl.textContent = `17.0s / ~17s`;
    }, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
    progressBar.style.width = '100%';
}
