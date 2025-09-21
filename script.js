// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
let uploadedImageData = null;
let isFetchingMore = false;
let timerInterval;

// The full list of gallery images.
const ALL_IMAGE_URLS = [
    "https://iili.io/K7bN7Hl.md.png", "https://iili.io/K7bOTzP.md.png", "https://iili.io/K7yYoqN.md.png",
    "https://iili.io/K7bk3Ku.md.png", "https://iili.io/K7b6OPV.md.png", "https://iili.io/K7be88v.md.png",
    "https://iili.io/K7b894e.md.png", "https://iili.io/K7y1cUN.md.png", "https://iili.io/K7yEx14.md.png",
    "https://iili.io/K7b4VQR.md.png", "https://iili.io/K7yGhS2.md.png", "https://iili.io/K7bs5wg.md.png",
    "https://iili.io/K7bDzpS.md.png", "https://iili.io/K7yVVv2.md.png", "https://iili.io/K7bmj7R.md.png",
    "https://iili.io/K7bP679.md.png"
];

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'header-nav', 'auth-modal', 'google-signin-btn', 'out-of-credits-modal',
        'prompt-input', 'generate-btn', 'generate-icon', 'loading-spinner',
        'image-upload-btn', 'image-upload-input', 'remove-image-btn',
        'image-preview-container', 'image-preview', 'masonry-gallery', 'gallery-container', 'loader',
        'ratio-btn', 'ratio-options', 'header-blur-overlay',
        'loading-overlay', 'timer-text', 'preview-modal', 'preview-image', 
        'download-btn', 'close-preview-btn', 'preview-prompt-text', 'use-prompt-btn'
    ];
    ids.forEach(id => DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id));
    
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');

    initializeEventListeners();
    initializeImageLoading();
    onAuthStateChanged(auth, user => {
        currentUser = user;
        updateUIForAuthState(user);
    });
});

function initializeEventListeners() {
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtns.forEach(btn => btn.addEventListener('click', closeAllModals));
    DOMElements.generateBtn?.addEventListener('click', handleImageGenerationRequest);
    
    DOMElements.promptInput?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleImageGenerationRequest();
        }
    });
    
    DOMElements.imageUploadBtn?.addEventListener('click', () => DOMElements.imageUploadInput.click());
    DOMElements.imageUploadInput?.addEventListener('change', handleImageUpload);
    DOMElements.removeImageBtn?.addEventListener('click', removeUploadedImage);

    // Dropdowns and Scroll listeners
    setupUIInteractions();
}

function setupUIInteractions() {
    DOMElements.ratioBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        DOMElements.ratioOptions.classList.toggle('hidden');
    });
    document.addEventListener('click', () => DOMElements.ratioOptions?.classList.add('hidden'));
    
    document.querySelectorAll('.ratio-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentAspectRatio = e.currentTarget.dataset.ratio;
            document.querySelectorAll('.ratio-option').forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
        });
    });

    DOMElements.galleryContainer.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = DOMElements.galleryContainer;
        
        if (scrollTop > 20) DOMElements.headerBlurOverlay.classList.add('opacity-100');
        else DOMElements.headerBlurOverlay.classList.remove('opacity-100');

        if (scrollTop + clientHeight >= scrollHeight - 300 && !isFetchingMore) {
            fetchMoreImages();
        }
    });
}

function initializeImageLoading() {
    document.querySelectorAll('.masonry-item img').forEach(img => {
        if (img.complete) img.classList.add('loaded');
        else img.addEventListener('load', () => img.classList.add('loaded'));
    });
}

// --- Auth & User State ---
function updateUIForAuthState(user) {
    const nav = DOMElements.headerNav;
    if (!nav) return;
    if (user) {
        nav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Pricing</a>
            <div id="generation-counter" class="text-sm font-medium text-gray-700">Loading...</div>
            <button id="auth-action-btn" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Sign Out</button>
        `;
        nav.querySelector('#auth-action-btn').addEventListener('click', () => signOut(auth));
        fetchUserCredits(user);
    } else {
        nav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Pricing</a>
            <button id="auth-action-btn" class="text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700 transition-all">Sign In</button>
        `;
        nav.querySelector('#auth-action-btn').addEventListener('click', signInWithGoogle);
    }
}

async function fetchUserCredits(user) {
    try {
        const token = await user.getIdToken();
        const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Failed to fetch credits');
        const data = await response.json();
        currentUserCredits = data.credits;
        const counter = document.getElementById('generation-counter');
        if (counter) counter.textContent = `Credits: ${currentUserCredits}`;
    } catch (error) {
        console.error("Error fetching credits:", error);
        const counter = document.getElementById('generation-counter');
        if (counter) counter.textContent = "Credits: Error";
    }
}

