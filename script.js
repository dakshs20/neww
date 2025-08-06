// This console log will appear if the script file is even loaded and parsed.
console.log(Date.now(), "script.js: File started parsing.");

// --- MODIFIED: Import signInWithRedirect and getRedirectResult, remove signInWithPopup ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, addDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log(Date.now(), "script.js: Firebase imports attempted.");

// --- Firebase Configuration (Declared at top level) ---
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y", // REPLACE WITH YOUR ACTUAL API KEY
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.firebasestorage.app",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};
console.log(Date.now(), "script.js: Firebase config defined at top level.");

// --- Firebase App and Service Variables (Declared at top level, initialized later) ---
let firebaseApp;
let auth;
let db;
let googleProvider;

// --- State variables (Declared at top level and initialized) ---
let currentUser = null; // Stores Firebase User object
let freeGenerationsLeft = localStorage.getItem('freeGenerationsLeft') ? parseInt(localStorage.getItem('freeGenerationsLeft')) : 3;
let prompt = ''; // For image generator
let negativePrompt = ''; // For negative prompt
let imageUrl = ''; // For generated image
let loading = false; // For image generation (Imagen API call)
let currentError = ''; // Error message for display
let currentPage = 'home'; // 'home', 'generator'
let isSigningIn = false; // New state for sign-in loading
let isAuthReady = false; // Flag to indicate if Firebase Auth state has been checked and services initialized

let aspectRatio = '1:1'; // Default aspect ratio

let enhancedPrompt = '';
let loadingEnhancePrompt = false; // For Gemini prompt enhancement
let variationIdeas = [];
let loadingVariationIdeas = false;


// IMPORTANT: Your Google Cloud API Key for Imagen/Gemini (Declared at top level)
// REPLACE "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE" WITH THE KEY YOU OBTAINED FROM GOOGLE CLOUD CONSOLE
const IMAGEN_GEMINI_API_KEY = "AIzaSyBZxXWl9s2AeSCzMrfoEfnYWpGyfvP7jqs"; // Ensure this is your actual key
console.log(Date.now(), "script.js: IMAGEN_GEMINI_API_KEY value set at top level.");


// --- UI Element References (Will be populated in initApp) ---
// Declared as `let` so they can be assigned later in initApp
let homePageElement;
let generatorPageElement;
let allPageElements = []; // Group for easy iteration

let persistentDebugMessage;
let closeDebugMessageBtn;

let promptInput;
let negativePromptInput;
let copyPromptBtn;
let clearPromptBtn;
let aspectRatioSelectionDiv;
let generateBtn;
let enhanceBtn;
let variationBtn;
let useEnhancedPromptBtn;
let downloadBtn;
let errorDisplay;
let imageDisplayContainer;
let generatedImageElement;
let generatedImageWrapper;


let enhancedPromptDisplay;
let enhancedPromptText;
let variationIdeasDisplay;
let variationIdeasList;

let userDisplayDesktop;
let signInBtnDesktop;
let signOutBtnDesktop;
let userDisplayMobile;
let signInBtnMobile;
let signOutBtnMobile;
let freeGenerationsDisplay;
let signinRequiredModal;
let modalSignInBtn;
let closeSigninModalBtn;
let startCreatingBtn;
let logoBtn;

let hamburgerBtn;
let hamburgerIcon;
let mobileMenu;
let mobileMenuOverlay;
let closeMobileMenuBtn;
let mobileNavLinks; // This will be a NodeList, not a single element

let toastContainer;


// --- Helper function to get elements and log if not found (Declared at top level) ---
const getElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.error(Date.now(), `getElement: CRITICAL: Element with ID '${id}' NOT FOUND in the DOM. This element's functionality might be severely affected.`);
    } else {
        console.log(Date.now(), `getElement: Element with ID '${id}' FOUND.`);
    }
    return element;
};

// --- Firebase Initialization Function (Called by initApp) ---
function initFirebase() {
    console.log(Date.now(), "initFirebase: Initializing Firebase services...");
    try {
        firebaseApp = initializeApp(firebaseConfig);
        auth = getAuth(firebaseApp);
        db = getFirestore(firebaseApp);
        googleProvider = new GoogleAuthProvider();
        console.log(Date.now(), "initFirebase: Firebase services initialized successfully.");
        
        // --- ADDED: HANDLE REDIRECT RESULT ON PAGE LOAD ---
        // This checks if the user is returning from a Google Sign-In redirect.
        // It runs before onAuthStateChanged to ensure we can capture the sign-in event.
        getRedirectResult(auth)
            .then((result) => {
                if (result) {
                    // This means the user has just successfully signed in via redirect.
                    console.log(Date.now(), "initFirebase (getRedirectResult): User signed in via redirect.", result.user.uid);
                    signinRequiredModal?.classList.add('hidden'); // Hide modal just in case
                    showToast(`Welcome, ${result.user.displayName || 'friend'}!`, "success");
                    // The onAuthStateChanged listener below will handle fetching user data and updating the UI.
                } else {
                     console.log(Date.now(), "initFirebase (getRedirectResult): No redirect result found. This is a normal page load.");
                }
            }).catch((error) => {
                // Handle errors from the redirect process itself.
                console.error(Date.now(), "initFirebase (getRedirectResult): Error during Google Sign-In redirect:", error);
                setError(`Failed to sign in after redirect: ${error.message}`);
                showToast(`Sign-in failed: ${error.message}`, "error");
            }).finally(() => {
                // This ensures the signing-in state is reset after a redirect attempt.
                isSigningIn = false; 
                updateSignInButtons(false);
            });
        // --- END OF ADDED SECTION ---
        
        // Firebase Auth State Listener - This is still crucial for session management.
        onAuthStateChanged(auth, async (user) => {
            console.log(Date.now(), "onAuthStateChanged: Auth state change detected. User:", user ? user.uid : "null");
            currentUser = user;
            if (user) {
                console.log(Date.now(), "onAuthStateChanged: User logged in. Attempting to fetch user data from Firestore.");
                console.time("fetchUserData"); // Start timer for data fetch
                try {
                    await fetchUserData(user.uid); // Fetch user data from Firestore
                    console.log(Date.now(), "onAuthStateChanged: User data fetch completed successfully.");
                } catch (dataFetchError) {
                    console.error(Date.now(), "onAuthStateChanged: Error fetching user data:", dataFetchError);
                    setError(`Failed to load user data: ${dataFetchError.message}. Some features may be limited.`);
                    showToast(`Failed to load user data: ${dataFetchError.message}`, "error", 5000);
                } finally {
                    console.timeEnd("fetchUserData"); // End timer for data fetch
                }
            } else {
                console.log(Date.now(), "onAuthStateChanged: User logged out or no user detected. Checking local storage for free generations.");
                currentUser = null;
                // Only reset free generations if it's not already set or is invalid
                if (localStorage.getItem('freeGenerationsLeft') === null || parseInt(localStorage.getItem('freeGenerationsLeft')) < 0) {
                    freeGenerationsLeft = 3;
                    localStorage.setItem('freeGenerationsLeft', freeGenerationsLeft);
                    console.log(Date.now(), "onAuthStateChanged: Reset freeGenerationsLeft to 3 for unauthenticated user (local storage).");
                } else {
                    freeGenerationsLeft = parseInt(localStorage.getItem('freeGenerationsLeft'));
                    console.log(Date.now(), "onAuthStateChanged: Loaded freeGenerationsLeft from local storage:", freeGenerationsLeft);
                }
            }
            isAuthReady = true; // Set to true only after the initial auth state has been processed
            console.log(Date.now(), "onAuthStateChanged: isAuthReady set to true. Calling updateUI().");
            updateUI(); // Update UI immediately after auth state is determined
            console.log(Date.now(), "onAuthStateChanged: Auth state processing complete.");
        });

    } catch (e) {
        console.error(Date.now(), "initFirebase: CRITICAL ERROR: Error initializing Firebase:", e);
        currentError = `Firebase initialization failed: ${e.message}. App may not function correctly.`;
        if (persistentDebugMessage) {
            persistentDebugMessage.classList.remove('hidden');
            const msgP = persistentDebugMessage.querySelector('p');
            if (msgP) msgP.textContent = currentError + " Please check browser's Developer Console (F12) for details.";
        }
        throw e; // Re-throw to propagate to initApp's catch block
    }
}

