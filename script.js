// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, runTransaction, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const imageUploadBtn = document.getElementById('image-upload-btn');
const imageUploadInput = document.getElementById('image-upload-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const authBtn = document.getElementById('auth-btn');
const mobileAuthBtn = document.getElementById('mobile-auth-btn');
const authModal = document.getElementById('auth-modal');
const googleSignInBtn = document.getElementById('google-signin-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const copyPromptBtn = document.getElementById('copy-prompt-btn');
const enhancePromptBtn = document.getElementById('enhance-prompt-btn');
const promptSuggestionsContainer = document.getElementById('prompt-suggestions');
const postGenerationControls = document.getElementById('post-generation-controls');
const regeneratePromptInput = document.getElementById('regenerate-prompt-input');
const regenerateBtn = document.getElementById('regenerate-btn');

// --- NEW/MODIFIED DOM elements for Credit System ---
const creditDisplay = document.getElementById('credit-display');
const creditBalanceSpan = document.getElementById('credit-balance');
const buyCreditsBtn = document.getElementById('buy-credits-btn');
const mobileCreditDisplay = document.getElementById('mobile-credit-display');
const mobileCreditBalanceSpan = document.getElementById('mobile-credit-balance');
const mobileBuyCreditsBtn = document.getElementById('mobile-buy-credits-btn');
const creditsModal = document.getElementById('credits-modal');
const closeModalBtns = document.querySelectorAll('.close-modal-btn');


let timerInterval;
let uploadedImageData = null;
let selectedAspectRatio = '1:1';
let isRegenerating = false;
let lastPrompt = '';
let currentUserState = { user: null, credits: 0, listener: null };

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        if (user) {
            setupUser(user);
        } else {
            tearDownUser();
        }
    });

    mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    document.addEventListener('click', (event) => {
        if (!mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
            mobileMenu.classList.add('hidden');
        }
    });
    
    authBtn.addEventListener('click', handleAuthAction);
    mobileAuthBtn.addEventListener('click', handleAuthAction);
    googleSignInBtn.addEventListener('click', signInWithGoogle);
    closeModalBtns.forEach(btn => btn.addEventListener('click', () => {
        authModal.setAttribute('aria-hidden', 'true');
        creditsModal.setAttribute('aria-hidden', 'true');
    }));

    examplePrompts.forEach(button => {
        button.addEventListener('click', () => {
            promptInput.value = button.innerText.trim();
            promptInput.focus();
        });
    });
    
    generateBtn.addEventListener('click', handleGeneration);
    regenerateBtn.addEventListener('click', handleGeneration);

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generateBtn.click();
        }
    });

    aspectRatioBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.aspect-ratio-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAspectRatio = btn.dataset.ratio;
        });
    });

    copyPromptBtn.addEventListener('click', copyPrompt);
    enhancePromptBtn.addEventListener('click', handleEnhancePrompt);

    let suggestionTimeout;
    promptInput.addEventListener('input', () => {
        clearTimeout(suggestionTimeout);
        const promptText = promptInput.value.trim();
        if (promptText.length < 10) {
            promptSuggestionsContainer.innerHTML = '';
            promptSuggestionsContainer.classList.add('hidden');
            return;
        }
        promptSuggestionsContainer.innerHTML = `<span class="text-sm text-gray-400 italic">AI is thinking...</span>`;
        promptSuggestionsContainer.classList.remove('hidden');
        suggestionTimeout = setTimeout(() => fetchAiSuggestions(promptText), 300);
    });

    imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
    imageUploadInput.addEventListener('change', handleImageUpload);
    removeImageBtn.addEventListener('click', removeUploadedImage);
});

// --- User & Credit Management ---

async function setupUser(user) {
    currentUserState.user = user;

    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
        // First-time sign-in: Grant free credits in a transaction
        try {
            await runTransaction(db, async (transaction) => {
                const userLedgerRef = doc(collection(db, `users/${user.uid}/creditLedger`));
                
                transaction.set(userRef, {
                    email: user.email,
                    displayName: user.displayName,
                    createdAt: serverTimestamp(),
                    creditBalance: 5
                });

                transaction.set(userLedgerRef, {
                    delta: 5,
                    reason: 'ALLOCATE_FREE',
                    createdAt: serverTimestamp()
                });
            });
            console.log("New user created and 5 free credits allocated.");
        } catch (e) {
            console.error("Transaction failed: ", e);
        }
    }
    
    // Attach a real-time listener to the user's document
    if (currentUserState.listener) currentUserState.listener(); // Detach old listener if any
    
    currentUserState.listener = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            currentUserState.credits = data.creditBalance || 0;
            updateUIForAuthState(user, currentUserState.credits);
        }
    }, (error) => {
        console.error("Error listening to user document:", error);
    });
}

function tearDownUser() {
    // Detach the listener when the user signs out
    if (currentUserState.listener) {
        currentUserState.listener();
        currentUserState.listener = null;
    }
    currentUserState = { user: null, credits: 0, listener: null };
    updateUIForAuthState(null, 0);
}

