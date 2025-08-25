// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, increment, collection, addDoc, query, onSnapshot, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.appspot.com",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- DOM Element References ---
const appContainer = document.getElementById('app-container');
const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');
const resultContainer = document.getElementById('result-container');
const loadingIndicator = document.getElementById('loading-indicator');
const imageGrid = document.getElementById('image-grid');
const timerEl = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const messageBox = document.getElementById('message-box');
const examplePrompts = document.querySelectorAll('.example-prompt');
const generatorUI = document.getElementById('generator-ui');
const imageUploadBtn = document.getElementById('image-upload-btn');
const imageUploadInput = document.getElementById('image-upload-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const authBtn = document.getElementById('auth-btn');
const mobileAuthBtn = document.getElementById('mobile-auth-btn');
const generationCounterEl = document.getElementById('generation-counter');
const mobileGenerationCounterEl = document.getElementById('mobile-generation-counter');
const authModal = document.getElementById('auth-modal');
const googleSignInBtn = document.getElementById('google-signin-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const musicBtn = document.getElementById('music-btn');
const lofiMusic = document.getElementById('lofi-music');
const cursorDot = document.querySelector('.cursor-dot');
const cursorOutline = document.querySelector('.cursor-outline');
const aspectRatioBtns = document.querySelectorAll('.aspect-ratio-btn');
const logoBtn = document.getElementById('logo-btn');
const libraryBtn = document.getElementById('library-btn');
const mobileLibraryBtn = document.getElementById('mobile-library-btn');
const libraryContainer = document.getElementById('library-container');
const libraryGrid = document.getElementById('library-grid');
const libraryEmptyMessage = document.getElementById('library-empty-message');
const mainContent = document.querySelector('main > .w-full.max-w-3xl');
const otherSections = document.querySelectorAll('main > section, main > .mt-24.text-center');

let timerInterval;
const FREE_GENERATION_LIMIT = 3;
let uploadedImageData = null;
// MODIFIED: Changed to an object to store both URL and prompt for the unlock-to-save feature
let lastGeneratedImage = null; 
let selectedAspectRatio = '1:1';
let unsubscribeLibrary = null;

// --- reCAPTCHA Callback Function ---
window.onRecaptchaSuccess = function(token) {
    console.log("Invisible reCAPTCHA check passed. Proceeding with image generation.");
    generateImage(token);
};

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        updateUIForAuthState(user);
    });
    mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    document.addEventListener('click', (event) => {
        if (!mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
            mobileMenu.classList.add('hidden');
        }
    });
    authBtn.addEventListener('click', handleAuthAction);
    mobileAuthBtn.addEventListener('click', handleAuthAction);
    googleSignInBtn.addEventListener('click', signInWithGoogle);
    closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));
    examplePrompts.forEach(button => {
        button.addEventListener('click', () => {
            promptInput.value = button.innerText.trim();
            promptInput.focus();
        });
    });
    
    libraryBtn.addEventListener('click', showLibraryView);
    mobileLibraryBtn.addEventListener('click', showLibraryView);
    logoBtn.addEventListener('click', showGeneratorView);

    generateBtn.addEventListener('click', () => {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            showMessage('Please describe what you want to create or edit.', 'error');
            return;
        }

        const count = getGenerationCount();
        if (!auth.currentUser && count >= FREE_GENERATION_LIMIT) {
            authModal.setAttribute('aria-hidden', 'false');
            return;
        }
        grecaptcha.execute();
    });

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generateBtn.click();
        }
    });

    aspectRatioBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            aspectRatioBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAspectRatio = btn.dataset.ratio;
        });
    });

    imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
    imageUploadInput.addEventListener('change', handleImageUpload);
    removeImageBtn.addEventListener('click', removeUploadedImage);
    musicBtn.addEventListener('click', () => {
        const isPlaying = musicBtn.classList.contains('playing');
        if (isPlaying) {
            lofiMusic.pause();
        } else {
            lofiMusic.play().catch(error => console.error("Audio playback failed:", error));
        }
        musicBtn.classList.toggle('playing');
    });
    let mouseX = 0, mouseY = 0;
    let outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    const animateCursor = () => {
        cursorDot.style.left = `${mouseX}px`;
        cursorDot.style.top = `${mouseY}px`;
        const ease = 0.15;
        outlineX += (mouseX - outlineX) * ease;
        outlineY += (mouseY - outlineY) * ease;
        cursorOutline.style.transform = `translate(calc(${outlineX}px - 50%), calc(${outlineY}px - 50%))`;
        requestAnimationFrame(animateCursor);
    };
    requestAnimationFrame(animateCursor);
    const interactiveElements = document.querySelectorAll('a, button, textarea, input, label');
    interactiveElements.forEach(el => {
        el.addEventListener('mouseover', () => cursorOutline.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => cursorOutline.classList.remove('cursor-hover'));
    });
});

