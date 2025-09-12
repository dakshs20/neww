// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration - REPLACE WITH YOURS
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
let userCredits = 0;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeUniversalScripts();
    if (document.getElementById('generator-ui')) {
        initializeGeneratorPage();
    }
});

function initializeUniversalScripts() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const authModal = document.getElementById('auth-modal');
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const musicBtn = document.getElementById('music-btn');
    const lofiMusic = document.getElementById('lofi-music');
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');

    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
        document.addEventListener('click', (event) => {
            if (!mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }

    if (authBtn) authBtn.addEventListener('click', handleAuthAction);
    if (mobileAuthBtn) mobileAuthBtn.addEventListener('click', handleAuthAction);
    if (googleSignInBtn) googleSignInBtn.addEventListener('click', signInWithGoogle);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));

    if (musicBtn && lofiMusic) {
        musicBtn.addEventListener('click', () => {
            const isPlaying = musicBtn.classList.contains('playing');
            if (isPlaying) lofiMusic.pause();
            else lofiMusic.play().catch(error => console.error("Audio playback failed:", error));
            musicBtn.classList.toggle('playing');
        });
    }

    if (cursorDot && cursorOutline) {
        let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
        window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
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
        document.querySelectorAll('a, button, textarea, input, label').forEach(el => {
            el.addEventListener('mouseover', () => cursorOutline.classList.add('cursor-hover'));
            el.addEventListener('mouseout', () => cursorOutline.classList.remove('cursor-hover'));
        });
    }
}

function initializeGeneratorPage() {
    const promptInput = document.getElementById('prompt-input');
    const generateBtn = document.getElementById('generate-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');

    if (generateBtn) generateBtn.addEventListener('click', () => handleImageGenerationRequest(false));
    if (regenerateBtn) regenerateBtn.addEventListener('click', () => handleImageGenerationRequest(true));

    document.querySelectorAll('.example-prompt').forEach(button => {
        button.addEventListener('click', () => {
            promptInput.value = button.innerText.trim();
            promptInput.focus();
        });
    });

    if (promptInput) {
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generateBtn.click();
            }
        });
    }

    document.querySelectorAll('.aspect-ratio-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.aspect-ratio-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAspectRatio = btn.dataset.ratio;
        });
    });

    document.getElementById('copy-prompt-btn')?.addEventListener('click', copyPrompt);
    document.getElementById('enhance-prompt-btn')?.addEventListener('click', handleEnhancePrompt);
    document.getElementById('image-upload-btn')?.addEventListener('click', () => document.getElementById('image-upload-input').click());
    document.getElementById('image-upload-input')?.addEventListener('change', handleImageUpload);
    document.getElementById('remove-image-btn')?.addEventListener('click', removeUploadedImage);
}

function handleAuthAction() { if (auth.currentUser) signOut(auth); else signInWithGoogle(); }

function signInWithGoogle() {
    signInWithPopup(auth, provider).catch(error => console.error("Auth Error:", error));
}

async function updateUIForAuthState(user) {
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const generationCounterEl = document.getElementById('generation-counter');
    const mobileGenerationCounterEl = document.getElementById('mobile-generation-counter');

    if (user) {
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        document.getElementById('auth-modal').setAttribute('aria-hidden', 'true');

        try {
            const idToken = await user.getIdToken(true); // Force refresh
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${idToken}` } });
            if (!response.ok) {
                 const errorBody = await response.text();
                 console.error("Credit fetch failed with status:", response.status, "and body:", errorBody);
                 throw new Error('Failed to fetch credits');
            }
            const data = await response.json();
            userCredits = data.credits;
            updateCreditDisplay();
        } catch (error) {
            console.error("Credit fetch error:", error);
            if (generationCounterEl) generationCounterEl.textContent = 'Credits: Error';
            if (mobileGenerationCounterEl) mobileGenerationCounterEl.textContent = 'Credits: Error';
        }
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        userCredits = 0;
        if (generationCounterEl) generationCounterEl.textContent = 'Sign in for credits';
        if (mobileGenerationCounterEl) mobileGenerationCounterEl.textContent = 'Sign in for credits';
    }
}

function handleImageGenerationRequest(isRegen) {
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

    if (userCredits <= 0) {
        resetToGeneratorView();
        setTimeout(() => {
            const messageContent = `You're out of credits. <a href="pricing.html" class="font-bold underline hover:text-red-800">Buy more</a> to continue creating.`;
            showMessage(messageContent, 'error', true);
        }, 100);
        return;
    }

    generateImage(prompt);
}

async function generateImage(prompt) {
    lastPrompt = prompt;

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

        userCredits--; // Deduct locally first for UI speed
        updateCreditDisplay();
        incrementTotalGenerations();

    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
        // If generation failed, refresh credits from server to ensure sync
        if (auth.currentUser) updateUIForAuthState(auth.currentUser);
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        document.getElementById('regenerate-prompt-input').value = lastPrompt;
        postGenerationControls.classList.remove('hidden');
        addNavigationButtons();
        isRegenerating = false;
    }
}

