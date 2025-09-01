// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
const authModalTitle = document.getElementById('auth-modal-title');
const authModalMessage = document.getElementById('auth-modal-message');
const authModalActionBtn = document.getElementById('auth-modal-action-btn');
const authModalActionBtnText = document.getElementById('auth-modal-action-btn-text');
const closeModalBtn = document.getElementById('close-modal-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const musicBtn = document.getElementById('music-btn');
const lofiMusic = document.getElementById('lofi-music');
const cursorDot = document.querySelector('.cursor-dot');
const cursorOutline = document.querySelector('.cursor-outline');
const aspectRatioBtns = document.querySelectorAll('.aspect-ratio-btn');
const copyPromptBtn = document.getElementById('copy-prompt-btn');
const enhancePromptBtn = document.getElementById('enhance-prompt-btn');

let timerInterval;
let uploadedImageData = null;
let selectedAspectRatio = '1:1';
let currentUserData = null;
let isGenerating = false;
let userListener = null; // To hold the Firestore listener unsubscribe function

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (userListener) {
            userListener(); // Unsubscribe from old listener
        }
        if (user) {
            const userRef = doc(db, "users", user.uid);
            
            // Set up a real-time listener for user data
            userListener = onSnapshot(userRef, async (docSnap) => {
                if (!docSnap.exists()) {
                    // First-time sign-in, create user document
                    const newUser = {
                        email: user.email,
                        displayName: user.displayName,
                        credits: 5,
                        createdAt: serverTimestamp()
                    };
                    await setDoc(userRef, newUser);
                    currentUserData = newUser;
                } else {
                    // User data exists, update local state
                    currentUserData = docSnap.data();
                }
                updateUIForAuthState(user, currentUserData);
            });
        } else {
            // User is signed out
            currentUserData = null;
            updateUIForAuthState(null, null);
        }
    });

    mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    document.addEventListener('click', (event) => {
        if (!mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
            mobileMenu.classList.add('hidden');
        }
    });
    authBtn.addEventListener('click', handleAuthAction);
    mobileAuthBtn.addEventListener('click', handleAuthAction);
    closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));
    examplePrompts.forEach(button => {
        button.addEventListener('click', () => {
            promptInput.value = button.innerText.trim();
            promptInput.focus();
        });
    });
    
    generateBtn.addEventListener('click', () => {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            showMessage('Please describe what you want to create.', 'error');
            return;
        }
        if (isGenerating) return;

        if (!auth.currentUser) {
            // Not signed in: show sign-in modal
            showSignInModal();
            return;
        }

        if (currentUserData && currentUserData.credits > 0) {
            // Signed in with credits: generate image
            generateImage();
        } else {
            // Signed in, no credits: show buy plan modal
            showOutOfCreditsModal();
        }
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

    copyPromptBtn.addEventListener('click', copyPrompt);
    enhancePromptBtn.addEventListener('click', handleEnhancePrompt);

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

function showSignInModal() {
    authModalTitle.textContent = 'Sign In For Free Credits';
    authModalMessage.textContent = 'Please sign in with Google to get 5 free credits and start generating images.';
    authModalActionBtnText.textContent = 'Sign In with Google';
    authModalActionBtn.onclick = signInWithGoogle;
    authModalActionBtn.querySelector('svg').style.display = 'block';
    authModal.setAttribute('aria-hidden', 'false');
}

function showOutOfCreditsModal() {
    authModalTitle.textContent = 'You’ve Used All Your Free Credits';
    authModalMessage.textContent = 'Please buy a plan to continue generating images.';
    authModalActionBtnText.textContent = 'Buy a Plan';
    authModalActionBtn.onclick = () => { window.location.href = 'pricing.html'; };
    authModalActionBtn.querySelector('svg').style.display = 'none';
    authModal.setAttribute('aria-hidden', 'false');
}

async function generateImage() {
    isGenerating = true;
    const prompt = promptInput.value.trim();
    
    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    resultContainer.classList.remove('hidden');
    loadingIndicator.classList.remove('hidden');
    generatorUI.classList.add('hidden');
    startTimer();

    try {
        const imageUrl = await generateImageWithRetry(prompt, uploadedImageData, null, selectedAspectRatio);
        await deductCredit(auth.currentUser.uid);
        displayImage(imageUrl, prompt);
    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        addBackButton();
        isGenerating = false;
    }
}

async function deductCredit(userId) {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
        credits: increment(-1)
    });
}

function copyPrompt() {
    const promptText = promptInput.value;
    if (!promptText) {
        showMessage('There is no prompt to copy.', 'info');
        return;
    }
    navigator.clipboard.writeText(promptText).then(() => {
        showMessage('Prompt copied to clipboard!', 'info');
        const originalIcon = copyPromptBtn.innerHTML;
        copyPromptBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        setTimeout(() => {
            copyPromptBtn.innerHTML = originalIcon;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showMessage('Failed to copy prompt.', 'error');
    });
}

async function handleEnhancePrompt() {
    const promptText = promptInput.value.trim();
    if (!promptText) {
        showMessage('Please enter a prompt to enhance.', 'info');
        return;
    }

    const originalIcon = enhancePromptBtn.innerHTML;
    const spinner = `<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
    enhancePromptBtn.innerHTML = spinner;
    enhancePromptBtn.disabled = true;

    try {
        const enhancedPrompt = await callApiToEnhance(promptText);
        promptInput.value = enhancedPrompt;
        promptInput.style.height = 'auto';
        promptInput.style.height = (promptInput.scrollHeight) + 'px';
    } catch (error) {
        console.error('Failed to enhance prompt:', error);
        showMessage('Sorry, the prompt could not be enhanced right now.', 'error');
    } finally {
        enhancePromptBtn.innerHTML = originalIcon;
        enhancePromptBtn.disabled = false;
    }
}

async function callApiToEnhance(prompt, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch('/api/enhance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.error || `API Error: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.text) {
                return result.text;
            } else {
                throw new Error("Unexpected response structure from enhancement API.");
            }
        } catch (error) {
            console.error(`Enhancement attempt ${attempt + 1} failed:`, error);
            if (attempt >= maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}


function handleAuthAction() { if (auth.currentUser) signOut(auth); else signInWithGoogle(); }

function signInWithGoogle() { 
    signInWithPopup(auth, provider)
      .then(() => authModal.setAttribute('aria-hidden', 'true'))
      .catch(error => console.error("Authentication Error:", error));
}

function updateUIForAuthState(user, userData) {
    if (user && userData) {
        const creditText = `${userData.credits} credit${userData.credits !== 1 ? 's' : ''} left`;
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        generationCounterEl.textContent = creditText;
        mobileGenerationCounterEl.textContent = creditText;
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        generationCounterEl.textContent = '';
        mobileGenerationCounterEl.textContent = '';
    }
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
                body: JSON.stringify({ prompt, imageData, aspectRatio: aspectRatio })
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
    messageEl.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up`;
    messageEl.textContent = text;
    messageBox.innerHTML = '';
    messageBox.appendChild(messageEl);
    setTimeout(() => {
        if(messageBox.contains(messageEl)) {
            messageBox.removeChild(messageEl);
        }
    }, 4000);
}
function addBackButton() {
    if (document.getElementById('back-to-generator-btn')) return;

    const backButton = document.createElement('button');
    backButton.id = 'back-to-generator-btn';
    backButton.textContent = '← Create another';
    backButton.className = 'mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
    backButton.onclick = () => {
        generatorUI.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        imageGrid.innerHTML = '';
        messageBox.innerHTML = '';
        promptInput.value = '';
        removeUploadedImage();
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

