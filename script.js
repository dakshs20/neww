// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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

// --- Set Auth Persistence ---
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Firebase persistence error:", error.code, error.message);
  });


// --- Global State ---
let currentUser;
let currentUserData = { credits: 0, plan: 'free' };
let isGenerating = false;
let currentAspectRatio = '1:1';
let uploadedImageData = null;
let timerInterval;

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'header-nav', 'gallery-container', 'masonry-gallery', 'prompt-input',
        'generate-btn', 'generate-icon', 'loading-spinner', 'ratio-btn', 'ratio-options',
        'auth-modal', 'google-signin-btn', 'out-of-credits-modal', 'insufficient-credits-message',
        'preview-modal', 'preview-image', 'preview-prompt-input',
        'download-btn', 'close-preview-btn', 'regenerate-btn',
        'image-upload-btn', 'image-upload-input', 'image-preview-container', 'image-preview', 'remove-image-btn',
        'hero-section', 'hero-headline', 'hero-subline', 'typewriter', 'prompt-bar-container',
        'mobile-menu', 'mobile-menu-btn', 'menu-open-icon', 'menu-close-icon',
        'button-timer', 'button-content'
    ];
    ids.forEach(id => {
        DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id);
    });
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');

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
        if (!DOMElements.ratioBtn.disabled) {
            DOMElements.ratioOptions.classList.toggle('hidden');
        }
    });
    document.addEventListener('click', () => DOMElements.ratioOptions?.classList.add('hidden'));
    document.querySelectorAll('.ratio-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentAspectRatio = e.currentTarget.dataset.ratio;
            document.querySelectorAll('.ratio-option').forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
        });
    });
    DOMElements.closePreviewBtn?.addEventListener('click', () => toggleModal(DOMElements.previewModal, false));
    DOMElements.downloadBtn?.addEventListener('click', downloadPreviewImage);
    DOMElements.regenerateBtn?.addEventListener('click', handleRegeneration);
    DOMElements.mobileMenuBtn?.addEventListener('click', () => {
        const isHidden = DOMElements.mobileMenu.classList.toggle('hidden');
        DOMElements.menuOpenIcon.classList.toggle('hidden', !isHidden);
        DOMElements.menuCloseIcon.classList.toggle('hidden', isHidden);
    });
    window.addEventListener('scroll', () => {
        const header = document.querySelector('header');
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });
}


// --- Core App Logic ---
function updateUIForAuthState(user) {
    currentUser = user;
    if (user) {
        fetchUserData(user);
    } else {
        renderLoggedOutNav();
    }
}

async function fetchUserData(user) {
    try {
        const token = await user.getIdToken(true);
        const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Failed to fetch user data');
        currentUserData = await response.json();
        renderLoggedInNav();
    } catch (error) {
        console.error("Error fetching user data:", error);
        renderLoggedOutNav();
    }
}

function renderLoggedInNav() {
    const { plan, credits } = currentUserData;
    const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
    const nav = DOMElements.headerNav;
    const mobileNav = DOMElements.mobileMenu;

    nav.innerHTML = `
        <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-slate-100 rounded-full px-3 py-1 transition-colors">Pricing</a>
        <span class="plan-badge ${plan}">${planName}</span>
        <div id="credits-counter" class="text-sm font-medium text-gray-700 px-3 py-1">Credits: ${credits}</div>
        <button id="sign-out-btn-desktop" class="text-sm font-medium border border-gray-300 text-gray-700 px-4 py-1.5 rounded-full hover:bg-gray-100 transition-colors">Sign Out</button>
    `;
    mobileNav.innerHTML = `
        <a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Pricing</a>
        <div class="p-4 text-center">
             <span class="plan-badge ${plan}">${planName}</span>
             <div id="credits-counter-mobile" class="text-lg font-semibold my-3">Credits: ${credits}</div>
             <button id="sign-out-btn-mobile" class="w-full text-left text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Sign Out</button>
        </div>
    `;
    document.getElementById('sign-out-btn-desktop').addEventListener('click', () => signOut(auth));
    document.getElementById('sign-out-btn-mobile').addEventListener('click', () => signOut(auth));
}

