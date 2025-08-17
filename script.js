// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// NEW: Import Firebase Storage module
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";


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
// NEW: Initialize Firebase Storage
const storage = getStorage(app);

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

// --- NEW: History and Credit Elements ---
const historySection = document.getElementById('history-section');
const historyGrid = document.getElementById('history-grid');
const creditDisplay = document.getElementById('credit-display');
const mobileCreditDisplay = document.getElementById('mobile-credit-display');

let timerInterval;
const FREE_GENERATION_LIMIT = 3;
let uploadedImageData = null;
let lastGeneratedImageUrl = null;

// --- NEW: State Management for Credits and History ---
const INITIAL_CREDITS = 25;
const GENERATION_COST = 1;
const HD_DOWNLOAD_COST = 5;
const HISTORY_LIMIT = 15; // Set a limit for the number of images in history

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
    
    // Custom cursor logic
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

// --- Auth Functions ---
function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth);
    } else {
        signInWithGoogle();
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .catch(error => console.error("Authentication Error:", error));
}

function updateUIForAuthState(user) {
    if (user) {
        // User is signed in
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        generationCounterEl.classList.add('hidden');
        mobileGenerationCounterEl.classList.add('hidden');
        authModal.setAttribute('aria-hidden', 'true');

        // NEW: Handle credits and history
        initializeCredits();
        updateCreditDisplay();
        loadAndRenderHistory();
        creditDisplay.classList.remove('hidden');
        mobileCreditDisplay.classList.remove('hidden');

        if (lastGeneratedImageUrl) {
            const blurredContainer = document.querySelector('.blurred-image-container');
            if (blurredContainer) {
                const img = blurredContainer.querySelector('img');
                img.classList.remove('blurred-image');
                const overlay = blurredContainer.querySelector('.unlock-overlay');
                if (overlay) overlay.remove();
            }
            lastGeneratedImageUrl = null;
        }
    } else {
        // User is signed out
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        updateGenerationCounter();
        generationCounterEl.classList.remove('hidden');
        mobileGenerationCounterEl.classList.remove('hidden');

        // NEW: Hide credits and history
        creditDisplay.classList.add('hidden');
        mobileCreditDisplay.classList.add('hidden');
        historySection.classList.add('hidden');
    }
}


// --- Free Generation Counter Functions ---
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

// --- NEW: Credit Management Functions ---
function getCredits() {
    if (!auth.currentUser) return 0;
    return parseInt(localStorage.getItem(`credits_${auth.currentUser.uid}`) || '0');
}

function setCredits(amount) {
    if (!auth.currentUser) return;
    localStorage.setItem(`credits_${auth.currentUser.uid}`, amount);
    updateCreditDisplay();
}

function initializeCredits() {
    if (!auth.currentUser) return;
    const creditsKey = `credits_${auth.currentUser.uid}`;
    if (localStorage.getItem(creditsKey) === null) {
        localStorage.setItem(creditsKey, INITIAL_CREDITS);
    }
}

function updateCreditDisplay() {
    if (!auth.currentUser) return;
    const credits = getCredits();
    const text = `✨ ${credits} Credits`;
    creditDisplay.textContent = text;
    mobileCreditDisplay.textContent = text;
}

// --- REBUILT: History Management with Firebase Storage ---
function getHistory() {
    if (!auth.currentUser) return [];
    const historyJson = localStorage.getItem(`history_${auth.currentUser.uid}`);
    return historyJson ? JSON.parse(historyJson) : [];
}