// --- Toast Notification System (Declared at top level) ---
function showToast(message, type = 'info', duration = 3000) {
    if (!toastContainer) {
        console.warn(Date.now(), "showToast: Toast container not found. Cannot display toast.");
        return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    let iconClass = '';
    if (type === 'success') iconClass = 'fas fa-check-circle text-green-400';
    else if (type === 'error') iconClass = 'fas fa-times-circle text-red-500';
    else iconClass = 'fas fa-info-circle text-blue-400';

    const icon = document.createElement('i');
    icon.className = iconClass;
    toast.prepend(icon);

    toastContainer.appendChild(toast);
    console.log(Date.now(), `showToast: Displaying ${type} toast: "${message}"`);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.addEventListener('transitionend', () => {
            toast.remove();
            console.log(Date.now(), "showToast: Toast removed.");
        }, { once: true });
    }, duration);
}

// --- Mobile Menu Toggle Function (Declared at top level) ---
function toggleMobileMenu() {
    console.log(Date.now(), "toggleMobileMenu: Function called.");
    if (mobileMenu && mobileMenuOverlay && hamburgerBtn && hamburgerIcon) {
        const isMenuOpen = mobileMenu.classList.contains('translate-x-0');
        
        mobileMenu.classList.toggle('translate-x-full', isMenuOpen);
        mobileMenu.classList.toggle('translate-x-0', !isMenuOpen);
        
        mobileMenuOverlay.classList.toggle('hidden', isMenuOpen);
        
        hamburgerBtn.setAttribute('aria-expanded', !isMenuOpen);
        hamburgerIcon.classList.toggle('fa-bars', isMenuOpen);
        hamburgerIcon.classList.toggle('fa-times', !isMenuOpen);
        
        console.log(Date.now(), "toggleMobileMenu: Mobile menu toggled. Current state:", !isMenuOpen ? "OPEN" : "CLOSED");
    } else {
        console.error(Date.now(), "toggleMobileMenu: One or more mobile menu elements (mobileMenu, mobileMenuOverlay, hamburgerBtn, hamburgerIcon) not found. Cannot toggle.");
    }
}

// --- MODIFIED: Authentication Functions ---
async function signInWithGoogle() {
    console.log(Date.now(), "signInWithGoogle: Function entered.");
    clearError();

    if (isSigningIn) {
        console.log(Date.now(), "signInWithGoogle: Already signing in, ignoring multiple clicks.");
        return;
    }

    isSigningIn = true;
    updateSignInButtons(true); // Show loading state on buttons
    
    console.time("signInWithRedirect");
    try {
        if (!auth || !googleProvider) {
            throw new Error("Firebase Auth or Google Provider not initialized.");
        }
        
        console.log(Date.now(), "signInWithGoogle: Initiating signInWithRedirect...");
        // This will navigate the user away from the page.
        await signInWithRedirect(auth, googleProvider);
        // The code after this line will not execute in this session, as the page is redirecting.
        // The result will be handled by `getRedirectResult()` when the user returns to the page.
        
    } catch (error) {
        // This will only catch errors that happen *before* the redirect starts (e.g., config error).
        console.error(Date.now(), "signInWithGoogle: Error initiating redirect:", error);
        setError(`Failed to start sign-in: ${error.message}`);
        showToast(`Sign-in failed: ${error.message}`, "error");
        
        // Reset state only if the redirect fails to initiate
        isSigningIn = false;
        updateSignInButtons(false);
    } finally {
        // This block will likely not be fully observed in the console because of the page navigation.
        console.timeEnd("signInWithRedirect");
    }
}

// Function to update sign-in button states with loading spinner (Declared at top level)
function updateSignInButtons(loadingState) {
    console.log(Date.now(), "updateSignInButtons: Updating sign-in button state to loading:", loadingState);
    const signInButtons = [signInBtnDesktop, signInBtnMobile, modalSignInBtn];
    const buttonText = 'Sign In With Google';
    const loadingText = `
        <span class="flex items-center justify-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Signing In...
        </span>
    `;

    signInButtons.forEach(btn => {
        if (btn) {
            btn.innerHTML = loadingState ? loadingText : buttonText;
            btn.disabled = loadingState; // Disable during loading
            btn.classList.toggle('opacity-70', loadingState);
            btn.classList.toggle('cursor-not-allowed', loadingState);
        }
    });
}

