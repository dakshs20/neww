// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

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
const provider = new GoogleAuthProvider();

// --- DOM Element References ---
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

// Auth Buttons & Counters
const authBtn = document.getElementById('auth-btn');
const mobileAuthBtn = document.getElementById('mobile-auth-btn');
const generationCounterEl = document.getElementById('generation-counter');
const mobileGenerationCounterEl = document.getElementById('mobile-generation-counter');

// Modal
const authModal = document.getElementById('auth-modal');
const googleSignInBtn = document.getElementById('google-signin-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

// Mobile Menu
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');

// --- REBUILT Music Player ---
const musicBtn = document.getElementById('music-btn');
const lofiMusic = document.getElementById('lofi-music');

// --- REBUILT Custom Cursor ---
const cursorDot = document.querySelector('.cursor-dot');
const cursorOutline = document.querySelector('.cursor-outline');

// --- NEW AI Avatar ---
const avatarUploadInput = document.getElementById('avatar-upload-input');
const avatarUploadArea = document.getElementById('avatar-upload-area');
const avatarPreview = document.getElementById('avatar-preview');
const avatarUploadPrompt = document.getElementById('avatar-upload-prompt');
const generateAvatarBtn = document.getElementById('generate-avatar-btn');
const avatarResultContainer = document.getElementById('avatar-result-container');
const avatarLoading = document.getElementById('avatar-loading');
const avatarResultImage = document.getElementById('avatar-result-image');
const avatarDownloadBtn = document.getElementById('avatar-download-btn');
const avatarPlaceholder = document.getElementById('avatar-placeholder');
let avatarImageData = null;

let timerInterval;
const FREE_GENERATION_LIMIT = 3;
let uploadedImageData = null; // To store the base64 image data

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, user => {
        updateUIForAuthState(user);
    });

    // --- Event Listeners ---
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

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generateImage();
        }
    });

    generateBtn.addEventListener('click', generateImage);

    // --- Image Upload Listeners ---
    imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
    imageUploadInput.addEventListener('change', handleImageUpload);
    removeImageBtn.addEventListener('click', removeUploadedImage);

    // --- CORRECTED Music Player Listener ---
    musicBtn.addEventListener('click', () => {
        const isPlaying = musicBtn.classList.contains('playing');
        if (isPlaying) {
            lofiMusic.pause();
        } else {
            lofiMusic.play().catch(error => console.error("Audio playback failed:", error));
        }
        musicBtn.classList.toggle('playing');
    });

    // --- REBUILT Custom Cursor Logic ---
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

    // --- NEW AI Avatar Listeners ---
    avatarUploadInput.addEventListener('change', handleAvatarUpload);
    generateAvatarBtn.addEventListener('click', generateAvatar);
    avatarDownloadBtn.addEventListener('click', downloadAvatar);
});

// --- Auth Functions ---
function handleAuthAction() {
    if (auth.currentUser) signOut(auth);
    else signInWithGoogle();
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .then(result => updateUIForAuthState(result.user))
        .catch(error => console.error("Authentication Error:", error));
}

function updateUIForAuthState(user) {
    if (user) {
        const welcomeText = `Welcome, ${user.displayName.split(' ')[0]}`;
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        generationCounterEl.textContent = welcomeText;
        mobileGenerationCounterEl.textContent = welcomeText;
        authModal.setAttribute('aria-hidden', 'true');
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        updateGenerationCounter();
    }
}

// --- Generation Counter Functions ---
function getGenerationCount() {
    return parseInt(localStorage.getItem('generationCount') || '0');
}

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

// --- Image Handling Functions ---
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onloadend = () => {
        uploadedImageData = {
            mimeType: file.type,
            data: reader.result.split(',')[1]
        };
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

// --- Core Image Generation Logic ---
async function generateImage() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showMessage('Please describe what you want to create or edit.', 'error');
        return;
    }

    if (!auth.currentUser && getGenerationCount() >= FREE_GENERATION_LIMIT) {
        authModal.setAttribute('aria-hidden', 'false');
        return;
    }

    // UI Reset
    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    resultContainer.classList.remove('hidden');
    loadingIndicator.classList.remove('hidden');
    generatorUI.classList.add('hidden');
    
    startTimer();

    try {
        const imageUrl = await generateImageWithRetry(prompt, uploadedImageData);
        displayImage(imageUrl, prompt);
        if (!auth.currentUser) {
            incrementGenerationCount();
        }
    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        addBackButton();
    }
}

