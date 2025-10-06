// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- Global State ---
let currentUser;
let currentUserCredits = 0;
let isGenerating = false;
let currentAspectRatio = '1:1';
let currentStyle = 'Realistic'; 
let uploadedImageData = null;
let currentPreviewInputData = null; 
let timerInterval;

// --- DOM Element Caching ---
const DOMElements = {};

// --- GOOGLE DRIVE INTEGRATION STATE ---
// IMPORTANT: Replace with your Google Cloud project's credentials.
// You can get these from the Google Cloud Console: https://console.cloud.google.com/apis/credentials
const GOOGLE_API_KEY = "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y"; // Can be same as Firebase key
const GOOGLE_CLIENT_ID = "520534975282-ca7f413hr2le5vgkcqt1fuuptv2am9e5.apps.googleusercontent.com";
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let isDriveConnected = false;
let driveSaveOption = 'manual'; // 'manual' or 'auto'


document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'header-nav', 'gallery-container', 'masonry-gallery', 'prompt-input',
        'generate-btn', 'generate-icon', 'loading-spinner', 'ratio-btn', 'ratio-options',
        'auth-modal', 'google-signin-btn', 'out-of-credits-modal', 
        'preview-modal', 'preview-image', 'preview-prompt-input',
        'download-btn', 'close-preview-btn', 'regenerate-btn',
        'image-upload-btn', 'image-upload-input', 'image-preview-container', 'image-preview', 'remove-image-btn',
        'preview-input-image-container', 'preview-input-image', 'change-input-image-btn', 'remove-input-image-btn', 'preview-image-upload-input',
        'hero-section', 'hero-headline', 'hero-subline', 'typewriter', 'prompt-bar-container',
        'mobile-menu', 'mobile-menu-btn', 'menu-open-icon', 'menu-close-icon',
        'button-timer', 'button-content', 'style-selector', 'mobile-style-toggle-btn', 'mobile-style-options',
        // New Drive elements
        'drive-btn', 'drive-btn-text', 'drive-modal', 'connect-drive-btn',
        'drive-connected-content', 'drive-disconnected-content', 'drive-save-auto',
        'drive-save-manual', 'save-to-drive-btn', 'toast-notification', 'drive-modal-subtitle'
    ];
    ids.forEach(id => {
        if (id) {
            DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id);
        }
    });
    
    // Select all buttons and other query-based elements
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');
    DOMElements.modalBackdrops = document.querySelectorAll('.modal-backdrop');
    DOMElements.ratioOptionBtns = document.querySelectorAll('.ratio-option');
    DOMElements.styleBtns = document.querySelectorAll('.style-btn'); 
    DOMElements.masonryColumns = document.querySelectorAll('.masonry-column');
    DOMElements.statCards = document.querySelectorAll('.stat-card');
    DOMElements.counters = document.querySelectorAll('.counter');

    initializeEventListeners();
    initializeAnimations();
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
    restructureGalleryForMobile();
    loadDriveState();
});

// --- GOOGLE DRIVE INTEGRATION ---

// Called when Google API script is loaded
window.gapiLoaded = function() {
    gapi.load('client', () => {
        gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        }).then(() => {
            gapiInited = true;
            updateDriveStatusUI();
        });
    });
}

// Called when Google Identity Services script is loaded
window.gisLoaded = function() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: driveAuthCallback,
    });
    gisInited = true;
    updateDriveStatusUI();
}

// Callback after user authorizes with Google
function driveAuthCallback(response) {
    if (response.error) {
        console.error("Google Drive Auth Error:", response.error);
        showToast("Drive connection failed. Please try again.", true);
        return;
    }
    isDriveConnected = true;
    localStorage.setItem('driveConnected', 'true');
    updateDriveStatusUI();
    updateDriveModalContent();
    showToast("Google Drive connected successfully!");
}

// Handles the connect button click
function handleDriveAuthClick() {
    if (gapiInited && gisInited) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        showToast("Google services are still loading. Please wait a moment.", true)
        console.error("GAPI or GIS not initialized yet.");
    }
}

// Updates UI elements based on Drive connection status
function updateDriveStatusUI() {
    const { driveBtn, driveBtnText, saveToDriveBtn } = DOMElements;
    if (isDriveConnected && gapiInited) {
        driveBtn.classList.add('connected');
        driveBtnText.textContent = 'Drive Connected';
    } else {
        driveBtn.classList.remove('connected');
        driveBtnText.textContent = 'Connect Drive';
    }
    // Toggle manual save button visibility in preview modal
    if(saveToDriveBtn){
       saveToDriveBtn.classList.toggle('hidden', !(isDriveConnected && driveSaveOption === 'manual'));
    }
}

