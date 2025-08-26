// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Google Drive API Configuration ---
// IMPORTANT: You must get these from your Google Cloud Console project.
// 1. Create a project at https://console.cloud.google.com/
// 2. Enable the "Google Drive API".
// 3. Create an "API Key" under "Credentials".
// 4. Create an "OAuth 2.0 Client ID" for a "Web application". Add your website's URL to the authorized origins.
const GOOGLE_API_KEY = "YOUR_GOOGLE_API_KEY"; // Replace with your Google API Key
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"; // Replace with your Google Client ID
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let gapiInited = false;
let gisInited = false;


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
// Shared Elements
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const cursorDot = document.querySelector('.cursor-dot');
const cursorOutline = document.querySelector('.cursor-outline');

// Page: index.html & for-teams.html
const authBtn = document.getElementById('auth-btn');
const mobileAuthBtn = document.getElementById('mobile-auth-btn');
const generationCounterEl = document.getElementById('generation-counter');
const mobileGenerationCounterEl = document.getElementById('mobile-generation-counter');
const authModal = document.getElementById('auth-modal');
const googleSignInBtn = document.getElementById('google-signin-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const musicBtn = document.getElementById('music-btn');
const lofiMusic = document.getElementById('lofi-music');

// Page: for-teams.html
const getStartedBtn = document.getElementById('get-started-btn');
const emailModal = document.getElementById('email-modal');
const emailForm = document.getElementById('email-form');
const emailInput = document.getElementById('business-email-input');
const emailErrorMsg = document.getElementById('email-error-msg');
const closeEmailModalBtn = document.getElementById('close-email-modal-btn');

// Page: index.html & pro-generator.html (Generator UI)
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
const aspectRatioBtns = document.querySelectorAll('.aspect-ratio-btn');
const copyPromptBtn = document.getElementById('copy-prompt-btn');
const enhancePromptBtn = document.getElementById('enhance-prompt-btn');

// Page: pro-generator.html
const driveConnectBtn = document.getElementById('drive-connect-btn');
const mobileDriveConnectBtn = document.getElementById('mobile-drive-connect-btn');


// --- Global State ---
let timerInterval;
const FREE_GENERATION_LIMIT = 3;
let uploadedImageData = null;
let lastGeneratedImageUrl = null;
let lastGeneratedBlob = null; // To store the image blob for Drive upload
let selectedAspectRatio = '1:1';

// --- reCAPTCHA Callback Function ---
window.onRecaptchaSuccess = function(token) {
    console.log("Invisible reCAPTCHA check passed. Proceeding with image generation.");
    generateImage(token);
};

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // Shared logic for all pages
    onAuthStateChanged(auth, user => {
        if (authBtn) updateUIForAuthState(user);
    });
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    document.addEventListener('click', (event) => {
        if (mobileMenu && !mobileMenu.contains(event.target) && mobileMenuBtn && !mobileMenuBtn.contains(event.target)) {
            mobileMenu.classList.add('hidden');
        }
    });
    initializeCursor();

    // --- Page-Specific Initializers ---
    if (document.body.contains(document.getElementById('generator-ui'))) {
        initializeGeneratorPage();
    }
    if (document.body.contains(getStartedBtn)) {
        initializeForTeamsPage();
    }
    if (document.body.contains(driveConnectBtn)) {
        initializeProGeneratorPage();
    }
});

// --- Initializer Functions ---

function initializeCursor() {
    if (!cursorDot || !cursorOutline) return;
    let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
    const animate = () => {
        cursorDot.style.left = `${mouseX}px`;
        cursorDot.style.top = `${mouseY}px`;
        outlineX += (mouseX - outlineX) * 0.15;
        outlineY += (mouseY - outlineY) * 0.15;
        cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    document.querySelectorAll('a, button, textarea, input, label').forEach(el => {
        el.addEventListener('mouseover', () => cursorOutline.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => cursorOutline.classList.remove('cursor-hover'));
    });
}

function initializeGeneratorPage() {
    // Logic for index.html and pro-generator.html
    if (authBtn) { // This check separates it from pro-generator
        authBtn.addEventListener('click', handleAuthAction);
        mobileAuthBtn.addEventListener('click', handleAuthAction);
        googleSignInBtn.addEventListener('click', signInWithGoogle);
        closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));
        musicBtn.addEventListener('click', toggleMusic);
    }
    generateBtn.addEventListener('click', handleGenerateClick);
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateBtn.click(); }
    });
    if (examplePrompts) {
        examplePrompts.forEach(b => b.addEventListener('click', () => { promptInput.value = b.innerText.trim(); promptInput.focus(); }));
    }
    aspectRatioBtns.forEach(btn => btn.addEventListener('click', () => {
        aspectRatioBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAspectRatio = btn.dataset.ratio;
    }));
    copyPromptBtn.addEventListener('click', copyPrompt);
    enhancePromptBtn.addEventListener('click', handleEnhancePrompt);
    imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
    imageUploadInput.addEventListener('change', handleImageUpload);
    removeImageBtn.addEventListener('click', removeUploadedImage);
}

