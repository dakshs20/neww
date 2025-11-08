// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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
const provider = new GoogleAuthProvider();

// --- Global State ---
let currentUser;
let currentUserCredits = 10; // Default for demo
let isGenerating = false;

// --- Generator State ---
let currentPrompt = "";
let currentStyle = "Clean Product";
let currentRatio = "1:1";
let currentQuality = 1; // 0=Draft, 1=Standard, 2=High, 3=Ultra
let currentImageCount = 4;
let isEnhancePrompt = false;
let isUpscale = false;

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'header-nav', 'auth-modal', 'google-signin-btn', 'new-user-credits-modal',
        'mobile-menu', 'mobile-menu-btn', 'menu-open-icon', 'menu-close-icon',
        'main-generate-btn-header', 'credits-count-header', 'generate-loader-header',
        'creation-dock', 'mobile-dock-handle', 'show-controls-btn',
        'prompt-input', 'enhance-toggle',
        'style-carousel', 'style-intensity-slider', 'style-intensity-value',
        'quality-slider', 'upscale-toggle',
        'image-step-down', 'image-step-up', 'image-count-display',
        'main-generate-btn-dock', 'credits-count-dock', 'generate-loader-dock',
        'empty-state', 'results-grid',
        'result-card-template'
    ];
    ids.forEach(id => {
        if (id) {
            DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id);
        }
    });
    
    // Select all buttons and other query-based elements
    DOMElements.closeModalBtns = document.querySelectorAll('.close-modal-btn');
    DOMElements.modalBackdrops = document.querySelectorAll('.modal-backdrop');
    DOMElements.styleChips = document.querySelectorAll('.style-chip');
    DOMElements.ratioChips = document.querySelectorAll('.ratio-chip');
    DOMElements.presetCards = document.querySelectorAll('.preset-card');

    initializeEventListeners();
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
    updateCreditsDisplay();
    updateImageCountDisplay();
});

function initializeEventListeners() {
    // --- Auth & Modals ---
    DOMElements.googleSigninBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtns.forEach(btn => btn.addEventListener('click', closeAllModals));
    DOMElements.modalBackdrops.forEach(backdrop => {
        backdrop.addEventListener('click', (event) => {
            if (event.target === backdrop) closeAllModals();
        });
    });

    // --- Header & Nav ---
    DOMElements.mobileMenuBtn?.addEventListener('click', () => {
        const isHidden = DOMElements.mobileMenu.classList.toggle('hidden');
        DOMElements.menuOpenIcon.classList.toggle('hidden', !isHidden);
        DOMElements.menuCloseIcon.classList.toggle('hidden', isHidden);
    });

    // --- Mobile Dock Controls ---
    DOMElements.mobileDockHandle?.addEventListener('click', closeMobileDock);
    DOMElements.showControlsBtn?.addEventListener('click', openMobileDock);

    // --- Generator Controls ---
    DOMElements.promptInput?.addEventListener('input', e => currentPrompt = e.target.value);
    DOMElements.enhanceToggle?.addEventListener('click', toggleEnhance);
    
    DOMElements.styleChips.forEach(chip => {
        chip.addEventListener('click', () => selectStyle(chip));
    });

    DOMElements.ratioChips.forEach(chip => {
        chip.addEventListener('click', () => selectRatio(chip));
    });
    
    DOMElements.qualitySlider?.addEventListener('input', e => {
        currentQuality = parseInt(e.target.value, 10);
    });

    DOMElements.upscaleToggle?.addEventListener('click', toggleUpscale);

    DOMElements.imageStepDown?.addEventListener('click', () => updateImageCount(-1));
    DOMElements.imageStepUp?.addEventListener('click', () => updateImageCount(1));

    DOMElements.mainGenerateBtnDock?.addEventListener('click', handleGeneration);
    DOMElements.mainGenerateBtnHeader?.addEventListener('click', handleGeneration);

    // --- Keyboard Shortcuts ---
    document.addEventListener('keydown', e => {
        // Don't trigger if user is typing in an input
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
        
        switch (e.key.toUpperCase()) {
            case 'G':
                handleGeneration();
                break;
            // Add other shortcuts (E, S, C) here
        }
    });
}