async function saveToHistory(base64ImageUrl) {
    if (!auth.currentUser) return;

    try {
        // 1. Upload the image to Firebase Storage
        const fileName = `${Date.now()}.png`;
        const storageRef = ref(storage, `history/${auth.currentUser.uid}/${fileName}`);
        const uploadTask = await uploadString(storageRef, base64ImageUrl, 'data_url');
        
        // 2. Get the public URL of the uploaded image
        const downloadURL = await getDownloadURL(uploadTask.ref);

        // 3. Save the *URL* (not the base64 data) to localStorage
        const history = getHistory();
        history.unshift({ url: downloadURL, prompt: promptInput.value.trim() });

        // 4. Enforce the history limit to prevent future quota issues
        const trimmedHistory = history.slice(0, HISTORY_LIMIT);
        
        localStorage.setItem(`history_${auth.currentUser.uid}`, JSON.stringify(trimmedHistory));
        
        // 5. Refresh the displayed history
        loadAndRenderHistory();

    } catch (error) {
        console.error("Error saving to history:", error);
        showMessage("Could not save image to your history.", "error");
    }
}

function loadAndRenderHistory() {
    const history = getHistory();
    historyGrid.innerHTML = '';
    if (history.length > 0) {
        historySection.classList.remove('hidden');
        history.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'relative group rounded-lg overflow-hidden history-item';
            
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = item.prompt;
            img.className = 'w-full h-full object-cover';
            img.crossOrigin = "anonymous"; // Needed to allow canvas to process the image for watermarking
            
            const overlay = document.createElement('div');
            overlay.className = 'absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2';

            const sdButton = document.createElement('button');
            sdButton.innerHTML = `SD <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
            sdButton.className = 'download-btn-small bg-blue-500 hover:bg-blue-600';
            sdButton.onclick = () => downloadImage(item.url, 'sd');

            const hdButton = document.createElement('button');
            hdButton.innerHTML = `HD (${HD_DOWNLOAD_COST} ✨) <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
            hdButton.className = 'download-btn-small bg-purple-500 hover:bg-purple-600 mt-2';
            hdButton.onclick = () => downloadImage(item.url, 'hd');
            
            overlay.appendChild(sdButton);
            overlay.appendChild(hdButton);
            historyItem.appendChild(img);
            historyItem.appendChild(overlay);
            historyGrid.appendChild(historyItem);
        });
    } else {
        historySection.classList.add('hidden');
    }
}


// --- Image Handling ---
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

    if (auth.currentUser) {
        const credits = getCredits();
        if (credits < GENERATION_COST) {
            showMessage(`You need at least ${GENERATION_COST} credit to generate an image.`, 'error');
            return;
        }
    } else {
        const count = getGenerationCount();
        if (count >= FREE_GENERATION_LIMIT) {
            authModal.setAttribute('aria-hidden', 'false');
            return;
        }
    }

    const shouldBlur = !auth.currentUser && getGenerationCount() === (FREE_GENERATION_LIMIT - 1);

    // UI Reset
    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    resultContainer.classList.remove('hidden');
    loadingIndicator.classList.remove('hidden');
    generatorUI.classList.add('hidden');
    
    startTimer();

    try {
        const imageUrl = await generateImageWithRetry(prompt, uploadedImageData);
        
        if (auth.currentUser) {
            const currentCredits = getCredits();
            setCredits(currentCredits - GENERATION_COST);
            // The saveToHistory function now handles uploading and saving the URL
            await saveToHistory(imageUrl); 
        } else {
            incrementGenerationCount();
            if (shouldBlur) {
                lastGeneratedImageUrl = imageUrl;
            }
        }
        
        displayImage(imageUrl, prompt, shouldBlur);
        incrementTotalGenerations();

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
                payload = { 
                    instances: [{ prompt: prompt }], 
                    parameters: { "sampleCount": 1 } 
                };
            }

            const response = await fetch(apiUrl, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload) 
            });

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
            console.warn(`Attempt ${attempt + 1} failed: ${error.message}`);
            if (attempt >= maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}


// --- Live Counter ---
async function incrementTotalGenerations() {
    const counterRef = doc(db, "stats", "imageGenerations");
    try {
        await setDoc(counterRef, { count: increment(1) }, { merge: true });
    } catch (error) {
        console.error("Error incrementing generation count:", error);
    }
}