function initializeForTeamsPage() {
    // Logic specific to for-teams.html
    authBtn.addEventListener('click', handleAuthAction);
    mobileAuthBtn.addEventListener('click', handleAuthAction);
    if(googleSignInBtn) googleSignInBtn.addEventListener('click', signInWithGoogle);
    if(closeModalBtn) closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));
    getStartedBtn.addEventListener('click', () => emailModal.setAttribute('aria-hidden', 'false'));
    closeEmailModalBtn.addEventListener('click', () => emailModal.setAttribute('aria-hidden', 'true'));
    emailForm.addEventListener('submit', handleEmailSubmit);
}

function initializeProGeneratorPage() {
    // Logic specific to pro-generator.html
    // Load Google API scripts
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = gapiLoaded;
    document.head.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = gisLoaded;
    document.head.appendChild(gisScript);
    
    driveConnectBtn.addEventListener('click', handleAuthClick);
    mobileDriveConnectBtn.addEventListener('click', handleAuthClick);
}

// --- Event Handlers ---

function handleGenerateClick() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showMessage('Please describe what you want to create or edit.', 'error');
        return;
    }
    // On pro page, there's no limit. On free page, check limit.
    if (authBtn) { 
        const count = getGenerationCount();
        if (!auth.currentUser && count >= FREE_GENERATION_LIMIT) {
            authModal.setAttribute('aria-hidden', 'false');
            return;
        }
        grecaptcha.execute(); // Only execute reCAPTCHA on the free page
    } else {
        generateImage(); // On pro page, generate directly
    }
}

function handleEmailSubmit(e) {
    e.preventDefault();
    const email = emailInput.value.trim();
    const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
    const domain = email.split('@')[1];

    if (!domain || commonProviders.includes(domain.toLowerCase())) {
        emailErrorMsg.textContent = 'Please use a valid business email.';
        emailErrorMsg.classList.remove('hidden');
        return;
    }
    
    emailErrorMsg.classList.add('hidden');
    console.log('Business email validated:', email);
    // Redirect to the pro generator page
    window.location.href = 'pro-generator.html';
}

function toggleMusic() {
    if (!musicBtn || !lofiMusic) return;
    const isPlaying = musicBtn.classList.contains('playing');
    if (isPlaying) lofiMusic.pause();
    else lofiMusic.play().catch(e => console.error("Audio error:", e));
    musicBtn.classList.toggle('playing');
}

// --- Core Functionality (Image Generation, etc.) ---

async function generateImage(recaptchaToken = null) {
    const prompt = promptInput.value.trim();
    const isFreePage = !!authBtn; // Check if on the free page
    const shouldBlur = isFreePage && !auth.currentUser && getGenerationCount() === (FREE_GENERATION_LIMIT - 1);
    
    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    resultContainer.classList.remove('hidden');
    loadingIndicator.classList.remove('hidden');
    generatorUI.classList.add('hidden');
    startTimer();

    try {
        const imageUrl = await generateImageWithRetry(prompt, uploadedImageData, recaptchaToken, selectedAspectRatio);
        const response = await fetch(imageUrl);
        lastGeneratedBlob = await response.blob(); // Store blob for upload
        
        if (shouldBlur) { lastGeneratedImageUrl = imageUrl; }
        displayImage(imageUrl, prompt, shouldBlur);
        
        if (isFreePage) {
            incrementTotalGenerations();
            if (!auth.currentUser) { incrementGenerationCount(); }
        }
    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        addBackButton();
        if (isFreePage && typeof grecaptcha !== 'undefined') grecaptcha.reset();
    }
}

