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


// --- NEW: Data for Interactive Use Case Section ---
const useCaseData = [
    { title: "Marketing", imageUrl: "https://iili.io/KaDoEWF.md.png" },
    { title: "Advertising", imageUrl: "https://iili.io/KaDn2YQ.md.png" },
    { title: "Fashion", imageUrl: "https://iili.io/KaDBjJ2.md.png" },
    { title: "Graphic Design", imageUrl: "https://images.unsplash.com/photo-1629904853716-f0bc64219b1b?q=80&w=1200&auto=format&fit=crop" },
    { title: "Realistic Photos", imageUrl: "https://iili.io/KaDqXu1.md.png" }
];


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
        'header-nav', 'mobile-menu', 'mobile-menu-btn', 'menu-open-icon', 'menu-close-icon',
        'gallery-container', 'masonry-gallery', 'prompt-input',
        'generate-btn', 'generate-icon', 'button-timer', 'ratio-btn', 'ratio-options',
        'auth-modal', 'google-signin-btn', 'out-of-credits-modal',
        'preview-modal', 'preview-image', 'preview-prompt-input',
        'download-btn', 'close-preview-btn', 'regenerate-btn',
        'image-upload-btn', 'image-upload-input', 'image-preview-container', 'image-preview', 'remove-image-btn',
        'preview-input-image-container', 'preview-input-image', 'change-input-image-btn', 'remove-input-image-btn', 'preview-image-upload-input',
        'hero-section', 'hero-headline', 'hero-subline', 'typewriter', 'prompt-bar-container',
        'use-case-tabs', 'use-case-image-display'
    ];
    ids.forEach(id => {
        if (id) {
            DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id);
        }
    });
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');
    DOMElements.ratioOptionBtns = document.querySelectorAll('.ratio-option');
    DOMElements.masonryColumns = document.querySelectorAll('.masonry-column');
    DOMElements.statCards = document.querySelectorAll('.stat-card');
    DOMElements.counters = document.querySelectorAll('.counter');

    initializeEventListeners();
    initializeAnimations();
    initializeInteractiveUseCases();
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
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
    // Call this only once when DOM is ready and screen is small
    restructureGalleryForMobile.called = true;
}


function initializeInteractiveUseCases() {
    const tabsContainer = DOMElements.useCaseTabs;
    if (!tabsContainer) return;

    useCaseData.forEach((item, index) => {
        const tab = document.createElement('button');
        tab.className = 'use-case-tab';
        tab.textContent = item.title;
        tab.dataset.index = index;
        if (index === 0) {
            tab.classList.add('active');
        }
        tabsContainer.appendChild(tab);
    });

    updateUseCaseImage(0);

    tabsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('use-case-tab')) {
            const index = parseInt(e.target.dataset.index, 10);
            updateUseCaseImage(index);
        }
    });
}

function updateUseCaseImage(index) {
    const imageDisplay = DOMElements.useCaseImageDisplay;
    const tabs = document.querySelectorAll('.use-case-tab');
    if (!imageDisplay || !tabs.length) return;

    tabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === index);
    });

    imageDisplay.classList.add('fading');
    setTimeout(() => {
        imageDisplay.src = useCaseData[index].imageUrl;
        imageDisplay.onload = () => {
            imageDisplay.classList.remove('fading');
        };
    }, 400);
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
        if (!DOMElements.ratioBtn.disabled) {
            DOMElements.ratioOptions.classList.toggle('hidden');
        }
    });
    document.addEventListener('click', () => DOMElements.ratioOptions?.classList.add('hidden'));
    DOMElements.ratioOptionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentAspectRatio = e.currentTarget.dataset.ratio;
            DOMElements.ratioOptionBtns.forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
        });
    });

    DOMElements.closePreviewBtn?.addEventListener('click', () => toggleModal(DOMElements.previewModal, false));
    DOMElements.downloadBtn?.addEventListener('click', downloadPreviewImage);
    DOMElements.regenerateBtn?.addEventListener('click', handleRegeneration);
    DOMElements.changeInputImageBtn?.addEventListener('click', () => DOMElements.previewImageUploadInput.click());
    DOMElements.previewImageUploadInput?.addEventListener('change', handlePreviewImageChange);
    DOMElements.removeInputImageBtn?.addEventListener('click', removePreviewInputImage);

    // Mobile Menu Toggle
    DOMElements.mobileMenuBtn?.addEventListener('click', () => {
        const isHidden = DOMElements.mobileMenu.classList.toggle('hidden');
        DOMElements.menuOpenIcon.classList.toggle('hidden', !isHidden);
        DOMElements.menuCloseIcon.classList.toggle('hidden', isHidden);
    });

    // Initial check for gallery restructure
    if (window.innerWidth < 768 && !restructureGalleryForMobile.called) {
        restructureGalleryForMobile();
    }
}