// Updates the content of the Drive modal
function updateDriveModalContent() {
    const { driveConnectedContent, driveDisconnectedContent, driveSaveAuto, driveSaveManual } = DOMElements;
    if (isDriveConnected) {
        driveConnectedContent.classList.remove('hidden');
        driveDisconnectedContent.classList.add('hidden');
        if (driveSaveOption === 'auto') {
            driveSaveAuto.checked = true;
        } else {
            driveSaveManual.checked = true;
        }
    } else {
        driveConnectedContent.classList.add('hidden');
        driveDisconnectedContent.classList.remove('hidden');
    }
}

// Load saved state from localStorage
function loadDriveState() {
    isDriveConnected = localStorage.getItem('driveConnected') === 'true';
    driveSaveOption = localStorage.getItem('driveSaveOption') || 'manual';
    // The UI update will be called once the GAPI/GIS scripts are loaded and ready.
}

// Convert Base64 to Blob for uploading
function base64ToBlob(base64, contentType = 'image/png') {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, {type: contentType});
}

// Uploads a file to the user's Google Drive
async function uploadFileToDrive(base64Data, fileName) {
    if (!isDriveConnected || !gapiInited) {
        showToast("Google Drive is not connected.", true);
        return;
    }
    
    showToast("Saving to Google Drive...");

    try {
        const blob = base64ToBlob(base64Data.split(',')[1]);
        const metadata = {
            name: fileName,
            mimeType: 'image/png',
            parents: ['root'] // Saves to the root Drive folder
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const response = await gapi.client.request({
            path: '/upload/drive/v3/files',
            method: 'POST',
            params: { uploadType: 'multipart' },
            headers: { 'Content-Type': 'multipart/related; boundary=' + form._boundary },
            body: form
        });

        if (response.status === 200) {
            showToast("Image saved to Google Drive!");
        } else {
            throw new Error('Upload failed with status: ' + response.status);
        }
    } catch (error) {
        console.error("Error uploading to Drive:", error);
        showToast("Failed to save to Drive.", true);
        // This can happen if the token expired. We should guide the user.
        if (error.result && error.result.error.status === "UNAUTHENTICATED") {
           isDriveConnected = false;
           localStorage.removeItem('driveConnected');
           updateDriveStatusUI();
           DOMElements.driveModalSubtitle.textContent = "Your session expired. Please connect again.";
           toggleModal(DOMElements.driveModal, true);
        }
    }
}

// --- END OF GOOGLE DRIVE INTEGRATION ---


function restructureGalleryForMobile() {
    if (window.innerWidth >= 768) return;
    const firstColumn = DOMElements.masonryColumns[0];
    if (!firstColumn) return;
    for (let i = 1; i < DOMElements.masonryColumns.length; i++) {
        const column = DOMElements.masonryColumns[i];
        while (column.firstChild) {
            firstColumn.appendChild(column.firstChild);
        }
    }
}

function initializeEventListeners() {
    // --- Authentication & Modal Listeners ---
    DOMElements.googleSigninBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtns.forEach(btn => btn.addEventListener('click', closeAllModals));
    DOMElements.modalBackdrops.forEach(backdrop => {
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) closeAllModals();
        });
    });

    // --- Core UI Listeners ---
    DOMElements.generateBtn?.addEventListener('click', () => handleImageGenerationRequest());
    DOMElements.promptInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleImageGenerationRequest();
        }
    });
    DOMElements.promptInput?.addEventListener('input', autoResizeTextarea);
    
    // --- Image Upload Listeners ---
    DOMElements.imageUploadBtn?.addEventListener('click', () => DOMElements.imageUploadInput.click());
    DOMElements.imageUploadInput?.addEventListener('change', handleImageUpload);
    DOMElements.removeImageBtn?.addEventListener('click', removeUploadedImage);

    // --- Popover Listeners (Ratio & Mobile Style) ---
    DOMElements.ratioBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!DOMElements.ratioBtn.disabled) DOMElements.ratioOptions?.classList.toggle('hidden');
    });
    DOMElements.mobileStyleToggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation(); 
        DOMElements.mobileStyleOptions?.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        DOMElements.ratioOptions?.classList.add('hidden');
        DOMElements.mobileStyleOptions?.classList.add('hidden');
    });

    DOMElements.ratioOptionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentAspectRatio = e.currentTarget.dataset.ratio;
            DOMElements.ratioOptionBtns.forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
        });
    });

    DOMElements.styleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentStyle = btn.dataset.style;
            DOMElements.styleBtns.forEach(b => {
                 b.classList.toggle('selected', b.dataset.style === currentStyle);
            });
            DOMElements.mobileStyleOptions?.classList.add('hidden');
        });
    });

    // --- Preview Modal Listeners ---
    DOMElements.closePreviewBtn?.addEventListener('click', () => toggleModal(DOMElements.previewModal, false));
    DOMElements.downloadBtn?.addEventListener('click', downloadPreviewImage);
    DOMElements.regenerateBtn?.addEventListener('click', handleRegeneration);
    DOMElements.changeInputImageBtn?.addEventListener('click', () => DOMElements.previewImageUploadInput.click());
    DOMElements.previewImageUploadInput?.addEventListener('change', handlePreviewImageChange);
    DOMElements.removeInputImageBtn?.addEventListener('click', removePreviewInputImage);
    
    // --- Mobile Menu & Header Scroll ---
    DOMElements.mobileMenuBtn?.addEventListener('click', () => {
        const isHidden = DOMElements.mobileMenu.classList.toggle('hidden');
        DOMElements.menuOpenIcon.classList.toggle('hidden', !isHidden);
        DOMElements.menuCloseIcon.classList.toggle('hidden', isHidden);
    });
    window.addEventListener('scroll', () => {
        const header = document.querySelector('header');
        header.classList.toggle('scrolled', window.scrollY > 10);
    });
    
    // --- New Drive Listeners ---
    DOMElements.driveBtn?.addEventListener('click', () => {
        updateDriveModalContent();
        toggleModal(DOMElements.driveModal, true);
    });
    DOMElements.connectDriveBtn?.addEventListener('click', handleDriveAuthClick);
    DOMElements.driveSaveAuto?.addEventListener('change', () => {
        driveSaveOption = 'auto';
        localStorage.setItem('driveSaveOption', 'auto');
        updateDriveStatusUI();
    });
    DOMElements.driveSaveManual?.addEventListener('change', () => {
        driveSaveOption = 'manual';
        localStorage.setItem('driveSaveOption', 'manual');
        updateDriveStatusUI();
    });
    DOMElements.saveToDriveBtn?.addEventListener('click', () => {
        const promptText = DOMElements.previewPromptInput.value || 'Untitled';
        const fileName = `GenArt - ${promptText.substring(0, 40)}.png`;
        uploadFileToDrive(DOMElements.previewImage.src, fileName);
    });
}