function displayImage(imageUrl, prompt, shouldBlur = false) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group fade-in-slide-up mx-auto max-w-2xl border border-gray-200/80';
    if (shouldBlur) imgContainer.classList.add('blurred-image-container');
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    if (shouldBlur) img.classList.add('blurred-image');
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300';

    const downloadButton = createActionButton('download', 'Download Image', () => {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = `GenArt-${prompt.substring(0,20).replace(/\s/g, '_')}.png`;
        a.click();
    });

    buttonContainer.appendChild(downloadButton);

    // Add "Save to Drive" button only on the pro page
    if (driveConnectBtn) {
        const saveToDriveButton = createActionButton('drive', 'Save to Drive', uploadFile);
        saveToDriveButton.id = 'save-to-drive-btn';
        buttonContainer.appendChild(saveToDriveButton);
    }
    
    imgContainer.appendChild(img);
    if (!shouldBlur) imgContainer.appendChild(buttonContainer);
    
    if (shouldBlur) {
        const overlay = document.createElement('div');
        overlay.className = 'unlock-overlay';
        overlay.innerHTML = `<h3 class="text-xl font-semibold">Unlock Image</h3><p class="mt-2">Sign in to unlock this image and get unlimited generations.</p><button id="unlock-btn">Sign In to Unlock</button>`;
        overlay.querySelector('#unlock-btn').onclick = () => { authModal.setAttribute('aria-hidden', 'false'); };
        imgContainer.appendChild(overlay);
    }
    imageGrid.appendChild(imgContainer);
}

function createActionButton(type, title, onClick) {
    const button = document.createElement('button');
    button.className = 'bg-black/50 text-white p-2 rounded-full hover:bg-black/75 transition-colors';
    button.title = title;
    button.onclick = onClick;
    if (type === 'download') {
        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    } else if (type === 'drive') {
        button.innerHTML = `<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.42 5.58a1 1 0 0 0-1.42 0l-5.58 5.58-5.58-5.58a1 1 0 0 0-1.42 1.42l6.29 6.29a.996.996 0 0 0 1.41 0l6.29-6.29a1 1 0 0 0 0-1.42z"/><path d="m12 16-6-6h12z"/></svg>`;
    }
    return button;
}


// --- Google Drive API Functions ---

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: GOOGLE_API_KEY,
        discoveryDocs: DISCOVERY_DOCS,
    });
    gapiInited = true;
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later
    });
    gisInited = true;
}

function handleAuthClick() {
    if (!gapiInited || !gisInited) {
        showMessage("Google API is not ready yet. Please wait a moment.", "info");
        return;
    }
    if (gapi.client.getToken() === null) {
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) throw (resp);
            updateDriveButtonUI(true);
        };
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        console.log("Already connected to Google Drive.");
        showMessage("You are already connected to Google Drive.", "info");
    }
}

function updateDriveButtonUI(isConnected) {
    const textEl = document.getElementById('drive-connect-text');
    if (isConnected) {
        textEl.textContent = 'Drive Connected';
        driveConnectBtn.classList.add('bg-green-100', 'border-green-300', 'text-green-800');
        mobileDriveConnectBtn.textContent = 'Drive Connected';
    } else {
        textEl.textContent = 'Connect Drive';
        driveConnectBtn.classList.remove('bg-green-100', 'border-green-300', 'text-green-800');
        mobileDriveConnectBtn.textContent = 'Connect Drive';
    }
}