async function signOutUser() {
    console.log(Date.now(), "signOutUser: Attempting signOutUser...");
    clearError();
    console.time("signOut");
    try {
        if (!auth) {
            console.error(Date.now(), "signOutUser: Firebase Auth not initialized. Cannot sign out.");
            setError("Firebase services not ready. Cannot sign out.");
            return;
        }
        await signOut(auth);
        console.log(Date.now(), "signOutUser: User signed out successfully.");
        showToast("Signed out successfully!", "info");
    } catch (error) {
        console.error(Date.now(), "signOutUser: Error signing out:", error);
        setError(`Failed to sign out: ${error.message}`);
        showToast(`Failed to sign out: ${error.message}`, "error");
    } finally {
        console.timeEnd("signOut");
        updateUI(); // Update UI after sign out
    }
}

async function fetchUserData(uid) {
    console.log(Date.now(), `fetchUserData: Entering fetchUserData for UID: ${uid}`);
    clearError();
    if (!db) {
        console.error(Date.now(), "fetchUserData: Firestore DB not initialized. Cannot fetch user data.");
        setError("Database not ready. Please refresh.");
        return;
    }
    const userDocRef = doc(db, 'users', uid);
    try {
        console.log(Date.now(), `fetchUserData: Attempting to get document for UID: ${uid}`);
        const userDocSnap = await getDoc(userDocRef);
        console.log(Date.now(), `fetchUserData: Document snapshot received. Exists: ${userDocSnap.exists()}`);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            freeGenerationsLeft = userData.freeGenerationsLeft !== undefined ? userData.freeGenerationsLeft : 0;
            console.log(Date.now(), "fetchUserData: Fetched existing user data:", userData);
        } else {
            console.log(Date.now(), "fetchUserData: User document does not exist for UID:", uid, ". Initializing new user data in Firestore with 3 free generations.");
            await setDoc(userDocRef, {
                freeGenerationsLeft: 3,
                createdAt: serverTimestamp()
            });
            freeGenerationsLeft = 3;
            console.log(Date.now(), "fetchUserData: New user data initialized in Firestore for UID:", uid);
        }
        localStorage.removeItem('freeGenerationsLeft'); // Clear local storage for authenticated users
        console.log(Date.now(), "fetchUserData: Removed freeGenerationsLeft from local storage for authenticated user.");
    } catch (error) {
        console.error(Date.now(), "fetchUserData: Error fetching/initializing user data:", error);
        throw error; // Re-throw to be caught by onAuthStateChanged
    } finally {
        console.log(Date.now(), "fetchUserData: Exiting fetchUserData.");
    }
}

function updateUIForAuthStatus() {
    console.log(Date.now(), "updateUIForAuthStatus: Updating UI for auth status. Current user:", currentUser ? currentUser.displayName || currentUser.email : "None");

    if (userDisplayDesktop) {
        if (currentUser) {
            userDisplayDesktop.textContent = `Welcome, ${currentUser.displayName || currentUser.email}!`;
            userDisplayDesktop.classList.remove('hidden');
        } else {
            userDisplayDesktop.classList.add('hidden');
        }
    }
    if (signInBtnDesktop) signInBtnDesktop.classList.toggle('hidden', !!currentUser);
    if (signOutBtnDesktop) signOutBtnDesktop.classList.toggle('hidden', !currentUser);

    if (userDisplayMobile) {
        if (currentUser) {
            userDisplayMobile.textContent = `Welcome, ${currentUser.displayName || currentUser.email}!`;
            userDisplayMobile.classList.remove('hidden');
        } else {
            userDisplayMobile.classList.add('hidden');
        }
    }
    if (signInBtnMobile) signInBtnMobile.classList.toggle('hidden', !!currentUser);
    if (signOutBtnMobile) signOutBtnMobile.classList.toggle('hidden', !currentUser);

    console.log(Date.now(), "updateUIForAuthStatus: UI updated based on auth status.");
}

function populateAspectRatioRadios() {
    console.log(Date.now(), "populateAspectRatioRadios: Populating aspect ratio radios.");
    if (aspectRatioSelectionDiv) {
        aspectRatioSelectionDiv.innerHTML = ''; // Clear existing radios
        ['1:1', '4:5', '9:16', '16:9'].forEach(ratio => {
            const label = document.createElement('label');
            label.className = 'inline-flex items-center cursor-pointer';
            label.innerHTML = `
                <input type="radio" name="aspectRatio" value="${ratio}" class="form-radio h-5 w-5 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500" ${aspectRatio === ratio ? 'checked' : ''}>
                <span class="ml-2 text-gray-200 font-helvetica text-sm">${ratio}</span>
            `;
            const radioInput = label.querySelector('input');
            if (radioInput) {
                radioInput.addEventListener('change', (e) => {
                    aspectRatio = e.target.value;
                    console.log(Date.now(), "Event: Aspect ratio changed to:", aspectRatio);
                    updateImageWrapperAspectRatio();
                });
            }
            aspectRatioSelectionDiv.appendChild(label);
        });
        console.log(Date.now(), "populateAspectRatioRadios: Aspect ratio radios populated.");
    } else {
        console.error(Date.now(), "populateAspectRatioRadios: aspectRatioSelectionDiv element not found. Cannot populate radios.");
    }
}

async function setPage(newPage) {
    console.log(Date.now(), `setPage: Attempting to switch to page: ${newPage}. Current page: ${currentPage}`);
    if (currentPage === newPage) {
        console.log(Date.now(), `setPage: Already on page ${newPage}, no change needed.`);
        return;
    }

    allPageElements.forEach(element => {
        if (element) {
            element.classList.add('hidden');
            element.classList.remove('animate-fade-in-up');
        }
    });

    let newPageElement;
    if (newPage === 'home') {
        newPageElement = homePageElement;
    } else if (newPage === 'generator') {
        newPageElement = generatorPageElement;
        updateImageWrapperAspectRatio();
    }

    if (newPageElement) {
        newPageElement.classList.remove('hidden');
        void newPageElement.offsetWidth; 
        newPageElement.classList.add('animate-fade-in-up');
        console.log(Date.now(), `setPage: Displayed page '${newPage}' and applied animation.`);
    } else {
        console.error(Date.now(), `setPage: New page element for '${newPage}' not found. Cannot switch page.`);
    }

    currentPage = newPage;
    updateUI();
    console.log(Date.now(), `setPage: Page switched to: ${currentPage}.`);
}