async function generateImage(recaptchaToken) {
    const prompt = promptInput.value.trim();
    const shouldBlur = !auth.currentUser && getGenerationCount() === (FREE_GENERATION_LIMIT -1);
    
    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    resultContainer.classList.remove('hidden');
    loadingIndicator.classList.remove('hidden');
    generatorUI.classList.add('hidden');
    startTimer();

    try {
        const imageUrl = await generateImageWithRetry(prompt, uploadedImageData, recaptchaToken, selectedAspectRatio);
        
        // MODIFIED: Store prompt with image URL for guests
        if (shouldBlur) { 
            lastGeneratedImage = { url: imageUrl, prompt: prompt }; 
        }
        
        displayImage(imageUrl, prompt, shouldBlur);
        
        if (auth.currentUser && !shouldBlur) {
            saveImageToLibrary(imageUrl, prompt);
        }

        incrementTotalGenerations();
        if (!auth.currentUser) { incrementGenerationCount(); }
    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        addBackButton();
        grecaptcha.reset();
    }
}

function handleAuthAction() { if (auth.currentUser) signOut(auth); else signInWithGoogle(); }
function signInWithGoogle() { signInWithPopup(auth, provider).catch(error => console.error("Authentication Error:", error)); }

function updateUIForAuthState(user) {
    if (user) {
        const welcomeText = `Welcome, ${user.displayName.split(' ')[0]}`;
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        generationCounterEl.textContent = welcomeText;
        mobileGenerationCounterEl.textContent = welcomeText;
        authModal.setAttribute('aria-hidden', 'true');
        
        libraryBtn.classList.remove('hidden');
        mobileLibraryBtn.classList.remove('hidden');
        if (unsubscribeLibrary) unsubscribeLibrary(); 
        loadUserImages();

        // MODIFIED: Correctly save the last generated image with its original prompt upon sign-in
        if (lastGeneratedImage) {
            const blurredContainer = document.querySelector('.blurred-image-container');
            if (blurredContainer) {
                const img = blurredContainer.querySelector('img');
                img.classList.remove('blurred-image');
                const overlay = blurredContainer.querySelector('.unlock-overlay');
                if (overlay) overlay.remove();
                // Use the saved prompt, not the current input value
                saveImageToLibrary(lastGeneratedImage.url, lastGeneratedImage.prompt);
            }
            lastGeneratedImage = null;
        }
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        updateGenerationCounter();
        
        libraryBtn.classList.add('hidden');
        mobileLibraryBtn.classList.add('hidden');
        showGeneratorView();
        if (unsubscribeLibrary) {
            unsubscribeLibrary();
            unsubscribeLibrary = null;
        }
    }
}

function showLibraryView() {
    mainContent.classList.add('hidden');
    otherSections.forEach(sec => sec.classList.add('hidden'));
    libraryContainer.classList.remove('hidden');
    mobileMenu.classList.add('hidden');
}

// MODIFIED: This function now properly resets the UI state
function showGeneratorView() {
    mainContent.classList.remove('hidden');
    otherSections.forEach(sec => sec.classList.remove('hidden'));
    libraryContainer.classList.add('hidden');
    
    // Reset the generator UI state for a clean slate
    generatorUI.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    promptInput.value = '';
    removeUploadedImage();
}

async function saveImageToLibrary(imageUrl, prompt) {
    if (!auth.currentUser) return;
    try {
        const userImagesCollection = collection(db, 'users', auth.currentUser.uid, 'images');
        await addDoc(userImagesCollection, {
            imageUrl: imageUrl,
            prompt: prompt,
            aspectRatio: selectedAspectRatio,
            createdAt: Timestamp.now()
        });
        console.log("Image successfully saved to library!");
    } catch (error) {
        console.error("Error saving image to library:", error);
    }
}

function loadUserImages() {
    if (!auth.currentUser) return;

    const userImagesCollection = collection(db, 'users', auth.currentUser.uid, 'images');
    const q = query(userImagesCollection);

    unsubscribeLibrary = onSnapshot(q, (querySnapshot) => {
        const images = [];
        querySnapshot.forEach((doc) => {
            images.push({ id: doc.id, ...doc.data() });
        });
        
        images.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        
        libraryGrid.innerHTML = '';
        if (images.length === 0) {
            libraryEmptyMessage.classList.remove('hidden');
        } else {
            libraryEmptyMessage.classList.add('hidden');
            images.forEach(data => {
                const imageCard = createImageCard(data);
                libraryGrid.appendChild(imageCard);
            });
        }
    }, (error) => {
        console.error("Error fetching user images:", error);
        libraryGrid.innerHTML = '';
        libraryEmptyMessage.textContent = "Could not load your library. Please try again later.";
        libraryEmptyMessage.classList.remove('hidden');
    });
}

