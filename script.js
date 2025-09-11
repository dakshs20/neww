// --- UPDATED & FINAL ---
// This version implements the "Out of Credits" modal popup logic.
// It checks the user's credits on the frontend for immediate feedback
// and also handles the 403 error from the backend for robustness.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

// --- Global State ---
let timerInterval;
let uploadedImageData = null;
let selectedAspectRatio = '1:1';
let isRegenerating = false;
let lastPrompt = '';
let userCredits = null; // To hold the user's current credit count.
let unsubscribeUserCredits; // To hold the listener unsub function.

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initializeUniversalScripts();

    if (document.getElementById('generator-ui')) {
        initializeGeneratorPage();
    }
});


/**
 * Initializes scripts that run on every page (e.g., header, auth, cursor).
 */
function initializeUniversalScripts() {
    // --- DOM Element References ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const authModal = document.getElementById('auth-modal');
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const musicBtn = document.getElementById('music-btn');
    const lofiMusic = document.getElementById('lofi-music');
    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');
    
    // Add references for the new credits modal
    const creditsModal = document.getElementById('credits-modal');
    const closeCreditsModalBtn = document.getElementById('close-credits-modal-btn');

    // --- Event Listeners ---
    onAuthStateChanged(auth, user => updateUIForAuthState(user));

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
        document.addEventListener('click', (event) => {
            if (!mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }

    if (authBtn) authBtn.addEventListener('click', handleAuthAction);
    if (mobileAuthBtn) mobileAuthBtn.addEventListener('click', handleAuthAction);
    if (googleSignInBtn) googleSignInBtn.addEventListener('click', signInWithGoogle);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => authModal.setAttribute('aria-hidden', 'true'));
    
    // Add event listener to close the credits modal
    if (closeCreditsModalBtn && creditsModal) {
        closeCreditsModalBtn.addEventListener('click', () => creditsModal.setAttribute('aria-hidden', 'true'));
    }

    if (musicBtn && lofiMusic) {
        musicBtn.addEventListener('click', () => {
            const isPlaying = musicBtn.classList.contains('playing');
            if (isPlaying) {
                lofiMusic.pause();
            } else {
                lofiMusic.play().catch(error => console.error("Audio playback failed:", error));
            }
            musicBtn.classList.toggle('playing');
        });
    }
    
    // --- Custom Cursor Logic ---
    if (cursorDot && cursorOutline) {
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
    }
}


/**
 * Initializes scripts specific to the main generator page.
 */
function initializeGeneratorPage() {
    // --- DOM Element References ---
    const promptInput = document.getElementById('prompt-input');
    const generateBtn = document.getElementById('generate-btn');
    const examplePrompts = document.querySelectorAll('.example-prompt');
    const imageUploadBtn = document.getElementById('image-upload-btn');
    const imageUploadInput = document.getElementById('image-upload-input');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const aspectRatioBtns = document.querySelectorAll('.aspect-ratio-btn');
    const copyPromptBtn = document.getElementById('copy-prompt-btn');
    const enhancePromptBtn = document.getElementById('enhance-prompt-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');
    const promptSuggestionsContainer = document.getElementById('prompt-suggestions');

    // --- Event Listeners ---
    if(examplePrompts) {
        examplePrompts.forEach(button => {
            button.addEventListener('click', () => {
                promptInput.value = button.innerText.trim();
                promptInput.focus();
            });
        });
    }

    if (generateBtn) generateBtn.addEventListener('click', () => handleGenerateClick(false));
    if (regenerateBtn) regenerateBtn.addEventListener('click', () => handleGenerateClick(true));
    
    if (promptInput) {
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generateBtn.click();
            }
        });

        let suggestionTimeout;
        promptInput.addEventListener('input', () => {
            clearTimeout(suggestionTimeout);
            const promptText = promptInput.value.trim();
            if (promptText.length < 10) {
                promptSuggestionsContainer.innerHTML = '';
                promptSuggestionsContainer.classList.add('hidden');
                return;
            }
            promptSuggestionsContainer.innerHTML = `<span class="text-sm text-gray-400 italic">AI is thinking...</span>`;
            promptSuggestionsContainer.classList.remove('hidden');
            suggestionTimeout = setTimeout(() => fetchAiSuggestions(promptText), 300);
        });

        promptInput.addEventListener('blur', () => {
            setTimeout(() => {
                if (promptSuggestionsContainer) {
                    promptSuggestionsContainer.classList.add('hidden');
                }
            }, 150);
        });
    }

    if(aspectRatioBtns) {
        aspectRatioBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                aspectRatioBtns.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                selectedAspectRatio = btn.dataset.ratio;
            });
        });
    }

    if(copyPromptBtn) copyPromptBtn.addEventListener('click', copyPrompt);
    if(enhancePromptBtn) enhancePromptBtn.addEventListener('click', handleEnhancePrompt);

    if(imageUploadBtn) imageUploadBtn.addEventListener('click', () => imageUploadInput.click());
    if(imageUploadInput) imageUploadInput.addEventListener('change', handleImageUpload);
    if(removeImageBtn) removeImageBtn.addEventListener('click', removeUploadedImage);
}


