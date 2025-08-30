// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, increment, collection, addDoc, getDocs, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// NEW: Import Firebase Storage modules
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";


// --- Google Drive API Configuration ---
const GOOGLE_API_KEY = "AIzaSyAypNULLr5wkLATw1V3qA-I5NwcnGIc0v8"; 
const GOOGLE_CLIENT_ID = "673422771881-dkts1iissdsbev5mi1nvbp90nvdo2mvh.apps.googleusercontent.com"; 

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
// NEW: Initialize Firebase Storage
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// --- DOM Element References ---
// (Existing references)
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
const generationCounterEl = document.getElementById('generation-counter');
const mobileGenerationCounterEl = document.getElementById('mobile-generation-counter');
const authModal = document.getElementById('auth-modal');
const googleSignInBtn = document.getElementById('google-signin-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const musicBtn = document.getElementById('music-btn');
const lofiMusic = document.getElementById('lofi-music');
const aspectRatioBtns = document.querySelectorAll('.aspect-ratio-btn');
const copyPromptBtn = document.getElementById('copy-prompt-btn');
const enhancePromptBtn = document.getElementById('enhance-prompt-btn');
const getStartedBtn = document.getElementById('get-started-btn');
const emailModal = document.getElementById('email-modal');
const emailForm = document.getElementById('email-form');
const emailInput = document.getElementById('business-email-input');
const emailErrorMsg = document.getElementById('email-error-msg');
const closeEmailModalBtn = document.getElementById('close-email-modal-btn');
const brandingSettingsBtn = document.getElementById('branding-settings-btn');
const driveConnectBtn = document.getElementById('drive-connect-btn');
const mobileDriveConnectBtn = document.getElementById('mobile-drive-connect-btn');
const variantsBtn = document.getElementById('variants-btn');
// NEW: Library page references
const libraryGrid = document.getElementById('library-grid');
const libraryLoader = document.getElementById('library-loader');
const emptyLibraryMessage = document.getElementById('empty-library-message');
const userWelcomeEl = document.getElementById('user-welcome');


// --- Global State ---
let timerInterval;
const FREE_GENERATION_LIMIT = 3;
let uploadedImageData = null;
let lastGeneratedBlob = null; // Used for single generations
let currentImageUrlToSave = null; // Used for saving any image (single or variant)
let selectedAspectRatio = '1:1';
let brandingSettings = {};
let currentUploadOptions = {};
let currentUser = null; // NEW: Store current user state

// --- reCAPTCHA Callback Function ---
window.onRecaptchaSuccess = function(token) {
    generateImage(token);
};

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    initializeCursor();
    
    // Auth state listener is now the primary entry point for user-dependent UI
    onAuthStateChanged(auth, user => {
        currentUser = user; // Set global user state
        updateUIForAuthState(user);

        // Page-specific initializations
        if (document.body.contains(document.getElementById('generator-ui'))) {
             // This is the generator page
        } else if (document.body.contains(document.getElementById('library-grid'))) {
            // This is the library page
            if (user) {
                fetchUserLibrary();
            } else {
                window.location.href = 'pro-generator.html'; // Redirect if not logged in
            }
        }
    });

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    document.addEventListener('click', (event) => {
        if (mobileMenu && !mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
            mobileMenu.classList.add('hidden');
        }
    });

    if (authBtn) authBtn.addEventListener('click', handleAuthAction);
    if (mobileAuthBtn) mobileAuthBtn.addEventListener('click', handleAuthAction);
    if (googleSignInBtn) googleSignInBtn.addEventListener('click', signInWithGoogle);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));
    if (musicBtn) musicBtn.addEventListener('click', toggleMusic);

    if (generatorUI) {
        if (generateBtn) generateBtn.addEventListener('click', handleGenerateClick);
        if (variantsBtn) variantsBtn.addEventListener('click', generateVariants);
        if (promptInput) promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateBtn.click(); }
        });
        if (examplePrompts) examplePrompts.forEach(b => b.addEventListener('click', () => { promptInput.value = b.innerText.trim(); promptInput.focus(); }));
        if (aspectRatioBtns) aspectRatioBtns.forEach(btn => btn.addEventListener('click', () => {
            aspectRatioBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAspectRatio = btn.dataset.ratio;
        }));
        if (copyPromptBtn) copyPromptBtn.addEventListener('click', copyPrompt);
        if (enhancePromptBtn) enhancePromptBtn.addEventListener('click', handleEnhancePrompt);
        if (imageUploadBtn) imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
        if (imageUploadInput) imageUploadInput.addEventListener('change', handleImageUpload);
        if (removeImageBtn) removeImageBtn.addEventListener('click', removeUploadedImage);
    }
    
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            emailModal.classList.remove('hidden');
            emailModal.setAttribute('aria-hidden', 'false');
        });
        closeEmailModalBtn.addEventListener('click', () => {
            emailModal.classList.add('hidden');
            emailModal.setAttribute('aria-hidden', 'true');
        });
        emailForm.addEventListener('submit', handleEmailSubmit);
    }

    if (brandingSettingsBtn) {
        initializeProGeneratorPage();
    }
});