function updateUIForAuthState(user, credits) {
    if (user) {
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        authModal.setAttribute('aria-hidden', 'true');
        
        creditDisplay.classList.remove('hidden');
        mobileCreditDisplay.classList.remove('hidden');
        creditBalanceSpan.textContent = credits;
        mobileCreditBalanceSpan.textContent = credits;

        if (credits <= 0) {
            buyCreditsBtn.classList.remove('hidden');
            mobileBuyCreditsBtn.classList.remove('hidden');
        } else {
            buyCreditsBtn.classList.add('hidden');
            mobileBuyCreditsBtn.classList.add('hidden');
        }
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        creditDisplay.classList.add('hidden');
        mobileCreditDisplay.classList.add('hidden');
        buyCreditsBtn.classList.add('hidden');
        mobileBuyCreditsBtn.classList.add('hidden');
    }
}

// --- Generation Flow ---

function handleGeneration(event) {
    isRegenerating = event.currentTarget.id === 'regenerate-btn';
    const prompt = isRegenerating ? regeneratePromptInput.value.trim() : promptInput.value.trim();

    if (!prompt) {
        showMessage('Please describe what you want to create.', 'error');
        return;
    }

    if (!currentUserState.user) {
        authModal.setAttribute('aria-hidden', 'false');
        return;
    }
    
    if (currentUserState.credits <= 0) {
        creditsModal.setAttribute('aria-hidden', 'false');
        return;
    }
    
    // Generate a unique key for this specific request to prevent double spending
    const idempotencyKey = crypto.randomUUID();
    generateImage(prompt, idempotencyKey);
}


async function generateImage(prompt, idempotencyKey) {
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
        const idToken = await currentUserState.user.getIdToken();
        const response = await fetch('/api/generate-with-credits', {
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

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `API Error: ${response.status}`);
        }

        displayImage(result.imageUrl, prompt);

    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Generation failed: ${error.message}`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        regeneratePromptInput.value = lastPrompt;
        postGenerationControls.classList.remove('hidden');
        addNavigationButtons();
        isRegenerating = false; // Reset flag
    }
}


// --- Auth Actions ---

function handleAuthAction() { if (auth.currentUser) signOut(auth); else signInWithGoogle(); }

function signInWithGoogle() {
    signInWithPopup(auth, provider).catch(error => {
        console.error("Authentication Error:", error);
        showMessage("Failed to sign in. Please try again.", "error");
    });
}


// --- UI & Utility Functions (Mostly Unchanged) ---

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
        a.click();
    };

    imgContainer.appendChild(img);
    imgContainer.appendChild(downloadButton);
    imageGrid.appendChild(imgContainer);
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        uploadedImageData = { mimeType: file.type, data: reader.result.split(',')[1] };
        imagePreview.src = reader.result;
        imagePreviewContainer.classList.remove('hidden');
        promptInput.placeholder = "Describe the edits you want to make...";
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageData = null;
    imageUploadInput.value = '';
    imagePreviewContainer.classList.add('hidden');
    imagePreview.src = '';
    promptInput.placeholder = "An oil painting of a futuristic city skyline at dusk...";
}

async function handleEnhancePrompt() {
    const promptText = promptInput.value.trim();
    if (!promptText) return showMessage('Please enter a prompt to enhance.', 'info');
    enhancePromptBtn.disabled = true;
    try {
        const response = await fetch('/api/enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });
        if (!response.ok) throw new Error('Failed to get enhancement.');
        const data = await response.json();
        promptInput.value = data.text;
    } catch (error) {
        showMessage('Could not enhance prompt.', 'error');
    } finally {
        enhancePromptBtn.disabled = false;
    }
}

async function fetchAiSuggestions(promptText) {
    try {
        const response = await fetch('/api/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });
        if (!response.ok) return;
        const data = await response.json();
        promptSuggestionsContainer.innerHTML = '';
        if (data.suggestions && data.suggestions.length > 0) {
            data.suggestions.slice(0, 3).forEach(suggestion => {
                const btn = document.createElement('button');
                btn.className = 'prompt-suggestion-btn';
                btn.textContent = `Add "${suggestion}"`;
                btn.onmousedown = (e) => {
                    e.preventDefault();
                    promptInput.value += `, ${suggestion}`;
                    promptSuggestionsContainer.classList.add('hidden');
                };
                promptSuggestionsContainer.appendChild(btn);
            });
            promptSuggestionsContainer.classList.remove('hidden');
        } else {
            promptSuggestionsContainer.classList.add('hidden');
        }
    } catch (error) {
        promptSuggestionsContainer.classList.add('hidden');
    }
}

function copyPrompt() {
    navigator.clipboard.writeText(promptInput.value).then(() => {
        showMessage('Prompt copied!', 'info');
    });
}

function showMessage(text, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up`;
    messageEl.textContent = text;
    messageBox.innerHTML = '';
    messageBox.appendChild(messageEl);
    setTimeout(() => messageEl.remove(), 4000);
}

function addNavigationButtons() {
    const existingButton = document.getElementById('start-new-btn');
    if (existingButton) existingButton.remove();

    const startNewButton = document.createElement('button');
    startNewButton.id = 'start-new-btn';
    startNewButton.textContent = '← Start New';
    startNewButton.className = 'text-sm sm:text-base mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
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

function startTimer() {
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
    progressBar.style.width = '100%';
}