function updateUI() {
    console.log(Date.now(), `updateUI: Updating UI for current page: ${currentPage}. Auth Ready: ${isAuthReady}. Loading: ${loading}. Enhance Loading: ${loadingEnhancePrompt}. Variation Loading: ${loadingVariationIdeas}. Prompt empty: ${!promptInput?.value.trim()}`);

    const interactiveElements = [
        homePageElement, generatorPageElement, logoBtn,
        hamburgerBtn, closeMobileMenuBtn, mobileMenuOverlay,
        startCreatingBtn, promptInput, negativePromptInput, copyPromptBtn, clearPromptBtn, generateBtn,
        enhanceBtn, variationBtn, useEnhancedPromptBtn,
        downloadBtn, signInBtnDesktop, signOutBtnDesktop,
        signInBtnMobile, signOutBtnMobile, modalSignInBtn,
        closeSigninModalBtn, persistentDebugMessage, closeDebugMessageBtn
    ];

    interactiveElements.forEach(el => {
        if (el) { 
            const isAuthButton = el.id && (el.id.includes('sign-in-btn') || el.id.includes('sign-out-btn') || el.id.includes('modal-sign-in-btn'));
            const isGeneratorButton = el.id && (el.id === 'generate-image-btn');
            const isEnhanceOrVariationButton = el.id && (el.id === 'enhance-prompt-btn' || el.id === 'generate-variation-ideas-btn');
            
            let shouldBeDisabled = !isAuthReady;

            if (isAuthButton) {
                shouldBeDisabled = isSigningIn;
            } else if (isGeneratorButton) {
                const noFreeGenerations = (!currentUser && freeGenerationsLeft <= 0);
                shouldBeDisabled = !isAuthReady || noFreeGenerations || loading || loadingEnhancePrompt || loadingVariationIdeas;
            } else if (isEnhanceOrVariationButton) {
                shouldBeDisabled = !isAuthReady || !promptInput?.value.trim() || loading || loadingEnhancePrompt || loadingVariationIdeas;
            } else if (el.id === 'use-enhanced-prompt-btn') {
                shouldBeDisabled = !isAuthReady || !enhancedPrompt || loading || loadingEnhancePrompt || loadingVariationIdeas;
            } else if (el.id === 'download-image-btn') {
                shouldBeDisabled = !isAuthReady || !imageUrl || loading || loadingEnhancePrompt || loadingVariationIdeas;
            } else if (el.id === 'copy-prompt-btn') {
                shouldBeDisabled = !isAuthReady || !promptInput?.value.trim() || loading || loadingEnhancePrompt || loadingVariationIdeas;
            } else if (el.id === 'clear-prompt-btn') {
                shouldBeDisabled = !isAuthReady || (!promptInput?.value.trim() && !negativePromptInput?.value.trim()) || loading || loadingEnhancePrompt || loadingVariationIdeas;
            } else if (el.id === 'close-debug-message-btn') {
                shouldBeDisabled = false;
            }

            if (!isAuthButton && !isGeneratorButton && !isEnhanceOrVariationButton && el.id !== 'close-debug-message-btn') {
                shouldBeDisabled = !isAuthReady || loading || loadingEnhancePrompt || loadingVariationIdeas;
            }


            el.disabled = shouldBeDisabled;
            el.classList.toggle('opacity-50', shouldBeDisabled);
            el.classList.toggle('cursor-not-allowed', shouldBeDisabled);
        }
    });

    homePageElement?.classList.toggle('bg-white/10', currentPage === 'home');
    homePageElement?.classList.toggle('text-blue-100', currentPage === 'home');
    homePageElement?.classList.toggle('text-gray-300', currentPage !== 'home');

    generatorPageElement?.classList.toggle('bg-white/10', currentPage === 'generator');
    generatorPageElement?.classList.toggle('text-blue-100', currentPage === 'generator');
    generatorPageElement?.classList.toggle('text-gray-300', currentPage !== 'generator');

    if (currentPage === 'generator') {
        updateGeneratorPageUI();
    }
    updateUIForAuthStatus();
}