async function generateImageWithRetry(prompt, imageData, token, aspectRatio) {
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt, imageData, aspectRatio: aspectRatio })
    });
    if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || `API Error: ${response.status}`);
    }
    const result = await response.json();
    const base64Data = imageData
        ? result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data
        : result.predictions?.[0]?.bytesBase64Encoded;

    if (!base64Data) throw new Error("No image data received from API.");
    return `data:image/png;base64,${base64Data}`;
}

function showMessage(htmlContent, type = 'info', persistent = false) {
    const messageBox = document.getElementById('message-box');
    const messageEl = document.createElement('div');
    messageEl.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up`;
    messageEl.innerHTML = htmlContent;
    messageBox.innerHTML = '';
    messageBox.appendChild(messageEl);

    if (!persistent) {
        setTimeout(() => {
            if (messageBox.contains(messageEl)) {
                messageBox.removeChild(messageEl);
            }
        }, 4000);
    }
}

function resetToGeneratorView() {
    document.getElementById('generator-ui').classList.remove('hidden');
    document.getElementById('result-container').classList.add('hidden');
    document.getElementById('image-grid').innerHTML = '';
    document.getElementById('post-generation-controls').classList.add('hidden');
    document.getElementById('prompt-input').value = '';
    document.getElementById('regenerate-prompt-input').value = '';
    removeUploadedImage();
}

function updateCreditDisplay() {
    const creditText = `Credits: ${userCredits}`;
    document.getElementById('generation-counter').textContent = creditText;
    document.getElementById('mobile-generation-counter').textContent = creditText;
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        uploadedImageData = { mimeType: file.type, data: reader.result.split(',')[1] };
        document.getElementById('image-preview').src = reader.result;
        document.getElementById('image-preview-container').classList.remove('hidden');
        document.getElementById('prompt-input').placeholder = "Describe the edits you want to make...";
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageData = null;
    document.getElementById('image-upload-input').value = '';
    document.getElementById('image-preview-container').classList.add('hidden');
    document.getElementById('image-preview').src = '';
    document.getElementById('prompt-input').placeholder = "An oil painting of a futuristic city skyline at dusk...";
}

async function incrementTotalGenerations() {
    const counterRef = doc(db, "stats", "imageGenerations");
    try { await setDoc(counterRef, { count: increment(1) }, { merge: true }); } catch (error) { console.error("Error incrementing gen count:", error); }
}

function displayImage(imageUrl, prompt) {
    const imageGrid = document.getElementById('image-grid');
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group fade-in-slide-up mx-auto max-w-2xl border';
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    const downloadButton = document.createElement('button');
    downloadButton.className = 'absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100';
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

function addNavigationButtons() {
    const messageBox = document.getElementById('message-box');
    const existingButton = document.getElementById('start-new-btn');
    if (existingButton) existingButton.remove();

    const startNewButton = document.createElement('button');
    startNewButton.id = 'start-new-btn';
    startNewButton.textContent = '← Start New';
    startNewButton.className = 'text-sm sm:text-base mt-4 text-blue-600 font-semibold hover:text-blue-800';
    startNewButton.onclick = () => {
        resetToGeneratorView();
        messageBox.innerHTML = '';
    };
    messageBox.prepend(startNewButton);
}

function copyPrompt() {
    const promptInput = document.getElementById('prompt-input');
    const copyPromptBtn = document.getElementById('copy-prompt-btn');
    if (!promptInput.value) return;
    navigator.clipboard.writeText(promptInput.value).then(() => {
        showMessage('Prompt copied!', 'info');
        const originalIcon = copyPromptBtn.innerHTML;
        copyPromptBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        setTimeout(() => { copyPromptBtn.innerHTML = originalIcon; }, 2000);
    });
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

async function handleEnhancePrompt() {
    const promptInput = document.getElementById('prompt-input');
    const enhancePromptBtn = document.getElementById('enhance-prompt-btn');
    if (!promptInput.value.trim()) return showMessage('Please enter a prompt to enhance.', 'info');
    
    const originalIcon = enhancePromptBtn.innerHTML;
    enhancePromptBtn.innerHTML = `<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
    enhancePromptBtn.disabled = true;

    try {
        const response = await fetch('/api/enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptInput.value })
        });
        if (!response.ok) throw new Error('API request failed');
        const result = await response.json();
        promptInput.value = result.text;
    } catch (error) {
        showMessage('Could not enhance prompt.', 'error');
    } finally {
        enhancePromptBtn.innerHTML = originalIcon;
        enhancePromptBtn.disabled = false;
    }
}


