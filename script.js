// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const provider = new GoogleAuthProvider();

// --- DOM Element References ---
const authPromptContainer = document.getElementById('auth-prompt-container');
const mainSigninBtn = document.getElementById('main-signin-btn');
const generatorUI = document.getElementById('generator-ui');
const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');
const resultContainer = document.getElementById('result-container');
const loadingIndicator = document.getElementById('loading-indicator');
const imageGrid = document.getElementById('image-grid');
const timerEl = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const messageBox = document.getElementById('message-box');
const examplePrompts = document.querySelectorAll('.example-prompt');
const imageUploadBtn = document.getElementById('image-upload-btn');
const imageUploadInput = document.getElementById('image-upload-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const authBtn = document.getElementById('auth-btn');
const mobileAuthBtn = document.getElementById('mobile-auth-btn');
const creditCounterEl = document.getElementById('credit-counter');
const mobileCreditCounterEl = document.getElementById('mobile-credit-counter');
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

// --- Global State ---
let timerInterval;
const INITIAL_CREDITS = 5;
let currentUserCredits = 0;
let uploadedImageData = null;
let currentImageUrlToSave = null;
let selectedAspectRatio = '1:1';
let brandingSettings = {};
let currentUploadOptions = {};

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    initializeCursor();
    
    onAuthStateChanged(auth, user => {
        if (user) {
            handleUserLogin(user);
        } else {
            handleUserLogout();
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
    if (mainSigninBtn) mainSigninBtn.addEventListener('click', signInWithGoogle);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => authModal.classList.add('hidden'));
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
        getStartedBtn.addEventListener('click', () => emailModal.classList.remove('hidden'));
        closeEmailModalBtn.addEventListener('click', () => emailModal.classList.add('hidden'));
        emailForm.addEventListener('submit', handleEmailSubmit);
    }

    if (brandingSettingsBtn) {
        initializeProGeneratorPage();
    }
});

// --- Authentication and User Handling ---
async function handleUserLogin(user) {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
        currentUserCredits = userDoc.data().generationCredits;
    } else {
        await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName,
            createdAt: new Date(),
            generationCredits: INITIAL_CREDITS
        });
        currentUserCredits = INITIAL_CREDITS;
    }
    updateUICredits();

    if(authBtn) authBtn.textContent = 'Sign Out';
    if(mobileAuthBtn) mobileAuthBtn.textContent = 'Sign Out';
    if(authModal) authModal.classList.add('hidden');
    
    if (authPromptContainer) authPromptContainer.classList.add('hidden');
    if (generatorUI) generatorUI.classList.remove('hidden');
}

function handleUserLogout() {
    currentUserCredits = 0;
    if(authBtn) authBtn.textContent = 'Sign In';
    if(mobileAuthBtn) mobileAuthBtn.textContent = 'Sign In';
    if(creditCounterEl) creditCounterEl.textContent = '';
    if(mobileCreditCounterEl) mobileCreditCounterEl.textContent = '';

    if (authPromptContainer) authPromptContainer.classList.remove('hidden');
    if (generatorUI) generatorUI.classList.add('hidden');
    if (resultContainer) resultContainer.classList.add('hidden');
}

function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth).catch(error => console.error("Sign Out Error:", error));
    } else {
        signInWithGoogle();
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .catch(error => {
            console.error("Authentication Error:", error);
            showMessage("Could not sign in with Google. Please try again.", "error");
        });
}

function updateUICredits() {
    const text = `${currentUserCredits} credit${currentUserCredits !== 1 ? 's' : ''} left`;
    if (creditCounterEl) creditCounterEl.textContent = text;
    if (mobileCreditCounterEl) mobileCreditCounterEl.textContent = text;
}

// --- Image Generation Logic ---
async function handleGenerateClick() {
    if (!auth.currentUser) {
        authModal.classList.remove('hidden');
        return;
    }

    if (currentUserCredits <= 0) {
        showMessage("You're out of credits! Please upgrade to continue generating.", 'error');
        return;
    }
    
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showMessage('Please describe what you want to create or edit.', 'error');
        return;
    }

    await generateImageFlow(prompt, false);
}