function initializeCursor() {
    // ... (no changes in this function)
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');
    if (!cursorDot || !cursorOutline) return;
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

function initializeProGeneratorPage() {
    // ... (no changes in this function)
    const brandingPanel = document.getElementById('branding-panel');
    const brandingPanelBackdrop = document.getElementById('branding-panel-backdrop');
    const closeBrandingPanelBtn = document.getElementById('close-branding-panel-btn');
    const logoUploadInput = document.getElementById('logo-upload-input');
    const logoUploadBtn = document.getElementById('logo-upload-btn');
    const removeLogoBtn = document.getElementById('remove-logo-btn');
    const watermarkEnabledToggle = document.getElementById('watermark-enabled-toggle');
    const placementOptions = document.getElementById('placement-options');
    const opacitySlider = document.getElementById('opacity-slider');
    const sizeSlider = document.getElementById('size-slider');
    const paddingXInput = document.getElementById('padding-x-input');
    const paddingYInput = document.getElementById('padding-y-input');
    
    const driveOptionsModal = document.getElementById('drive-options-modal');
    const saveWithBrandingBtn = document.getElementById('save-with-branding-btn');
    const saveWithoutBrandingBtn = document.getElementById('save-without-branding-btn');
    const cancelSaveBtn = document.getElementById('cancel-save-btn');

    const fileNameModal = document.getElementById('file-name-modal');
    const fileNameForm = document.getElementById('file-name-form');
    const cancelFileNameBtn = document.getElementById('cancel-file-name-btn');

    loadBrandingSettings();
    
    brandingSettingsBtn.addEventListener('click', openBrandingPanel);
    closeBrandingPanelBtn.addEventListener('click', closeBrandingPanel);
    brandingPanelBackdrop.addEventListener('click', closeBrandingPanel);
    logoUploadBtn.addEventListener('click', () => logoUploadInput.click());
    logoUploadInput.addEventListener('change', handleLogoUpload);
    removeLogoBtn.addEventListener('click', removeLogo);
    watermarkEnabledToggle.addEventListener('click', () => {
        const isEnabled = watermarkEnabledToggle.getAttribute('aria-checked') === 'true';
        setWatermarkEnabled(!isEnabled);
        saveBrandingSettings();
    });
    placementOptions.addEventListener('click', (e) => {
        if (e.target.closest('.placement-btn')) {
            document.querySelectorAll('.placement-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.closest('.placement-btn').classList.add('selected');
            brandingSettings.position = e.target.closest('.placement-btn').dataset.position;
            saveBrandingSettings();
        }
    });
    opacitySlider.addEventListener('input', (e) => {
        document.getElementById('opacity-value').textContent = `${e.target.value}%`;
        brandingSettings.opacity = e.target.value / 100;
        saveBrandingSettings();
    });
    sizeSlider.addEventListener('input', (e) => {
        document.getElementById('size-value').textContent = `${e.target.value}%`;
        brandingSettings.size = e.target.value / 100;
        saveBrandingSettings();
    });
    paddingXInput.addEventListener('input', (e) => {
        brandingSettings.paddingX = parseInt(e.target.value, 10);
        saveBrandingSettings();
    });
    paddingYInput.addEventListener('input', (e) => {
        brandingSettings.paddingY = parseInt(e.target.value, 10);
        saveBrandingSettings();
    });

    saveWithBrandingBtn.addEventListener('click', () => {
        hideDriveOptions();
        showFileNameModal({ withBranding: true });
    });
    saveWithoutBrandingBtn.addEventListener('click', () => {
        hideDriveOptions();
        showFileNameModal({ withBranding: false });
    });
    cancelSaveBtn.addEventListener('click', hideDriveOptions);

    fileNameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fileName = document.getElementById('file-name-input').value;
        uploadToDrive(currentUploadOptions, fileName);
        hideFileNameModal();
    });
    cancelFileNameBtn.addEventListener('click', hideFileNameModal);

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
    
    if (driveConnectBtn) driveConnectBtn.addEventListener('click', handleAuthClick);
    if (mobileDriveConnectBtn) mobileDriveConnectBtn.addEventListener('click', handleAuthClick);
}

