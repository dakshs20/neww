// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Google Drive API Configuration ---
// IMPORTANT: You must get these from your Google Cloud Console project.
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
const messageBox = document.getElementById('message-box');
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
const brandingPanel = document.getElementById('branding-panel');
const brandingPanelBackdrop = document.getElementById('branding-panel-backdrop');
const brandingSettingsBtn = document.getElementById('branding-settings-btn');
const closeBrandingPanelBtn = document.getElementById('close-branding-panel-btn');
const logoUploadInput = document.getElementById('logo-upload-input');
const logoUploadBtn = document.getElementById('logo-upload-btn');
const removeLogoBtn = document.getElementById('remove-logo-btn');
const logoPreview = document.getElementById('logo-preview');
const logoPlaceholderText = document.getElementById('logo-placeholder-text');
const watermarkEnabledToggle = document.getElementById('watermark-enabled-toggle');
const placementOptions = document.getElementById('placement-options');
const opacitySlider = document.getElementById('opacity-slider');
const opacityValue = document.getElementById('opacity-value');
const sizeSlider = document.getElementById('size-slider');
const sizeValue = document.getElementById('size-value');
const paddingXInput = document.getElementById('padding-x-input');
const paddingYInput = document.getElementById('padding-y-input');

// --- Global State ---
let lastGeneratedImageUrl = null;
let lastGeneratedBlob = null;
let brandingSettings = {};

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    initializeCursor();

    if (document.body.contains(getStartedBtn)) {
        initializeForTeamsPage();
    }
    if (document.body.contains(document.getElementById('generator-ui'))) {
        initializeGeneratorPage();
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
    generateBtn.addEventListener('click', handleGenerateClick);
    // ... (Add other generator event listeners if they are not page-specific)
}

function initializeForTeamsPage() {
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

function initializeProGeneratorPage() {
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
        if (e.target.classList.contains('placement-btn')) {
            document.querySelectorAll('.placement-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
            brandingSettings.position = e.target.dataset.position;
            saveBrandingSettings();
        }
    });
    opacitySlider.addEventListener('input', (e) => {
        opacityValue.textContent = `${e.target.value}%`;
        brandingSettings.opacity = e.target.value / 100;
        saveBrandingSettings();
    });
    sizeSlider.addEventListener('input', (e) => {
        sizeValue.textContent = `${e.target.value}%`;
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
}

// --- Event Handlers ---
function handleGenerateClick() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showMessage('Please describe what you want to create or edit.', 'error');
        return;
    }
    generateImage();
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
    window.location.href = 'pro-generator.html';
}

// --- Branding & Watermarking Functions ---
function openBrandingPanel() {
    brandingPanel.classList.remove('translate-x-full');
    brandingPanelBackdrop.classList.remove('hidden');
}

function closeBrandingPanel() {
    brandingPanel.classList.add('translate-x-full');
    brandingPanelBackdrop.classList.add('hidden');
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
        opacitySlider.value = (brandingSettings.opacity || 1) * 100;
        opacityValue.textContent = `${opacitySlider.value}%`;
        sizeSlider.value = (brandingSettings.size || 0.1) * 100;
        sizeValue.textContent = `${sizeSlider.value}%`;
        paddingXInput.value = brandingSettings.paddingX || 20;
        paddingYInput.value = brandingSettings.paddingY || 20;
    } else {
        brandingSettings = { logo: null, enabled: false, position: 'bottom-right', opacity: 1, size: 0.1, paddingX: 20, paddingY: 20 };
    }
}

function applyWatermarkAndDownload() {
    if (!brandingSettings.logo) {
        showMessage("Please upload a logo in Branding Settings first.", "error");
        return;
    }
    if (!lastGeneratedImageUrl) {
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
    mainImage.src = lastGeneratedImageUrl;
}

// --- Core Functionality ---
async function generateImage() {
    const prompt = promptInput.value.trim();
    generatorUI.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    loadingIndicator.classList.remove('hidden');
    
    // MOCK API CALL
    setTimeout(() => {
        const mockImageUrl = `https://placehold.co/1024x1024/EFEFEF/333333?text=${encodeURIComponent(prompt.substring(0, 20))}`;
        fetch(mockImageUrl)
            .then(res => res.blob())
            .then(blob => {
                lastGeneratedBlob = blob;
                lastGeneratedImageUrl = URL.createObjectURL(blob);
                displayImage(lastGeneratedImageUrl, prompt);
                loadingIndicator.classList.add('hidden');
                addBackButton();
            });
    }, 2000);
}

function displayImage(imageUrl, prompt) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group fade-in-slide-up mx-auto max-w-2xl border border-gray-200/80';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300';

    const downloadButton = createActionButton('download', 'Download Original', () => {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = `GenArt_Original_${Date.now()}.png`;
        a.click();
    });
    buttonContainer.appendChild(downloadButton);

    if (brandingSettings.enabled) {
        const exportBrandedButton = createActionButton('brand', 'Export with Branding', applyWatermarkAndDownload);
        buttonContainer.appendChild(exportBrandedButton);
    }
    
    imgContainer.appendChild(img);
    imgContainer.appendChild(buttonContainer);
    imageGrid.innerHTML = '';
    imageGrid.appendChild(imgContainer);
}

function createActionButton(type, title, onClick) {
    const button = document.createElement('button');
    button.className = 'bg-black/50 text-white p-2 rounded-full hover:bg-black/75 transition-colors';
    button.title = title;
    button.onclick = onClick;
    
    const icons = {
        download: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
        brand: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>`
    };
    
    button.innerHTML = icons[type] || '';
    return button;
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
    };
    if (messageBox) messageBox.prepend(backButton);
}