function renderLoggedOutNav() {
    DOMElements.headerNav.innerHTML = `
        <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-slate-100 rounded-full px-3 py-1 transition-colors">Pricing</a>
        <button id="sign-in-btn-desktop" class="text-sm font-medium bg-slate-800 text-white px-4 py-1.5 rounded-full hover:bg-slate-900 transition-colors">Sign In</button>
    `;
    DOMElements.mobileMenu.innerHTML = `
       <a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Pricing</a>
       <div class="p-4 mt-4">
            <button id="sign-in-btn-mobile" class="w-full text-lg font-semibold bg-slate-800 text-white px-4 py-3 rounded-xl hover:bg-opacity-90 transition-colors">Sign In</button>
       </div>
    `;
    document.getElementById('sign-in-btn-desktop').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
    document.getElementById('sign-in-btn-mobile').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
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
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(console.error);
}

// --- Image Generation ---
async function handleImageGenerationRequest() {
    if (isGenerating) return;
    if (!currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }
    
    if (currentUserData.credits <= 0) {
        DOMElements.insufficientCreditsMessage.textContent = `You have ${currentUserData.credits} credits left. Upgrade now to continue without interruption.`;
        toggleModal(DOMElements.outOfCreditsModal, true);
        return;
    }

    const prompt = DOMElements.promptInput.value.trim();
    if (!prompt && !uploadedImageData) {
        DOMElements.promptBarContainer.classList.add('animate-shake');
        setTimeout(() => DOMElements.promptBarContainer.classList.remove('animate-shake'), 500);
        return;
    }

    isGenerating = true;
    setLoadingState(true, currentUserData.plan === 'free');
    
    try {
        const token = await currentUser.getIdToken();
        
        const deductResponse = await fetch('/api/credits', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!deductResponse.ok) throw new Error('Credit deduction failed. Please try again.');
        
        const creditData = await deductResponse.json();
        currentUserData.credits = creditData.newCredits;
        renderLoggedInNav(); 

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ prompt, imageData: uploadedImageData, aspectRatio: uploadedImageData ? null : currentAspectRatio })
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
        
        showPreviewModal(`data:image/png;base64,${base64Data}`, prompt);

    } catch (error) {
        console.error("Generation Error:", error);
        alert(`An error occurred during generation: ${error.message}`);
    } finally {
        clearInterval(timerInterval);
        setLoadingState(false);
        DOMElements.promptInput.value = '';
        autoResizeTextarea({target: DOMElements.promptInput});
        removeUploadedImage();
    }
}

async function handleRegeneration() {
    closeAllModals();
    handleImageGenerationRequest(); 
}

function setLoadingState(isLoading, isFree = false) {
    isGenerating = isLoading;
    DOMElements.generateBtn.disabled = isLoading;
    DOMElements.buttonContent.classList.toggle('hidden', isLoading);
    DOMElements.buttonTimer.classList.toggle('hidden', !isLoading);
    if(isLoading) {
        startTimer(isFree ? 30000 : 17000);
    }
}

function startTimer(duration) {
    let endTime = Date.now() + duration;
    DOMElements.buttonTimer.textContent = (duration / 1000).toFixed(2);
    
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

function showPreviewModal(imageUrl, prompt) {
    DOMElements.previewImage.src = imageUrl;
    DOMElements.previewPromptInput.value = prompt;
    toggleModal(DOMElements.previewModal, true);
}


function downloadPreviewImage() {
    const imageUrl = DOMElements.previewImage.src;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `genart-image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function autoResizeTextarea(e) {
    const textarea = e.target;
    const promptBarContainer = DOMElements.promptBarContainer;
    if (!textarea || !promptBarContainer) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    const lineHeight = parseFloat(window.getComputedStyle(textarea).lineHeight);
    const numLines = Math.round(textarea.scrollHeight / lineHeight);
    if (numLines > 1) { 
        promptBarContainer.classList.add('expanded');
    } else {
        promptBarContainer.classList.remove('expanded');
    }
}

