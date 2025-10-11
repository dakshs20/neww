// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWDZZ-zLYyCrvnnnTeZ1w_IBWQvTrf-hM",
  authDomain: "gena-c597d.firebaseapp.com",
  projectId: "gena-c597d",
  storageBucket: "gena-c597d.firebasestorage.app",
  messagingSenderId: "926192855864",
  appId: "1:926192855864:web:728ec3e47624fe2d672fcd",
  measurementId: "G-SYK9TMY47N"
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
let currentStyle = 'Realistic'; // Default style
let uploadedImageData = null;
let currentPreviewInputData = null; 
let timerInterval;

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'header-nav', 'gallery-container', 'masonry-gallery', 'prompt-input',
        'generate-btn', 'generate-icon', 'loading-spinner', 'ratio-btn', 'ratio-options',
        'auth-modal', 'google-signin-btn', 'out-of-credits-modal', 'new-user-credits-modal',
        'preview-modal', 'preview-image', 'preview-prompt-input',
        'download-btn', 'close-preview-btn', 'regenerate-btn',
        'image-upload-btn', 'image-upload-input', 'image-preview-container', 'image-preview', 'remove-image-btn',
        'preview-input-image-container', 'preview-input-image', 'change-input-image-btn', 'remove-input-image-btn', 'preview-image-upload-input',
        'hero-section', 'hero-headline', 'hero-subline', 'typewriter', 'prompt-bar-container',
        'mobile-menu', 'mobile-menu-btn', 'menu-open-icon', 'menu-close-icon',
        'button-timer', 'button-content', 'style-selector', 'mobile-style-toggle-btn', 'mobile-style-options'
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
    DOMElements.styleBtns = document.querySelectorAll('.style-btn'); // This now selects ALL style buttons
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
    // Correctly wired event listener for the mobile style toggle button
    DOMElements.mobileStyleToggleBtn?.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevents the global click listener from firing immediately
        DOMElements.mobileStyleOptions?.classList.toggle('hidden');
    });

    // Global click listener to close popovers
    document.addEventListener('click', () => {
        DOMElements.ratioOptions?.classList.add('hidden');
        DOMElements.mobileStyleOptions?.classList.add('hidden');
    });

    // --- Selection Logic (Ratio & Style) ---
    DOMElements.ratioOptionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentAspectRatio = e.currentTarget.dataset.ratio;
            DOMElements.ratioOptionBtns.forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
        });
    });

    // Unified style button logic for both desktop and mobile
    DOMElements.styleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentStyle = btn.dataset.style;
            // Update all style buttons to show the current selection
            DOMElements.styleBtns.forEach(b => {
                 b.classList.toggle('selected', b.dataset.style === currentStyle);
            });
            // Close mobile popover if it's open
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
}

// --- Animations (omitted for brevity) ---
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
    if (user) {
        nav.innerHTML = `<a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors">Pricing</a><div id="credits-counter" class="text-sm font-medium text-gray-700 px-3 py-1">Credits: ...</div><button id="sign-out-btn-desktop" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors">Sign Out</button>`;
        mobileNav.innerHTML = `<a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Pricing</a><div id="credits-counter-mobile" class="text-center text-lg font-semibold text-gray-700 p-3 my-2 border-y">Credits: ...</div><button id="sign-out-btn-mobile" class="w-full text-left text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Sign Out</button>`;
        document.getElementById('sign-out-btn-desktop').addEventListener('click', () => signOut(auth));
        document.getElementById('sign-out-btn-mobile').addEventListener('click', () => signOut(auth));
        fetchUserCredits(user);
    } else {
        nav.innerHTML = `<a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors">Pricing</a><button id="sign-in-btn-desktop" class="text-sm font-medium text-white px-4 py-1.5 rounded-full transition-colors" style="background-color: #517CBE;">Sign In</button>`;
        mobileNav.innerHTML = `<a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Pricing</a><div class="p-4 mt-4"><button id="sign-in-btn-mobile" class="w-full text-lg font-semibold bg-[#517CBE] text-white px-4 py-3 rounded-xl hover:bg-opacity-90 transition-colors">Sign In</button></div>`;
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

        // --- NEW: Check if the user is new and show a welcome modal ---
        if (data.isNewUser) {
            // Show the welcome modal after a short delay
            setTimeout(() => {
                toggleModal(DOMElements.newUserCreditsModal, true);
            }, 1000); // 1 second delay
        }
        
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
    
    // NEW: Combine user prompt with the selected style
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
        
        // IMPORTANT: Show the original user prompt in the modal, not the modified one
        showPreviewModal(`data:image/png;base64,${base64Data}`, userPrompt, generationInputData);

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
    // handleImageGenerationRequest will automatically add the currently selected style
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
    DOMElements.previewPromptInput.value = prompt; // Show original user prompt
    currentPreviewInputData = inputImageData;
    DOMElements.previewInputImageContainer.classList.toggle('hidden', !inputImageData);
    if (inputImageData) {
        DOMElements.previewInputImage.src = `data:${inputImageData.mimeType};base64,${inputImageData.data}`;
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