function handleGenerateClick() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showMessage('Please describe what you want to create or edit.', 'error');
        return;
    }

    // Pro generator page doesn't have free limits, but we check for login
    if (brandingSettingsBtn && !currentUser) {
        showMessage('Please sign in to use the Pro generator.', 'error');
        // This is a placeholder for a proper login flow on the pro page if needed
        // For now, we assume users arrive here logged in.
        return;
    }
    
    if (document.getElementById('auth-btn') && !brandingSettingsBtn) { // This logic is for the FREE page
        const count = getGenerationCount();
        if (!auth.currentUser && count >= FREE_GENERATION_LIMIT) {
            authModal.setAttribute('aria-hidden', 'false');
            return;
        }
        grecaptcha.execute();
    } else { // This is for the PRO page
        generateImage();
    }
}

function handleEmailSubmit(e) {
    // ... (no changes in this function)
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
    window.location.href = 'pro-generator.html';
}

async function generateVariants() {
    // ... (no changes in this function)
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showMessage('Please enter a prompt to generate variants.', 'error');
        return;
    }

    variantsBtn.classList.add('selected');

    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    resultContainer.classList.remove('hidden');
    loadingIndicator.classList.remove('hidden');
    generatorUI.classList.add('hidden');
    startTimer();

    try {
        const promises = [
            generateImageWithRetry(prompt, uploadedImageData, null, selectedAspectRatio),
            generateImageWithRetry(prompt, uploadedImageData, null, selectedAspectRatio),
            generateImageWithRetry(prompt, uploadedImageData, null, selectedAspectRatio)
        ];

        const imageUrls = await Promise.all(promises);
        
        imageGrid.classList.remove('md:grid-cols-1');
        imageGrid.classList.add('md:grid-cols-3');
        
        imageUrls.forEach(imageUrl => {
            displayImage(imageUrl, prompt, false, true);
        });

    } catch (error) {
        console.error('Variant generation failed:', error);
        showMessage(`Sorry, we couldn't generate variants. ${error.message}`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        addBackButton();
    }
}

async function generateImage(recaptchaToken = null) {
    // ... (no changes in this function)
    const prompt = promptInput.value.trim();
    const isFreePage = !!document.getElementById('auth-btn') && !brandingSettingsBtn;
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
        lastGeneratedBlob = await response.blob();
        
        if (shouldBlur) { 
            // Don't set the main save URL if it's blurred, let the unlock handle it.
        } else {
            currentImageUrlToSave = imageUrl;
        }
        
        imageGrid.classList.remove('md:grid-cols-3');
        imageGrid.classList.add('md:grid-cols-1');

        displayImage(imageUrl, prompt, shouldBlur);
        
        if (isFreePage) {
            incrementTotalGenerations();
            if (!auth.currentUser) { incrementGenerationCount(); }
        }
    } catch (error)
        {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        addBackButton();
        if (isFreePage && typeof grecaptcha !== 'undefined') grecaptcha.reset();
    }
}