function initializeAnimations() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    
    gsap.registerPlugin(ScrollTrigger, TextPlugin);
    gsap.fromTo(DOMElements.heroHeadline, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.2 });
    gsap.fromTo(DOMElements.heroSubline, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.4 });
    const words = ["creators.", "agencies.", "enterprises."];
    let masterTl = gsap.timeline({ repeat: -1 });
    words.forEach(word => {
        let tl = gsap.timeline({ repeat: 1, yoyo: true, repeatDelay: 1.5 });
        tl.to("#typewriter", { text: word, duration: 1, ease: "none" });
        masterTl.add(tl);
    });
    if (DOMElements.statCards.length > 0) gsap.fromTo(DOMElements.statCards, { opacity: 0, y: 30, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 1, stagger: 0.15, ease: 'power3.out', scrollTrigger: { trigger: "#stats-section", start: "top 85%" } });
    if (DOMElements.counters.length > 0) DOMElements.counters.forEach(counter => { const target = +counter.dataset.target; const proxy = { val: 0 }; gsap.to(proxy, { val: target, duration: 2.5, ease: "power2.out", scrollTrigger: { trigger: counter, start: "top 90%" }, onUpdate: () => counter.textContent = Math.ceil(proxy.val) }); });
    const testimonialSection = document.getElementById('testimonial-section');
    if(testimonialSection) gsap.from(testimonialSection.querySelectorAll(".testimonial-image, .testimonial-card"), { opacity: 0, y: 50, duration: 1, stagger: 0.2, ease: 'power3.out', scrollTrigger: { trigger: testimonialSection, start: "top 80%" } });
}