// --- UI Helper Functions ---
function displayImage(imageUrl, prompt, shouldBlur = false) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group fade-in-slide-up mx-auto max-w-2xl border border-gray-200/80';
    
    if (shouldBlur) imgContainer.classList.add('blurred-image-container');

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    if (shouldBlur) img.classList.add('blurred-image');
    
    imgContainer.appendChild(img);

    if (!shouldBlur) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'absolute top-4 right-4 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300';

        const sdButton = document.createElement('button');
        sdButton.innerHTML = `Download SD <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        sdButton.className = 'download-btn bg-blue-500 hover:bg-blue-600';
        sdButton.onclick = () => downloadImage(imageUrl, 'sd');
        
        const hdButton = document.createElement('button');
        hdButton.innerHTML = `Download HD (${HD_DOWNLOAD_COST} ✨) <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        hdButton.className = 'download-btn bg-purple-500 hover:bg-purple-600';
        hdButton.onclick = () => downloadImage(imageUrl, 'hd');

        buttonContainer.appendChild(sdButton);
        if (auth.currentUser) buttonContainer.appendChild(hdButton);
        
        imgContainer.appendChild(buttonContainer);
    }
    
    if (shouldBlur) {
        const overlay = document.createElement('div');
        overlay.className = 'unlock-overlay';
        overlay.innerHTML = `
            <h3 class="text-xl font-semibold">Unlock Image</h3>
            <p class="mt-2">Sign in to unlock this image and get unlimited generations.</p>
            <button id="unlock-btn">Sign In to Unlock</button>
        `;
        overlay.querySelector('#unlock-btn').onclick = () => {
            authModal.setAttribute('aria-hidden', 'false');
        };
        imgContainer.appendChild(overlay);
    }

    imageGrid.appendChild(imgContainer);
}

async function downloadImage(imageUrl, quality) {
    let finalImageUrl = imageUrl;
    let fileName = `genart-image-${quality}.png`;

    if (quality === 'hd') {
        if (!auth.currentUser) {
            showMessage('Please sign in to download in HD.', 'error');
            return;
        }
        const credits = getCredits();
        if (credits < HD_DOWNLOAD_COST) {
            showMessage(`Not enough credits for HD download. You need ${HD_DOWNLOAD_COST} credits.`, 'error');
            return;
        }
        setCredits(credits - HD_DOWNLOAD_COST);
    } else { // 'sd' quality
        try {
            finalImageUrl = await applyWatermark(imageUrl);
        } catch (error) {
            console.error('Failed to apply watermark:', error);
            showMessage('Could not apply watermark. Downloading original image.', 'error');
        }
    }
    
    const a = document.createElement('a');
    a.href = finalImageUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function applyWatermark(imageUrl) {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = 'Anonymous'; 
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const watermarkText = 'GenArt';
            ctx.font = `bold ${img.width / 20}px Arial`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(watermarkText, canvas.width / 2, canvas.height / 2);
            resolve(canvas.toDataURL('image/png'));
        };

        img.onerror = (err) => {
            reject(err);
        };

        img.src = imageUrl;
    });
}


function showMessage(text, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `p-3 rounded-lg ${type === 'error' ? 'text-red-700 bg-red-100' : 'text-gray-700 bg-gray-100'} fade-in-slide-up font-medium`;
    messageEl.textContent = text;
    messageBox.innerHTML = ''; 
    messageBox.appendChild(messageEl);
}

function addBackButton() {
    const backButton = document.createElement('button');
    backButton.textContent = '← Create another';
    backButton.className = 'mt-6 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
    backButton.onclick = () => {
        generatorUI.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        imageGrid.innerHTML = '';
        messageBox.innerHTML = '';
        promptInput.value = '';
        removeUploadedImage();
        loadAndRenderHistory(); // Refresh history view
    };
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