async function generateImageWithRetry(prompt, imageData, token, aspectRatio, maxRetries = 3) {
    // ... (no changes in this function)
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
            console.error(`Generation attempt ${attempt + 1} failed:`, error);
            if (attempt >= maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

function displayImage(imageUrl, prompt, shouldBlur = false, isVariant = false) {
    // ... (slight modifications)
    const cardWrapper = document.createElement('div');
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group border border-gray-200/80';

    if (!isVariant) {
        cardWrapper.className = 'mx-auto max-w-2xl fade-in-slide-up';
    } else {
        cardWrapper.className = 'variant-image-container fade-in-slide-up';
        imgContainer.classList.add('h-full');
    }

    if (shouldBlur) imgContainer.classList.add('blurred-image-container');

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    if (isVariant) img.classList.add('h-full', 'object-cover');
    if (shouldBlur) img.classList.add('blurred-image');

    const buttonContainer = document.createElement('div');
    const downloadButton = createActionButton('download', 'Download Original', () => {
        const a = document.createElement('a'); a.href = imageUrl; a.download = `GenArt_Original_${Date.now()}.png`; a.click();
    });
    
    let proButtons = [];
    if (brandingSettingsBtn) { // Only show pro buttons on the pro page
        proButtons.push(createActionButton('library', 'Save to Library', () => saveToLibrary(imageUrl, prompt)));
        if (brandingSettings.enabled && brandingSettings.logo) {
            proButtons.push(createActionButton('brand', 'Export with Branding', () => applyWatermarkAndDownload(imageUrl)));
        }
        proButtons.push(createActionButton('drive', 'Save to Drive', () => showDriveOptions(imageUrl)));
    }

    // UPDATED LOGIC: If aspect ratio is 16:9, buttons go below for single images AND variants.
    if (selectedAspectRatio === '16:9' && !shouldBlur) {
        buttonContainer.className = 'flex items-center justify-center gap-3 mt-4';
        imgContainer.appendChild(img);
        cardWrapper.appendChild(imgContainer);
        buttonContainer.appendChild(downloadButton);
        proButtons.forEach(btn => buttonContainer.appendChild(btn));
        cardWrapper.appendChild(buttonContainer);
    } else {
        buttonContainer.className = 'absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300';
        buttonContainer.appendChild(downloadButton);
        proButtons.forEach(btn => buttonContainer.appendChild(btn));
        imgContainer.appendChild(img);
        if (!shouldBlur) imgContainer.appendChild(buttonContainer);
        cardWrapper.appendChild(imgContainer);
    }

    if (shouldBlur) {
        const overlay = document.createElement('div');
        overlay.className = 'unlock-overlay';
        overlay.innerHTML = `<h3 class="text-xl font-semibold">Unlock Image</h3><p class="mt-2">Sign in to unlock this image and get unlimited generations.</p><button id="unlock-btn">Sign In to Unlock</button>`;
        overlay.querySelector('#unlock-btn').onclick = () => { authModal.setAttribute('aria-hidden', 'false'); };
        imgContainer.appendChild(overlay);
    }
    
    if (!isVariant) imageGrid.innerHTML = '';
    imageGrid.appendChild(cardWrapper);
}

function createActionButton(type, title, onClick) {
    const button = document.createElement('button');
    button.className = 'bg-black/50 text-white p-2 rounded-full hover:bg-black/75 transition-colors flex items-center justify-center w-10 h-10';
    button.title = title;
    button.onclick = (e) => {
        e.stopPropagation(); // Prevent card click events
        onClick();
    };
    
    const icons = {
        download: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
        brand: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>`,
        drive: `<img src="https://iili.io/K25gUKl.md.png" alt="Save to Drive" class="w-5 h-5">`,
        // NEW: Library Icon
        library: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
        // NEW: Remove Icon
        remove: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`
    };
    
    button.innerHTML = icons[type] || '';
    return button;
}

// --- Authentication ---
function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth).catch(error => console.error("Sign Out Error:", error));
    } else {
        signInWithGoogle();
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(result => {
             // Redirect to pro page after first sign in from index
            if (!brandingSettingsBtn) {
                window.location.href = 'pro-generator.html';
            } else {
                updateUIForAuthState(result.user);
            }
        })
        .catch(error => console.error("Authentication Error:", error));
}

function updateUIForAuthState(user) {
    const libraryBtn = document.getElementById('library-btn');
    const mobileLibraryBtn = document.getElementById('mobile-library-btn');

    if (user) {
        const welcomeText = `Welcome, ${user.displayName.split(' ')[0]}`;
        
        if (authBtn) authBtn.textContent = 'Sign Out';
        if (mobileAuthBtn) mobileAuthBtn.textContent = 'Sign Out';
        if (userWelcomeEl) userWelcomeEl.textContent = welcomeText;
        if (generationCounterEl) generationCounterEl.textContent = welcomeText;
        if (mobileGenerationCounterEl) mobileGenerationCounterEl.textContent = welcomeText;
        if (authModal) authModal.setAttribute('aria-hidden', 'true');

        if (libraryBtn) libraryBtn.classList.remove('hidden');
        if (mobileLibraryBtn) mobileLibraryBtn.classList.remove('hidden');

        // Unlock blurred image if present
        const blurredContainer = document.querySelector('.blurred-image-container');
        if (blurredContainer) {
            const img = blurredContainer.querySelector('img');
            img.classList.remove('blurred-image');
            const overlay = blurredContainer.querySelector('.unlock-overlay');
            if (overlay) overlay.remove();
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300';
            const downloadButton = createActionButton('download', 'Download Original', () => {
                const a = document.createElement('a'); a.href = img.src; a.download = `GenArt_Original_${Date.now()}.png`; a.click();
            });
            buttonContainer.appendChild(downloadButton);
            blurredContainer.appendChild(buttonContainer);
        }
    } else {
        if (authBtn) authBtn.textContent = 'Sign In';
        if (mobileAuthBtn) mobileAuthBtn.textContent = 'Sign In';
        if (userWelcomeEl) userWelcomeEl.textContent = '';
        if (libraryBtn) libraryBtn.classList.add('hidden');
        if (mobileLibraryBtn) mobileLibraryBtn.classList.add('hidden');
        updateGenerationCounter(); // Only for free page
    }
}


