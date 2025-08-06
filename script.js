// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut, onAuthStateChanged, getRedirectResult, signInWithCustomToken, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// Firestore is not directly used for this app's data persistence, but imported for completeness if needed later.
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

console.log("app.js: Script started loading.");

// --- Firebase Configuration and Initialization ---
// MANDATORY: Use __app_id and __firebase_config provided by the Canvas environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
let firebaseConfig = {};

try {
    firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    console.log("app.js: Firebase config parsed successfully.");
} catch (e) {
    console.error("app.js: Error parsing __firebase_config:", e);
    // Fallback to a minimal config if parsing fails, to avoid halting the script
    firebaseConfig = {
        apiKey: "YOUR_FALLBACK_API_KEY", // This will be replaced by the Canvas environment anyway
        authDomain: "your-fallback-auth-domain.firebaseapp.com",
        projectId: "your-fallback-project-id"
    };
}

let app, auth, db, provider;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app); // Initialize Firestore, though not used for this app's current features
    provider = new GoogleAuthProvider();
    console.log("app.js: Firebase services initialized.");
} catch (e) {
    console.error("app.js: Error initializing Firebase app or services:", e);
    // If Firebase init fails, the app won't function, so we log and might need to stop further execution.
    // For now, we'll let it try to proceed to see if other parts of the script work.
}


// --- DOM Element References (declared globally to be accessible after DOMContentLoaded) ---
let promptInput, generateBtn, resultContainer, loadingIndicator, imageGrid, timerEl, progressBar, messageBox, examplePrompts, generatorUI;
let authBtn, mobileAuthBtn, generationCounterEl, mobileGenerationCounterEl;
let authModal, googleSignInBtn, closeModalBtn;
let mobileMenuBtn, mobileMenu;

let timerInterval;
const FREE_GENERATION_LIMIT = 3;

// --- Initial Authentication on Load ---
// This ensures the user is signed in either via custom token or anonymously
// when the app loads, which is crucial for Canvas environment.
async function initializeAuth() {
    console.log("Firebase: Attempting initial authentication...");
    try {
        if (auth) { // Ensure auth object is initialized before using it
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                await signInWithCustomToken(auth, __initial_auth_token);
                console.log("Firebase: Signed in with custom token.");
            } else {
                await signInAnonymously(auth);
                console.log("Firebase: Signed in anonymously.");
            }
        } else {
            console.error("Firebase: Auth object is not initialized, cannot perform initial sign-in.");
        }
    } catch (error) {
        console.error("Firebase: Initial sign-in error:", error);
        // Fallback to anonymous if custom token fails, or just proceed if already signed in
        if (auth && error.code !== 'auth/already-initialized' && error.code !== 'auth/already-signed-in') {
             await signInAnonymously(auth);
             console.log("Firebase: Fallback to anonymous sign-in successful.");
        }
    }
}

