// --- Firebase and Auth Initialization ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const db = getFirestore(app); // Initialize Firestore
const provider = new GoogleAuthProvider();

// --- IMPORTANT: This array now serves as a fallback ---
const fallbackImageUrls = [
    "https://iili.io/K7bN7Hl.md.png", "https://iili.io/K7bOTzP.md.png", "https://iili.io/K7yYoqN.md.png", "https://iili.io/K7bk3Ku.md.png",
    "https://iili.io/K7b6OPV.md.png", "https://iili.io/K7be88v.md.png", "https://iili.io/K7b894e.md.png", "https://iili.io/K7y1cUN.md.png",
    "https://iili.io/K7yEx14.md.png", "https://iili.io/K7b4VQR.md.png", "https://iili.io/K7yGhS2.md.png", "https://iili.io/K7bs5wg.md.png",
    "https://iili.io/K7bDzpS.md.png", "https://iili.io/K7yVVv2.md.png", "https://iili.io/K7bmj7R.md.png", "https://iili.io/K7bP679.md.png",
    "https://iili.io/FiiqmhB.md.png", "https://iili.io/FiiC8VS.md.png",
    "https://iili.io/FiizC0P.md.png", "https://iili.io/FiiT4UP.md.png"
];


// --- Global State ---
let currentUserCredits = 0;
let uploadedImageData = null;
let isGenerating = false;
let timerInterval;
let currentAspectRatio = '1:1'; // Default aspect ratio

// --- DOM Element Caching ---
const DOMElements = {};

document.addEventListener('DOMContentLoaded', () => {
    const ids = [
        'auth-btn', 'auth-modal', 'google-signin-btn', 'close-modal-btn',
        'out-of-credits-modal', 'close-credits-modal-btn', 'welcome-credits-modal',
        'close-welcome-modal-btn', 'generation-counter', 'prompt-input',
        'generate-btn', 'image-upload-btn', 'image-upload-input', 'remove-image-btn',
        'image-preview-container', 'image-preview', 'result-container', 'image-grid',
        'loading-indicator', 'progress-bar-container', 'progress-bar', 'timer',
        'background-grid-container', 'background-grid', 'ratio-selector-btn', 'ratio-options'
    ];
    ids.forEach(id => DOMElements[id.replace(/-./g, c => c[1].toUpperCase())] = document.getElementById(id));

    initializeEventListeners();
    listenForSharedImages(); // New function to load the gallery
});

function initializeEventListeners() {
    onAuthStateChanged(auth, user => updateUIForAuthState(user));
    DOMElements.authBtn?.addEventListener('click', handleAuthAction);
    DOMElements.googleSignInBtn?.addEventListener('click', signInWithGoogle);
    DOMElements.closeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.authModal, false));
    DOMElements.closeCreditsModalBtn?.addEventListener('click', () => {
        toggleModal(DOMElements.outOfCreditsModal, false);
        resetUIAfterGeneration();
    });
    DOMElements.closeWelcomeModalBtn?.addEventListener('click', () => toggleModal(DOMElements.welcomeCreditsModal, false));
    DOMElements.generateBtn?.addEventListener('click', handleImageGenerationRequest);
    DOMElements.imageUploadBtn?.addEventListener('click', () => DOMElements.imageUploadInput.click());
    DOMElements.imageUploadInput?.addEventListener('change', handleImageUpload);
    DOMElements.removeImageBtn?.addEventListener('click', removeUploadedImage);
    DOMElements.promptInput?.addEventListener('input', autoResizeTextarea);

    // --- Aspect Ratio Selector Listeners ---
    DOMElements.ratioSelectorBtn?.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevents the document click listener from closing it immediately
        toggleRatioOptions();
    });

    document.querySelectorAll('.ratio-option-box').forEach(box => {
        box.addEventListener('click', selectRatio);
    });

    // Global listener to close the ratio options when clicking outside
    document.addEventListener('click', () => {
        if (DOMElements.ratioOptions?.classList.contains('visible')) {
            toggleRatioOptions();
        }
    });
}

// --- NEW: Background Grid Logic with Firestore ---
function listenForSharedImages() {
    const grid = DOMElements.backgroundGrid;
    if (!grid) return;

    // Start with the fallback images for a nice loading state
    populateGrid(fallbackImageUrls);

    const q = query(collection(db, "shared_images"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        const imageUrls = [];
        snapshot.forEach((doc) => {
            imageUrls.push(doc.data().imageUrl);
        });

        // If we got images from the database, use them. Otherwise, keep the fallbacks.
        if (imageUrls.length > 0) {
            populateGrid(imageUrls);
        }
    }, (error) => {
        console.error("Error fetching shared images: ", error);
        // If there's an error, we still have the fallback images displayed.
    });
}