function updateGeneratorPageUI() {
    console.log(Date.now(), "updateGeneratorPageUI: Updating dynamic generator UI.");
    if (promptInput) promptInput.value = prompt;
    if (negativePromptInput) negativePromptInput.value = negativePrompt;

    if (freeGenerationsDisplay) {
        if (currentUser) {
            freeGenerationsDisplay.textContent = `You have unlimited generations!`;
            freeGenerationsDisplay.classList.remove('text-red-400', 'text-gray-400');
            freeGenerationsDisplay.classList.add('text-green-400');
        } else {
            freeGenerationsDisplay.textContent = `You have ${freeGenerationsLeft} generations left without sign in.`;
            if (freeGenerationsLeft <= 0) {
                freeGenerationsDisplay.classList.remove('text-green-400', 'text-gray-400');
                freeGenerationsDisplay.classList.add('text-red-400');
            } else {
                freeGenerationsDisplay.classList.remove('text-red-400', 'text-gray-400');
                freeGenerationsDisplay.classList.add('text-green-400');
            }
        }
    }

    populateAspectRatioRadios();

    if (generateBtn) {
        let buttonText = 'Generate Image';
        let loadingText = 'Generating...';

        if (!currentUser && freeGenerationsLeft <= 0) {
            buttonText = 'Sign In to Generate More';
        }

        generateBtn.innerHTML = loading ? `
            <span class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
                ${loadingText}
            </span>
        ` : buttonText;

        generateBtn.classList.toggle('bg-gray-700', loading);
        generateBtn.classList.toggle('cursor-not-allowed', loading);
        generateBtn.classList.toggle('bg-gradient-to-r', !loading);
        generateBtn.classList.remove('from-blue-700', 'to-indigo-800', 'hover:from-blue-800', 'hover:to-indigo-900',
                                   'from-red-600', 'to-red-700', 'hover:from-red-700', 'hover:to-red-800',
                                   'from-gray-600', 'to-gray-700', 'hover:from-gray-700', 'hover:to-gray-800');


        if (loading) {
            // Handled by loading state
        } else if (!currentUser && freeGenerationsLeft <= 0) {
            generateBtn.classList.add('from-red-600', 'to-red-700', 'hover:from-red-700', 'hover:to-red-800');
        } else {
            generateBtn.classList.add('from-blue-700', 'to-indigo-800', 'hover:from-blue-800', 'hover:to-indigo-900');
        }
    }


    if (errorDisplay) {
        errorDisplay.textContent = currentError;
        errorDisplay.classList.toggle('hidden', !currentError);
    }

    if (imageDisplayContainer && generatedImageElement) {
        if (loading) {
            imageDisplayContainer.classList.add('hidden');
        } else if (imageUrl) {
            imageDisplayContainer.classList.remove('hidden');
            generatedImageElement.src = imageUrl;
            generatedImageElement.alt = `AI generated image based on prompt: ${prompt}`;
            generatedImageElement.style.opacity = '0';
        } else {
            imageDisplayContainer.classList.add('hidden');
        }
    }

    if (enhanceBtn) {
        enhanceBtn.innerHTML = loadingEnhancePrompt ? `
            <span class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Enhancing...
            </span>
        ` : `<i class="fas fa-magic mr-2"></i> Enhance Prompt`;
        enhanceBtn.classList.toggle('bg-gray-700', loadingEnhancePrompt);
        enhanceBtn.classList.toggle('cursor-not-allowed', loadingEnhancePrompt);
        enhanceBtn.classList.toggle('bg-gradient-to-r', !loadingEnhancePrompt);
        enhanceBtn.classList.toggle('from-blue-600', !loadingEnhancePrompt);
        enhanceBtn.classList.toggle('to-cyan-700', !loadingEnhancePrompt);
        enhanceBtn.classList.toggle('hover:from-blue-700', !loadingEnhancePrompt);
        enhanceBtn.classList.toggle('hover:to-cyan-800', !loadingEnhancePrompt);
    }

    if (enhancedPromptDisplay && enhancedPromptText) {
        enhancedPromptText.textContent = enhancedPrompt;
        enhancedPromptDisplay.classList.toggle('hidden', !enhancedPrompt);
        if (useEnhancedPromptBtn) {
            useEnhancedPromptBtn.classList.toggle('hidden', !enhancedPrompt);
        }
    }

    if (variationBtn) {
        variationBtn.innerHTML = loadingVariationIdeas ? `
            <span class="flex items-center justify-center">
                 <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Ideas...
            </span>
        ` : `<i class="fas fa-lightbulb mr-2"></i> Get Variation Ideas`;
        variationBtn.classList.toggle('bg-gray-700', loadingVariationIdeas);
        variationBtn.classList.toggle('cursor-not-allowed', loadingVariationIdeas);
        variationBtn.classList.toggle('bg-gradient-to-r', !loadingVariationIdeas);
        variationBtn.classList.toggle('from-green-700', !loadingVariationIdeas);
        variationBtn.classList.toggle('to-emerald-700', !loadingVariationIdeas);
        variationBtn.classList.toggle('hover:from-green-800', !loadingVariationIdeas);
        variationBtn.classList.toggle('hover:to-emerald-800', !loadingVariationIdeas);
    }

    if (variationIdeasDisplay && variationIdeasList) {
        variationIdeasList.innerHTML = variationIdeas.map(idea => `<li>${idea}</li>`).join('');
        variationIdeasDisplay.classList.toggle('hidden', variationIdeas.length === 0);
    }
}

function updateImageWrapperAspectRatio() {
    if (!generatedImageWrapper || !generatedImageElement) {
        console.warn(Date.now(), "updateImageWrapperAspectRatio: generatedImageWrapper or generatedImageElement not found. Cannot update aspect ratio.");
        return;
    }

    generatedImageElement.style.width = '100%';
    generatedImageElement.style.height = '100%';
    generatedImageElement.style.objectFit = 'contain';
    generatedImageElement.style.position = 'absolute';
    generatedImageElement.style.top = '0';
    generatedImageElement.style.left = '0';

    let paddingBottomPercentage;
    switch (aspectRatio) {
        case '1:1': paddingBottomPercentage = '100%'; break;
        case '4:5': paddingBottomPercentage = '125%'; break;
        case '9:16': paddingBottomPercentage = '177.77%'; break;
        case '16:9': paddingBottomPercentage = '56.25%'; break;
        default: paddingBottomPercentage = '100%'; break;
    }

    generatedImageWrapper.style.position = 'relative';
    generatedImageWrapper.style.width = '100%';
    generatedImageWrapper.style.paddingBottom = paddingBottomPercentage;
    generatedImageWrapper.style.height = '0';


    console.log(Date.now(), `updateImageWrapperAspectRatio: Wrapper aspect ratio set to ${aspectRatio} (${paddingBottomPercentage}).`);
}

async function enhancePrompt() {
    console.log(Date.now(), "enhancePrompt: Function called.");
    clearError();

    if (!IMAGEN_GEMINI_API_KEY || IMAGEN_GEMINI_API_KEY === "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE") {
        setError('API Key is not configured for prompt enhancement. Please replace "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE" in script.js with your actual key obtained from Google Cloud Console.');
        updateUI();
        console.error(Date.now(), "enhancePrompt: API Key not configured. Cannot proceed.");
        showToast("API Key missing for prompt enhancement. Check console.", "error");
        return;
    }

    if (!promptInput || !promptInput.value.trim()) {
        setError('Please enter a prompt to enhance.');
        updateUI();
        showToast("Enter a prompt to enhance.", "info");
        console.warn(Date.now(), "enhancePrompt: Prompt input is empty. Cannot enhance.");
        return;
    }

    loadingEnhancePrompt = true;
    enhancedPrompt = '';
    updateUI();
    showToast("Enhancing your prompt...", "info");
    console.time("enhancePromptAPI");

    try {
        const promptToEnhance = promptInput.value.trim();
        console.log(Date.now(), `enhancePrompt: Sending prompt to Gemini API: "${promptToEnhance}"`);
        const geminiPrompt = `
            You are an expert prompt engineer for AI image generation.
            Take the following user prompt and expand it into a highly detailed, descriptive, and creative prompt for an image generation model.
            Focus on adding details that enhance the visual quality, atmosphere, and specific characteristics of the subject, without forcing a "photorealistic" style unless explicitly requested.
            Consider adding:
            - Specific descriptive adjectives for the subject and scene.
            - Details about lighting (e.g., "soft morning light", "dramatic chiaroscuro", "neon glow").
            - Environmental details (e.g., "lush foliage", "ancient cobblestones", "futuristic cityscape").
            - Artistic style suggestions if appropriate (e.g., "oil painting", "concept art", "pixel art", "surrealist", "anime style").
            - Compositional elements (e.g., "wide shot", "close-up", "dynamic angle").
            - Textures, colors, and mood.
            - Quality keywords like "ultra-detailed", "high resolution", "intricate".

            Do not include any conversational text, just the enhanced prompt.
            Original prompt: "${promptToEnhance}"
        `;

        const payload = { contents: [{ role: "user", parts: [{ text: geminiPrompt }] }] };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${IMAGEN_GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(Date.now(), "enhancePrompt: Gemini API fetch response received.");

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
        }

        const result = await response.json();
        console.log(Date.now(), "enhancePrompt: Gemini API response parsed:", result);

        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            enhancedPrompt = result.candidates[0].content.parts[0].text.trim();
            showToast("Prompt enhanced successfully!", "success");
            console.log(Date.now(), "enhancePrompt: Enhanced prompt received:", enhancedPrompt);
        } else {
            setError('Failed to enhance prompt. No response from AI.');
            showToast('Failed to enhance prompt.', "error");
            console.error(Date.now(), 'enhancePrompt: AI response missing content:', result);
        }
    } catch (e) {
        setError(`Error enhancing prompt: ${e.message || 'Unknown error'}.`);
        showToast(`Prompt enhancement failed: ${e.message}`, "error");
        console.error(Date.now(), 'enhancePrompt: Error during prompt enhancement:', e);
    } finally {
        loadingEnhancePrompt = false;
        updateUI();
        console.timeEnd("enhancePromptAPI");
    }
}

