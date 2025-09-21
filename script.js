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
let timerInterval;
let isFetchingMore = false;
let imagePage = 0;
let nextColumnIndex = 0; // NEW: To track which column to add the next image to.

// All available images for infinite scroll
const ALL_IMAGE_URLS = [
    "https://iili.io/K7bN7Hl.md.png", "https://iili.io/K7bOTzP.md.png", "https://iili.io/K7yYoqN.md.png",
    "https://iili.io/K7bk3Ku.md.png", "https://iili.io/K7b6OPV.md.png", "https://iili.io/K7be88v.md.png",
    "https://iili.io/K7b894e.md.png", "https://iili.io/K7y1cUN.md.png", "https://iili.io/K7yEx14.md.png",
    "https://iili.io/K7b4VQR.md.png", "https://iili.io/K7yGhS2.md.png", "https://iili.io/K7bs5wg.md.png",
    "https://iili.io/K7bDzpS.md.png", "https://iili.io/K7yVVv2.md.png", "https://iili.io/K7bmj7R.md.png",
    "https://iili.io/K7bP679.md.png",
    "https://images.unsplash.com/photo-1678043639454-a25c4a31b1d1?q=80&w=800",
    "https://images.unsplash.com/photo-1678776210282-b1187d6e53c4?q=80&w=800",
    "https://images.unsplash.com/photo-1677332213134-b0ae1071a5c4?q=80&w=800",
    "https://images.unsplash.com/photo-1678043639454-a25c4a31b1d1?q=80&w=800"
];


// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'header-nav', 'gallery-container', 'masonry-gallery', 'loader', 'prompt-input',
        'generate-btn', 'generate-icon', 'loading-spinner', 'ratio-btn', 'ratio-options',
        'auth-modal', 'google-signin-btn', 'out-of-credits-modal', 'loading-overlay',
        'timer-text', 'preview-modal', 'preview-image', 'preview-prompt-input',
        'download-btn', 'close-preview-btn', 'regenerate-btn', 'header-blur-overlay',
        'image-upload-btn', 'image-upload-input', 'image-preview-container', 'image-preview', 'remove-image-btn'
    ];
    ids.forEach(id => DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id));
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');
    DOMElements.ratioOptionBtns = document.querySelectorAll('.ratio-option');
    DOMElements.masonryColumns = document.querySelectorAll('.masonry-column');

    initializeEventListeners();
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
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

    DOMElements.promptInput?.addEventListener('input', autoResizeTextarea);
    
    DOMElements.imageUploadBtn?.addEventListener('click', () => DOMElements.imageUploadInput.click());
    DOMElements.imageUploadInput?.addEventListener('change', handleImageUpload);
    DOMElements.removeImageBtn?.addEventListener('click', removeUploadedImage);

    DOMElements.ratioBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        DOMElements.ratioOptions.classList.toggle('hidden');
    });
    document.addEventListener('click', () => DOMElements.ratioOptions.classList.add('hidden'));
    DOMElements.ratioOptionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentAspectRatio = e.currentTarget.dataset.ratio;
            DOMElements.ratioOptionBtns.forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
        });
    });

    DOMElements.galleryContainer?.addEventListener('scroll', () => {
        const overlay = DOMElements.headerBlurOverlay;
        if (DOMElements.galleryContainer.scrollTop > 50) {
            overlay.classList.remove('opacity-0');
        } else {
            overlay.classList.add('opacity-0');
        }
    });

    DOMElements.closePreviewBtn?.addEventListener('click', () => toggleModal(DOMElements.previewModal, false));
    DOMElements.downloadBtn?.addEventListener('click', downloadPreviewImage);
    DOMElements.regenerateBtn?.addEventListener('click', handleRegeneration);

    DOMElements.galleryContainer?.addEventListener('scroll', handleInfiniteScroll);
}

// --- Infinite Scroll ---
function handleInfiniteScroll() {
    const container = DOMElements.galleryContainer;
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 300 && !isFetchingMore) {
        loadMoreImages();
    }
}

function loadMoreImages() {
    isFetchingMore = true;
    DOMElements.loader.style.display = 'block';

    // The artificial 1-second delay has been removed.
    // New images will now be fetched and displayed instantly.
    const imagesPerPage = 10;
    const startIndex = (imagePage * imagesPerPage) % ALL_IMAGE_URLS.length;
    const endIndex = startIndex + imagesPerPage;
    
    let newImages = ALL_IMAGE_URLS.slice(startIndex, endIndex);

    if (endIndex > ALL_IMAGE_URLS.length) {
        const remaining = endIndex - ALL_IMAGE_URLS.length;
        newImages = newImages.concat(ALL_IMAGE_URLS.slice(0, remaining));
    }

    newImages.forEach(url => {
        addImageToMasonry(url);
    });
    
    imagePage++;
    DOMElements.loader.style.display = 'none';
    isFetchingMore = false;
}


// --- Core App Logic ---