// --- Branding & Watermarking ---
// ... (no changes in these functions)
function openBrandingPanel() {
    document.getElementById('branding-panel').classList.remove('translate-x-full');
    document.getElementById('branding-panel-backdrop').classList.remove('hidden');
}
function closeBrandingPanel() {
    document.getElementById('branding-panel').classList.add('translate-x-full');
    document.getElementById('branding-panel-backdrop').classList.add('hidden');
}
function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        brandingSettings.logo = reader.result;
        updateLogoPreview();
        saveBrandingSettings();
    };
    reader.readAsDataURL(file);
}
function removeLogo() {
    brandingSettings.logo = null;
    updateLogoPreview();
    saveBrandingSettings();
}
function updateLogoPreview() {
    const logoPreview = document.getElementById('logo-preview');
    const logoPlaceholderText = document.getElementById('logo-placeholder-text');
    const removeLogoBtn = document.getElementById('remove-logo-btn');
    if (brandingSettings.logo) {
        logoPreview.src = brandingSettings.logo;
        logoPreview.classList.remove('hidden');
        logoPlaceholderText.classList.add('hidden');
        removeLogoBtn.classList.remove('hidden');
    } else {
        logoPreview.src = '';
        logoPreview.classList.add('hidden');
        logoPlaceholderText.classList.remove('hidden');
        removeLogoBtn.classList.add('hidden');
    }
}
function setWatermarkEnabled(isEnabled) {
    const watermarkEnabledToggle = document.getElementById('watermark-enabled-toggle');
    watermarkEnabledToggle.setAttribute('aria-checked', isEnabled);
    brandingSettings.enabled = isEnabled;
    if (isEnabled) {
        watermarkEnabledToggle.classList.add('bg-blue-600');
    } else {
        watermarkEnabledToggle.classList.remove('bg-blue-600');
    }
}
function saveBrandingSettings() {
    localStorage.setItem('genartBrandingSettings', JSON.stringify(brandingSettings));
}
function loadBrandingSettings() {
    const savedSettings = localStorage.getItem('genartBrandingSettings');
    if (savedSettings) {
        brandingSettings = JSON.parse(savedSettings);
        updateLogoPreview();
        setWatermarkEnabled(brandingSettings.enabled);
        document.querySelectorAll('.placement-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.position === brandingSettings.position);
        });
        document.getElementById('opacity-slider').value = (brandingSettings.opacity || 1) * 100;
        document.getElementById('opacity-value').textContent = `${document.getElementById('opacity-slider').value}%`;
        document.getElementById('size-slider').value = (brandingSettings.size || 0.1) * 100;
        document.getElementById('size-value').textContent = `${document.getElementById('size-slider').value}%`;
        document.getElementById('padding-x-input').value = brandingSettings.paddingX || 20;
        document.getElementById('padding-y-input').value = brandingSettings.paddingY || 20;
    } else {
        brandingSettings = { logo: null, enabled: false, position: 'bottom-right', opacity: 1, size: 0.1, paddingX: 20, paddingY: 20 };
    }
}
function applyWatermarkAndDownload(imageUrl) {
    if (!brandingSettings.logo) {
        showMessage("Please upload a logo in Branding Settings first.", "error");
        return;
    }
    if (!imageUrl) {
        showMessage("Please generate an image first.", "error");
        return;
    }

    const mainImage = new Image();
    mainImage.crossOrigin = "anonymous";
    mainImage.onload = () => {
        const watermark = new Image();
        watermark.crossOrigin = "anonymous";
        watermark.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = mainImage.naturalWidth;
            canvas.height = mainImage.naturalHeight;
            ctx.drawImage(mainImage, 0, 0);

            const watermarkWidth = canvas.width * brandingSettings.size;
            const watermarkHeight = watermark.height * (watermarkWidth / watermark.width);
            const paddingX = brandingSettings.paddingX;
            const paddingY = brandingSettings.paddingY;

            let x, y;
            switch (brandingSettings.position) {
                case 'top-left': x = paddingX; y = paddingY; break;
                case 'top-right': x = canvas.width - watermarkWidth - paddingX; y = paddingY; break;
                case 'bottom-left': x = paddingX; y = canvas.height - watermarkHeight - paddingY; break;
                default: x = canvas.width - watermarkWidth - paddingX; y = canvas.height - watermarkHeight - paddingY; break;
            }

            ctx.globalAlpha = brandingSettings.opacity;
            ctx.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);

            const link = document.createElement('a');
            link.download = `GenArt_Branded_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        watermark.src = brandingSettings.logo;
    };
    mainImage.src = imageUrl;
}

// --- Google Drive API Functions ---
// ... (no changes in these functions)
function gapiLoaded() { gapi.load('client', initializeGapiClient); }
async function initializeGapiClient() {
    await gapi.client.init({ apiKey: GOOGLE_API_KEY, discoveryDocs: DISCOVERY_DOCS });
    gapiInited = true;
}
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: '',
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
            if (resp.error !== undefined) {
                console.error("Google Auth Error:", resp);
                showMessage("Could not connect to Google Drive.", "error");
                return;
            };
            updateDriveButtonUI(true);
        };
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        showMessage("You are already connected to Google Drive.", "info");
    }
}
function updateDriveButtonUI(isConnected) {
    const textEl = document.getElementById('drive-connect-text');
    if(textEl) {
        if (isConnected) {
            textEl.textContent = 'Drive Connected';
            driveConnectBtn.classList.add('bg-green-100', 'border-green-300', 'text-green-800');
            if(mobileDriveConnectBtn) mobileDriveConnectBtn.textContent = 'Drive Connected';
        } else {
            textEl.textContent = 'Connect Drive';
            driveConnectBtn.classList.remove('bg-green-100', 'border-green-300', 'text-green-800');
            if(mobileDriveConnectBtn) mobileDriveConnectBtn.textContent = 'Connect Drive';
        }
    }
}
function showDriveOptions(imageUrl) {
    currentImageUrlToSave = imageUrl;
    const modal = document.getElementById('drive-options-modal');
    modal.classList.remove('hidden');
}
function hideDriveOptions() {
    const modal = document.getElementById('drive-options-modal');
    modal.classList.add('hidden');
}
function showFileNameModal(options) {
    currentUploadOptions = options;
    const modal = document.getElementById('file-name-modal');
    const input = document.getElementById('file-name-input');
    const promptText = document.getElementById('prompt-input').value.substring(0, 30).replace(/\s/g, '_');
    input.value = `GenArt_${promptText || 'image'}`;
    modal.classList.remove('hidden');
    input.focus();
}
function hideFileNameModal() {
    const modal = document.getElementById('file-name-modal');
    modal.classList.add('hidden');
}
async function uploadToDrive(options = { withBranding: false }, fileName) {
    if (!currentImageUrlToSave) {
        showMessage('No image selected to save.', 'error');
        return;
    }
    if (gapi.client.getToken() === null) {
        showMessage('Please connect to Google Drive first.', 'info');
        handleAuthClick();
        return;
    }

    if (options.withBranding && !brandingSettings.logo) {
        showMessage("Please upload a logo in Branding Settings to save with branding.", "error");
        return;
    }

    if (options.withBranding) {
        const mainImage = new Image();
        mainImage.crossOrigin = "anonymous";
        mainImage.onload = () => {
            const watermark = new Image();
            watermark.crossOrigin = "anonymous";
            watermark.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = mainImage.naturalWidth;
                canvas.height = mainImage.naturalHeight;
                ctx.drawImage(mainImage, 0, 0);

                const watermarkWidth = canvas.width * brandingSettings.size;
                const watermarkHeight = watermark.height * (watermarkWidth / watermark.width);
                const paddingX = brandingSettings.paddingX;
                const paddingY = brandingSettings.paddingY;

                let x, y;
                switch (brandingSettings.position) {
                    case 'top-left': x = paddingX; y = paddingY; break;
                    case 'top-right': x = canvas.width - watermarkWidth - paddingX; y = paddingY; break;
                    case 'bottom-left': x = paddingX; y = canvas.height - watermarkHeight - paddingY; break;
                    default: x = canvas.width - watermarkWidth - paddingX; y = canvas.height - watermarkHeight - paddingY; break;
                }

                ctx.globalAlpha = brandingSettings.opacity;
                ctx.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);
                
                canvas.toBlob((blob) => {
                    performUpload(blob, fileName);
                }, 'image/png');
            };
            watermark.src = brandingSettings.logo;
        };
        mainImage.src = currentImageUrlToSave;
    } else {
        const response = await fetch(currentImageUrlToSave);
        const imageBlob = await response.blob();
        performUpload(imageBlob, fileName);
    }
}
async function performUpload(blob, fileName) {
    const finalFileName = fileName ? `${fileName}.png` : `GenArt_${Date.now()}.png`;
    const metadata = {
        'name': finalFileName,
        'mimeType': 'image/png',
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    try {
        const saveButton = document.querySelector('button[title="Save to Drive"]');
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
        showMessage(`Image saved as "${finalFileName}" to your Google Drive!`, 'info');
        saveButton.innerHTML = originalIcon;
        saveButton.disabled = false;
    } catch (error) {
        console.error('Error uploading to Drive:', error);
        showMessage(`Failed to save to Drive: ${error.message}`, 'error');
    }
}

// --- NEW: Library Functions ---

async function saveToLibrary(imageUrl, prompt) {
    if (!currentUser) {
        showMessage('You must be signed in to save images to your library.', 'error');
        return;
    }

    const saveButton = document.querySelector('button[title="Save to Library"]');
    const originalIcon = saveButton.innerHTML;
    saveButton.innerHTML = `<svg class="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    saveButton.disabled = true;

    try {
        // 1. Convert base64 URL to Blob
        const response = await fetch(imageUrl);
        const imageBlob = await response.blob();

        // 2. Create a reference in Firebase Storage
        const imageId = `genart_${Date.now()}.png`;
        const storageRef = ref(storage, `user_images/${currentUser.uid}/${imageId}`);

        // 3. Upload the Blob
        const uploadResult = await uploadBytes(storageRef, imageBlob);

        // 4. Get the public download URL
        const downloadURL = await getDownloadURL(uploadResult.ref);

        // 5. Save metadata to Firestore
        const libraryCollectionRef = collection(db, 'userLibraries', currentUser.uid, 'images');
        await addDoc(libraryCollectionRef, {
            imageUrl: downloadURL,
            prompt: prompt,
            storagePath: uploadResult.ref.fullPath,
            createdAt: serverTimestamp()
        });

        showMessage('Image saved to your library!', 'info');

    } catch (error) {
        console.error("Error saving to library: ", error);
        showMessage('Could not save image. Please try again.', 'error');
    } finally {
        saveButton.innerHTML = originalIcon;
        saveButton.disabled = false;
    }
}

