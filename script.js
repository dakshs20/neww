// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.appspot.com",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// --- Global State ---
let currentUserCredits = 0;
let lastPrompt = '';
let selectedAspectRatio = '1:1';
let uploadedImageData = null;
let isGenerating = false;
let timerInterval;

// --- DOM Element Caching for Performance ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    // Cache all DOM elements once to avoid repeated lookups
    DOMElements.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    DOMElements.mobileMenu = document.getElementById('mobile-menu');
    DOMElements.authBtn = document.getElementById('auth-btn');
    DOMElements.mobileAuthBtn = document.getElementById('mobile-auth-btn');
    DOMElements.authModal = document.getElementById('auth-modal');
    DOMElements.googleSignInBtn = document.getElementById('google-signin-btn');
    DOMElements.closeModalBtn = document.getElementById('close-modal-btn');
    DOMElements.outOfCreditsModal = document.getElementById('out-of-credits-modal');
    DOMElements.closeCreditsModalBtn = document.getElementById('close-credits-modal-btn');
    DOMElements.generationCounter = document.getElementById('generation-counter');
    DOMElements.mobileGenerationCounter = document.getElementById('mobile-generation-counter');
    DOMElements.musicBtn = document.getElementById('music-btn');
    DOMElements.lofiMusic = document.getElementById('lofi-music');
    DOMElements.cursorDot = document.querySelector('.cursor-dot');
    DOMElements.cursorOutline = document.querySelector('.cursor-outline');
    DOMElements.generatorUI = document.getElementById('generator-ui');
    DOMElements.resultContainer = document.getElementById('result-container');
    DOMElements.promptInput = document.getElementById('prompt-input');
    DOMElements.generateBtn = document.getElementById('generate-btn');
    DOMElements.examplePrompts = document.querySelectorAll('.example-prompt');
    DOMElements.imageUploadBtn = document.getElementById('image-upload-btn');
    DOMElements.imageUploadInput = document.getElementById('image-upload-input');
    DOMElements.removeImageBtn = document.getElementById('remove-image-btn');
    DOMElements.imagePreviewContainer = document.getElementById('image-preview-container');
    DOMElements.imagePreview = document.getElementById('image-preview');
    DOMElements.aspectRatioBtns = document.querySelectorAll('.aspect-ratio-btn');
    DOMElements.copyPromptBtn = document.getElementById('copy-prompt-btn');
    DOMElements.enhancePromptBtn = document.getElementById('enhance-prompt-btn');
    DOMElements.promptSuggestionsContainer = document.getElementById('prompt-suggestions');
    DOMElements.loadingIndicator = document.getElementById('loading-indicator');
    DOMElements.imageGrid = document.getElementById('image-grid');
    DOMElements.postGenerationControls = document.getElementById('post-generation-controls');
    DOMElements.regeneratePromptInput = document.getElementById('regenerate-prompt-input');
    DOMElements.regenerateBtn = document.getElementById('regenerate-btn');
    DOMElements.messageBox = document.getElementById('message-box');
    
    initializeEventListeners();
});

function initializeEventListeners() {
    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    if (DOMElements.mobileMenuBtn) DOMElements.mobileMenuBtn.addEventListener('click', () => DOMElements.mobileMenu.classList.toggle('hidden'));
    
    [DOMElements.authBtn, DOMElements.mobileAuthBtn].forEach(btn => btn?.addEventListener('click', handleAuthAction));
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    
    DOMElements.closeCreditsModalBtn?.addEventListener('click', () => {
        toggleModal(DOMElements.outOfCreditsModal, false);
        resetToGeneratorView();
    });

    DOMElements.musicBtn?.addEventListener('click', toggleMusic);
    
    DOMElements.generateBtn?.addEventListener('click', () => handleImageGenerationRequest(false));
    DOMElements.regenerateBtn?.addEventListener('click', () => handleImageGenerationRequest(true));

    DOMElements.promptInput?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            DOMElements.generateBtn.click();
        }
    });

    DOMElements.examplePrompts.forEach(button => {
        button.addEventListener('click', () => {
            DOMElements.promptInput.value = button.innerText.trim();
            DOMElements.promptInput.focus();
        });
    });

    DOMElements.aspectRatioBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            DOMElements.aspectRatioBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAspectRatio = btn.dataset.ratio;
        });
    });

    DOMElements.imageUploadBtn?.addEventListener('click', () => DOMElements.imageUploadInput.click());
    DOMElements.imageUploadInput?.addEventListener('change', handleImageUpload);
    DOMElements.removeImageBtn?.addEventListener('click', removeUploadedImage);
    DOMElements.copyPromptBtn?.addEventListener('click', copyPrompt);
    DOMElements.enhancePromptBtn?.addEventListener('click', handleEnhancePrompt);

    initializeCursor();
}