// --- AI & Generation Logic ---

async function handleGenerateClick(isRegen) {
    isRegenerating = isRegen;
    const promptInput = isRegenerating ? document.getElementById('regenerate-prompt-input') : document.getElementById('prompt-input');
    const prompt = promptInput.value.trim();
    
    if (!prompt) {
        showMessage(`Please describe what you want to ${isRegenerating ? 'regenerate' : 'create'}.`, 'error');
        return;
    }
    
    // Check authentication and credits before proceeding
    if (!auth.currentUser) {
        document.getElementById('auth-modal').setAttribute('aria-hidden', 'false');
        return;
    }

    // Check if the user has credits before making an API call for instant feedback.
    if (userCredits !== null && userCredits <= 0) {
        document.getElementById('credits-modal').setAttribute('aria-hidden', 'false');
        return; // Stop the generation process
    }
    
    generateImage(prompt);
}


async function fetchAiSuggestions(promptText) {
    const promptInput = document.getElementById('prompt-input');
    const promptSuggestionsContainer = document.getElementById('prompt-suggestions');
    if (promptText !== promptInput.value.trim()) return;

    try {
        const response = await fetch('/api/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });
        if (!response.ok) {
            promptSuggestionsContainer.classList.add('hidden');
            console.error('Failed to fetch suggestions');
            return;
        }
        const data = await response.json();
        const relevantSuggestions = data.suggestions;
        promptSuggestionsContainer.innerHTML = '';
        if (relevantSuggestions && Array.isArray(relevantSuggestions) && relevantSuggestions.length > 0) {
            relevantSuggestions.slice(0, 3).forEach(suggestionText => {
                if(typeof suggestionText !== 'string') return;
                const btn = document.createElement('button');
                btn.className = 'prompt-suggestion-btn';
                const cleanText = suggestionText.replace(/_/g, ' ').trim();
                btn.textContent = `Add "${cleanText}"`;
                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault(); 
                    const currentPrompt = promptInput.value.trim();
                    promptInput.value = currentPrompt + (currentPrompt.endsWith(',') || currentPrompt.length === 0 ? ' ' : ', ') + cleanText;
                    promptInput.focus();
                    promptSuggestionsContainer.classList.add('hidden'); 
                });
                promptSuggestionsContainer.appendChild(btn);
            });
            if (promptSuggestionsContainer.children.length > 0) {
                promptSuggestionsContainer.classList.remove('hidden');
            }
        } else {
            promptSuggestionsContainer.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error fetching or parsing suggestions:', error);
        promptSuggestionsContainer.classList.add('hidden');
    }
}

async function handleEnhancePrompt() {
    const promptInput = document.getElementById('prompt-input');
    const enhancePromptBtn = document.getElementById('enhance-prompt-btn');
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
        const response = await fetch('/api/enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });
        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || `API Error: ${response.status}`);
        }
        const result = await response.json();
        if (result.text) {
            promptInput.value = result.text;
            promptInput.style.height = 'auto';
            promptInput.style.height = (promptInput.scrollHeight) + 'px';
        } else {
            throw new Error("Unexpected response from enhancement API.");
        }
    } catch (error) {
        console.error('Failed to enhance prompt:', error);
        showMessage('Sorry, the prompt could not be enhanced right now.', 'error');
    } finally {
        enhancePromptBtn.innerHTML = originalIcon;
        enhancePromptBtn.disabled = false;
    }
}

async function generateImage(prompt) {
    lastPrompt = prompt;
    
    // UI updates for generation start
    const imageGrid = document.getElementById('image-grid');
    const messageBox = document.getElementById('message-box');
    const loadingIndicator = document.getElementById('loading-indicator');
    const postGenerationControls = document.getElementById('post-generation-controls');
    const resultContainer = document.getElementById('result-container');
    const generatorUI = document.getElementById('generator-ui');

    imageGrid.innerHTML = '';
    messageBox.innerHTML = '';
    if (isRegenerating) {
        loadingIndicator.classList.remove('hidden');
        postGenerationControls.classList.add('hidden');
    } else {
        resultContainer.classList.remove('hidden');
        loadingIndicator.classList.remove('hidden');
        generatorUI.classList.add('hidden');
    }
    startTimer();

    try {
        const idToken = await auth.currentUser.getIdToken();
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt, 
                imageData: uploadedImageData, 
                aspectRatio: selectedAspectRatio,
                idToken
            })
        });

        if (!response.ok) {
            const errorResult = await response.json();
            // Robustly handle the specific 403 (Forbidden) error from the backend.
            if (response.status === 403) {
                 document.getElementById('credits-modal').setAttribute('aria-hidden', 'false');
                 // Reset the UI since generation failed.
                 stopTimer();
                 loadingIndicator.classList.add('hidden');
                 postGenerationControls.classList.add('hidden');
                 resultContainer.classList.add('hidden');
                 generatorUI.classList.remove('hidden');
                 return; // Stop execution
            }
            throw new Error(errorResult.error || `API Error: ${response.status}`);
        }

        const result = await response.json();
        let base64Data;
        if (uploadedImageData) { // check if it was an image-to-image request
            base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        } else { // text-to-image
            base64Data = result.predictions?.[0]?.bytesBase64Encoded;
        }
        if (!base64Data) throw new Error("No image data received from API.");
        
        displayImage(`data:image/png;base64,${base64Data}`, prompt);

    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
        // Also reset UI on general failure
        stopTimer();
        loadingIndicator.classList.add('hidden');
        postGenerationControls.classList.add('hidden');
        resultContainer.classList.add('hidden');
        generatorUI.classList.remove('hidden');

    } finally {
        stopTimer();
        if(document.getElementById('result-container').classList.contains('hidden') === false) {
             loadingIndicator.classList.add('hidden');
             document.getElementById('regenerate-prompt-input').value = lastPrompt;
             postGenerationControls.classList.remove('hidden');
             addNavigationButtons();
        }
        isRegenerating = false;
    }
}


