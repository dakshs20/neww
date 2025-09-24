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

const useCaseData = [
    { title: "Marketing", imageUrl: "https://images.unsplash.com/photo-1557862921-37829c790f19?q=80&w=2000&auto=format&fit=crop", description: "Create compelling visuals for campaigns, social media, and ad content in seconds, not hours." },
    { title: "Advertising", imageUrl: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=2000&auto=format&fit=crop", description: "Generate countless variations of ad creatives to A/B test and find the perfect message for your audience." },
    { title: "Fashion", imageUrl: "https://images.unsplash.com/photo-1581044777550-4cfa6ce6702e?q=80&w=2000&auto=format&fit=crop", description: "Conceptualize and visualize new clothing designs, model shoots, and entire fashion lines instantly." },
    { title: "Graphic Design", imageUrl: "https://images.unsplash.com/photo-1629904853716-f0bc64219b1b?q=80&w=2000&auto=format&fit=crop", description: "Accelerate your workflow with unique assets, textures, and inspirational concepts for any design project." },
    { title: "Realistic Photos", imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2000&auto=format&fit=crop", description: "Produce hyper-realistic portraits and scenes, perfect for stock photography or artistic reference." }
];

// --- Global State ---
let currentUser;
let currentUserCredits = 0;
let isGenerating = false;
let currentAspectRatio = '1:1';
let uploadedImageData = null;
let currentPreviewInputData = null; 
let timerInterval;
let useCaseInterval;
let currentUseCaseIndex = 0;

// --- DOM Element Caching ---
const DOMElements = {};

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
        'use-case-tabs', 'mobile-menu', 'mobile-menu-btn', 'menu-open-icon', 'menu-close-icon',
        'button-timer'
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

function initializeInteractiveUseCases() {
    const tabsContainer = DOMElements.useCaseTabs;
    const descriptionsContainer = document.getElementById('use-case-descriptions');
    const imageWrapper = document.getElementById('use-case-image-wrapper');
    
    if (!tabsContainer || !descriptionsContainer || !imageWrapper) return;

    useCaseData.forEach((item, index) => {
        // Create Tab
        const tab = document.createElement('button');
        tab.className = 'use-case-tab';
        tab.textContent = item.title;
        tab.dataset.index = index;
        tabsContainer.appendChild(tab);

        // Create Description
        const description = document.createElement('p');
        description.className = 'use-case-description text-base text-gray-600';
        description.dataset.index = index;
        description.innerHTML = item.description.split(' ').map(word => `<span class="word">${word}</span>`).join(' ');
        descriptionsContainer.appendChild(description);

        // Create Image
        const img = document.createElement('img');
        img.src = item.imageUrl;
        img.alt = item.title;
        img.className = 'use-case-image';
        img.dataset.index = index;
        imageWrapper.appendChild(img);
    });

    tabsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('use-case-tab')) {
            const index = parseInt(e.target.dataset.index, 10);
            updateUseCaseContent(index);
            // Reset interval on manual click
            clearInterval(useCaseInterval);
            useCaseInterval = setInterval(() => {
                currentUseCaseIndex = (currentUseCaseIndex + 1) % useCaseData.length;
                updateUseCaseContent(currentUseCaseIndex);
            }, 5000);
        }
    });
    
    // Initial state
    updateUseCaseContent(0);

    // Start auto-play
    useCaseInterval = setInterval(() => {
        currentUseCaseIndex = (currentUseCaseIndex + 1) % useCaseData.length;
        updateUseCaseContent(currentUseCaseIndex);
    }, 5000);
}

function updateUseCaseContent(index) {
    currentUseCaseIndex = index;
    const allImages = document.querySelectorAll('.use-case-image');
    const allTabs = document.querySelectorAll('.use-case-tab');
    const allDescriptions = document.querySelectorAll('.use-case-description');

    allTabs.forEach((tab, i) => tab.classList.toggle('active', i === index));
    allImages.forEach((img, i) => img.classList.toggle('active', i === index));
    
    allDescriptions.forEach((desc, i) => {
        const isActive = i === index;
        desc.classList.toggle('active', isActive);
        if(isActive) {
            gsap.fromTo(desc.querySelectorAll('.word'), 
                { opacity: 0, y: 10 },
                { opacity: 1, y: 0, stagger: 0.03, duration: 0.5, ease: 'power2.out' }
            );
        }
    });
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
    
    DOMElements.mobileMenuBtn?.addEventListener('click', () => {
        const isHidden = DOMElements.mobileMenu.classList.toggle('hidden');
        DOMElements.menuOpenIcon.classList.toggle('hidden', !isHidden);
        DOMElements.menuCloseIcon.classList.toggle('hidden', isHidden);
    });
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

    gsap.fromTo("#interactive-use-cases", 
        { opacity: 0, y: 50 },
        { 
            opacity: 1, 
            y: 0, 
            duration: 1, 
            ease: 'power3.out',
            scrollTrigger: {
                trigger: "#interactive-use-cases",
                start: "top 80%",
            }
        }
    );
}


// --- Core App Logic ---
function updateUIForAuthState(user) {
    currentUser = user;
    const nav = DOMElements.headerNav;
    const mobileNav = DOMElements.mobileMenu;

    if (user) {
        nav.innerHTML = `
            <a href="about.html" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors">About</a>
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors">Pricing</a>
            <div id="credits-counter" class="text-sm font-medium text-gray-700 px-3 py-1">Credits: ...</div>
            <button id="sign-out-btn-desktop" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors">Sign Out</button>
        `;
        mobileNav.innerHTML = `
            <a href="about.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">About</a>
            <a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Pricing</a>
            <div id="credits-counter-mobile" class="text-center text-lg font-semibold text-gray-700 p-3 my-2 border-y">Credits: ...</div>
            <button id="sign-out-btn-mobile" class="w-full text-left text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Sign Out</button>
        `;
        document.getElementById('sign-out-btn-desktop').addEventListener('click', () => signOut(auth));
        document.getElementById('sign-out-btn-mobile').addEventListener('click', () => signOut(auth));
        fetchUserCredits(user);
    } else {
        nav.innerHTML = `
            <a href="about.html" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors">About</a>
            <a href="pricing.html" class="text-sm font-medium text-gray-700 hover:bg-[#517CBE]/10 rounded-full px-3 py-1 transition-colors">Pricing</a>
            <button id="sign-in-btn-desktop" class="text-sm font-medium text-white px-4 py-1.5 rounded-full transition-colors" style="background-color: #517CBE;">Sign In</button>
        `;
         mobileNav.innerHTML = `
            <a href="about.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">About</a>
            <a href="pricing.html" class="block text-lg font-semibold text-gray-700 p-3 rounded-lg hover:bg-gray-100">Pricing</a>
            <div class="p-4 mt-4">
                 <button id="sign-in-btn-mobile" class="w-full text-lg font-semibold bg-[#517CBE] text-white px-4 py-3 rounded-xl hover:bg-opacity-90 transition-colors">Sign In</button>
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
    const creditsCounter = document.getElementById('credits-counter');
    const creditsCounterMobile = document.getElementById('credits-counter-mobile');
    if (creditsCounter) creditsCounter.textContent = `Credits: ${amount}`;
    if (creditsCounterMobile) creditsCounterMobile.textContent = `Credits: ${amount}`;
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
    }, 50); // Update every 50ms for smoother millisecond display
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