// --- UI & State Management ---

// --- FIXED --- This function is now more robust for showing and hiding modals.
function toggleModal(modal, show) {
    if (!modal) return;
    if (show) {
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.remove('opacity-0', 'invisible');
    } else {
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.add('opacity-0', 'invisible');
    }
}

async function updateUIForAuthState(user) {
    if (user) {
        DOMElements.authBtn.textContent = 'Sign Out';
        DOMElements.mobileAuthBtn.textContent = 'Sign Out';
        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/credits', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const bodyText = await response.text();
                throw new Error(`Credit fetch failed with status: ${response.status} and body: ${bodyText}`);
            }
            const data = await response.json();
            currentUserCredits = data.credits;
            updateCreditDisplay();
        } catch (error) {
            console.error("Credit fetch error:", error);
            currentUserCredits = 0;
            updateCreditDisplay();
            showMessage("Could not fetch your credit balance.", "error");
        }
    } else {
        currentUserCredits = 0;
        DOMElements.authBtn.textContent = 'Sign In';
        DOMElements.mobileAuthBtn.textContent = 'Sign In';
        updateCreditDisplay();
    }
}

function updateCreditDisplay() {
    const text = auth.currentUser ? `Credits: ${currentUserCredits}` : 'Sign in for credits';
    DOMElements.generationCounter.textContent = text;
    DOMElements.mobileGenerationCounter.textContent = text;
}

function resetToGeneratorView() {
    DOMElements.generatorUI.classList.remove('hidden');
    DOMElements.resultContainer.classList.add('hidden');
    DOMElements.imageGrid.innerHTML = '';
    DOMElements.messageBox.innerHTML = '';
    DOMElements.postGenerationControls.classList.add('hidden');
    removeUploadedImage();
    DOMElements.promptInput.value = '';
    DOMElements.regeneratePromptInput.value = '';
}

// --- Core Application Logic ---

function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth).catch(error => console.error("Sign out error:", error));
    } else {
        toggleModal(DOMElements.authModal, true);
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(() => toggleModal(DOMElements.authModal, false))
        .catch(error => {
            console.error("Authentication Error:", error);
            showMessage('Failed to sign in. Please try again.', 'error');
        });
}

function handleImageGenerationRequest(isRegenerate) {
    if (isGenerating) return;

    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }

    if (currentUserCredits <= 0) {
        toggleModal(DOMElements.outOfCreditsModal, true);
        return;
    }

    const promptInput = isRegenerate ? DOMElements.regeneratePromptInput : DOMElements.promptInput;
    const prompt = promptInput.value.trim();

    if (!prompt) {
        showMessage('Please describe what you want to create.', 'error');
        return;
    }
    
    lastPrompt = prompt;
    generateImage(prompt, isRegenerate);
}

async function generateImage(prompt, isRegenerate) {
    isGenerating = true;
    startLoadingUI(isRegenerate);

    try {
        const token = await auth.currentUser.getIdToken();
        
        const deductResponse = await fetch('/api/credits', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!deductResponse.ok) {
            if(deductResponse.status === 402) {
                 toggleModal(DOMElements.outOfCreditsModal, true);
            } else {
                 throw new Error('Failed to deduct credit.');
            }
            stopLoadingUI();
            return;
        }
        
        const deductData = await deductResponse.json();
        currentUserCredits = deductData.newCredits;
        updateCreditDisplay();

        const generateResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ prompt, imageData: uploadedImageData, aspectRatio: selectedAspectRatio })
        });

        if (!generateResponse.ok) {
            const errorResult = await generateResponse.json();
            throw new Error(errorResult.error || `API Error: ${generateResponse.status}`);
        }

        const result = await generateResponse.json();
        const base64Data = result.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Data) throw new Error("No image data received from API.");

        const imageUrl = `data:image/png;base64,${base64Data}`;
        displayImage(imageUrl, prompt);

    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
        updateUIForAuthState(auth.currentUser); 
    } finally {
        stopLoadingUI();
    }
}