// --- Authentication & User State ---

function handleAuthAction() { if (auth.currentUser) signOut(auth); else signInWithGoogle(); }

function signInWithGoogle() { 
    signInWithPopup(auth, provider).catch(error => console.error("Authentication Error:", error)); 
}

function updateUIForAuthState(user) {
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const generationCounterEl = document.getElementById('generation-counter');
    const mobileGenerationCounterEl = document.getElementById('mobile-generation-counter');
    const generateBtn = document.getElementById('generate-btn');
    const authModal = document.getElementById('auth-modal');

    // Clean up previous user's credit listener
    if (unsubscribeUserCredits) {
        unsubscribeUserCredits();
        unsubscribeUserCredits = null;
    }
    userCredits = null;

    if (user) {
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        if (authModal) authModal.setAttribute('aria-hidden', 'true');

        const userRef = doc(db, "users", user.uid);
        
        // Listen for real-time updates to the user's document (especially credits)
        unsubscribeUserCredits = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
                const userData = doc.data();
                userCredits = userData.credits;
                const creditText = `Credits: ${userCredits}`;
                generationCounterEl.textContent = creditText;
                mobileGenerationCounterEl.textContent = creditText;

                // Enable/disable button based on credits
                if (generateBtn) {
                    generateBtn.disabled = userCredits <= 0;
                    generateBtn.title = userCredits <= 0 ? "You have no credits left" : "Generate AI Image";
                }

            } else {
                // First sign-in, create user document with free credits
                setDoc(userRef, {
                    email: user.email,
                    displayName: user.displayName,
                    credits: 5 // Initial free credits
                }).catch(error => console.error("Error creating user document:", error));
            }
        });
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        generationCounterEl.textContent = '';
        mobileGenerationCounterEl.textContent = '';
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.title = "Generate AI Image";
        }
    }
}


// --- UI & Utility Functions ---

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        uploadedImageData = { mimeType: file.type, data: reader.result.split(',')[1] };
        document.getElementById('image-preview').src = reader.result;
        document.getElementById('image-preview-container').classList.remove('hidden');
        document.getElementById('prompt-input').placeholder = "Describe the edits you want to make...";
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageData = null;
    document.getElementById('image-upload-input').value = '';
    document.getElementById('image-preview-container').classList.add('hidden');
    document.getElementById('image-preview').src = '';
    document.getElementById('prompt-input').placeholder = "An oil painting of a futuristic city skyline at dusk...";
}

function displayImage(imageUrl, prompt) {
    const imageGrid = document.getElementById('image-grid');
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
    const messageBox = document.getElementById('message-box');
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

function addNavigationButtons() {
    const messageBox = document.getElementById('message-box');
    const existingButton = document.getElementById('start-new-btn');
    if (existingButton) existingButton.remove();

    const startNewButton = document.createElement('button');
    startNewButton.id = 'start-new-btn';
    startNewButton.textContent = '← Start New';
    startNewButton.className = 'text-sm sm:text-base mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
    startNewButton.onclick = () => {
        document.getElementById('generator-ui').classList.remove('hidden');
        document.getElementById('result-container').classList.add('hidden');
        document.getElementById('image-grid').innerHTML = '';
        document.getElementById('message-box').innerHTML = '';
        document.getElementById('post-generation-controls').classList.add('hidden');
        document.getElementById('prompt-input').value = '';
        document.getElementById('regenerate-prompt-input').value = '';
        removeUploadedImage();
    };
    messageBox.prepend(startNewButton);
}

function copyPrompt() {
    const promptInput = document.getElementById('prompt-input');
    const copyPromptBtn = document.getElementById('copy-prompt-btn');
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

function startTimer() {
    const timerEl = document.getElementById('timer');
    const progressBar = document.getElementById('progress-bar');
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
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = '100%';
}