// --- Gallery Management ---
function addImageToGallery(imageUrl, isNew = false) {
    const columns = Array.from(document.querySelectorAll('.masonry-column'));
    if (!columns.length) return;

    const shortestColumn = columns.reduce((shortest, column) => 
        column.offsetHeight < shortest.offsetHeight ? column : shortest
    , columns[0]);

    const item = document.createElement('div');
    item.className = 'masonry-item';
    const img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'rounded-lg w-full h-auto block';
    img.alt = 'Generated Art';

    if (img.complete) img.classList.add('loaded');
    else img.addEventListener('load', () => img.classList.add('loaded'));
    
    item.appendChild(img);

    if (isNew) {
        shortestColumn.insertBefore(item, shortestColumn.firstChild);
    } else {
        shortestColumn.appendChild(item);
    }
}

function fetchMoreImages() {
    DOMElements.loader.style.display = 'none';
}


// --- Generation Flow ---
async function handleImageGenerationRequest() {
    if (isGenerating) return;
    if (!currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }
    if (currentUserCredits <= 0) {
        toggleModal(DOMElements.outOfCreditsModal, true);
        return;
    }
    const prompt = DOMElements.promptInput.value.trim();
    if (!prompt && !uploadedImageData) {
        DOMElements.promptInput.classList.add('placeholder-red-400');
        setTimeout(() => DOMElements.promptInput.classList.remove('placeholder-red-400'), 1000);
        return;
    }
    generateImage(prompt);
}

async function generateImage(prompt) {
    setLoadingState(true);
    startGenerationTimer();
    try {
        const token = await currentUser.getIdToken();
        
        await fetch('/api/credits', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }});
        
        const body = { prompt, aspectRatio: currentAspectRatio, ...(uploadedImageData && { imageData: uploadedImageData }) };

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error((await response.json()).error || 'API generation failed');
        
        const result = await response.json();
        const base64Data = uploadedImageData 
            ? result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data 
            : result.predictions?.[0]?.bytesBase64Encoded;

        if (!base64Data) throw new Error("No image data in API response");
        
        const imageUrl = `data:image/png;base64,${base64Data}`;
        
        clearInterval(timerInterval);
        DOMElements.loadingOverlay.classList.add('hidden');
        showPreviewModal(imageUrl, prompt);

        await fetchUserCredits(currentUser);
        resetPromptBar();

    } catch (error) {
        console.error("Generation Error:", error);
        clearInterval(timerInterval);
        DOMElements.loadingOverlay.classList.add('hidden');
    } finally {
        setLoadingState(false);
    }
}

// --- Image Upload ---
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        uploadedImageData = { mimeType: file.type, data: reader.result.split(',')[1] };
        DOMElements.imagePreview.src = reader.result;
        DOMElements.imagePreviewContainer.classList.remove('hidden');
        DOMElements.imageUploadBtn.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageData = null;
    DOMElements.imageUploadInput.value = '';
    DOMElements.imagePreviewContainer.classList.add('hidden');
    DOMElements.imageUploadBtn.classList.remove('hidden');
}


// --- UI Helpers (Modals, Timers, etc.) ---
function startGenerationTimer() {
    let countdown = 17;
    DOMElements.timerText.textContent = `${countdown}s`;
    DOMElements.loadingOverlay.classList.remove('hidden');

    timerInterval = setInterval(() => {
        countdown--;
        if (countdown >= 0) {
            DOMElements.timerText.textContent = `${countdown}s`;
        } else {
            DOMElements.timerText.textContent = '0s';
            clearInterval(timerInterval);
        }
    }, 1000);
}

function showPreviewModal(imageUrl, prompt) {
    DOMElements.previewImage.src = imageUrl;
    DOMElements.previewPromptText.textContent = prompt;
    DOMElements.previewModal.classList.remove('hidden');

    DOMElements.downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = `genart-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    
    DOMElements.usePromptBtn.onclick = () => {
        DOMElements.promptInput.value = prompt;
        DOMElements.previewModal.classList.add('hidden');
        DOMElements.promptInput.focus();
    };

    DOMElements.closePreviewBtn.onclick = () => {
        DOMElements.previewModal.classList.add('hidden');
        addImageToGallery(imageUrl, true);
    };
}


function setLoadingState(isLoading) {
    isGenerating = isLoading;
    DOMElements.generateBtn.disabled = isLoading;
    DOMElements.generateIcon.classList.toggle('hidden', isLoading);
    DOMElements.loadingSpinner.classList.toggle('hidden', !isLoading);
}

function resetPromptBar() {
    DOMElements.promptInput.value = '';
    removeUploadedImage();
}

function toggleModal(modal, show) {
    if (!modal) return;
    modal.style.display = show ? 'flex' : 'none';
    modal.setAttribute('aria-hidden', String(!show));
}

function closeAllModals() {
    document.querySelectorAll('[role="dialog"]').forEach(modal => toggleModal(modal, false));
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
      .then(() => closeAllModals())
      .catch(console.error);
}