function createImageCard(data) {
    const card = document.createElement('div');
    card.className = 'group relative fade-in-slide-up bg-gray-100 rounded-lg overflow-hidden';

    const img = document.createElement('img');
    img.src = data.imageUrl;
    img.alt = data.prompt;
    img.className = 'w-full h-full object-cover aspect-square';

    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4';

    const promptText = document.createElement('p');
    promptText.className = 'text-white text-sm font-medium line-clamp-3';
    promptText.textContent = data.prompt;

    const downloadButton = document.createElement('button');
    downloadButton.className = 'absolute top-2 right-2 bg-white/20 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white';
    downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    downloadButton.ariaLabel = "Download Image";
    downloadButton.onclick = (e) => {
        e.stopPropagation();
        const a = document.createElement('a');
        a.href = data.imageUrl;
        a.download = 'genart-image.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    overlay.appendChild(promptText);
    card.appendChild(img);
    card.appendChild(overlay);
    card.appendChild(downloadButton);

    return card;
}

function getGenerationCount() { return parseInt(localStorage.getItem('generationCount') || '0'); }
function incrementGenerationCount() {
    const newCount = getGenerationCount() + 1;
    localStorage.setItem('generationCount', newCount);
    updateGenerationCounter();
}
function updateGenerationCounter() {
    if (auth.currentUser) return;
    const count = getGenerationCount();
    const remaining = Math.max(0, FREE_GENERATION_LIMIT - count);
    const text = `${remaining} free generation${remaining !== 1 ? 's' : ''} left`;
    generationCounterEl.textContent = text;
    mobileGenerationCounterEl.textContent = text;
}
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        uploadedImageData = { mimeType: file.type, data: reader.result.split(',')[1] };
        imagePreview.src = reader.result;
        imagePreviewContainer.classList.remove('hidden');
        promptInput.placeholder = "Describe the edits you want to make...";
    };
    reader.readAsDataURL(file);
}
function removeUploadedImage() {
    uploadedImageData = null;
    imageUploadInput.value = '';
    imagePreviewContainer.classList.add('hidden');
    imagePreview.src = '';
    promptInput.placeholder = "An oil painting of a futuristic city skyline at dusk...";
}

async function generateImageWithRetry(prompt, imageData, token, aspectRatio, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, imageData, recaptchaToken: token, aspectRatio: aspectRatio })
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || `API Error: ${response.status}`);
            }

            const result = await response.json();
            
            let base64Data;
            if (imageData) {
                base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
            } else {
                base64Data = result.predictions?.[0]?.bytesBase64Encoded;
            }

            if (!base64Data) throw new Error("No image data received from API.");
            return `data:image/png;base64,${base64Data}`;

        } catch (error) {
            if (attempt >= maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}

async function incrementTotalGenerations() {
    const counterRef = doc(db, "stats", "imageGenerations");
    try { await setDoc(counterRef, { count: increment(1) }, { merge: true }); } catch (error) { console.error("Error incrementing generation count:", error); }
}
function displayImage(imageUrl, prompt, shouldBlur = false) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group fade-in-slide-up mx-auto max-w-2xl border border-gray-200/80';
    if (shouldBlur) { imgContainer.classList.add('blurred-image-container'); }
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    if (shouldBlur) { img.classList.add('blurred-image'); }
    const downloadButton = document.createElement('button');
    downloadButton.className = 'absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white';
    downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    downloadButton.ariaLabel = "Download Image";
    downloadButton.onclick = () => {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = 'genart-image.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    imgContainer.appendChild(img);
    if (!shouldBlur) { imgContainer.appendChild(downloadButton); }
    if (shouldBlur) {
        const overlay = document.createElement('div');
        overlay.className = 'unlock-overlay';
        overlay.innerHTML = `<h3 class="text-xl font-semibold">Unlock Image</h3><p class="mt-2">Sign in to unlock this image and get unlimited generations.</p><button id="unlock-btn">Sign In to Unlock</button>`;
        overlay.querySelector('#unlock-btn').onclick = () => { authModal.setAttribute('aria-hidden', 'false'); };
        imgContainer.appendChild(overlay);
    }
    imageGrid.appendChild(imgContainer);
}
function showMessage(text, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up`;
    messageEl.textContent = text;
    messageBox.innerHTML = '';
    messageBox.appendChild(messageEl);
}
function addBackButton() {
    const backButton = document.createElement('button');
    backButton.textContent = '← Create another';
    backButton.className = 'mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
    backButton.onclick = showGeneratorView;
    messageBox.prepend(backButton);
}
function startTimer() {
    let startTime = Date.now();
    const maxTime = 17 * 1000;
    progressBar.style.width = '0%';
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / maxTime, 1);
        progressBar.style.width = `${progress * 100}%`;
        timerEl.textContent = `${(elapsedTime / 1000).toFixed(1)}s / ~17s`;
        if (elapsedTime >= maxTime) {
            timerEl.textContent = `17.0s / ~17s`;
        }
    }, 100);
}
function stopTimer() {
    clearInterval(timerInterval);
    progressBar.style.width = '100%';
}