async function generateImageWithRetry(prompt, imageData, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            let apiUrl, payload;
            const apiKey = "AIzaSyBZxXWl9s2AeSCzMrfoEfnYWpGyfvP7jqs";

            if (imageData) {
                apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`;
                payload = {
                    "contents": [{
                        "parts": [
                            { "text": prompt },
                            { "inlineData": { "mimeType": imageData.mimeType, "data": imageData.data } }
                        ]
                    }],
                    "generationConfig": { "responseModalities": ["IMAGE", "TEXT"] }
                };
            } else {
                apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
                payload = { instances: [{ prompt }], parameters: { "sampleCount": 1 } };
            }

            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorText}`);
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

// --- NEW Avatar Functions ---
function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onloadend = () => {
        avatarImageData = {
            mimeType: file.type,
            data: reader.result.split(',')[1]
        };
        avatarPreview.src = reader.result;
        avatarPreview.classList.remove('hidden');
        avatarUploadPrompt.classList.add('hidden');
        generateAvatarBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

async function generateAvatar() {
    if (!avatarImageData) {
        alert("Please upload an image first.");
        return;
    }
    if (!auth.currentUser && getGenerationCount() >= FREE_GENERATION_LIMIT) {
        authModal.setAttribute('aria-hidden', 'false');
        return;
    }

    // Reset UI
    avatarLoading.classList.remove('hidden');
    avatarResultImage.classList.add('hidden');
    avatarDownloadBtn.classList.add('hidden');
    avatarPlaceholder.classList.add('hidden');
    generateAvatarBtn.disabled = true;

    try {
        // --- IMPROVED PROMPT ---
        const prompt = "Create a high-quality, artistic digital painting of the person in the image. Preserve their facial features and likeness, but render it in a smooth, modern, stylized avatar aesthetic. The background should be simple and complementary.";
        const imageUrl = await generateImageWithRetry(prompt, avatarImageData);
        
        avatarResultImage.src = imageUrl;
        avatarResultImage.classList.remove('hidden');
        avatarResultImage.classList.add('reveal'); // Add class for animation
        avatarDownloadBtn.classList.remove('hidden');
        
        if (!auth.currentUser) {
            incrementGenerationCount();
        }
    } catch (error) {
        console.error("Avatar generation failed:", error);
        avatarPlaceholder.textContent = "Sorry, couldn't create avatar.";
        avatarPlaceholder.classList.remove('hidden');
    } finally {
        avatarLoading.classList.add('hidden');
        generateAvatarBtn.disabled = false;
    }
}

function downloadAvatar() {
    const a = document.createElement('a');
    a.href = avatarResultImage.src;
    a.download = 'genart-avatar.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}


// --- Helper Functions ---
function displayImage(imageUrl, prompt) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group fade-in-slide-up mx-auto max-w-2xl border border-gray-200/80';
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
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
    imgContainer.appendChild(downloadButton);
    imageGrid.appendChild(imgContainer);
}

function showMessage(text, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `p-2 rounded-lg ${type === 'error' ? 'text-red-600' : 'text-gray-600'} fade-in-slide-up`;
    messageEl.textContent = text;
    messageBox.innerHTML = ''; 
    messageBox.appendChild(messageEl);
}

function addBackButton() {
    const backButton = document.createElement('button');
    backButton.textContent = '← Create another';
    backButton.className = 'mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
    backButton.onclick = () => {
        generatorUI.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        imageGrid.innerHTML = '';
        messageBox.innerHTML = '';
        promptInput.value = '';
        removeUploadedImage(); // Also clear the image when going back
    };
    messageBox.prepend(backButton);
}

function startTimer() {
    let startTime = Date.now();
    // **UPDATED TIMER DURATION**
    const maxTime = 17 * 1000; 
    progressBar.style.width = '0%';
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min(elapsedTime / maxTime, 1);
        progressBar.style.width = `${progress * 100}%`;
        // **UPDATED TIMER TEXT**
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