// --- Mobile Dock Logic ---
function openMobileDock() {
    DOMElements.creationDock.style.transform = 'translateY(0)';
    DOMElements.showControlsBtn.style.opacity = '0';
}
function closeMobileDock() {
    DOMElements.creationDock.style.transform = 'translateY(100%)';
    DOMElements.showControlsBtn.style.opacity = '1';
}

// --- Control Logic ---
function toggleEnhance() {
    isEnhancePrompt = !isEnhancePrompt;
    DOMElements.enhanceToggle.setAttribute('aria-checked', isEnhancePrompt);
    DOMElements.enhanceToggle.classList.toggle('bg-blue-500', isEnhancePrompt);
    DOMElements.enhanceToggle.classList.toggle('bg-gray-200', !isEnhancePrompt);
    DOMElements.enhanceToggle.querySelector('span').classList.toggle('translate-x-4', isEnhancePrompt);
}

function toggleUpscale() {
    isUpscale = !isUpscale;
    DOMElements.upscaleToggle.setAttribute('aria-checked', isUpscale);
    DOMElements.upscaleToggle.classList.toggle('bg-blue-500', isUpscale);
    DOMElements.upscaleToggle.classList.toggle('bg-gray-200', !isUpscale);
    DOMElements.upscaleToggle.querySelector('span').classList.toggle('translate-x-4', isUpscale);
}

function selectStyle(selectedChip) {
    currentStyle = selectedChip.dataset.style;
    DOMElements.styleChips.forEach(chip => chip.classList.remove('selected'));
    selectedChip.classList.add('selected');
    DOMElements.styleIntensitySlider.classList.remove('hidden');
}

function selectRatio(selectedChip) {
    currentRatio = selectedChip.dataset.ratio;
    DOMElements.ratioChips.forEach(chip => chip.classList.remove('selected'));
    selectedChip.classList.add('selected');
    // Add logic for custom ratio input here if needed
}

function updateImageCount(change) {
    let newCount = currentImageCount + change;
    if (newCount < 1) newCount = 1;
    if (newCount > 12) newCount = 12;
    currentImageCount = newCount;
    updateImageCountDisplay();
    updateCreditsDisplay();
}

function updateImageCountDisplay() {
    DOMElements.imageCountDisplay.textContent = currentImageCount;
}

function updateCreditsDisplay() {
    // Simple 1-credit-per-image logic
    let creditsToUse = currentImageCount;
    DOMElements.creditsCountDock.textContent = `${creditsToUse}`;
    DOMElements.creditsCountHeader.textContent = currentUserCredits;
}

// --- Generation Logic ---
async function handleGeneration() {
    if (isGenerating) return;
    if (currentUserCredits < currentImageCount) {
        alert("Not enough credits!");
        return;
    }

    isGenerating = true;
    setLoadingState(true);
    DOMElements.emptyState.classList.add('hidden');
    DOMElements.resultsGrid.classList.remove('hidden');

    // Simulate API call
    setTimeout(() => {
        // Deduct credits
        currentUserCredits -= currentImageCount;
        updateCreditsDisplay();

        // Add results to grid
        for (let i = 0; i < currentImageCount; i++) {
            addResultCard();
        }

        setLoadingState(false);
        isGenerating = false;
        if (window.innerWidth < 1024) {
            closeMobileDock();
        }
    }, 2500); // 2.5 second simulated generation
}

function setLoadingState(isLoading) {
    const dockBtn = DOMElements.mainGenerateBtnDock;
    const headerBtn = DOMElements.mainGenerateBtnHeader;
    
    if (isLoading) {
        [dockBtn, headerBtn].forEach(btn => {
            btn.disabled = true;
            btn.querySelector('span').classList.add('hidden');
            btn.querySelector('div').classList.remove('hidden');
        });
    } else {
        [dockBtn, headerBtn].forEach(btn => {
            btn.disabled = false;
            btn.querySelector('span').classList.remove('hidden');
            btn.querySelector('div').classList.add('hidden');
        });
    }
}