async function generateVariationIdeas() {
    console.log(Date.now(), "generateVariationIdeas: Function called.");
    clearError();

    if (!IMAGEN_GEMINI_API_KEY || IMAGEN_GEMINI_API_KEY === "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE") {
        setError('API Key is not configured for variation ideas. Please replace "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE" in script.js with your actual key obtained from Google Cloud Console.');
        updateUI();
        console.error(Date.now(), "generateVariationIdeas: API Key not configured. Cannot proceed.");
        showToast("API Key missing for variation ideas. Check console.", "error");
        return;
    }

    if (!promptInput || !promptInput.value.trim()) {
        setError('Please enter a prompt to get variation ideas.');
        updateUI();
        showToast("Enter a prompt to get ideas.", "info");
        console.warn(Date.now(), "generateVariationIdeas: Prompt input is empty. Cannot generate ideas.");
        return;
    }

    loadingVariationIdeas = true;
    variationIdeas = [];
    updateUI();
    showToast("Generating variation ideas...", "info");
    console.time("generateVariationIdeasAPI");

    try {
        const promptForIdeas = promptInput.value.trim();
        console.log(Date.now(), `generateVariationIdeas: Sending prompt to Gemini API for ideas: "${promptForIdeas}"`);
        const geminiPrompt = `
            Generate 3-5 distinct creative variations for the following image generation prompt.
            Each variation should be a concise, single sentence, focusing on different styles, moods, or minor subject alterations.
            Present them as a numbered list. Do not include any conversational text, just the numbered list.
            Original prompt: "${promptForIdeas}"
        `;

        const payload = { contents: [{ role: "user", parts: [{ text: geminiPrompt }] }] };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${IMAGEN_GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(Date.now(), "generateVariationIdeas: Gemini API fetch response received.");

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
        }

        const result = await response.json();
        console.log(Date.now(), "generateVariationIdeas: Gemini API response parsed:", result);

        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            const rawIdeas = result.candidates[0].content.parts[0].text.trim();
            variationIdeas = rawIdeas.split('\n').map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(line => line.length > 0);
            showToast("Variation ideas generated!", "success");
            console.log(Date.now(), "generateVariationIdeas: Ideas received:", variationIdeas);
        } else {
            setError('Failed to generate variation ideas. No response from AI.');
            showToast('Failed to generate ideas.', "error");
            console.error(Date.now(), 'generateVariationIdeas: AI response missing content:', result);
        }
    } catch (e) {
        setError(`Error generating variation ideas: ${e.message || 'Unknown error'}.`);
        showToast(`Idea generation failed: ${e.message}`, "error");
        console.error(Date.now(), 'generateVariationIdeas: Error during idea generation:', e);
    } finally {
        loadingVariationIdeas = false;
        updateUI();
        console.timeEnd("generateVariationIdeasAPI");
    }
}


async function generateImage() {
    console.log(Date.now(), "generateImage: Function called.");
    clearError();

    if (!IMAGEN_GEMINI_API_KEY || IMAGEN_GEMINI_API_KEY === "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE") {
        setError('API Key is not configured for image generation. Please replace "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE" in script.js with your actual key obtained from Google Cloud Console and ensure the Imagen API is enabled.');
        updateUI();
        console.error(Date.now(), "generateImage: API Key not configured. Cannot proceed.");
        showToast("API Key missing for image generation. Check console.", "error");
        return;
    }

    if (!promptInput || !promptInput.value.trim()) {
        setError('Please enter a prompt to generate an image.');
        updateUI();
        console.warn(Date.now(), "generateImage: Prompt is empty. Cannot generate image.");
        showToast("Please enter a prompt to generate an image.", "info");
        return;
    }

    if (!currentUser) {
        if (freeGenerationsLeft <= 0) {
            console.log(Date.now(), "generateImage: Free generations exhausted for unauthenticated user. Showing sign-in modal.");
            signinRequiredModal?.classList.remove('hidden');
            updateUI();
            showToast("You've used your free generations. Please sign in!", "info");
            return;
        } else {
            freeGenerationsLeft--;
            localStorage.setItem('freeGenerationsLeft', freeGenerationsLeft);
            console.log(Date.now(), `generateImage: Unauthenticated generation. ${freeGenerationsLeft} left.`);
            showToast(`Generating image... ${freeGenerationsLeft} free generations left.`, "info");
        }
    } else {
        console.log(Date.now(), "generateImage: Authenticated user generating image (unlimited).");
        showToast("Generating image...", "info");
    }

    loading = true;
    imageUrl = '';
    updateUI();
    console.log(Date.now(), "generateImage: Starting image generation request.");
    console.time("imageGenerationAPI");

    try {
        let finalPrompt = promptInput.value.trim();
        
        const textKeywords = ['text', 'number', 'letter', 'font', 'word', 'digits', 'characters'];
        const containsTextKeyword = textKeywords.some(keyword => finalPrompt.toLowerCase().includes(keyword));

        if (containsTextKeyword) {
            finalPrompt += ", clear, legible, sharp, high-resolution text, sans-serif font, precisely rendered, not distorted, no gibberish, accurate spelling, crisp edges";
            console.log(Date.now(), "generateImage: Added text-specific enhancements to prompt.");
        }

        let aspectRatioInstruction = '';
        switch (aspectRatio) {
            case '1:1': 
                aspectRatioInstruction = ', square format, 1:1 aspect ratio, balanced composition, perfect square, symmetrical frame'; 
                break;
            case '4:5': 
                aspectRatioInstruction = ', portrait orientation, 4:5 aspect ratio, tall and narrow composition, vertical format, ideal for social media portrait posts'; 
                break;
            case '9:16': 
                aspectRatioInstruction = ', ultra-portrait orientation, 9:16 aspect ratio, extremely tall and narrow composition, vertical smartphone screen format, full-screen mobile display'; 
                break;
            case '16:9': 
                aspectRatioInstruction = ', landscape orientation, 16:9 aspect ratio, wide and cinematic composition, horizontal widescreen format, film aspect ratio'; 
                break;
        }
        finalPrompt += aspectRatioInstruction;

        if (negativePromptInput && negativePromptInput.value.trim()) {
            finalPrompt += ` --no ${negativePromptInput.value.trim()}`;
            console.log(Date.now(), "generateImage: Added negative prompt.");
        }

        console.log(Date.now(), "generateImage: Final prompt for Imagen API:", finalPrompt);


        const payload = { instances: { prompt: finalPrompt }, parameters: { "sampleCount": 1 } };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${IMAGEN_GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(Date.now(), "generateImage: Imagen API fetch response received.");

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Imagen API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
        }

        const result = await response.json();
        console.log(Date.now(), "generateImage: Imagen API response parsed:", result);

        if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
            imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
            console.log(Date.now(), "generateImage: Image URL successfully created from Base64 data.");
            showToast("Image generated successfully!", "success");
        } else {
            setError('Failed to generate image. No image data received.');
            showToast('Failed to generate image. No data received.', "error");
            console.error(Date.now(), 'generateImage: API response missing image data:', result);
        }
    } catch (e) {
        setError(`An error occurred during image generation: ${e.message || 'Unknown error'}. Please try again.`);
        showToast(`Image generation failed: ${e.message}`, "error");
        console.error(Date.now(), 'generateImage: Error during image generation:', e);
    } finally {
        console.timeEnd("imageGenerationAPI");
        loading = false;
        updateUI();
        console.log(Date.now(), "generateImage: Image generation process finished (loading state reset).");
    }
}