async function generateVariants() {
    if (!auth.currentUser) {
        authModal.classList.remove('hidden');
        return;
    }

    if (currentUserCredits < 3) { // Assuming variants cost 3 credits
        showMessage(`You need at least 3 credits to generate variants. You have ${currentUserCredits}.`, 'error');
        return;
    }
    
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showMessage('Please enter a prompt to generate variants.', 'error');
        return;
    }
    if(variantsBtn) variantsBtn.classList.add('selected');
    await generateImageFlow(prompt, true);
}


async function generateImageFlow(prompt, areVariants) {
    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    resultContainer.classList.remove('hidden');
    loadingIndicator.classList.remove('hidden');
    generatorUI.classList.add('hidden');
    startTimer();

    const creditsToDeduct = areVariants ? 3 : 1;

    try {
        if (areVariants) {
            const promises = [
                generateImageWithRetry(prompt, uploadedImageData, selectedAspectRatio),
                generateImageWithRetry(prompt, uploadedImageData, selectedAspectRatio),
                generateImageWithRetry(prompt, uploadedImageData, selectedAspectRatio)
            ];
            const imageUrls = await Promise.all(promises);
            imageGrid.classList.add('md:grid-cols-3');
            imageUrls.forEach(url => displayImage(url, prompt, true));
        } else {
            const imageUrl = await generateImageWithRetry(prompt, uploadedImageData, selectedAspectRatio);
            currentImageUrlToSave = imageUrl;
            imageGrid.classList.remove('md:grid-cols-3');
            displayImage(imageUrl, prompt, false);
        }

        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, { generationCredits: increment(-creditsToDeduct) });
        currentUserCredits -= creditsToDeduct;
        updateUICredits();

    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        addBackButton();
    }
}


