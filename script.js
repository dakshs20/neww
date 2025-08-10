// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const mainGeneratorPage = document.getElementById('main-generator-page');
const myMediaPage = document.getElementById('my-media-page');
const homeLink = document.getElementById('home-link');
const myMediaBtn = document.getElementById('my-media-btn');
const mobileMyMediaBtn = document.getElementById('mobile-my-media-btn');

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

// --- My Media Page ---
const mediaGrid = document.getElementById('media-grid');
const mediaPlaceholder = document.getElementById('media-placeholder');
const mediaGridLoader = document.getElementById('media-grid-loader');

let timerInterval;
const FREE_GENERATION_LIMIT = 3;
let uploadedImageData = null; // To store the base64 image data
let unsubscribeHistory = null; // To stop listening to Firestore changes on logout

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

    // --- Page Navigation ---
    homeLink.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('main');
    });
    myMediaBtn.addEventListener('click', () => navigateTo('media'));
    mobileMyMediaBtn.addEventListener('click', () => navigateTo('media'));
});

// --- Page Navigation Function ---
function navigateTo(page) {
    if (page === 'main') {
        mainGeneratorPage.classList.remove('hidden');
        myMediaPage.classList.add('hidden');
    } else if (page === 'media') {
        mainGeneratorPage.classList.add('hidden');
        myMediaPage.classList.remove('hidden');
    }
}

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
        myMediaBtn.classList.remove('hidden');
        mobileMyMediaBtn.classList.remove('hidden');
        fetchUserMedia(user.uid);
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        updateGenerationCounter();
        myMediaBtn.classList.add('hidden');
        mobileMyMediaBtn.classList.add('hidden');
        if (unsubscribeHistory) unsubscribeHistory(); // Stop listening to old user's data
        mediaGrid.innerHTML = '';
        navigateTo('main'); // Go back to main page on logout
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

// --- My Media Functions ---
function fetchUserMedia(userId) {
    const q = query(collection(db, "users", userId, "images"), orderBy("createdAt", "desc"));
    
    unsubscribeHistory = onSnapshot(q, (querySnapshot) => {
        const images = [];
        querySnapshot.forEach((doc) => {
            images.push({ id: doc.id, ...doc.data() });
        });
        displayMedia(images);
    });
}

function displayMedia(images) {
    mediaGridLoader.classList.add('hidden');
    mediaGrid.innerHTML = '';
    if (images.length === 0) {
        mediaPlaceholder.classList.remove('hidden');
    } else {
        mediaPlaceholder.classList.add('hidden');
        images.forEach(image => {
            const item = document.createElement('div');
            item.className = 'grid-item';
            item.innerHTML = `
                <img src="${image.imageUrl}" alt="${image.prompt}" loading="lazy">
                <div class="grid-item-overlay">
                    <p class="grid-item-prompt">${image.prompt}</p>
                    <div class="grid-item-actions">
                        <button class="download-btn" title="Download"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>
                        <button class="delete-btn" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                    </div>
                </div>
            `;
            item.querySelector('.download-btn').addEventListener('click', () => downloadImage(image.imageUrl, image.prompt));
            item.querySelector('.delete-btn').addEventListener('click', () => deleteImage(image.id));
            mediaGrid.appendChild(item);
        });
    }
}

async function saveImageToHistory(prompt, imageUrl) {
    const user = auth.currentUser;
    if (!user) {
        authModal.setAttribute('aria-hidden', 'false');
        return;
    }
    try {
        await addDoc(collection(db, "users", user.uid, "images"), {
            prompt: prompt,
            imageUrl: imageUrl,
            createdAt: serverTimestamp()
        });
        // Visual feedback
        const saveBtn = document.querySelector('.save-btn-temp');
        if(saveBtn) {
            saveBtn.innerHTML = 'Saved!';
            saveBtn.disabled = true;
        }
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("Could not save image. It might be too large.");
    }
}

async function deleteImage(imageId) {
    const user = auth.currentUser;
    if (!user) return;
    if (confirm("Are you sure you want to delete this image?")) {
        try {
            await deleteDoc(doc(db, "users", user.uid, "images", imageId));
        } catch (e) {
            console.error("Error deleting document: ", e);
        }
    }
}

function downloadImage(imageUrl, prompt) {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `${prompt.slice(0, 20).replace(/\s+/g, '_')}.png`;
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
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300';

    const saveButton = document.createElement('button');
    saveButton.className = 'bg-black/50 text-white p-2 rounded-full save-btn-temp';
    saveButton.title = "Save to My Media";
    saveButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`;
    saveButton.onclick = () => saveImageToHistory(prompt, imageUrl);

    const downloadButton = document.createElement('button');
    downloadButton.className = 'bg-black/50 text-white p-2 rounded-full';
    downloadButton.title = "Download Image";
    downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
    downloadButton.onclick = () => downloadImage(imageUrl, prompt);

    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(downloadButton);
    
    imgContainer.appendChild(img);
    imgContainer.appendChild(buttonContainer);
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
