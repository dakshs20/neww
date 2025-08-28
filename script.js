// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Google Drive API Configuration (for pro-generator.html) ---
const GOOGLE_API_KEY = "AIzaSyAypNULLr5wkLATw1V3qA-I5NwcnGIc0v8"; 
const GOOGLE_CLIENT_ID = "673422771881-dkts1iissdsbev5mi1nvbp90nvdo2mvh.apps.googleusercontent.com"; 
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

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
const authPromptContainer = document.getElementById('auth-prompt-container');
const mainSigninBtn = document.getElementById('main-signin-btn');
const generatorUI = document.getElementById('generator-ui');
const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');
const resultContainer = document.getElementById('result-container');
const loadingIndicator = document.getElementById('loading-indicator');
const imageGrid = document.getElementById('image-grid');
const timerEl = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const messageBox = document.getElementById('message-box');
const examplePrompts = document.querySelectorAll('.example-prompt');
const imageUploadBtn = document.getElementById('image-upload-btn');
const imageUploadInput = document.getElementById('image-upload-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');
const authBtn = document.getElementById('auth-btn');
const mobileAuthBtn = document.getElementById('mobile-auth-btn');
const creditCounterEl = document.getElementById('credit-counter');
const mobileCreditCounterEl = document.getElementById('mobile-credit-counter');
const authModal = document.getElementById('auth-modal');
const googleSignInBtn = document.getElementById('google-signin-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const musicBtn = document.getElementById('music-btn');
const lofiMusic = document.getElementById('lofi-music');
const aspectRatioBtns = document.querySelectorAll('.aspect-ratio-btn');
const copyPromptBtn = document.getElementById('copy-prompt-btn');
const enhancePromptBtn = document.getElementById('enhance-prompt-btn');
const getStartedBtn = document.getElementById('get-started-btn');
const emailModal = document.getElementById('email-modal');
const emailForm = document.getElementById('email-form');
const emailInput = document.getElementById('business-email-input');
const emailErrorMsg = document.getElementById('email-error-msg');
const closeEmailModalBtn = document.getElementById('close-email-modal-btn');
const brandingSettingsBtn = document.getElementById('branding-settings-btn');
const driveConnectBtn = document.getElementById('drive-connect-btn');
const mobileDriveConnectBtn = document.getElementById('mobile-drive-connect-btn');
const variantsBtn = document.getElementById('variants-btn');

// --- Global State ---
let timerInterval;
const INITIAL_CREDITS = 5;
let currentUserCredits = 0;
let uploadedImageData = null;
let lastGeneratedBlob = null;
let currentImageUrlToSave = null;
let selectedAspectRatio = '1:1';
let brandingSettings = {};
let currentUploadOptions = {};

// --- Main App Logic ---
document.addEventListener('DOMContentLoaded', () => {
    initializeCursor();
    
    onAuthStateChanged(auth, user => {
        if (user) {
            handleUserLogin(user);
        } else {
            handleUserLogout();
        }
    });

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    document.addEventListener('click', (event) => {
        if (mobileMenu && !mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
            mobileMenu.classList.add('hidden');
        }
    });

    if (authBtn) authBtn.addEventListener('click', handleAuthAction);
    if (mobileAuthBtn) mobileAuthBtn.addEventListener('click', handleAuthAction);
    if (googleSignInBtn) googleSignInBtn.addEventListener('click', signInWithGoogle);
    if (mainSigninBtn) mainSigninBtn.addEventListener('click', signInWithGoogle);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => authModal.classList.add('hidden'));
    if (musicBtn) musicBtn.addEventListener('click', toggleMusic);

    if (generatorUI) {
        if (generateBtn) generateBtn.addEventListener('click', handleGenerateClick);
        if (variantsBtn) variantsBtn.addEventListener('click', generateVariants);
        if (promptInput) promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generateBtn.click(); }
        });
        if (examplePrompts) examplePrompts.forEach(b => b.addEventListener('click', () => { promptInput.value = b.innerText.trim(); promptInput.focus(); }));
        if (aspectRatioBtns) aspectRatioBtns.forEach(btn => btn.addEventListener('click', () => {
            aspectRatioBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAspectRatio = btn.dataset.ratio;
        }));
        if (copyPromptBtn) copyPromptBtn.addEventListener('click', copyPrompt);
        if (enhancePromptBtn) enhancePromptBtn.addEventListener('click', handleEnhancePrompt);
        if (imageUploadBtn) imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
        if (imageUploadInput) imageUploadInput.addEventListener('change', handleImageUpload);
        if (removeImageBtn) removeImageBtn.addEventListener('click', removeUploadedImage);
    }
    
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            emailModal.classList.remove('hidden');
        });
        closeEmailModalBtn.addEventListener('click', () => {
            emailModal.classList.add('hidden');
        });
        emailForm.addEventListener('submit', handleEmailSubmit);
    }

    if (brandingSettingsBtn) {
        initializeProGeneratorPage();
    }
});

