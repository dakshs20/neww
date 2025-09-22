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
let currentPreviewInputData = null; 
let timerInterval;

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'header-nav', 'gallery-container', 'masonry-gallery', 'prompt-input',
        'generate-btn', 'generate-icon', 'loading-spinner', 'ratio-btn', 'ratio-options',
        'auth-modal', 'google-signin-btn', 'out-of-credits-modal', 'loading-overlay',
        'timer-text', 'preview-modal', 'preview-image', 'preview-prompt-input',
        'download-btn', 'close-preview-btn', 'regenerate-btn', 'header-blur-overlay',
        'image-upload-btn', 'image-upload-input', 'image-preview-container', 'image-preview', 'remove-image-btn',
        'preview-input-image-container', 'preview-input-image', 'change-input-image-btn', 'remove-input-image-btn', 'preview-image-upload-input',
        'hero-headline'
    ];
    ids.forEach(id => DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id));
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');
    DOMElements.ratioOptionBtns = document.querySelectorAll('.ratio-option');
    DOMElements.masonryColumns = document.querySelectorAll('.masonry-column');
    DOMElements.statCards = document.querySelectorAll('.stat-card');
    DOMElements.counters = document.querySelectorAll('.counter');

    initializeEventListeners();
    initializeAnimations();
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
    restructureGalleryForMobile();
});

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
    DOMElements.changeInputImageBtn?.addEventListener('click', () => DOMElements.previewImageUploadInput.click());
    DOMElements.previewImageUploadInput?.addEventListener('change', handlePreviewImageChange);
    DOMElements.removeInputImageBtn?.addEventListener('click', removePreviewInputImage);
}

// --- NEW: Animations ---
function initializeAnimations() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    // Animate Hero Headline
    gsap.to(DOMElements.heroHeadline, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        delay: 0.2
    });

    // Animate Stat Cards
    gsap.to(DOMElements.statCards, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
            trigger: "#stats-section",
            start: "top 85%",
        }
    });

    // Animate Counters
    DOMElements.counters.forEach(counter => {
        const target = +counter.dataset.target;
        gsap.to(counter, {
            textContent: target,
            duration: 2,
            ease: "power2.out",
            snap: { textContent: 1 },
            scrollTrigger: {
                trigger: counter,
                start: "top 90%",
            },
            onUpdate: function() {
                // Add K or M for thousands or millions
                const currentVal = Math.ceil(this.targets()[0].textContent);
                if (target >= 1000) {
                     counter.textContent = Math.ceil(currentVal / 100) / 10 + "K";
                } else {
                     counter.textContent = currentVal;
                }
            },
             onComplete: function() {
                if (target >= 1000000) counter.textContent = target / 1000000 + "M";
                else if (target >= 1000) counter.textContent = target / 1000 + "K";
                else counter.textContent = target;
            }
        });
    });
}


// --- Core App Logic ---
function updateUIForAuthState(user) {
    currentUser = user;
    const nav = DOMElements.headerNav;
    if (user) {
        nav.innerHTML = `
            <a href="about.html" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">About</a>
            <div id="credits-counter" class="text-sm font-medium text-gray-700">Credits: ...</div>
            <button id="sign-out-btn" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">Sign Out</button>
        `;
        document.getElementById('sign-out-btn').addEventListener('click', () => signOut(auth));
        fetchUserCredits(user);
    } else {
        nav.innerHTML = `
            <a href="about.html" class="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">About</a>
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

    const imageDataSource = fromRegenerate ? currentPreviewInputData : uploadedImageData;
    const prompt = fromRegenerate ? promptOverride : DOMElements.promptInput.value.trim();

    if (!prompt && !imageDataSource) {
        const promptBar = DOMElements.promptInput.parentElement;
        promptBar.classList.add('animate-shake');
        setTimeout(() => promptBar.classList.remove('animate-shake'), 500);
        return;
    }

    isGenerating = true;
    setLoadingState(true);
    startTimer();
    
    const generationInputData = imageDataSource ? {...imageDataSource} : null;

    try {
        const token = await currentUser.getIdToken();
        
        const deductResponse = await fetch('/api/credits', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!deductResponse.ok) throw new Error('Credit deduction failed. Please try again.');
        
        const creditData = await deductResponse.json();
        currentUserCredits = creditData.newCredits;
        updateCreditsDisplay(currentUserCredits);

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ prompt, imageData: generationInputData, aspectRatio: currentAspectRatio })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API generation failed: ${errorText}`);
        }
        
        const result = await response.json();
        const base64Data = generationInputData
            ? result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data 
            : result.predictions?.[0]?.bytesBase64Encoded;
            
        if (!base64Data) throw new Error("No image data in API response");
        
        const imageUrl = `data:image/png;base64,${base64Data}`;
        
        showPreviewModal(imageUrl, prompt, generationInputData);

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
    if (!newPrompt && !currentPreviewInputData) return;
    
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
        if (seconds <= 0) clearInterval(timerInterval);
    }, 1000);
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
function showPreviewModal(imageUrl, prompt, inputImageData) {
    DOMElements.previewImage.src = imageUrl;
    DOMElements.previewPromptInput.value = prompt;
    currentPreviewInputData = inputImageData;

    if (inputImageData) {
        const dataUrl = `data:${inputImageData.mimeType};base64,${inputImageData.data}`;
        DOMElements.previewInputImage.src = dataUrl;
        DOMElements.previewInputImageContainer.classList.remove('hidden');
    } else {
        DOMElements.previewInputImageContainer.classList.add('hidden');
    }
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

// NEW: Helper function to convert data URL to Blob for robust downloading
function dataURLtoBlob(dataurl) {
    let arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[arr.length - 1]),
        n = bstr.length,
        u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

// UPDATED: downloadPreviewImage function for cross-browser compatibility
function downloadPreviewImage() {
    const dataUrl = DOMElements.previewImage.src;
    const blob = dataURLtoBlob(dataUrl);
    const objectUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = 'genart-image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up the object URL to free memory
    URL.revokeObjectURL(objectUrl);
}