async function fetchUserLibrary() {
    if (!currentUser || !libraryGrid) return;

    libraryLoader.style.display = 'block';
    emptyLibraryMessage.style.display = 'none';
    libraryGrid.innerHTML = '';

    try {
        const libraryCollectionRef = collection(db, 'userLibraries', currentUser.uid, 'images');
        const querySnapshot = await getDocs(libraryCollectionRef);

        if (querySnapshot.empty) {
            emptyLibraryMessage.style.display = 'block';
        } else {
            querySnapshot.docs.forEach(doc => {
                const imageData = doc.data();
                const imageId = doc.id;
                displayLibraryImage(imageData, imageId);
            });
        }
    } catch (error) {
        console.error("Error fetching library:", error);
        showMessage("Could not load your library. Please refresh the page.", 'error');
    } finally {
        libraryLoader.style.display = 'none';
    }
}

function displayLibraryImage(imageData, imageId) {
    const card = document.createElement('div');
    card.id = `library-card-${imageId}`;
    card.className = 'group relative aspect-w-1 aspect-h-1 bg-gray-100 rounded-lg overflow-hidden shadow-md';
    
    const img = document.createElement('img');
    img.src = imageData.imageUrl;
    img.alt = imageData.prompt;
    img.className = 'w-full h-full object-cover group-hover:opacity-75 transition-opacity';

    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-4 text-white';

    const promptText = document.createElement('p');
    promptText.className = 'text-sm line-clamp-3';
    promptText.textContent = imageData.prompt;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'flex items-center justify-end gap-2';

    const downloadBtn = createActionButton('download', 'Download', () => {
         const a = document.createElement('a'); a.href = imageData.imageUrl; a.target = '_blank'; a.download = `GenArt_Library_${imageId}.png`; a.click();
    });
    const removeBtn = createActionButton('remove', 'Remove from Library', () => removeFromLibrary(imageId, imageData.storagePath));
    
    buttonContainer.appendChild(downloadBtn);
    buttonContainer.appendChild(removeBtn);

    overlay.appendChild(promptText);
    overlay.appendChild(buttonContainer);
    card.appendChild(img);
    card.appendChild(overlay);
    libraryGrid.appendChild(card);
}