function addResultCard() {
    const template = DOMElements.resultCardTemplate;
    const clone = template.content.cloneNode(true);
    const img = clone.querySelector('img');
    
    // Get a random aspect ratio for visual variety in the grid
    const ratios = ['400x400', '400x500', '600x400'];
    const randomRatio = ratios[Math.floor(Math.random() * ratios.length)];
    
    img.src = `https://placehold.co/${randomRatio}/e0f2fe/517CBE?text=Result`;
    DOMElements.resultsGrid.prepend(clone);
}


// --- Auth & Header UI Logic ---
function updateUIForAuthState(user) {
    currentUser = user;
    const nav = DOMElements.headerNav;
    const mobileNav = DOMElements.mobileMenu;
    const linkClasses = "text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors";
    const mobileLinkClasses = "block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100";

    if (user) {
        // Logged-in state
        nav.innerHTML = `
            <a href="teams.html" class="${linkClasses}">For Teams</a>
            <a href="pricing.html" class="${linkClasses}">Pricing</a>
            <div id="credits-counter-nav" class="text-sm font-medium text-gray-700 px-3 py-1">Credits: ...</div>
            <button id="sign-out-btn-desktop" class="${linkClasses}">Sign Out</button>
        `;
        mobileNav.innerHTML = `
            <a href="teams.html" class="${mobileLinkClasses}">For Teams</a>
            <a href="pricing.html" class="${mobileLinkClasses}">Pricing</a>
            <div id="credits-counter-mobile" class="text-center text-lg font-semibold text-gray-700 p-3 my-2 border-y">Credits: ...</div>
            <button id="sign-out-btn-mobile" class="w-full text-left ${mobileLinkClasses}">Sign Out</button>
        `;
        document.getElementById('sign-out-btn-desktop').addEventListener('click', () => signOut(auth));
        document.getElementById('sign-out-btn-mobile').addEventListener('click', () => signOut(auth));
        fetchUserCredits(user);
    } else {
        // Logged-out state
        nav.innerHTML = `
            <a href="teams.html" class="${linkClasses}">For Teams</a>
            <a href="pricing.html" class="${linkClasses}">Pricing</a>
            <button id="sign-in-btn-desktop" class="text-sm font-medium text-white px-4 py-1.5 rounded-full transition-colors" style="background-color: #517CBE;">Sign In</button>
        `;
        mobileNav.innerHTML = `
            <a href="teams.html" class="${mobileLinkClasses}">For Teams</a>
            <a href="pricing.html" class="${mobileLinkClasses}">Pricing</a>
            <div class="p-4 mt-4">
                <button id="sign-in-btn-mobile" class="w-full text-lg font-semibold bg-[#517CBE] text-white px-4 py-3 rounded-xl hover:bg-opacity-90 transition-colors">Sign In</button>
            </div>
        `;
        document.getElementById('sign-in-btn-desktop').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
        document.getElementById('sign-in-btn-mobile').addEventListener('click', () => toggleModal(DOMElements.authModal, true));
    }
}

async function fetchUserCredits(user) {
    try {
        const token = await user.getIdToken(true);
        const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) throw new Error('Failed to fetch credits');

        const data = await response.json();
        currentUserCredits = data.credits;
        updateCreditsDisplay(); // Update all credit displays
        
        const navCounter = document.getElementById('credits-counter-nav');
        const mobileCounter = document.getElementById('credits-counter-mobile');
        if (navCounter) navCounter.textContent = `Credits: ${data.credits}`;
        if (mobileCounter) mobileCounter.textContent = `Credits: ${data.credits}`;

        if (data.isNewUser) {
            setTimeout(() => {
                toggleModal(DOMElements.newUserCreditsModal, true);
            }, 1000); 
        }
    } catch (error) {
        console.error("Error fetching credits:", error);
        const navCounter = document.getElementById('credits-counter-nav');
        const mobileCounter = document.getElementById('credits-counter-mobile');
        if (navCounter) navCounter.textContent = `Credits: Error`;
        if (mobileCounter) mobileCounter.textContent = `Credits: Error`;
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

async function signInWithGoogle() {
    try {
        await signInWithPopup(auth, provider);
        closeAllModals();
    } catch (error) {
        console.error("Google Sign-In Error:", error);
    }
}
