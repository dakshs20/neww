// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut, onAuthStateChanged, getRedirectResult, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// Firestore is not directly used for this app's data persistence, but imported for completeness if needed later.
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// --- Firebase Configuration and Initialization ---
// MANDATORY: Use __app_id and __firebase_config provided by the Canvas environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore, though not used for this app's current features
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

// --- Initial Authentication on Load ---
// This ensures the user is signed in either via custom token or anonymously
// when the app loads, which is crucial for Canvas environment.
async function initializeAuth() {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
            console.log("Signed in with custom token.");
        } else {
            await signInAnonymously(auth);
            console.log("Signed in anonymously.");
        }
    } catch (error) {
        console.error("Firebase initial sign-in error:", error);
        // Fallback to anonymous if custom token fails, or just proceed if already signed in
        if (error.code !== 'auth/already-initialized' && error.code !== 'auth/already-signed-in') {
             await signInAnonymously(auth);
        }
    }
}

// Call initial authentication function
initializeAuth();

// --- Mobile Menu Logic ---
mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
});

// Close menu if clicking outside
document.addEventListener('click', (event) => {
    if (!mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
        mobileMenu.classList.add('hidden');
    }
});

// --- Auth Logic ---
onAuthStateChanged(auth, user => {
    updateUIForAuthState(user);
});

getRedirectResult(auth).catch((error) => {
    console.error("Auth Redirect Error:", error);
    showMessage(`Authentication failed: ${error.message}`, 'error');
});

authBtn.addEventListener('click', handleAuthAction);
mobileAuthBtn.addEventListener('click', handleAuthAction);
googleSignInBtn.addEventListener('click', signInWithGoogle);
closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));

function handleAuthAction() {
    if (auth.currentUser && !auth.currentUser.isAnonymous) { // Check if it's a signed-in user, not anonymous
        signOut(auth);
    } else {
        signInWithGoogle();
    }
}

function signInWithGoogle() {
    signInWithRedirect(auth, provider);
}

function updateUIForAuthState(user) {
    if (user && !user.isAnonymous) { // User is signed in with a real account
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        generationCounterEl.textContent = 'Unlimited Generations';
        mobileGenerationCounterEl.textContent = 'Unlimited Generations';
        authModal.setAttribute('aria-hidden', 'true');
    } else { // User is anonymous or signed out
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        updateGenerationCounter();
    }
}

// --- Generation Counter Logic ---
function getGenerationCount() {
    return parseInt(localStorage.getItem('generationCount') || '0');
}

function incrementGenerationCount() {
    const newCount = getGenerationCount() + 1;
    localStorage.setItem('generationCount', newCount);
    updateGenerationCounter();
    return newCount;
}

function updateGenerationCounter() {
    if (auth.currentUser && !auth.currentUser.isAnonymous) return; // If signed in, no need for counter
    const count = getGenerationCount();
    const remaining = Math.max(0, FREE_GENERATION_LIMIT - count);
    const text = `${remaining} free generations left`;
    generationCounterEl.textContent = text;
    mobileGenerationCounterEl.textContent = text;
}


// --- UI Interaction Logic ---
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

// --- Core Image Generation Logic ---
async function generateImage() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showMessage('Please describe the image you want to create.', 'error');
        return;
    }

    // Check free generation limit only if user is anonymous
    if (auth.currentUser && auth.currentUser.isAnonymous && getGenerationCount() >= FREE_GENERATION_LIMIT) {
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
        // Increment count only if user is anonymous
        if (auth.currentUser && auth.currentUser.isAnonymous) {
            incrementGenerationCount();
        }
    } catch (error) {
        console.error('Image generation failed after multiple retries:', error);
        showMessage(`Sorry, we couldn't generate the image. Please try again. Error: ${error.message}`, 'error');
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
            // The API key is intentionally left empty. The Canvas environment will inject it at runtime.
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error ${response.status}: ${errorData.error.message || response.statusText}`);
            }
            
            const result = await response.json();
            if (result.predictions?.[0]?.bytesBase64Encoded) return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
            else throw new Error("No image data received from API.");
        } catch (error) {
            console.warn(`Attempt ${attempt + 1} failed: ${error.message}. Retrying...`);
            if (attempt >= maxRetries - 1) throw error;
            // Exponential backoff
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
    messageEl.className = `p-2 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-gray-600'} fade-in-slide-up`;
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