async function uploadFile() {
    if (!lastGeneratedBlob) {
        showMessage('No image has been generated yet to save.', 'error');
        return;
    }
    if (gapi.client.getToken() === null) {
        showMessage('Please connect to Google Drive first.', 'info');
        handleAuthClick(); // Prompt for auth
        return;
    }

    const metadata = {
        'name': `GenArt_${Date.now()}.png`,
        'mimeType': 'image/png',
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', lastGeneratedBlob);

    try {
        const saveButton = document.getElementById('save-to-drive-btn');
        const originalIcon = saveButton.innerHTML;
        saveButton.innerHTML = `<svg class="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        saveButton.disabled = true;

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token }),
            body: form,
        });
        const result = await response.json();
        if (result.error) {
            throw new Error(result.error.message);
        }
        console.log('File uploaded successfully:', result);
        showMessage('Image saved to your Google Drive!', 'info');
        saveButton.innerHTML = originalIcon;
        saveButton.disabled = false;
    } catch (error) {
        console.error('Error uploading to Drive:', error);
        showMessage(`Failed to save to Drive: ${error.message}`, 'error');
    }
}


// --- Utility & Helper Functions ---

function addBackButton() {
    if (document.getElementById('back-to-generator-btn')) return;
    const backButton = document.createElement('button');
    backButton.id = 'back-to-generator-btn';
    backButton.textContent = '← Create another';
    backButton.className = 'mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
    backButton.onclick = () => {
        generatorUI.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        imageGrid.innerHTML = '';
        messageBox.innerHTML = '';
        promptInput.value = '';
        removeUploadedImage();
    };
    if (messageBox) messageBox.prepend(backButton);
}

function handleAuthAction() { if (auth.currentUser) signOut(auth); else signInWithGoogle(); }

function signInWithGoogle() { signInWithPopup(auth, provider).then(result => updateUIForAuthState(result.user)).catch(error => console.error("Authentication Error:", error)); }

function updateUIForAuthState(user) {
    if (user) {
        const welcomeText = `Welcome, ${user.displayName.split(' ')[0]}`;
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        generationCounterEl.textContent = welcomeText;
        mobileGenerationCounterEl.textContent = welcomeText;
        authModal.setAttribute('aria-hidden', 'true');
        if (lastGeneratedImageUrl) {
            const blurredContainer = document.querySelector('.blurred-image-container');
            if (blurredContainer) {
                const img = blurredContainer.querySelector('img');
                img.classList.remove('blurred-image');
                const overlay = blurredContainer.querySelector('.unlock-overlay');
                if (overlay) overlay.remove();
            }
            lastGeneratedImageUrl = null;
        }
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        updateGenerationCounter();
    }
}

function getGenerationCount() { return parseInt(localStorage.getItem('generationCount') || '0'); }

function incrementGenerationCount() {
    const newCount = getGenerationCount() + 1;
    localStorage.setItem('generationCount', newCount);
    updateGenerationCounter();
}

function updateGenerationCounter() {
    if (auth.currentUser) return;
    const count = getGenerationCount();
    const remaining = Math.max(0, FREE_GENERATION_LIMIT - count);
    const text = `${remaining} free generation${remaining !== 1 ? 's' : ''} left`;
    if (generationCounterEl) generationCounterEl.textContent = text;
    if (mobileGenerationCounterEl) mobileGenerationCounterEl.textContent = text;
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

async function incrementTotalGenerations() {
    const counterRef = doc(db, "stats", "imageGenerations");
    try { await setDoc(counterRef, { count: increment(1) }, { merge: true }); } catch (error) { console.error("Error incrementing generation count:", error); }
}

function showMessage(text, type = 'info') {
    if (!messageBox) return;
    const messageEl = document.createElement('div');
    messageEl.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up`;
    messageEl.textContent = text;
    messageBox.innerHTML = '';
    messageBox.appendChild(messageEl);
    setTimeout(() => { if(messageBox.contains(messageEl)) messageBox.removeChild(messageEl); }, 4000);
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

function stopTimer() { clearInterval(timerInterval); progressBar.style.width = '100%'; }

async function copyPrompt() {
    const promptText = promptInput.value;
    if (!promptText) {
        showMessage('There is no prompt to copy.', 'info');
        return;
    }
    navigator.clipboard.writeText(promptText).then(() => {
        showMessage('Prompt copied to clipboard!', 'info');
        const originalIcon = copyPromptBtn.innerHTML;
        copyPromptBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        setTimeout(() => { copyPromptBtn.innerHTML = originalIcon; }, 2000);
    }, (err) => {
        console.error('Failed to copy text: ', err);
        showMessage('Failed to copy prompt.', 'error');
    });
}

async function handleEnhancePrompt() {
    const promptText = promptInput.value.trim();
    if (!promptText) {
        showMessage('Please enter a prompt to enhance.', 'info');
        return;
    }
    const originalIcon = enhancePromptBtn.innerHTML;
    const spinner = `<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
    enhancePromptBtn.innerHTML = spinner;
    enhancePromptBtn.disabled = true;
    try {
        const enhancedPrompt = await callApiToEnhance(promptText);
        promptInput.value = enhancedPrompt;
        promptInput.style.height = 'auto';
        promptInput.style.height = (promptInput.scrollHeight) + 'px';
    } catch (error) {
        console.error('Failed to enhance prompt:', error);
        showMessage('Sorry, the prompt could not be enhanced right now.', 'error');
    } finally {
        enhancePromptBtn.innerHTML = originalIcon;
        enhancePromptBtn.disabled = false;
    }
}

async function callApiToEnhance(prompt, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch('/api/enhance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || `API Error: ${response.status}`);
            }
            const result = await response.json();
            if (result.text) {
                return result.text;
            } else {
                throw new Error("Unexpected response structure from enhancement API.");
            }
        } catch (error) {
            console.error(`Enhancement attempt ${attempt + 1} failed:`, error);
            if (attempt >= maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}