function downloadImage() {
    console.log(Date.now(), "downloadImage: Function called.");
    if (imageUrl) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = 'generated_image.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Image downloaded!", "success");
        console.log(Date.now(), "downloadImage: Image download initiated.");
    } else {
        showToast("No image to download.", "info");
        console.warn(Date.now(), "downloadImage: No image URL available to download.");
    }
}

function copyToClipboard(text) {
    console.log(Date.now(), "copyToClipboard: Attempting to copy text.");
    if (!text) {
        showToast("Nothing to copy!", "info");
        return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast("Prompt copied to clipboard!", "success");
            console.log(Date.now(), "copyToClipboard: Text successfully copied.");
        } else {
            throw new Error('execCommand failed');
        }
    } catch (err) {
        console.error(Date.now(), 'copyToClipboard: Failed to copy text using execCommand:', err);
        try {
            navigator.clipboard.writeText(text).then(() => {
                showToast("Prompt copied to clipboard!", "success");
                console.log(Date.now(), "copyToClipboard: Text successfully copied using Clipboard API.");
            }).catch(clipboardErr => {
                console.error(Date.now(), 'copyToClipboard: Failed to copy text using Clipboard API:', clipboardErr);
                showToast("Failed to copy prompt. Please try manually.", "error");
            });
        } catch (apiErr) {
            console.error(Date.now(), 'copyToClipboard: Clipboard API not available or failed:', apiErr);
            showToast("Failed to copy prompt. Please try manually.", "error");
        }
    }
    document.body.removeChild(textarea);
}

function setError(message) {
    console.error(Date.now(), "setError: Setting error:", message);
    currentError = message;
}

function clearError() {
    console.log(Date.now(), "clearError: Clearing error.");
    currentError = '';
}

function setupEventListeners() {
    console.log(Date.now(), "setupEventListeners: Setting up all event listeners...");

    const homeBtn = getElement('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Home button clicked."); setPage('home'); });
    }

    const generatorBtn = getElement('generator-btn');
    if (generatorBtn) {
        generatorBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Generator button clicked."); setPage('generator'); });
    }

    if (logoBtn) {
        logoBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Logo button clicked."); setPage('home'); });
    }

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Hamburger button clicked."); toggleMobileMenu(); });
    }

    if (closeMobileMenuBtn) {
        closeMobileMenuBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Close Mobile Menu button clicked."); toggleMobileMenu(); });
    }

    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', () => {
            console.log(Date.now(), "Event: Mobile menu overlay clicked.");
            if (mobileMenu?.classList.contains('translate-x-0')) {
                toggleMobileMenu();
            }
        });
    }

    if (mobileNavLinks && mobileNavLinks.length > 0) {
        mobileNavLinks.forEach(link => {
            if (link) {
                link.addEventListener('click', (e) => {
                    console.log(Date.now(), `Event: Mobile nav link clicked: ${e.target.id}`);
                    if (e.target.id === 'mobile-home-btn') setPage('home');
                    else if (e.target.id === 'mobile-generator-btn') setPage('generator');
                    toggleMobileMenu();
                });
            }
        });
    }

    if (startCreatingBtn) {
        startCreatingBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Start Creating Now button clicked."); setPage('generator'); });
    }

    if (promptInput) {
        promptInput.addEventListener('input', (e) => {
            prompt = e.target.value;
            console.log(Date.now(), "Event: Prompt input changed. Current prompt:", prompt);
            updateUI();
        });
    }

    if (negativePromptInput) {
        negativePromptInput.addEventListener('input', (e) => {
            negativePrompt = e.target.value;
            console.log(Date.now(), "Event: Negative prompt input changed. Current negative prompt:", negativePrompt);
            updateUI();
        });
    }


    if (copyPromptBtn) {
        copyPromptBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Copy Prompt button clicked."); copyToClipboard(promptInput ? promptInput.value : ''); });
    }

    if (clearPromptBtn) {
        clearPromptBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Clear Prompt button clicked.");
            if (promptInput) promptInput.value = '';
            prompt = '';
            if (negativePromptInput) negativePromptInput.value = '';
            negativePrompt = '';
            enhancedPrompt = '';
            variationIdeas = [];
            imageUrl = '';
            showToast("Prompt cleared!", "info");
            updateUI();
        });
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Generate Image button clicked."); generateImage(); });
    }
    if (enhanceBtn) {
        enhanceBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Enhance Prompt button clicked."); enhancePrompt(); });
    }
    if (variationBtn) {
        variationBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Get Variation Ideas button clicked."); generateVariationIdeas(); });
    }

    if (useEnhancedPromptBtn) {
        useEnhancedPromptBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Use Enhanced Prompt button clicked.");
            prompt = enhancedPrompt;
            if (promptInput) promptInput.value = prompt;
            enhancedPrompt = '';
            updateUI();
            showToast("Enhanced prompt applied!", "success");
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Download Image button clicked."); downloadImage(); });
    }

    if (signInBtnDesktop) {
        signInBtnDesktop.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Sign In button clicked."); signInWithGoogle(); });
    }
    if (signOutBtnDesktop) {
        signOutBtnDesktop.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Sign Out button clicked."); signOutUser(); });
    }
    if (signInBtnMobile) {
        signInBtnMobile.addEventListener('click', () => { console.log(Date.now(), "Event: Mobile Sign In button clicked."); signInWithGoogle(); });
    }
    if (signOutBtnMobile) {
        signOutBtnMobile.addEventListener('click', () => { console.log(Date.now(), "Event: Mobile Sign Out button clicked."); signOutUser(); });
    }
    if (modalSignInBtn) {
        modalSignInBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Modal Sign In button clicked."); signInWithGoogle(); });
    }

    if (closeSigninModalBtn) {
        closeSigninModalBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Close Sign-in Modal button clicked.");
            signinRequiredModal?.classList.add('hidden');
        });
    }

    if (closeDebugMessageBtn) {
        closeDebugMessageBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Close Debug Message button clicked.");
            persistentDebugMessage?.classList.add('hidden');
        });
    }

    if (generatedImageElement) {
        generatedImageElement.onload = () => {
            console.log(Date.now(), "Event: generatedImageElement loaded successfully. Setting opacity to 1.");
            generatedImageElement.style.opacity = '1';
            generatedImageElement.classList.add('animate-image-reveal');
        };
        generatedImageElement.onerror = () => {
            console.error(Date.now(), "Event: generatedImageElement failed to load. Displaying placeholder.");
            setError("Failed to load image preview. The generated image data might be invalid or corrupted.");
            showToast("Image preview failed to load.", "error");
            if (imageDisplayContainer) imageDisplayContainer.classList.add('hidden');
        };
    }

    populateAspectRatioRadios();
    console.log(Date.now(), "setupEventListeners: All event listeners setup attempted.");
}