function updateUIForAuthState(user) {
    currentUser = user;
    const nav = DOMElements.headerNav;
    if (user) {
        nav.innerHTML = `
            <div id="credits-counter" class="text-sm font-medium text-gray-700">Credits: ...</div>
            <button id="sign-out-btn" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Sign Out</button>
        `;
        document.getElementById('sign-out-btn').addEventListener('click', () => signOut(auth));
        fetchUserCredits(user);
    } else {
        nav.innerHTML = `
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Pricing</a>
            <button id="sign-in-btn" class="text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700 transition-colors">Sign In</button>
        `;
        document.getElementById('sign-in-btn').addEventListener('click', signInWithGoogle);
    }
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
    const creditsEl = document.getElementById('credits-counter');
    if (creditsEl) {
        creditsEl.textContent = `Credits: ${amount}`;
    }
}

function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
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

function signInWithGoogle() {
    signInWithPopup(auth, provider).catch(console.error);
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

    const prompt = fromRegenerate ? promptOverride : DOMElements.promptInput.value.trim();
    if (!prompt && !uploadedImageData) {
        const promptBar = DOMElements.promptInput.parentElement;
        promptBar.classList.add('animate-shake');
        setTimeout(() => promptBar.classList.remove('animate-shake'), 500);
        return;
    }

    isGenerating = true;
    setLoadingState(true);
    startTimer();

    try {
        const token = await currentUser.getIdToken();
        
        const deductResponse = await fetch('/api/credits', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!deductResponse.ok) {
            throw new Error('Credit deduction failed. Please try again.');
        }
        const creditData = await deductResponse.json();
        currentUserCredits = creditData.newCredits;
        updateCreditsDisplay(currentUserCredits);

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ prompt, imageData: uploadedImageData, aspectRatio: currentAspectRatio })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API generation failed: ${errorText}`);
        }
        
        const result = await response.json();
        const base64Data = uploadedImageData 
            ? result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data 
            : result.predictions?.[0]?.bytesBase64Encoded;
            
        if (!base64Data) throw new Error("No image data in API response");
        
        const imageUrl = `data:image/png;base64,${base64Data}`;
        
        addImageToMasonry(imageUrl, true);

        showPreviewModal(imageUrl, prompt);

    } catch (error) {
        console.error("Generation Error:", error);
        alert(`An error occurred during generation: ${error.message}`);
    } finally {
        clearInterval(timerInterval);
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
    if (!newPrompt) return;
    toggleModal(DOMElements.previewModal, false);
    await handleImageGenerationRequest(newPrompt, true);
}


function setLoadingState(isLoading) {
    isGenerating = isLoading;
    DOMElements.generateBtn.disabled = isLoading;
    DOMElements.generateIcon.classList.toggle('hidden', isLoading);
    DOMElements.loadingSpinner.classList.toggle('hidden', !isLoading);
    if (isLoading) {
        toggleModal(DOMElements.loadingOverlay, true);
    } else {
        toggleModal(DOMElements.loadingOverlay, false);
    }
}

function startTimer() {
    let seconds = 17;
    DOMElements.timerText.textContent = `${seconds}s`;
    timerInterval = setInterval(() => {
        seconds--;
        DOMElements.timerText.textContent = `${seconds}s`;
        if (seconds <= 0) {
            clearInterval(timerInterval);
        }
    }, 1000);
}

// --- Image Handling & Masonry ---
function addImageToMasonry(url, prepend = false) {
    if (!DOMElements.masonryColumns || DOMElements.masonryColumns.length === 0) return;

    const item = document.createElement('div');
    item.className = 'masonry-item';
    const img = document.createElement('img');
    img.src = url;
    img.className = 'rounded-lg w-full h-auto block';
    img.alt = 'Generated Art';
    img.style.opacity = 0;
    
    img.onload = () => {
        img.style.opacity = 1;
        item.style.animation = 'none'; 
        item.style.backgroundImage = 'none';
        item.style.backgroundColor = 'transparent';
        item.style.minHeight = 'auto';
    };
    item.appendChild(img);

    if (prepend) {
        let shortestColumn = DOMElements.masonryColumns[0];
        for (let i = 1; i < DOMElements.masonryColumns.length; i++) {
            if (DOMElements.masonryColumns[i].offsetHeight < shortestColumn.offsetHeight) {
                shortestColumn = DOMElements.masonryColumns[i];
            }
        }
        shortestColumn.insertBefore(item, shortestColumn.firstChild);
    } else {
        const columnToAddTo = DOMElements.masonryColumns[nextColumnIndex];
        columnToAddTo.appendChild(item);
        nextColumnIndex = (nextColumnIndex + 1) % DOMElements.masonryColumns.length;
    }
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        uploadedImageData = { mimeType: file.type, data: base64String };
        DOMElements.imagePreview.src = reader.result;
        DOMElements.imagePreviewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageData = null;
    DOMElements.imageUploadInput.value = '';
    DOMElements.imagePreview.src = '';
    DOMElements.imagePreviewContainer.classList.add('hidden');
}


// --- Preview Modal ---
function showPreviewModal(imageUrl, prompt) {
    DOMElements.previewImage.src = imageUrl;
    DOMElements.previewPromptInput.value = prompt;
    toggleModal(DOMElements.previewModal, true);
}

function downloadPreviewImage() {
    const imageUrl = DOMElements.previewImage.src;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = 'genart-image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