function populateGrid(urls) {
    const grid = DOMElements.backgroundGrid;
    grid.innerHTML = ''; // Clear previous images
    urls.forEach(url => {
        const img = document.createElement('img');
        img.className = 'grid-image';
        img.src = url;
        img.loading = 'lazy';
        grid.appendChild(img);
    });
}


// --- Core App Logic (Authentication, Credits, Generation) ---
function toggleModal(modal, show) {
    if (!modal) return;
    if (show) {
        modal.classList.remove('opacity-0', 'invisible');
        modal.setAttribute('aria-hidden', 'false');
    } else {
        modal.classList.add('opacity-0', 'invisible');
        modal.setAttribute('aria-hidden', 'true');
    }
}

async function updateUIForAuthState(user) {
    const counter = DOMElements.generationCounter;
    if (user) {
        DOMElements.authBtn.textContent = 'Sign Out';
        try {
            const token = await user.getIdToken(true);
            const response = await fetch('/api/credits', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Failed to fetch credits');
            const data = await response.json();
            currentUserCredits = data.credits;
            if (counter) counter.textContent = `Credits: ${currentUserCredits}`;
            if (data.isNewUser) {
                const freeCreditsEl = document.getElementById('free-credits-amount');
                if (freeCreditsEl) freeCreditsEl.textContent = data.credits;
                toggleModal(DOMElements.welcomeCreditsModal, true);
            }
        } catch (error) {
            console.error("Error fetching credits:", error);
            if (counter) counter.textContent = "Credits: Error";
        }
    } else {
        DOMElements.authBtn.textContent = 'Sign In';
        if (counter) counter.textContent = "";
        currentUserCredits = 0;
    }
}

function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth).catch(console.error);
    } else {
        toggleModal(DOMElements.authModal, true);
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(() => toggleModal(DOMElements.authModal, false))
        .catch((error) => {
            console.error("Google Sign-In Error:", error);
            alert("Could not sign in with Google. Please check if pop-ups are blocked and try again.");
        });
}

async function handleImageGenerationRequest() {
    if (isGenerating) return;
    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }
    if (currentUserCredits <= 0) {
        toggleModal(DOMElements.outOfCreditsModal, true);
        return;
    }
    const prompt = DOMElements.promptInput.value.trim();
    if (!prompt && !uploadedImageData) return;

    generateImage(prompt);
}

async function generateImage(prompt) {
    startLoadingUI();
    try {
        const token = await auth.currentUser.getIdToken();
        const deductResponse = await fetch('/api/credits', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        if (!deductResponse.ok) throw new Error('Credit deduction failed');

        const generateResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ prompt, imageData: uploadedImageData, aspectRatio: currentAspectRatio })
        });
        if (!generateResponse.ok) throw new Error('API generation failed');

        const result = await generateResponse.json();
        const base64Data = uploadedImageData ? result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data : result.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Data) throw new Error("No image data in response");

        displayImage(`data:image/png;base64,${base64Data}`, prompt);
        await updateUIForAuthState(auth.currentUser);

    } catch (error) {
        console.error("Generation Error:", error);
        resetUIAfterGeneration();
    } finally {
        stopLoadingUI();
    }
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        uploadedImageData = { mimeType: file.type, data: reader.result.split(',')[1] };
        DOMElements.imagePreview.src = reader.result;
        DOMElements.imagePreviewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageData = null;
    DOMElements.imageUploadInput.value = '';
    DOMElements.imagePreviewContainer.classList.add('hidden');
}


// --- UI State Management for New Design ---
function autoResizeTextarea(e) {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
}

// --- Aspect Ratio Functions ---
function toggleRatioOptions() {
    DOMElements.ratioOptions?.classList.toggle('visible');
}

function selectRatio(event) {
    const selectedBox = event.currentTarget;
    currentAspectRatio = selectedBox.dataset.ratio;

    document.querySelectorAll('.ratio-option-box').forEach(box => box.classList.remove('active'));
    selectedBox.classList.add('active');
}


function startLoadingUI() {
    isGenerating = true;
    DOMElements.imageGrid.classList.add('hidden');
    DOMElements.loadingIndicator.classList.remove('hidden');
    DOMElements.backgroundGridContainer.classList.add('dimmed');
    startTimer();
}