function initApp() {
    console.log(Date.now(), "initApp: Starting application initialization.");
    console.time("AppInitialization");

    try {
        initFirebase(); 

        homePageElement = getElement('home-page-element');
        generatorPageElement = getElement('generator-page-element');
        allPageElements = [homePageElement, generatorPageElement].filter(Boolean);

        persistentDebugMessage = getElement('persistent-debug-message');
        closeDebugMessageBtn = getElement('close-debug-message-btn');

        promptInput = getElement('prompt-input');
        negativePromptInput = getElement('negative-prompt-input');
        copyPromptBtn = getElement('copy-prompt-btn');
        clearPromptBtn = getElement('clear-prompt-btn');
        aspectRatioSelectionDiv = getElement('aspect-ratio-selection');
        generateBtn = getElement('generate-image-btn');
        enhanceBtn = getElement('enhance-prompt-btn');
        variationBtn = getElement('generate-variation-ideas-btn');
        useEnhancedPromptBtn = getElement('use-enhanced-prompt-btn');
        downloadBtn = getElement('download-image-btn');
        errorDisplay = getElement('error-display');
        imageDisplayContainer = getElement('image-display-container');
        generatedImageElement = getElement('generated-image');
        generatedImageWrapper = getElement('generated-image-wrapper');


        enhancedPromptDisplay = getElement('enhanced-prompt-display');
        enhancedPromptText = getElement('enhanced-prompt-text');
        variationIdeasDisplay = getElement('variation-ideas-display');
        variationIdeasList = getElement('variation-ideas-list');

        userDisplayDesktop = getElement('user-display-desktop');
        signInBtnDesktop = getElement('sign-in-btn-desktop');
        signOutBtnDesktop = getElement('sign-out-btn-desktop');
        userDisplayMobile = getElement('user-display-mobile');
        signInBtnMobile = getElement('sign-in-btn-mobile');
        signOutBtnMobile = getElement('sign-out-btn-mobile');
        freeGenerationsDisplay = getElement('free-generations-display');
        signinRequiredModal = getElement('signin-required-modal');
        modalSignInBtn = getElement('modal-sign-in-btn');
        closeSigninModalBtn = getElement('close-signin-modal-btn');
        startCreatingBtn = getElement('start-creating-btn');
        logoBtn = getElement('logo-btn');

        hamburgerBtn = getElement('hamburger-btn');
        hamburgerIcon = getElement('hamburger-icon');
        mobileMenu = getElement('mobile-menu');
        mobileMenuOverlay = getElement('mobile-menu-overlay');
        closeMobileMenuBtn = getElement('close-mobile-menu-btn');
        mobileNavLinks = document.querySelectorAll('#mobile-menu .mobile-nav-link'); 

        toastContainer = getElement('toast-container');

        console.log(Date.now(), "initApp: All UI element references obtained.");

        console.log(Date.now(), "initApp: Calling setupEventListeners().");
        setupEventListeners();
        
        console.log(Date.now(), "initApp: Calling setPage('home').");
        setPage('home');

        console.timeEnd("AppInitialization");
        console.log(Date.now(), "initApp: App initialization complete.");

    } catch (criticalError) {
        console.error(Date.now(), "CRITICAL ERROR: Uncaught error during initApp execution:", criticalError);
        document.body.innerHTML = `<div style="color: white; background-color: red; padding: 20px; text-align: center;">
            <h1>Application Failed to Load</h1>
            <p>A critical error occurred during startup. Please check your browser's console (F12) for details.</p>
            <p>Error: ${criticalError.message}</p>
        </div>`;
        if (persistentDebugMessage) {
            persistentDebugMessage.classList.remove('hidden');
            persistentDebugMessage.querySelector('p').textContent = `A critical error occurred during startup: ${criticalError.message}. Please open your browser's Developer Console (F12) and copy all messages to the AI for debugging.`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log(Date.now(), "script.js: DOMContentLoaded event listener triggered. Initiating app.");
    initApp();
});