async function generateImageWithRetry(prompt, imageData, aspectRatio, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, imageData, aspectRatio })
            });
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || `API Error: ${response.status}`);
            }
            const result = await response.json();
            const base64Data = imageData ? result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data : result.predictions?.[0]?.bytesBase64Encoded;
            if (!base64Data) throw new Error("No image data received from API.");
            return `data:image/png;base64,${base64Data}`;
        } catch (error) {
            console.error(`Generation attempt ${attempt + 1} failed:`, error);
            if (attempt >= maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

function displayImage(imageUrl, prompt, isVariant = false) {
    const cardWrapper = document.createElement('div');
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group border border-gray-200/80';

    if (isVariant) {
        cardWrapper.className = 'variant-image-container fade-in-slide-up';
        imgContainer.classList.add('h-full');
    } else {
        cardWrapper.className = 'mx-auto max-w-2xl fade-in-slide-up';
    }

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = isVariant ? 'w-full h-full object-cover' : 'w-full h-auto object-contain';

    const buttonContainer = document.createElement('div');
    const downloadButton = createActionButton('download', 'Download Original', () => {
        const a = document.createElement('a'); a.href = imageUrl; a.download = `GenArt_Original_${Date.now()}.png`; a.click();
    });
    
    let proButtons = [];
    if (brandingSettingsBtn) {
        if (brandingSettings.enabled && brandingSettings.logo) {
            proButtons.push(createActionButton('brand', 'Export with Branding', () => applyWatermarkAndDownload(imageUrl)));
        }
        proButtons.push(createActionButton('drive', 'Save to Drive', () => showDriveOptions(imageUrl)));
    }

    if (selectedAspectRatio === '16:9') {
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
        imgContainer.appendChild(buttonContainer);
        cardWrapper.appendChild(imgContainer);
    }
    
    if (!isVariant) imageGrid.innerHTML = '';
    imageGrid.appendChild(cardWrapper);
}

function createActionButton(type, title, onClick) {
    const button = document.createElement('button');
    button.className = 'bg-black/50 text-white p-2 rounded-full hover:bg-black/75 transition-colors flex items-center justify-center w-10 h-10';
    button.title = title;
    button.onclick = onClick;
    const icons = {
        download: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
        brand: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>`,
        drive: `<img src="https://iili.io/K25gUKl.md.png" alt="Save to Drive" class="w-5 h-5">`
    };
    button.innerHTML = icons[type] || '';
    return button;
}

// --- Pro Page Initialization & Functions ---
function initializeProGeneratorPage() {
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
    paddingXInput.addEventListener('input', (e) => { brandingSettings.paddingX = parseInt(e.target.value, 10); saveBrandingSettings(); });
    paddingYInput.addEventListener('input', (e) => { brandingSettings.paddingY = parseInt(e.target.value, 10); saveBrandingSettings(); });

    saveWithBrandingBtn.addEventListener('click', () => { hideDriveOptions(); showFileNameModal({ withBranding: true }); });
    saveWithoutBrandingBtn.addEventListener('click', () => { hideDriveOptions(); showFileNameModal({ withBranding: false }); });
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
    gapiScript.async = true; gapiScript.defer = true; gapiScript.onload = gapiLoaded;
    document.head.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true; gisScript.defer = true; gisScript.onload = gisLoaded;
    document.head.appendChild(gisScript);
    
    if (driveConnectBtn) driveConnectBtn.addEventListener('click', handleDriveAuthClick);
    if (mobileDriveConnectBtn) mobileDriveConnectBtn.addEventListener('click', handleDriveAuthClick);
}

function openBrandingPanel() { document.getElementById('branding-panel').classList.remove('translate-x-full'); document.getElementById('branding-panel-backdrop').classList.remove('hidden'); }
function closeBrandingPanel() { document.getElementById('branding-panel').classList.add('translate-x-full'); document.getElementById('branding-panel-backdrop').classList.add('hidden'); }

function handleLogoUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { brandingSettings.logo = reader.result; updateLogoPreview(); saveBrandingSettings(); };
    reader.readAsDataURL(file);
}

function removeLogo() { brandingSettings.logo = null; updateLogoPreview(); saveBrandingSettings(); }

function updateLogoPreview() {
    const logoPreview = document.getElementById('logo-preview'), logoPlaceholderText = document.getElementById('logo-placeholder-text'), removeLogoBtn = document.getElementById('remove-logo-btn');
    if (brandingSettings.logo) {
        logoPreview.src = brandingSettings.logo;
        logoPreview.classList.remove('hidden'); logoPlaceholderText.classList.add('hidden'); removeLogoBtn.classList.remove('hidden');
    } else {
        logoPreview.src = '';
        logoPreview.classList.add('hidden'); logoPlaceholderText.classList.remove('hidden'); removeLogoBtn.classList.add('hidden');
    }
}

function setWatermarkEnabled(isEnabled) {
    const toggle = document.getElementById('watermark-enabled-toggle');
    toggle.setAttribute('aria-checked', isEnabled);
    brandingSettings.enabled = isEnabled;
    isEnabled ? toggle.classList.add('bg-blue-600') : toggle.classList.remove('bg-blue-600');
}

function saveBrandingSettings() { localStorage.setItem('genartBrandingSettings', JSON.stringify(brandingSettings)); }

function loadBrandingSettings() {
    const saved = localStorage.getItem('genartBrandingSettings');
    brandingSettings = saved ? JSON.parse(saved) : { logo: null, enabled: false, position: 'bottom-right', opacity: 1, size: 0.1, paddingX: 20, paddingY: 20 };
    updateLogoPreview();
    setWatermarkEnabled(brandingSettings.enabled);
    document.querySelectorAll('.placement-btn').forEach(btn => btn.classList.toggle('selected', btn.dataset.position === brandingSettings.position));
    document.getElementById('opacity-slider').value = (brandingSettings.opacity || 1) * 100;
    document.getElementById('opacity-value').textContent = `${document.getElementById('opacity-slider').value}%`;
    document.getElementById('size-slider').value = (brandingSettings.size || 0.1) * 100;
    document.getElementById('size-value').textContent = `${document.getElementById('size-slider').value}%`;
    document.getElementById('padding-x-input').value = brandingSettings.paddingX || 20;
    document.getElementById('padding-y-input').value = brandingSettings.paddingY || 20;
}

function applyWatermarkAndDownload(imageUrl) {
    if (!brandingSettings.logo || !imageUrl) { showMessage("Please upload a logo and generate an image first.", "error"); return; }
    const mainImage = new Image(); mainImage.crossOrigin = "anonymous";
    mainImage.onload = () => {
        const watermark = new Image(); watermark.crossOrigin = "anonymous";
        watermark.onload = () => {
            const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
            canvas.width = mainImage.naturalWidth; canvas.height = mainImage.naturalHeight; ctx.drawImage(mainImage, 0, 0);
            const wmWidth = canvas.width * brandingSettings.size, wmHeight = watermark.height * (wmWidth / watermark.width);
            const { paddingX, paddingY } = brandingSettings;
            let x, y;
            switch (brandingSettings.position) {
                case 'top-left': x = paddingX; y = paddingY; break;
                case 'top-right': x = canvas.width - wmWidth - paddingX; y = paddingY; break;
                case 'bottom-left': x = paddingX; y = canvas.height - wmHeight - paddingY; break;
                default: x = canvas.width - wmWidth - paddingX; y = canvas.height - wmHeight - paddingY; break;
            }
            ctx.globalAlpha = brandingSettings.opacity; ctx.drawImage(watermark, x, y, wmWidth, wmHeight);
            const link = document.createElement('a'); link.download = `GenArt_Branded_${Date.now()}.png`; link.href = canvas.toDataURL('image/png'); link.click();
        };
        watermark.src = brandingSettings.logo;
    };
    mainImage.src = imageUrl;
}

// --- Google Drive API Functions ---
function gapiLoaded() { gapi.load('client', initializeGapiClient); }
async function initializeGapiClient() { await gapi.client.init({ apiKey: GOOGLE_API_KEY, discoveryDocs: DISCOVERY_DOCS }); gapiInited = true; }
function gisLoaded() { tokenClient = google.accounts.oauth2.initTokenClient({ client_id: GOOGLE_CLIENT_ID, scope: SCOPES, callback: '', }); gisInited = true; }

function handleDriveAuthClick() {
    if (!gapiInited || !gisInited) { showMessage("Google API is not ready. Please wait.", "info"); return; }
    if (gapi.client.getToken() === null) {
        tokenClient.callback = (resp) => { if (resp.error) { console.error("Google Auth Error:", resp); showMessage("Could not connect to Google Drive.", "error"); return; } updateDriveButtonUI(true); };
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else { showMessage("Already connected to Google Drive.", "info"); }
}

function updateDriveButtonUI(isConnected) {
    const textEl = document.getElementById('drive-connect-text');
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

function showDriveOptions(imageUrl) { currentImageUrlToSave = imageUrl; document.getElementById('drive-options-modal').classList.remove('hidden'); }
function hideDriveOptions() { document.getElementById('drive-options-modal').classList.add('hidden'); }
function showFileNameModal(options) {
    currentUploadOptions = options;
    const modal = document.getElementById('file-name-modal'), input = document.getElementById('file-name-input');
    const promptText = document.getElementById('prompt-input').value.substring(0, 30).replace(/\s/g, '_');
    input.value = `GenArt_${promptText || 'image'}`;
    modal.classList.remove('hidden'); input.focus();
}
function hideFileNameModal() { document.getElementById('file-name-modal').classList.add('hidden'); }

async function uploadToDrive(options = { withBranding: false }, fileName) {
    if (!currentImageUrlToSave) { showMessage('No image to save.', 'error'); return; }
    if (gapi.client.getToken() === null) { showMessage('Please connect to Google Drive first.', 'info'); handleDriveAuthClick(); return; }
    if (options.withBranding && !brandingSettings.logo) { showMessage("Please upload a logo to save with branding.", "error"); return; }

    const blob = await new Promise(resolve => {
        if (!options.withBranding) { fetch(currentImageUrlToSave).then(res => res.blob()).then(resolve); } 
        else { /* ... logic to create branded blob from applyWatermarkAndDownload ... */ }
    });
    performUpload(blob, fileName);
}

async function performUpload(blob, fileName) {
    // ... (This function remains largely the same)
}

// --- General Helper Functions ---
function initializeCursor() {
    const cursorDot = document.querySelector('.cursor-dot'), cursorOutline = document.querySelector('.cursor-outline');
    if (!cursorDot || !cursorOutline) return;
    let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
    const animate = () => {
        cursorDot.style.left = `${mouseX}px`; cursorDot.style.top = `${mouseY}px`;
        outlineX += (mouseX - outlineX) * 0.15; outlineY += (mouseY - outlineY) * 0.15;
        cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
        requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    document.querySelectorAll('a, button, textarea, input, label').forEach(el => {
        el.addEventListener('mouseover', () => cursorOutline.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => cursorOutline.classList.remove('cursor-hover'));
    });
}

function startTimer() {
    let startTime = Date.now(); const maxTime = 17000;
    progressBar.style.width = '0%'; timerEl.textContent = `0.0s / ~17s`;
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= maxTime) { stopTimer(); progressBar.style.width = '100%'; timerEl.textContent = `17.0s / ~17s`; return; }
        progressBar.style.width = `${(elapsed / maxTime) * 100}%`;
        timerEl.textContent = `${(elapsed / 1000).toFixed(1)}s / ~17s`;
    }, 100);
}

function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

function handleImageUpload(event) {
    const file = event.target.files[0]; if (!file || !file.type.startsWith('image/')) return;
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
    uploadedImageData = null; imageUploadInput.value = '';
    imagePreviewContainer.classList.add('hidden'); imagePreview.src = '';
    promptInput.placeholder = "An oil painting of a futuristic city skyline at dusk...";
}

function showMessage(text, type = 'info') {
    if (!messageBox) return;
    const el = document.createElement('div');
    el.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up`;
    el.textContent = text;
    messageBox.innerHTML = ''; messageBox.appendChild(el);
    setTimeout(() => { if(messageBox.contains(el)) messageBox.removeChild(el); }, 4000);
}

function addBackButton() {
    if (document.getElementById('back-to-generator-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'back-to-generator-btn'; btn.textContent = '← Create another';
    btn.className = 'mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
    btn.onclick = () => {
        generatorUI.classList.remove('hidden'); resultContainer.classList.add('hidden');
        imageGrid.innerHTML = ''; messageBox.innerHTML = ''; promptInput.value = '';
        removeUploadedImage();
        if(variantsBtn) variantsBtn.classList.remove('selected');
    };
    if (messageBox) messageBox.prepend(btn);
}

function toggleMusic() {
    if (!musicBtn || !lofiMusic) return;
    const isPlaying = musicBtn.classList.toggle('playing');
    isPlaying ? lofiMusic.play().catch(e=>console.error("Audio error", e)) : lofiMusic.pause();
}

function copyPrompt() {
    if (!promptInput.value) { showMessage('Nothing to copy.', 'info'); return; }
    navigator.clipboard.writeText(promptInput.value).then(() => {
        showMessage('Prompt copied!', 'info');
        const icon = copyPromptBtn.innerHTML;
        copyPromptBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        setTimeout(() => { copyPromptBtn.innerHTML = icon; }, 2000);
    }, () => showMessage('Failed to copy.', 'error'));
}

async function handleEnhancePrompt() {
    if (!promptInput.value) { showMessage('Please enter a prompt to enhance.', 'info'); return; }
    const icon = enhancePromptBtn.innerHTML;
    enhancePromptBtn.innerHTML = `<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
    enhancePromptBtn.disabled = true;
    try {
        const response = await fetch('/api/enhance', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptInput.value })
        });
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        promptInput.value = data.text;
        promptInput.style.height = `${promptInput.scrollHeight}px`;
    } catch (error) {
        console.error('Failed to enhance prompt:', error);
        showMessage('Could not enhance prompt right now.', 'error');
    } finally {
        enhancePromptBtn.innerHTML = icon; enhancePromptBtn.disabled = false;
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
    } else {
        emailErrorMsg.classList.add('hidden');
        window.location.href = 'pro-generator.html';
    }
}