// --- Core App Logic ---
function updateUIForAuthState(user) {
    currentUser = user;
    const nav = DOMElements.headerNav;
    const mobileNav = DOMElements.mobileMenu;
    
    // The Drive button is persistent, we just re-insert it if innerHTML is cleared.
    const driveButtonHTML = DOMElements.driveBtn.outerHTML;

    if (user) {
        nav.innerHTML = driveButtonHTML + `<a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-full px-3 py-1.5 transition-colors">Pricing</a><div id="credits-counter" class="text-sm font-medium text-gray-700 px-3 py-1.5">Credits: ...</div><button id="sign-out-btn-desktop" class="text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-full px-3 py-1.5 transition-colors">Sign Out</button>`;
        mobileNav.innerHTML = `<a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Pricing</a><div id="credits-counter-mobile" class="text-center text-lg font-semibold text-gray-700 p-3 my-2 border-y">Credits: ...</div><button id="sign-out-btn-mobile" class="w-full text-left text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Sign Out</button>`;
        document.getElementById('sign-out-btn-desktop').addEventListener('click', () => signOut(auth));
        document.getElementById('sign-out-btn-mobile').addEventListener('click', () => signOut(auth));
        fetchUserCredits(user);
    } else {
        nav.innerHTML = driveButtonHTML + `<a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-full px-3 py-1.5 transition-colors">Pricing</a><button id="sign-in-btn-desktop" class="text-sm font-medium text-white px-4 py-1.5 rounded-full transition-colors bg-[#517CBE] hover:bg-opacity-90">Sign In</button>`;
        mobileNav.innerHTML = `<a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Pricing</a><div class="p-4 mt-4"><button id="sign-in-btn-mobile" class="w-full text-lg font-semibold bg-[#517CBE] text-white px-4 py-3 rounded-xl hover:bg-opacity-90 transition-colors">Sign In</button></div>`;
        document.getElementById('sign-in-btn-desktop').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
        document.getElementById('sign-in-btn-mobile').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
    }
    // Re-cache the drive button and re-attach its listener since we rewrote innerHTML
    DOMElements.driveBtn = document.getElementById('drive-btn');
    DOMElements.driveBtnText = document.getElementById('drive-btn-text');
    DOMElements.driveBtn?.addEventListener('click', () => {
        updateDriveModalContent();
        toggleModal(DOMElements.driveModal, true);
    });
    updateDriveStatusUI();
}

async function fetchUserCredits(user) {
    try {
        const token = await user.getIdToken(true);
        const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Failed to fetch credits');
        const data = await response.json();
        currentUserCredits = data.credits;
        updateCreditsDisplay(currentUserCredits);
    } catch (error) {
        console.error("Error fetching credits:", error);
        updateCreditsDisplay('Error');
    }
}

function updateCreditsDisplay(amount) {
    const creditsCounter = document.getElementById('credits-counter');
    const creditsCounterMobile = document.getElementById('credits-counter-mobile');
    if (creditsCounter) creditsCounter.textContent = `Credits: ${amount}`;
    if (creditsCounterMobile) creditsCounterMobile.textContent = `Credits: ${amount}`;
}

function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    DOMElements.promptBarContainer.classList.toggle('expanded', textarea.scrollHeight > 50);
}

function toggleModal(modal, show) {
    if (!modal) return;
    if (show) {
        modal.style.display = 'flex';
        setTimeout(() => modal.setAttribute('aria-hidden', 'false'), 10);
    } else {
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

function closeAllModals() {
    document.querySelectorAll('[role="dialog"]').forEach(modal => toggleModal(modal, false));
}

async function signInWithGoogle() {
    try {
        await signInWithPopup(auth, provider);
        closeAllModals();
    } catch (error) {
        console.error("Google Sign-In Error:", error);
    }
}

// --- Image Generation ---
async function handleImageGenerationRequest(promptOverride = null, fromRegenerate = false) {
    if (isGenerating) return;
    if (!currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }
    if (currentUserCredits <= 0) {
        toggleModal(DOMElements.outOfCreditsModal, true);
        return;
    }

    const imageDataSource = fromRegenerate ? currentPreviewInputData : uploadedImageData;
    const userPrompt = (fromRegenerate ? promptOverride : DOMElements.promptInput.value)?.trim();

    if (!userPrompt && !imageDataSource) {
        DOMElements.promptBarContainer.classList.add('animate-shake');
        setTimeout(() => DOMElements.promptBarContainer.classList.remove('animate-shake'), 500);
        return;
    }
    
    const finalPrompt = currentStyle ? `${userPrompt}, ${currentStyle} style` : userPrompt;

    setLoadingState(true);
    startTimer();
    
    const aspectRatioToSend = imageDataSource ? null : currentAspectRatio;
    const generationInputData = imageDataSource ? {...imageDataSource} : null;

    try {
        const token = await currentUser.getIdToken();
        const deductResponse = await fetch('/api/credits', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        if (!deductResponse.ok) throw new Error('Credit deduction failed.');
        
        const creditData = await deductResponse.json();
        currentUserCredits = creditData.newCredits;
        updateCreditsDisplay(currentUserCredits);

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ prompt: finalPrompt, imageData: generationInputData, aspectRatio: aspectRatioToSend })
        });
        if (!response.ok) throw new Error(`API error: ${await response.text()}`);
        
        const result = await response.json();
        const base64Data = generationInputData
            ? result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data 
            : result.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Data) throw new Error("No image data in API response");
        
        const fullBase64Image = `data:image/png;base64,${base64Data}`;
        showPreviewModal(fullBase64Image, userPrompt, generationInputData);

        if (isDriveConnected && driveSaveOption === 'auto') {
            const fileName = `GenArt - ${userPrompt.substring(0, 40) || 'Untitled'}.png`;
            await uploadFileToDrive(fullBase64Image, fileName);
        }

    } catch (error) {
        console.error("Generation Error:", error);
    } finally {
        setLoadingState(false);
        if(!fromRegenerate) {
            DOMElements.promptInput.value = '';
            autoResizeTextarea({target: DOMElements.promptInput});
            removeUploadedImage();
        }
    }
}