// --- UI Update Functions for Generation ---

function startLoadingUI(isRegenerate) {
    DOMElements.imageGrid.innerHTML = '';
    DOMElements.messageBox.innerHTML = '';
    if (isRegenerate) {
        DOMElements.loadingIndicator.classList.remove('hidden');
        DOMElements.postGenerationControls.classList.add('hidden');
    } else {
        DOMElements.resultContainer.classList.remove('hidden');
        DOMElements.loadingIndicator.classList.remove('hidden');
        DOMElements.generatorUI.classList.add('hidden');
    }
    startTimer();
}

function stopLoadingUI() {
    isGenerating = false;
    stopTimer();
    DOMElements.loadingIndicator.classList.add('hidden');
    DOMElements.regeneratePromptInput.value = lastPrompt;
    DOMElements.postGenerationControls.classList.remove('hidden');
    addNavigationButtons();
}

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

    imgContainer.append(img, downloadButton);
    DOMElements.imageGrid.appendChild(imgContainer);
}

// --- Utility Functions ---

function showMessage(text, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up`;
    messageEl.textContent = text;
    DOMElements.messageBox.innerHTML = '';
    DOMElements.messageBox.appendChild(messageEl);
}

function addNavigationButtons() {
    const startNewButton = document.createElement('button');
    startNewButton.textContent = '← Start New';
    startNewButton.className = 'text-sm sm:text-base mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
    startNewButton.onclick = resetToGeneratorView;
    DOMElements.messageBox.prepend(startNewButton);
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        uploadedImageData = { mimeType: file.type, data: reader.result.split(',')[1] };
        DOMElements.imagePreview.src = reader.result;
        DOMElements.imagePreviewContainer.classList.remove('hidden');
        DOMElements.promptInput.placeholder = "Describe the edits you want to make...";
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageData = null;
    if (DOMElements.imageUploadInput) DOMElements.imageUploadInput.value = '';
    DOMElements.imagePreviewContainer.classList.add('hidden');
    DOMElements.imagePreview.src = '';
    DOMElements.promptInput.placeholder = "An oil painting of a futuristic city skyline at dusk...";
}

async function handleEnhancePrompt() {
    showMessage("Prompt enhancement is coming soon!", "info");
}

function copyPrompt() {
    const promptText = DOMElements.promptInput.value;
    if (!promptText) {
        showMessage("There's nothing to copy.", "info");
        return;
    }
    navigator.clipboard.writeText(promptText).then(() => {
        showMessage("Prompt copied!", "info");
    }).catch(() => {
        showMessage("Failed to copy prompt.", "error");
    });
}

function toggleMusic() {
    const isPlaying = DOMElements.musicBtn.classList.toggle('playing');
    if (isPlaying) {
        DOMElements.lofiMusic.play().catch(error => console.error("Audio playback failed:", error));
    } else {
        DOMElements.lofiMusic.pause();
    }
}

function startTimer() {
    let startTime = Date.now();
    const timerEl = document.getElementById('timer');
    const progressBar = document.getElementById('progress-bar');
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

function initializeCursor() {
    let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    const animate = () => {
        DOMElements.cursorDot.style.left = `${mouseX}px`;
        DOMElements.cursorDot.style.top = `${mouseY}px`;
        const ease = 0.15;
        outlineX += (mouseX - outlineX) * ease;
        outlineY += (mouseY - outlineY) * ease;
        DOMElements.cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    document.querySelectorAll('a, button, textarea, input, label').forEach(el => {
        el.addEventListener('mouseover', () => DOMElements.cursorOutline.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => DOMElements.cursorOutline.classList.remove('cursor-hover'));
    });
}