// --- Authentication and User Handling ---

async function handleUserLogin(user) {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
        currentUserCredits = userDoc.data().generationCredits;
    } else {
        // First time sign-in, create user document
        await setDoc(userRef, {
            email: user.email,
            displayName: user.displayName,
            createdAt: new Date(),
            generationCredits: INITIAL_CREDITS
        });
        currentUserCredits = INITIAL_CREDITS;
    }
    updateUICredits();

    authBtn.textContent = 'Sign Out';
    mobileAuthBtn.textContent = 'Sign Out';
    authModal.classList.add('hidden');
    
    if (authPromptContainer) authPromptContainer.classList.add('hidden');
    if (generatorUI) generatorUI.classList.remove('hidden');
}

function handleUserLogout() {
    currentUserCredits = 0;
    authBtn.textContent = 'Sign In';
    mobileAuthBtn.textContent = 'Sign In';
    creditCounterEl.textContent = '';
    mobileCreditCounterEl.textContent = '';

    if (authPromptContainer) authPromptContainer.classList.remove('hidden');
    if (generatorUI) generatorUI.classList.add('hidden');
    if (resultContainer) resultContainer.classList.add('hidden'); // Hide results on logout
}

function handleAuthAction() {
    if (auth.currentUser) {
        signOut(auth).catch(error => console.error("Sign Out Error:", error));
    } else {
        signInWithGoogle();
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .catch(error => console.error("Authentication Error:", error));
}


function updateUICredits() {
    const text = `${currentUserCredits} credit${currentUserCredits !== 1 ? 's' : ''} left`;
    if (creditCounterEl) creditCounterEl.textContent = text;
    if (mobileCreditCounterEl) mobileCreditCounterEl.textContent = text;
}


// --- Image Generation Logic ---

async function handleGenerateClick() {
    if (!auth.currentUser) {
        authModal.classList.remove('hidden');
        return;
    }

    if (currentUserCredits <= 0) {
        showMessage("You're out of credits! Please upgrade to continue generating.", 'error');
        // In the future, you would redirect to a pricing page here.
        return;
    }
    
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showMessage('Please describe what you want to create or edit.', 'error');
        return;
    }

    await generateImage();

    // Deduct credit after successful generation attempt
    const userRef = doc(db, "users", auth.currentUser.uid);
    await updateDoc(userRef, {
        generationCredits: increment(-1)
    });
    currentUserCredits--;
    updateUICredits();
}

async function generateImage() {
    const prompt = promptInput.value.trim();
    
    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    resultContainer.classList.remove('hidden');
    loadingIndicator.classList.remove('hidden');
    generatorUI.classList.add('hidden');
    startTimer();

    try {
        const imageUrl = await generateImageWithRetry(prompt, uploadedImageData, selectedAspectRatio);
        const response = await fetch(imageUrl);
        lastGeneratedBlob = await response.blob();
        currentImageUrlToSave = imageUrl;
        
        imageGrid.classList.remove('md:grid-cols-3');
        imageGrid.classList.add('md:grid-cols-1');

        displayImage(imageUrl, prompt);
        
    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        addBackButton();
    }
}

async function generateImageWithRetry(prompt, imageData, aspectRatio, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // NOTE: This fetch call points to a serverless function.
            // You would need to deploy the `generate.js` file to a service like
            // Vercel, Netlify, or Google Cloud Functions.
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, imageData, aspectRatio })
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
            console.error(`Generation attempt ${attempt + 1} failed:`, error);
            if (attempt >= maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
}


function displayImage(imageUrl, prompt, isVariant = false) {
    const cardWrapper = document.createElement('div');
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group border border-gray-200/80';

    if (!isVariant) {
        cardWrapper.className = 'mx-auto max-w-2xl fade-in-slide-up';
    } else {
        cardWrapper.className = 'variant-image-container fade-in-slide-up';
        imgContainer.classList.add('h-full');
    }

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    if (isVariant) img.classList.add('h-full', 'object-cover');

    const buttonContainer = document.createElement('div');
    const downloadButton = createActionButton('download', 'Download Original', () => {
        const a = document.createElement('a'); a.href = imageUrl; a.download = `GenArt_Original_${Date.now()}.png`; a.click();
    });
    
    let proButtons = [];
    if (brandingSettingsBtn) { // This checks if we are on the pro page
        if (brandingSettings.enabled && brandingSettings.logo) {
            proButtons.push(createActionButton('brand', 'Export with Branding', () => applyWatermarkAndDownload(imageUrl)));
        }
        proButtons.push(createActionButton('drive', 'Save to Drive', () => showDriveOptions(imageUrl)));
    }

    if (selectedAspectRatio === '16:9') {
        buttonContainer.className = 'flex items-center justify-center gap-3 mt-4';
        imgContainer.appendChild(img);
        cardWrapper.appendChild(imgContainer);
        buttonContainer.appendChild(downloadButton);
        proButtons.forEach(btn => buttonContainer.appendChild(btn));
        cardWrapper.appendChild(buttonContainer);
    } else {
        buttonContainer.className = 'absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300';
        buttonContainer.appendChild(downloadButton);
        proButtons.forEach(btn => buttonContainer.appendChild(btn));
        imgContainer.appendChild(img);
        imgContainer.appendChild(buttonContainer);
        cardWrapper.appendChild(imgContainer);
    }
    
    if (!isVariant) imageGrid.innerHTML = '';
    imageGrid.appendChild(cardWrapper);
}