function stopLoadingUI() {
    isGenerating = false;
    DOMElements.loadingIndicator.classList.add('hidden');
    stopTimer();
}

function applyWatermark(baseImageUrl) {
    return new Promise((resolve, reject) => {
        const watermarkUrl = 'https://iili.io/FsAoG2I.md.png';

        const mainImage = new Image();
        mainImage.crossOrigin = 'anonymous';
        const watermark = new Image();
        watermark.crossOrigin = 'anonymous';

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        mainImage.onload = () => {
            watermark.onload = () => {
                canvas.width = mainImage.width;
                canvas.height = mainImage.height;
                ctx.drawImage(mainImage, 0, 0);
                ctx.globalAlpha = 0.75;
                const watermarkWidth = canvas.width * 0.15;
                const watermarkHeight = watermark.height * (watermarkWidth / watermark.width);
                const padding = canvas.width * 0.02;
                const x = canvas.width - watermarkWidth - padding;
                const y = canvas.height - watermarkHeight - padding;
                ctx.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);
                resolve(canvas.toDataURL('image/png'));
            };
            watermark.onerror = reject;
            watermark.src = watermarkUrl;
        };
        mainImage.onerror = reject;
        mainImage.src = baseImageUrl;
    });
}


async function displayImage(imageUrl, prompt) {
    DOMElements.loadingIndicator.classList.add('hidden');
    try {
        const watermarkedImageUrl = await applyWatermark(imageUrl);
        DOMElements.imageGrid.classList.remove('hidden');
        DOMElements.imageGrid.innerHTML = '';

        const imgContainer = document.createElement('div');
        imgContainer.className = 'bg-white/80 backdrop-blur-md rounded-2xl shadow-2xl p-2 relative group max-w-2xl mx-auto border border-gray-200/80';
        const img = document.createElement('img');
        img.src = watermarkedImageUrl;
        img.alt = prompt;
        img.className = 'w-full h-auto object-contain rounded-xl';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity';

        const downloadButton = document.createElement('button');
        downloadButton.className = "bg-black/50 text-white p-2 rounded-full";
        downloadButton.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        downloadButton.onclick = () => {
            const a = document.createElement('a');
            a.href = watermarkedImageUrl;
            a.download = 'genart-image.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        const shareButton = document.createElement('button');
        shareButton.className = "bg-black/50 text-white p-2 rounded-full";
        shareButton.title = "Share to Everyone";
        shareButton.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>`;
        shareButton.onclick = () => shareImage(watermarkedImageUrl, shareButton);

        const closeButton = document.createElement('button');
        closeButton.className = "bg-black/50 text-white p-2 rounded-full";
        closeButton.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        closeButton.onclick = resetUIAfterGeneration;

        buttonContainer.append(downloadButton, shareButton, closeButton);
        imgContainer.append(img, buttonContainer);
        DOMElements.imageGrid.appendChild(imgContainer);

    } catch (error) {
        console.error("Failed to apply watermark:", error);
        displayImage(imageUrl, prompt);
    }
}

async function shareImage(imageDataUrl, button) {
    if (!auth.currentUser) {
        toggleModal(DOMElements.authModal, true);
        return;
    }

    button.disabled = true;
    button.innerHTML = '...';

    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/share', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ imageDataUrl })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Sharing failed due to an unknown server issue.');
        }

        button.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    } catch (error) {
        console.error("Sharing Error:", error);
        alert(`Sorry, we couldn't share your image at this time. \n\nError: ${error.message}`);
        
        button.disabled = false;
        button.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>`;
    }
}

function resetUIAfterGeneration() {
    DOMElements.imageGrid.classList.add('hidden');
    DOMElements.imageGrid.innerHTML = '';
    DOMElements.backgroundGridContainer.classList.remove('dimmed');
    DOMElements.promptInput.value = '';
    autoResizeTextarea({ target: DOMElements.promptInput });
    removeUploadedImage();
}

function startTimer() {
    let startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        if (DOMElements.timer) DOMElements.timer.textContent = `${(elapsedTime / 1000).toFixed(1)}s`;
        const progress = Math.min(elapsedTime / 17000, 1);
        if (DOMElements.progressBar) DOMElements.progressBar.style.width = `${progress * 100}%`;
    }, 100);
}

function stopTimer() {
    clearInterval(timerInterval);
}