async function removeFromLibrary(docId, storagePath) {
     if (!currentUser) return;
     if (!confirm('Are you sure you want to permanently remove this image?')) return;

    try {
        // 1. Delete from Firestore
        await deleteDoc(doc(db, 'userLibraries', currentUser.uid, 'images', docId));

        // 2. Delete from Storage
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);

        // 3. Remove from UI
        const cardToRemove = document.getElementById(`library-card-${docId}`);
        if (cardToRemove) {
            cardToRemove.remove();
        }

        if(libraryGrid.children.length === 0){
             emptyLibraryMessage.style.display = 'block';
        }

        showMessage('Image removed from library.', 'info');

    } catch (error) {
        console.error("Error removing image: ", error);
        showMessage('Failed to remove image. Please try again.', 'error');
    }
}


// --- Helper Functions ---
// ... (no changes in these functions except showMessage)
function startTimer() {
    let startTime = Date.now();
    const maxTime = 17 * 1000;
    progressBar.style.width = '0%';
    timerEl.textContent = `0.0s / ~17s`;
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime >= maxTime) {
            stopTimer();
            progressBar.style.width = '100%';
            timerEl.textContent = `17.0s / ~17s`;
            return;
        }
        const progress = Math.min(elapsedTime / maxTime, 1);
        progressBar.style.width = `${progress * 100}%`;
        timerEl.textContent = `${(elapsedTime / 1000).toFixed(1)}s / ~17s`;
    }, 100);
}
function stopTimer() { clearInterval(timerInterval); timerInterval = null; }
function getGenerationCount() { return parseInt(localStorage.getItem('generationCount') || '0'); }
function incrementGenerationCount() {
    const newCount = getGenerationCount() + 1;
    localStorage.setItem('generationCount', newCount);
    updateGenerationCounter();
}
function updateGenerationCounter() {
    if (auth.currentUser || !generationCounterEl) return;
    const count = getGenerationCount();
    const remaining = Math.max(0, FREE_GENERATION_LIMIT - count);
    const text = `${remaining} free generation${remaining !== 1 ? 's' : ''} left`;
    generationCounterEl.textContent = text;
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
async function incrementTotalGenerations() {
    const counterRef = doc(db, "stats", "imageGenerations");
    try { await setDoc(counterRef, { count: increment(1) }, { merge: true }); } catch (error) { console.error("Error incrementing generation count:", error); }
}
function showMessage(text, type = 'info') {
    const container = document.getElementById('message-box') || document.body;
    const messageEl = document.createElement('div');
    
    // Use different styles for a global message vs. in-app message
    if (container.id === 'message-box') {
        messageEl.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up`;
        container.innerHTML = ''; // Clear previous messages
        container.appendChild(messageEl);
    } else {
        messageEl.className = `fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg ${type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'} fade-in-slide-up`;
        container.appendChild(messageEl);
    }
    
    messageEl.textContent = text;
    setTimeout(() => { if(container.contains(messageEl)) container.removeChild(messageEl); }, 4000);
}
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
        if (variantsBtn) {
            variantsBtn.classList.remove('selected');
        }
    };
    if (messageBox) messageBox.prepend(backButton);
}
function toggleMusic() {
    if (!musicBtn || !lofiMusic) return;
    const isPlaying = musicBtn.classList.contains('playing');
    if (isPlaying) lofiMusic.pause();
    else lofiMusic.play().catch(e => console.error("Audio error:", e));
    musicBtn.classList.toggle('playing');
}
function copyPrompt() {
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
async function callApiToEnhance(prompt) {
    for (let attempt = 0; attempt < 3; attempt++) {
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
            if (attempt >= 2) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}