// --- Main Application Logic (runs after DOM is fully loaded) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("app.js: DOM Content Loaded. Starting element selection and event listeners setup.");

    // Assign DOM Element References inside DOMContentLoaded
    promptInput = document.getElementById('prompt-input');
    console.log("Element: promptInput", promptInput ? "found" : "NOT found");
    generateBtn = document.getElementById('generate-btn');
    console.log("Element: generateBtn", generateBtn ? "found" : "NOT found");
    resultContainer = document.getElementById('result-container');
    console.log("Element: resultContainer", resultContainer ? "found" : "NOT found");
    loadingIndicator = document.getElementById('loading-indicator');
    console.log("Element: loadingIndicator", loadingIndicator ? "found" : "NOT found");
    imageGrid = document.getElementById('image-grid');
    console.log("Element: imageGrid", imageGrid ? "found" : "NOT found");
    timerEl = document.getElementById('timer');
    console.log("Element: timerEl", timerEl ? "found" : "NOT found");
    progressBar = document.getElementById('progress-bar');
    console.log("Element: progressBar", progressBar ? "found" : "NOT found");
    messageBox = document.getElementById('message-box');
    console.log("Element: messageBox", messageBox ? "found" : "NOT found");
    examplePrompts = document.querySelectorAll('.example-prompt');
    console.log("Elements: examplePrompts (count)", examplePrompts.length);
    generatorUI = document.getElementById('generator-ui');
    console.log("Element: generatorUI", generatorUI ? "found" : "NOT found");
    
    authBtn = document.getElementById('auth-btn');
    console.log("Element: authBtn", authBtn ? "found" : "NOT found");
    mobileAuthBtn = document.getElementById('mobile-auth-btn');
    console.log("Element: mobileAuthBtn", mobileAuthBtn ? "found" : "NOT found");
    generationCounterEl = document.getElementById('generation-counter');
    console.log("Element: generationCounterEl", generationCounterEl ? "found" : "NOT found");
    mobileGenerationCounterEl = document.getElementById('mobile-generation-counter');
    console.log("Element: mobileGenerationCounterEl", mobileGenerationCounterEl ? "found" : "NOT found");
    
    authModal = document.getElementById('auth-modal');
    console.log("Element: authModal", authModal ? "found" : "NOT found");
    googleSignInBtn = document.getElementById('google-signin-btn');
    console.log("Element: googleSignInBtn", googleSignInBtn ? "found" : "NOT found");
    closeModalBtn = document.getElementById('close-modal-btn');
    console.log("Element: closeModalBtn", closeModalBtn ? "found" : "NOT found");

    mobileMenuBtn = document.getElementById('mobile-menu-btn');
    console.log("Element: mobileMenuBtn", mobileMenuBtn ? "found" : "NOT found");
    mobileMenu = document.getElementById('mobile-menu');
    console.log("Element: mobileMenu", mobileMenu ? "found" : "NOT found");

    // Call initial authentication function
    // This needs to be called after DOM elements are assigned, as it uses 'auth'
    initializeAuth();

    // --- Mobile Menu Logic ---
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            if (mobileMenu) mobileMenu.classList.toggle('hidden');
            console.log("Event: Mobile menu toggled.");
        });
    } else {
        console.warn("Mobile menu button not found, cannot attach listener.");
    }
    
    // Close menu if clicking outside
    document.addEventListener('click', (event) => {
        if (mobileMenu && mobileMenuBtn && !mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
            mobileMenu.classList.add('hidden');
            console.log("Event: Mobile menu closed by outside click.");
        }
    });

    // --- Auth Logic ---
    if (auth) { // Only attach if Firebase auth is initialized
        onAuthStateChanged(auth, user => {
            console.log("Firebase: Auth state changed. User:", user ? user.uid : "None (anonymous or signed out)");
            updateUIForAuthState(user);
        });

        getRedirectResult(auth).catch((error) => {
            console.error("Firebase: Auth Redirect Error:", error);
            showMessage(`Authentication failed: ${error.message}`, 'error');
        });
    } else {
        console.error("Firebase Auth not initialized, cannot set up auth state listener or redirect result.");
    }

    if (authBtn) {
        authBtn.addEventListener('click', handleAuthAction);
        console.log("Event Listener: authBtn click attached.");
    } else { console.warn("Auth button not found, cannot attach listener."); }

    if (mobileAuthBtn) {
        mobileAuthBtn.addEventListener('click', handleAuthAction);
        console.log("Event Listener: mobileAuthBtn click attached.");
    } else { console.warn("Mobile auth button not found, cannot attach listener."); }

    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', signInWithGoogle);
        console.log("Event Listener: googleSignInBtn click attached.");
    } else { console.warn("Google Sign-In button not found, cannot attach listener."); }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            if (authModal) authModal.setAttribute('aria-hidden', 'true');
            console.log("Event: Close modal button clicked.");
        });
    } else { console.warn("Close modal button not found, cannot attach listener."); }


    function handleAuthAction() {
        console.log("Function: handleAuthAction called.");
        if (auth.currentUser && !auth.currentUser.isAnonymous) { // Check if it's a signed-in user, not anonymous
            console.log("Firebase: Signing out user.");
            signOut(auth);
        } else {
            console.log("Firebase: Initiating Google sign-in redirect.");
            signInWithGoogle();
        }
    }

    function signInWithGoogle() {
        console.log("Function: signInWithGoogle called.");
        if (auth && provider) { // Ensure auth and provider are initialized
            signInWithRedirect(auth, provider);
        } else {
            console.error("Firebase: Auth or Provider not initialized for Google Sign-In.");
            showMessage("Sign-in service not available. Please try again later.", "error");
        }
    }

    function updateUIForAuthState(user) {
        console.log("Function: updateUIForAuthState called with user:", user ? user.uid : "null");
        if (user && !user.isAnonymous) { // User is signed in with a real account
            if (authBtn) authBtn.textContent = 'Sign Out';
            if (mobileAuthBtn) mobileAuthBtn.textContent = 'Sign Out';
            if (generationCounterEl) generationCounterEl.textContent = 'Unlimited Generations';
            if (mobileGenerationCounterEl) mobileGenerationCounterEl.textContent = 'Unlimited Generations';
            if (authModal) authModal.setAttribute('aria-hidden', 'true');
            console.log("UI Updated: User signed in.");
        } else { // User is anonymous or signed out
            if (authBtn) authBtn.textContent = 'Sign In';
            if (mobileAuthBtn) mobileAuthBtn.textContent = 'Sign In';
            updateGenerationCounter();
            console.log("UI Updated: User signed out or anonymous.");
        }
    }

    // --- Generation Counter Logic ---
    function getGenerationCount() {
        const count = parseInt(localStorage.getItem('generationCount') || '0');
        console.log("Function: getGenerationCount - current count:", count);
        return count;
    }

    function incrementGenerationCount() {
        const newCount = getGenerationCount() + 1;
        localStorage.setItem('generationCount', newCount);
        updateGenerationCounter();
        console.log("Function: incrementGenerationCount - new count:", newCount);
        return newCount;
    }

    function updateGenerationCounter() {
        console.log("Function: updateGenerationCounter called.");
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
            console.log("Counter: User is signed in, counter skipped.");
            return; // If signed in, no need for counter
        }
        const count = getGenerationCount();
        const remaining = Math.max(0, FREE_GENERATION_LIMIT - count);
        const text = `${remaining} free generations left`;
        if (generationCounterEl) generationCounterEl.textContent = text;
        if (mobileGenerationCounterEl) mobileGenerationCounterEl.textContent = text;
        console.log("Counter: Displayed text:", text);
    }


    // --- UI Interaction Logic ---
    examplePrompts.forEach(button => {
        button.addEventListener('click', () => {
            if (promptInput) promptInput.value = button.innerText.trim();
            if (promptInput) promptInput.focus();
            console.log("Event: Example prompt button clicked:", button.innerText.trim());
        });
        console.log("Event Listener: Example prompt button attached.");
    });
    
    if (promptInput) {
        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generateImage();
                console.log("Event: Enter key pressed in prompt input.");
            }
        });
        console.log("Event Listener: promptInput keydown attached.");
    } else { console.warn("Prompt input not found, cannot attach keydown listener."); }

    if (generateBtn) {
        generateBtn.addEventListener('click', generateImage);
        console.log("Event Listener: generateBtn click attached.");
    } else { console.error("Generate button not found, cannot attach listener!"); }

    // --- Core Image Generation Logic ---
    async function generateImage() {
        console.log("Function: generateImage called.");
        if (!promptInput) {
            console.error("Prompt input element not found. Cannot generate image.");
            showMessage('Internal error: Prompt input not available.', 'error');
            return;
        }
        const prompt = promptInput.value.trim();
        if (!prompt) {
            showMessage('Please describe the image you want to create.', 'error');
            console.log("Validation: Prompt is empty.");
            return;
        }

        // Check free generation limit only if user is anonymous
        if (auth && auth.currentUser && auth.currentUser.isAnonymous && getGenerationCount() >= FREE_GENERATION_LIMIT) {
            if (authModal) authModal.setAttribute('aria-hidden', 'false');
            console.log("Validation: Free generation limit reached for anonymous user. Showing auth modal.");
            return;
        }

        if (imageGrid) imageGrid.innerHTML = '';
        if (messageBox) messageBox.innerHTML = '';
        if (resultContainer) resultContainer.classList.remove('hidden');
        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
        if (generatorUI) generatorUI.classList.add('hidden');
        
        startTimer();
        console.log("Image generation started for prompt:", prompt);

        try {
            const imageUrl = await generateImageWithRetry(prompt);
            displayImage(imageUrl, prompt);
            // Increment count only if user is anonymous
            if (auth.currentUser && auth.currentUser.isAnonymous) {
                incrementGenerationCount();
            }
            console.log("Image generated and displayed successfully.");
        } catch (error) {
            console.error('Image generation failed after multiple retries:', error);
            showMessage(`Sorry, we couldn't generate the image. Please try again. Error: ${error.message}`, 'error');
        } finally {
            stopTimer();
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            addBackButton();
            console.log("Image generation process finished.");
        }
    }

    async function generateImageWithRetry(prompt, maxRetries = 3) {
        console.log("Function: generateImageWithRetry called.");
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const payload = { instances: [{ prompt }], parameters: { "sampleCount": 1 } };
                // The API key is intentionally left empty. The Canvas environment will inject it at runtime.
                const apiKey = "";
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
                console.log(`API Call: Attempt ${attempt + 1} for prompt: "${prompt}" to URL: ${apiUrl}`);
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`API Error ${response.status}: ${errorData.error.message || response.statusText}`);
                }
                
                const result = await response.json();
                if (result.predictions?.[0]?.bytesBase64Encoded) {
                    console.log("API Call: Image data received successfully.");
                    return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
                }
                else throw new Error("No image data received from API.");
            } catch (error) {
                console.warn(`API Call: Attempt ${attempt + 1} failed: ${error.message}. Retrying...`);
                if (attempt >= maxRetries - 1) throw error;
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }

    // --- Helper Functions ---
    function displayImage(imageUrl, prompt) {
        console.log("Function: displayImage called with imageUrl (truncated):", imageUrl.substring(0, 50) + "...");
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
            console.log("Event: Download button clicked.");
            const a = document.createElement('a');
            a.href = imageUrl;
            a.download = 'genart-image.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
        imgContainer.appendChild(img);
        imgContainer.appendChild(downloadButton);
        if (imageGrid) imageGrid.appendChild(imgContainer);
        else console.warn("Image grid not found, cannot display image.");
    }

    function showMessage(text, type = 'info') {
        console.log(`Function: showMessage called. Type: ${type}, Text: "${text}"`);
        const messageEl = document.createElement('div');
        messageEl.className = `p-2 rounded-lg ${type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-gray-600'} fade-in-slide-up`;
        messageEl.textContent = text;
        if (messageBox) {
            messageBox.innerHTML = '';
            messageBox.appendChild(messageEl);
        } else {
            console.warn("Message box not found, cannot display message.");
        }
    }

    function addBackButton() {
        console.log("Function: addBackButton called.");
        const backButton = document.createElement('button');
        backButton.textContent = '← Create another';
        backButton.className = 'mt-4 text-blue-600 font-semibold hover:text-blue-800 transition-colors';
        backButton.onclick = () => {
            console.log("Event: Back button clicked. Resetting UI.");
            if (generatorUI) generatorUI.classList.remove('hidden');
            if (resultContainer) resultContainer.classList.add('hidden');
            if (imageGrid) imageGrid.innerHTML = '';
            if (messageBox) messageBox.innerHTML = '';
            if (promptInput) promptInput.value = '';
        };
        if (messageBox) messageBox.prepend(backButton);
        else console.warn("Message box not found, cannot add back button.");
    }

    function startTimer() {
        console.log("Function: startTimer called.");
        let startTime = Date.now();
        const maxTime = 17 * 1000;
        if (progressBar) progressBar.style.width = '0%';
        timerInterval = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min(elapsedTime / maxTime, 1);
            if (progressBar) progressBar.style.width = `${progress * 100}%`;
            if (timerEl) timerEl.textContent = `${(elapsedTime / 1000).toFixed(1)}s / ~17s`;
            if (elapsedTime >= maxTime && timerEl) timerEl.textContent = `17.0s / ~17s`;
        }, 100);
    }

    function stopTimer() {
        console.log("Function: stopTimer called.");
        clearInterval(timerInterval);
        if (progressBar) progressBar.style.width = '100%';
    }
}); // End of DOMContentLoaded