async function handleRegeneration() {
    const newPrompt = DOMElements.previewPromptInput.value;
    if (!newPrompt && !currentPreviewInputData) return;
    toggleModal(DOMElements.previewModal, false);
    await handleImageGenerationRequest(newPrompt, true);
}

function setLoadingState(isLoading) {
    isGenerating = isLoading;
    DOMElements.generateBtn.disabled = isLoading;
    DOMElements.buttonContent.classList.toggle('hidden', isLoading);
    DOMElements.buttonTimer.classList.toggle('hidden', !isLoading);
    if (!isLoading) clearInterval(timerInterval);
}

function startTimer() {
    let endTime = Date.now() + 17000;
    DOMElements.buttonTimer.textContent = '17.00';
    timerInterval = setInterval(() => {
        const remaining = endTime - Date.now();
        if (remaining <= 0) {
            clearInterval(timerInterval);
            DOMElements.buttonTimer.textContent = '0.00';
            return;
        }
        DOMElements.buttonTimer.textContent = (remaining / 1000).toFixed(2);
    }, 50);
}

// --- Image Handling & Uploads ---
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        uploadedImageData = { mimeType: file.type, data: base64String };
        DOMElements.imagePreview.src = reader.result;
        DOMElements.imagePreviewContainer.classList.remove('hidden');
        DOMElements.ratioBtn.disabled = true;
        DOMElements.ratioBtn.classList.add('opacity-50', 'cursor-not-allowed');
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageData = null;
    DOMElements.imageUploadInput.value = '';
    DOMElements.imagePreview.src = '';
    DOMElements.imagePreviewContainer.classList.add('hidden');
    DOMElements.ratioBtn.disabled = false;
    DOMElements.ratioBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

// --- Preview Modal ---
function showPreviewModal(imageUrl, prompt, inputImageData) {
    DOMElements.previewImage.src = imageUrl;
    DOMElements.previewPromptInput.value = prompt;
    currentPreviewInputData = inputImageData;
    DOMElements.previewInputImageContainer.classList.toggle('hidden', !inputImageData);
    if (inputImageData) {
        DOMElements.previewInputImage.src = `data:${inputImageData.mimeType};base64,${inputImageData.data}`;
    }
    // Update save button visibility when the modal is shown
    updateDriveStatusUI();
    toggleModal(DOMElements.previewModal, true);
}

function handlePreviewImageChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        currentPreviewInputData = { mimeType: file.type, data: base64String };
        DOMElements.previewInputImage.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function removePreviewInputImage() {
    currentPreviewInputData = null;
    DOMElements.previewImageUploadInput.value = '';
    DOMElements.previewInputImage.src = '';
    DOMElements.previewInputImageContainer.classList.add('hidden');
}

function downloadPreviewImage() {
    fetch(DOMElements.previewImage.src)
        .then(res => res.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'genart-image.png';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(() => console.error('An error occurred while downloading the image.'));
}

// --- Utility Functions ---
function showToast(message, isError = false) {
    const toast = DOMElements.toastNotification;
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#dc2626' : '#374151'; // red-600 or gray-800
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