// --- Helper & UI Functions ---

function createActionButton(type, title, onClick) {
    const button = document.createElement('button');
    button.className = 'bg-black/50 text-white p-2 rounded-full hover:bg-black/75 transition-colors flex items-center justify-center w-10 h-10';
    button.title = title;
    button.onclick = onClick;
    
    const icons = {
        download: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
        brand: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/><path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>`,
        drive: `<img src="https://iili.io/K25gUKl.md.png" alt="Save to Drive" class="w-5 h-5">`
    };
    
    button.innerHTML = icons[type] || '';
    return button;
}

function initializeCursor() {
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');
    if (!cursorDot || !cursorOutline) return;
    let mouseX = 0, mouseY = 0, outlineX = 0, outlineY = 0;
    window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
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
    document.querySelectorAll('a, button, textarea, input, label').forEach(el => {
        el.addEventListener('mouseover', () => cursorOutline.classList.add('cursor-hover'));
        el.addEventListener('mouseout', () => cursorOutline.classList.remove('cursor-hover'));
    });
}

function startTimer() {
    let startTime = Date.now();
    const maxTime = 17 * 1000;
    progressBar.style.width = '0%';
    timerEl.textContent = `0.0s / ~17s`;
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime >= maxTime) {
            stopTimer();
            progressBar.style.width = '100%';
            timerEl.textContent = `17.0s / ~17s`;
            return;
        }
        const progress = Math.min(elapsedTime / maxTime, 1);
        progressBar.style.width = `${progress * 100}%`;
        timerEl.textContent = `${(elapsedTime / 1000).toFixed(1)}s / ~17s`;
    }, 100);
}

function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

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

function showMessage(text, type = 'info') {
    if (!messageBox) return;
    const messageEl = document.createElement('div');
    messageEl.className = `p-4 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'} fade-in-slide-up`;
    messageEl.textContent = text;
    messageBox.innerHTML = '';
    messageBox.appendChild(messageEl);
    setTimeout(() => { if(messageBox.contains(messageEl)) messageBox.removeChild(messageEl); }, 4000);
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
        if (variantsBtn) variantsBtn.classList.remove('selected');
    };
    if (messageBox) messageBox.prepend(backButton);
}

function toggleMusic() {
    if (!musicBtn || !lofiMusic) return;
    const isPlaying = musicBtn.classList.contains('playing');
    if (isPlaying) lofiMusic.pause();
    else lofiMusic.play().catch(e => console.error("Audio error:", e));
    musicBtn.classList.toggle('playing');
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
        setTimeout(() => { copyPromptBtn.innerHTML = originalIcon; }, 2000);
    }, (err) => {
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
        // NOTE: This fetch call points to a serverless function.
        // You would need to deploy the `enhance.js` file.
        const response = await fetch('/api/enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });
        if (!response.ok) throw new Error('Failed to enhance prompt.');
        const data = await response.json();
        promptInput.value = data.text;
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

// --- Functions below are for for-teams and pro-generator pages ---
// They are included here to keep all JS in one file for simplicity,
// but in a larger project, they would be in separate files.

function handleEmailSubmit(e) {
    e.preventDefault();
    const email = emailInput.value.trim();
    const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];
    const domain = email.split('@')[1];

    if (!domain || commonProviders.includes(domain.toLowerCase())) {
        emailErrorMsg.textContent = 'Please use a valid business email.';
        emailErrorMsg.classList.remove('hidden');
        return;
    }
    
    emailErrorMsg.classList.add('hidden');
    window.location.href = 'pro-generator.html';
}

async function generateVariants() {
    // This is a pro feature, so we just check for credits
    if (currentUserCredits <= 0) {
        showMessage("You're out of credits! Please upgrade.", 'error');
        return;
    }
    // A real implementation might charge more credits for variants
    // For now, it's the same as a single generation
    handleGenerateClick(); 
}