// --- Animations ---
function initializeAnimations() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    
    gsap.registerPlugin(ScrollTrigger, TextPlugin);

    const headline = DOMElements.heroHeadline;
    if (headline) {
        const headlineText = headline.textContent;
        headline.innerHTML = headlineText.split("").map(char => `<span class="char">${char === ' ' ? '&nbsp;' : char}</span>`).join("");
        
        gsap.to(".char", {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            stagger: 0.02,
            ease: 'power4.out'
        });
    }

    gsap.to(DOMElements.heroSubline, {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: 'power3.out',
        delay: 0.5
    });

    const words = ["creators.", "agencies.", "enterprises."];
    let masterTl = gsap.timeline({ repeat: -1 });
    words.forEach(word => {
        let tl = gsap.timeline({ repeat: 1, yoyo: true, repeatDelay: 1.5 });
        tl.to("#typewriter", { text: word, duration: 1, ease: "none" });
        masterTl.add(tl);
    });
    
    if (DOMElements.statCards.length > 0) {
        gsap.to(DOMElements.statCards, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 1.2,
            stagger: 0.2,
            ease: 'power4.out',
            scrollTrigger: {
                trigger: "#stats-section",
                start: "top 85%",
            }
        });
    }

    if (DOMElements.counters.length > 0) {
        DOMElements.counters.forEach(counter => {
            const target = +counter.dataset.target;
            const proxy = { val: 0 }; 

            gsap.to(proxy, {
                val: target,
                duration: 2.5,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: counter,
                    start: "top 90%",
                },
                onUpdate: function() {
                    counter.textContent = Math.ceil(proxy.val);
                }
            });
        });
    }
}


// --- Core App Logic ---
function updateUIForAuthState(user) {
    currentUser = user;
    const desktopNav = DOMElements.headerNav;
    const mobileNav = DOMElements.mobileMenu;

    if (user) {
        // Desktop Logged In
        desktopNav.innerHTML = `
            <a href="about.html" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE] hover:text-white rounded-full px-3 py-1 transition-colors">About</a>
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE] hover:text-white rounded-full px-3 py-1 transition-colors">Pricing</a>
            <div id="credits-counter-desktop" class="text-sm font-medium text-gray-700 px-3 py-1">Credits: ...</div>
            <button id="sign-out-btn-desktop" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE] hover:text-white rounded-full px-3 py-1 transition-colors">Sign Out</button>
        `;
        // Mobile Logged In
        mobileNav.innerHTML = `
            <div class="px-4 py-3">
                <p class="text-sm text-gray-500">Signed in as</p>
                <p class="text-sm font-medium text-gray-800 truncate">${user.email}</p>
            </div>
            <div id="credits-counter-mobile" class="text-center font-semibold text-gray-700 py-2">Credits: ...</div>
            <div class="border-t border-gray-200/80 my-1"></div>
            <a href="about.html" class="mobile-nav-link">About</a>
            <a href="pricing.html" class="mobile-nav-link">Pricing</a>
            <div class="border-t border-gray-200/80 my-1"></div>
            <button id="sign-out-btn-mobile" class="mobile-nav-link w-full text-left">Sign Out</button>
        `;

        document.getElementById('sign-out-btn-desktop').addEventListener('click', () => signOut(auth));
        document.getElementById('sign-out-btn-mobile').addEventListener('click', () => signOut(auth));
        fetchUserCredits(user);
    } else {
        // Desktop Logged Out
        desktopNav.innerHTML = `
            <a href="about.html" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE] hover:text-white rounded-full px-3 py-1 transition-colors">About</a>
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE] hover:text-white rounded-full px-3 py-1 transition-colors">Pricing</a>
            <button id="sign-in-btn-desktop" class="text-sm font-medium text-white px-4 py-1.5 rounded-full transition-colors" style="background-color: #517CBE;">Sign In</button>
        `;
        // Mobile Logged Out
        mobileNav.innerHTML = `
            <a href="about.html" class="mobile-nav-link">About</a>
            <a href="pricing.html" class="mobile-nav-link">Pricing</a>
            <div class="p-2">
                <button id="sign-in-btn-mobile" class="w-full text-base font-semibold text-white px-4 py-2.5 rounded-xl transition-colors" style="background-color: #517CBE;">Sign In</button>
            </div>
        `;
        
        document.getElementById('sign-in-btn-desktop').addEventListener('click', signInWithGoogle);
        document.getElementById('sign-in-btn-mobile').addEventListener('click', signInWithGoogle);
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
    const desktopCounter = document.getElementById('credits-counter-desktop');
    const mobileCounter = document.getElementById('credits-counter-mobile');
    if (desktopCounter) {
        desktopCounter.textContent = `Credits: ${amount}`;
    }
    if (mobileCounter) {
        mobileCounter.textContent = `Credits: ${amount}`;
    }
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
    
    const aspectRatioToSend = imageDataSource ? null : currentAspectRatio;
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
            body: JSON.stringify({ prompt, imageData: generationInputData, aspectRatio: aspectRatioToSend })
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
    DOMElements.buttonTimer.classList.toggle('hidden', !isLoading);

    if (isLoading) {
        DOMElements.generateBtn.classList.remove('w-10');
        DOMElements.generateBtn.classList.add('w-28'); // Make button wider for timer
    } else {
        DOMElements.generateBtn.classList.add('w-10');
        DOMElements.generateBtn.classList.remove('w-28');
    }
}

function startTimer() {
    let endTime = Date.now() + 17000;
    DOMElements.buttonTimer.textContent = '17.00s';

    timerInterval = setInterval(() => {
        const now = Date.now();
        const timeLeft = endTime - now;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            DOMElements.buttonTimer.textContent = '0.00s';
            return;
        }

        const secondsLeft = (timeLeft / 1000).toFixed(2);
        DOMElements.buttonTimer.textContent = `${secondsLeft}s`;
    }, 50); // Update every 50ms for a smooth countdown
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

function downloadPreviewImage() {
    const imageUrl = DOMElements.previewImage.src;
    fetch(imageUrl)
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
        .catch(() => alert('An error occurred while downloading the image.'));
}


