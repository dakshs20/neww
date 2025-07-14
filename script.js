// This console log will appear if the script file is even loaded and parsed.
console.log(Date.now(), "script.js: File started parsing.");

// Import Firebase functions directly as a module
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, addDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

console.log(Date.now(), "script.js: Firebase imports attempted.");

// --- Firebase Configuration (Declared at top level) ---
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y", // REPLACE WITH YOUR ACTUAL API KEY
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.firebasestorage.app",
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
let imageUrl = ''; // For generated image
let loading = false; // For image generation
let currentError = ''; // Error message for display
let currentPage = 'home'; // 'home', 'generator'
let isSigningIn = false; // New state for sign-in loading
let isAuthReady = false; // Flag to indicate if Firebase Auth state has been checked and services initialized

let aspectRatio = '1:1'; // Default aspect ratio

let enhancedPrompt = '';
let loadingEnhancePrompt = false;
let variationIdeas = [];
let loadingVariationIdeas = false;

let uploadedBaseImageBase64 = null; // Stores the base64 string of the uploaded image
let loadingImageSynthesis = false; // New loading state for Gemini's prompt synthesis


// IMPORTANT: Your Google Cloud API Key for Imagen/Gemini (Declared at top level)
// REPLACE "YOUR_ACTUAL_GENERATED_API_KEY_HERE_PASTE_YOUR_KEY_HERE" WITH THE KEY YOU OBTAINED FROM GOOGLE CLOUD CONSOLE
const IMAGEN_GEMINI_API_KEY = "AIzaSyBZxXWl9s2AeSCzMrfoEfnYWpGyfvP7jqs";
console.log(Date.now(), "script.js: IMAGEN_GEMINI_API_KEY value set at top level.");


// --- UI Element References (Will be populated in initApp) ---
let homePageElement;
let generatorPageElement;
let allPageElements = []; // Group for easy iteration

let persistentDebugMessage;
let closeDebugMessageBtn;

let promptInput;
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
let generatedImageWrapper; // New reference for the image's parent div

let baseImageUploadInput; // New
let baseImagePreview; // New
let baseImagePreviewContainer; // New
let clearBaseImageBtn; // New

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
let mobileNavLinks;

let toastContainer;


// --- Helper function to get elements and log if not found (Declared at top level) ---
const getElement = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.error(Date.now(), `getElement: Element with ID '${id}' NOT FOUND in the DOM.`);
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
        isAuthReady = true; // Set to true immediately after Firebase services are initialized
        console.log(Date.now(), "initFirebase: isAuthReady set to true.");

        // Firebase Auth State Listener - Moved here to ensure 'auth' is defined
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
                if (localStorage.getItem('freeGenerationsLeft') === null || parseInt(localStorage.getItem('freeGenerationsLeft')) < 0) {
                    freeGenerationsLeft = 3;
                    localStorage.setItem('freeGenerationsLeft', freeGenerationsLeft);
                    console.log(Date.now(), "onAuthStateChanged: Reset freeGenerationsLeft to 3 for unauthenticated user (local storage).");
                } else {
                    freeGenerationsLeft = parseInt(localStorage.getItem('freeGenerationsLeft'));
                    console.log(Date.now(), "onAuthStateChanged: Loaded freeGenerationsLeft from local storage:", freeGenerationsLeft);
                }
            }
            isAuthReady = true; // Confirm auth state is fully processed
            console.log(Date.now(), "onAuthStateChanged: isAuthReady confirmed true. Updating UI.");
            updateUI(); // Update UI immediately after auth state is determined
            console.log(Date.now(), "onAuthStateChanged: Auth state processing complete.");
        });

    } catch (e) {
        console.error(Date.now(), "initFirebase: CRITICAL ERROR: Error initializing Firebase:", e);
        currentError = `Firebase initialization failed: ${e.message}. App may not function correctly.`;
        // Attempt to show persistent debug message within initApp's scope
        if (persistentDebugMessage) {
            persistentDebugMessage.classList.remove('hidden');
            const msgP = persistentDebugMessage.querySelector('p');
            if (msgP) msgP.textContent = currentError + " Please check console (F12) for details.";
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
        console.error(Date.now(), "toggleMobileMenu: One or more mobile menu elements not found. Cannot toggle.");
    }
}

// --- Authentication Functions (Declared at top level) ---
async function signInWithGoogle() {
    console.log(Date.now(), "signInWithGoogle: Function entered.");
    clearError();

    if (isSigningIn) {
        console.log(Date.now(), "signInWithGoogle: Already signing in, ignoring multiple clicks.");
        return;
    }

    isSigningIn = true;
    updateSignInButtons(true);
    
    const testWindow = window.open('', '_blank', 'width=1,height=1,left=0,top=0');
    if (testWindow) {
        testWindow.close();
        console.log(Date.now(), "signInWithGoogle: Popup blocker check passed.");
    } else {
        console.warn(Date.now(), "signInWithGoogle: Popup blocker check failed. Popups might be blocked.");
        setError("Your browser might be blocking the sign-in popup. Please allow popups for this site and try again.");
        isSigningIn = false;
        updateSignInButtons(false);
        return;
    }

    console.time("signInWithPopup");
    try {
        if (!auth || !googleProvider) {
            console.error(Date.now(), "signInWithGoogle: Firebase Auth or Google Provider not initialized. Cannot sign in.");
            setError("Firebase services not ready. Please refresh and try again.");
            return;
        }
        console.log(Date.now(), "signInWithGoogle: Attempting signInWithPopup call...");
        const result = await signInWithPopup(auth, googleProvider);
        console.log(Date.now(), "signInWithGoogle: signInWithPopup successful. User:", result.user.uid, result.user.displayName || result.user.email);
        signinRequiredModal?.classList.add('hidden');
    } catch (error) {
        console.error(Date.now(), "signInWithGoogle: Error during Google Sign-In:", error);
        console.error(Date.now(), "signInWithGoogle: Error code:", error.code);
        console.error(Date.now(), "signInWithGoogle: Error message:", error.message);
        if (error.code === 'auth/popup-closed-by-user') {
            setError('Sign-in popup closed. Please try again.');
        } else if (error.code === 'auth/cancelled-popup-request') {
            setError('Sign-in popup was already open or another request was pending. Please try again.');
        } else if (error.code === 'auth/network-request-failed') {
            setError('Network error during sign-in. Check your internet connection.');
        } else if (error.code === 'auth/unauthorized-domain') {
            setError('Authentication failed: Unauthorized domain. Please check Firebase Console -> Authentication -> Sign-in method -> Authorized domains and add your current domain (e.g., localhost, or your preview URL).');
        } else if (error.code === 'auth/popup-blocked') {
            setError('Sign-in popup was blocked by your browser. Please disable popup blockers for this site and try again.');
        }
        else {
            setError(`Failed to sign in: ${error.message}`);
        }
    } finally {
        console.timeEnd("signInWithPopup");
        isSigningIn = false;
        updateSignInButtons(false);
        updateUI();
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
            btn.disabled = loadingState;
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
        updateUI();
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
            showToast(`Welcome back, ${currentUser.displayName || currentUser.email}!`, "success");
        } else {
            console.log(Date.now(), "fetchUserData: User document does not exist for UID:", uid, ". Initializing new user data in Firestore with 3 free generations.");
            await setDoc(userDocRef, {
                freeGenerationsLeft: 3,
                createdAt: serverTimestamp()
            });
            freeGenerationsLeft = 3;
            console.log(Date.now(), "fetchUserData: New user data initialized in Firestore for UID:", uid);
            showToast(`Welcome, ${currentUser.displayName || currentUser.email}! You have 3 free generations.`, "success");
        }
        localStorage.removeItem('freeGenerationsLeft');
        console.log(Date.now(), "fetchUserData: Removed freeGenerationsLeft from local storage for authenticated user.");
    } catch (error) {
        console.error(Date.now(), "fetchUserData: Error fetching/initializing user data:", error);
        throw error;
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
        aspectRatioSelectionDiv.innerHTML = '';
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
                    updateImageWrapperAspectRatio(); // Update wrapper aspect ratio immediately
                });
            }
            aspectRatioSelectionDiv.appendChild(label);
        });
        console.log(Date.now(), "populateAspectRatioRadios: Aspect ratio radios populated.");
    } else {
        console.error(Date.now(), "populateAspectRatioRadios: aspectRatioSelectionDiv element not found.");
    }
}

// --- Page Visibility Logic (Declared at top level) ---
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
        updateImageWrapperAspectRatio(); // Ensure correct aspect ratio when navigating to generator page
    }

    if (newPageElement) {
        newPageElement.classList.remove('hidden');
        void newPageElement.offsetWidth; // Trigger reflow for animation
        newPageElement.classList.add('animate-fade-in-up');
        console.log(Date.now(), `setPage: Displayed page '${newPage}' and applied animation.`);
    } else {
        console.error(Date.now(), `setPage: New page element for '${newPage}' not found.`);
    }

    currentPage = newPage;
    updateUI();
    console.log(Date.now(), `setPage: Page switched to: ${currentPage}.`);
}

function updateUI() {
    console.log(Date.now(), `updateUI: Updating UI for current page: ${currentPage}. Auth Ready: ${isAuthReady}`);

    const interactiveElements = [
        homePageElement, generatorPageElement, logoBtn,
        hamburgerBtn, closeMobileMenuBtn, mobileMenuOverlay,
        startCreatingBtn, promptInput, copyPromptBtn, clearPromptBtn, generateBtn,
        enhanceBtn, variationBtn, useEnhancedPromptBtn,
        downloadBtn, signInBtnDesktop, signOutBtnDesktop,
        signInBtnMobile, signOutBtnMobile, modalSignInBtn,
        closeSigninModalBtn,
        baseImageUploadInput, clearBaseImageBtn // New elements
    ];

    interactiveElements.forEach(el => {
        if (el) {
            const isAuthButton = el.id && (el.id.includes('sign-in-btn') || el.id.includes('sign-out-btn') || el.id.includes('modal-sign-in-btn'));
            const isGeneratorButton = el.id && (el.id === 'generate-image-btn' || el.id === 'enhance-prompt-btn' || el.id === 'generate-variation-ideas-btn');
            
            if (isAuthButton) {
                el.disabled = isSigningIn;
                el.classList.toggle('opacity-50', isSigningIn);
                el.classList.toggle('cursor-not-allowed', isSigningIn);
            } else if (isGeneratorButton) {
                // Buttons are enabled if isAuthReady is true AND (user is logged in OR has free generations)
                const shouldDisableGenerator = !isAuthReady || (!currentUser && freeGenerationsLeft <= 0);
                el.disabled = loading || loadingEnhancePrompt || loadingVariationIdeas || loadingImageSynthesis || shouldDisableGenerator;
                el.classList.toggle('opacity-50', el.disabled);
                el.classList.toggle('cursor-not-allowed', el.disabled);
            } else {
                // Other general buttons are enabled if isAuthReady is true
                el.disabled = !isAuthReady;
                el.classList.toggle('opacity-50', !isAuthReady);
                el.classList.toggle('cursor-not-allowed', !isAuthReady);
            }
        }
    });

    homePageElement?.classList.toggle('bg-white/10', currentPage === 'home');
    homePageElement?.classList.toggle('text-blue-100', currentPage === 'home');
    homePageElement?.classList.toggle('text-gray-300', currentPage !== 'home');

    generatorPageElement?.classList.toggle('bg-white/10', currentPage === 'generator');
    generatorPageElement?.classList.toggle('text-blue-100', currentPage === 'generator');
    generatorPageElement?.classList.toggle('text-gray-300', currentPage !== 'generator');
    console.log(Date.now(), "updateUI: Header button states updated.");

    if (currentPage === 'generator') {
        updateGeneratorPageUI();
    }
    updateUIForAuthStatus();
    console.log(Date.now(), "updateUI: Finished general UI update.");
}

function updateGeneratorPageUI() {
    console.log(Date.now(), "updateGeneratorPageUI: Updating dynamic generator UI.");
    if (promptInput) promptInput.value = prompt;

    if (freeGenerationsDisplay) {
        if (currentUser) {
            freeGenerationsDisplay.textContent = `You have unlimited generations!`;
            freeGenerationsDisplay.classList.remove('text-red-400', 'text-gray-400');
            freeGenerationsDisplay.classList.add('text-green-400');
            console.log(Date.now(), "updateGeneratorPageUI: Displaying unlimited generations for authenticated user.");
        } else {
            freeGenerationsDisplay.textContent = `You have ${freeGenerationsLeft} generations left without sign in.`;
            if (freeGenerationsLeft <= 0) {
                freeGenerationsDisplay.classList.remove('text-green-400', 'text-gray-400');
                freeGenerationsDisplay.classList.add('text-red-400');
                console.log(Date.now(), "updateGeneratorPageUI: Displaying 0 generations left, red text.");
            } else {
                freeGenerationsDisplay.classList.remove('text-red-400', 'text-gray-400');
                freeGenerationsDisplay.classList.add('text-green-400');
                console.log(Date.now(), "updateGeneratorPageUI: Displaying free generations left, green text.");
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

        if (loadingImageSynthesis) { // New loading state for Gemini synthesis
            loadingText = 'Analyzing Image & Prompt...';
        }

        generateBtn.innerHTML = (loading || loadingImageSynthesis) ? `
            <span class="flex items-center justify-center">
                <svg class="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
                ${loadingText}
            </span>
        ` : buttonText;

        generateBtn.classList.toggle('bg-gray-700', loading || loadingImageSynthesis);
        generateBtn.classList.toggle('cursor-not-allowed', loading || loadingImageSynthesis);
        generateBtn.classList.toggle('bg-gradient-to-r', !(loading || loadingImageSynthesis));
        generateBtn.classList.toggle('from-blue-700', !(loading || loadingImageSynthesis));
        generateBtn.classList.toggle('to-indigo-800', !(loading || loadingImageSynthesis));
        generateBtn.classList.toggle('hover:from-blue-800', !(loading || loadingImageSynthesis));
        generateBtn.classList.toggle('hover:to-indigo-900', !(loading || loadingImageSynthesis));

        generateBtn.classList.remove('from-red-600', 'to-red-700', 'hover:from-red-700', 'hover:to-red-800',
                                   'from-gray-600', 'to-gray-700', 'hover:from-gray-700', 'hover:to-gray-800');


        if (loading || loadingImageSynthesis) {
            // Handled above
        } else if (!currentUser && freeGenerationsLeft <= 0) {
            generateBtn.classList.add('from-red-600', 'to-red-700', 'hover:from-red-700', 'hover:to-red-800');
            generateBtn.disabled = false;
        } else {
            generateBtn.classList.add('from-blue-700', 'to-indigo-800', 'hover:from-blue-800', 'hover:to-indigo-900');
            generateBtn.disabled = false;
        }
        console.log(Date.now(), "updateGeneratorPageUI: Generate button state updated.");
    }

    if (errorDisplay) {
        errorDisplay.textContent = currentError;
        errorDisplay.classList.toggle('hidden', !currentError);
        console.log(Date.now(), "updateGeneratorPageUI: Error display updated. Hidden:", !currentError);
    }

    if (imageDisplayContainer && generatedImageElement) {
        if (loading || loadingImageSynthesis) {
            imageDisplayContainer.classList.add('hidden');
            console.log(Date.now(), "updateGeneratorPageUI: Image container hidden (loading).");
        } else if (imageUrl) {
            imageDisplayContainer.classList.remove('hidden');
            generatedImageElement.src = imageUrl;
            generatedImageElement.alt = `AI generated image based on prompt: ${prompt}`;
            // The style for the image itself is now minimal, relying on the wrapper for aspect ratio
            generatedImageElement.style.width = '100%';
            generatedImageElement.style.height = '100%';
            generatedImageElement.style.objectFit = 'contain'; // Ensure it fits without stretching

            generatedImageElement.classList.add('animate-image-reveal');
            console.log(Date.now(), "updateGeneratorPageUI: Image container shown with new image.");
            // NEW DEBUG LOGS FOR IMAGE DISPLAY
            console.log(Date.now(), "DEBUG: generatedImageElement.outerHTML:", generatedImageElement.outerHTML);
            console.log(Date.now(), "DEBUG: imageDisplayContainer.outerHTML:", imageDisplayContainer.outerHTML);
        } else {
            imageDisplayContainer.classList.add('hidden');
            console.log(Date.now(), "updateGeneratorPageUI: Image container hidden (no image).");
        }
    }

    // New: Base Image Preview visibility
    if (baseImagePreviewContainer && baseImagePreview) {
        if (uploadedBaseImageBase64) {
            baseImagePreview.src = uploadedBaseImageBase64;
            baseImagePreviewContainer.classList.remove('hidden');
            console.log(Date.now(), "updateGeneratorPageUI: Base image preview shown.");
        } else {
            baseImagePreview.src = ''; // Clear source
            baseImagePreviewContainer.classList.add('hidden');
            console.log(Date.now(), "updateGeneratorPageUI: Base image preview hidden.");
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
        console.log(Date.now(), "updateGeneratorPageUI: Enhance button state updated.");
    }

    if (enhancedPromptDisplay && enhancedPromptText) {
        enhancedPromptText.textContent = enhancedPrompt;
        enhancedPromptDisplay.classList.toggle('hidden', !enhancedPrompt);
        // Show/hide use-enhanced-prompt-btn based on enhancedPrompt presence
        if (useEnhancedPromptBtn) {
            useEnhancedPromptBtn.classList.toggle('hidden', !enhancedPrompt);
        }
        console.log(Date.now(), "updateGeneratorPageUI: Enhanced prompt display updated. Hidden:", !enhancedPrompt);
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
        console.log(Date.now(), "updateGeneratorPageUI: Variation ideas button state updated.");
    }

    if (variationIdeasDisplay && variationIdeasList) {
        variationIdeasList.innerHTML = variationIdeas.map(idea => `<li>${idea}</li>`).join('');
        variationIdeasDisplay.classList.toggle('hidden', variationIdeas.length === 0);
        console.log(Date.now(), "updateGeneratorPageUI: Variation ideas display updated. Hidden:", variationIdeas.length === 0);
    }
}

/**
 * Dynamically sets the padding-bottom on the image wrapper to maintain aspect ratio.
 * This creates a container that holds the image without stretching it.
 */
function updateImageWrapperAspectRatio() {
    if (!generatedImageWrapper) {
        console.warn(Date.now(), "updateImageWrapperAspectRatio: generatedImageWrapper not found.");
        return;
    }

    let paddingBottomPercentage;
    switch (aspectRatio) {
        case '1:1': paddingBottomPercentage = '100%'; break; // Height = Width
        case '4:5': paddingBottomPercentage = '125%'; break; // Height = 5/4 * Width
        case '9:16': paddingBottomPercentage = '177.77%'; break; // Height = 16/9 * Width
        case '16:9': paddingBottomPercentage = '56.25%'; break; // Height = 9/16 * Width
        default: paddingBottomPercentage = '100%'; break; // Default to square
    }

    // Apply the padding-bottom hack to the wrapper
    generatedImageWrapper.style.position = 'relative';
    generatedImageWrapper.style.width = '100%'; // Ensure it takes full width
    generatedImageWrapper.style.paddingBottom = paddingBottomPercentage;
    generatedImageWrapper.style.height = '0'; // Crucial for padding-bottom hack

    // Ensure the image inside is absolutely positioned to fill this new container
    if (generatedImageElement) {
        generatedImageElement.style.position = 'absolute';
        generatedImageElement.style.top = '0';
        generatedImageElement.style.left = '0';
        generatedImageElement.style.width = '100%';
        generatedImageElement.style.height = '100%';
        generatedImageElement.style.objectFit = 'contain'; // This is key: image fits without stretching
    }
    console.log(Date.now(), `updateImageWrapperAspectRatio: Wrapper aspect ratio set to ${aspectRatio} (${paddingBottomPercentage}).`);
}

/**
 * Handles the file upload for the base image, converts it to Base64, and displays a preview.
 * @param {Event} event The change event from the file input.
 */
function handleBaseImageUpload(event) {
    console.log(Date.now(), "handleBaseImageUpload: File input change detected.");
    const file = event.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file (PNG, JPEG, WEBP).');
            showToast('Invalid file type. Please upload an image.', 'error');
            clearBaseImage(); // Clear any previous selection
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5 MB limit
            setError('Image file size exceeds 5MB limit.');
            showToast('Image too large. Max 5MB.', 'error');
            clearBaseImage();
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedBaseImageBase64 = e.target.result;
            // The image preview will be updated by updateGeneratorPageUI
            updateUI();
            showToast('Image uploaded successfully!', 'success');
            console.log(Date.now(), "handleBaseImageUpload: Image read and stored as Base64.");
        };
        reader.onerror = (e) => {
            setError('Failed to read image file.');
            showToast('Failed to read image file.', 'error');
            console.error(Date.now(), "handleBaseImageUpload: Error reading file:", e);
            clearBaseImage();
        };
        reader.readAsDataURL(file);
    } else {
        clearBaseImage();
        console.log(Date.now(), "handleBaseImageUpload: No file selected, clearing base image.");
    }
}

/**
 * Clears the uploaded base image and its preview.
 */
function clearBaseImage() {
    uploadedBaseImageBase64 = null;
    if (baseImageUploadInput) baseImageUploadInput.value = ''; // Clear file input
    updateUI();
    showToast('Base image cleared.', 'info');
    console.log(Date.now(), "clearBaseImage: Base image state reset.");
}

/**
 * Calls the Gemini API to synthesize a new image generation prompt based on an uploaded image and text prompt.
 * @param {string} textPrompt The user's text prompt.
 * @param {string} imageBase64 The base64 string of the uploaded image.
 * @returns {Promise<string>} A promise that resolves with the synthesized prompt.
 */
async function synthesizeImagePromptWithGemini(textPrompt, imageBase64) {
    console.log(Date.now(), "synthesizeImagePromptWithGemini: Starting prompt synthesis with Gemini.");
    loadingImageSynthesis = true;
    updateUI(); // Update UI to show loading state for synthesis
    showToast("Analyzing image and prompt with AI...", "info");

    try {
        const geminiInstruction = `
            You are an advanced AI image generation prompt engineer specializing in image-to-image transformations.
            I will provide you with a BASE IMAGE and a TEXT PROMPT.
            Your goal is to create a single, comprehensive, and highly effective text prompt for a cutting-edge image generation model (like Imagen 3.0).
            This prompt must instruct the model to:
            1.  **Analyze the BASE IMAGE:** Understand its core subjects, composition, dominant colors, lighting, and general aesthetic/style.
            2.  **Integrate the TEXT PROMPT:** Apply the instructions and concepts from the TEXT PROMPT as modifications, additions, or stylistic changes *to the content and style derived from the BASE IMAGE*.
            3.  **Focus on Transformation:** The output image should be a clear transformation or reimagining of the BASE IMAGE, not a completely new image. The TEXT PROMPT guides this transformation.
            4.  **Be Descriptive:** Include rich details about subjects, environment, lighting, textures, and specific artistic styles (e.g., "photorealistic," "oil painting," "cyberpunk," "dreamy").
            5.  **Maintain Cohesion:** Ensure the final prompt creates a coherent vision that blends both visual and textual inputs.

            DO NOT output any conversational text, only the final, optimized image generation prompt.

            TEXT PROMPT: "${textPrompt}"
        `;

        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: geminiInstruction },
                        {
                            inlineData: {
                                mimeType: uploadedBaseImageBase64.split(';')[0].split(':')[1], // Extract mime type from base64 string
                                data: imageBase64.split(',')[1] // Extract base64 data part
                            }
                        }
                    ]
                }
            ],
        };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${IMAGEN_GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error during synthesis: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            const synthesizedPrompt = result.candidates[0].content.parts[0].text.trim();
            console.log(Date.now(), "synthesizeImagePromptWithGemini: Synthesized prompt:", synthesizedPrompt);
            showToast("Image and prompt analyzed!", "success");
            return synthesizedPrompt;
        } else {
            throw new Error('Gemini response missing content during prompt synthesis.');
        }
    } catch (e) {
        setError(`Error synthesizing prompt with image: ${e.message || 'Unknown error'}.`);
        showToast(`Image analysis failed: ${e.message}`, "error");
        console.error(Date.now(), 'synthesizeImagePromptWithGemini: Error:', e);
        return null; // Return null on error
    } finally {
        loadingImageSynthesis = false;
        updateUI(); // Update UI to clear synthesis loading state
        console.log(Date.now(), "synthesizeImagePromptWithGemini: Prompt synthesis finished.");
    }
}


/**
 * Calls the Gemini API to enhance the current prompt for more detailed and versatile image generation.
 */
async function enhancePrompt() {
    console.log(Date.now(), "enhancePrompt: Function called.");
    clearError();

    if (!prompt.trim()) {
        setError('Please enter a prompt to enhance.');
        updateUI();
        showToast("Enter a prompt to enhance.", "info");
        return;
    }

    loadingEnhancePrompt = true;
    enhancedPrompt = ''; // Clear previous enhanced prompt
    updateUI();
    showToast("Enhancing your prompt...", "info");
    console.time("enhancePromptAPI");

    try {
        const promptToEnhance = promptInput.value;
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

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
        }

        const result = await response.json();
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

/**
 * Calls the Gemini API to generate creative variation ideas for the current prompt.
 */
async function generateVariationIdeas() {
    console.log(Date.now(), "generateVariationIdeas: Function called.");
    clearError();

    if (!prompt.trim()) {
        setError('Please enter a prompt to get variation ideas.');
        updateUI();
        showToast("Enter a prompt to get ideas.", "info");
        return;
    }

    loadingVariationIdeas = true;
    variationIdeas = []; // Clear previous ideas
    updateUI();
    showToast("Generating variation ideas...", "info");
    console.time("generateVariationIdeasAPI");

    try {
        const promptForIdeas = promptInput.value;
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

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
        }

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            const rawIdeas = result.candidates[0].content.parts[0].text.trim();
            // Parse the numbered list into an array
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
        console.error(Date.now(), "generateImage: API Key not configured.");
        showToast("API Key missing for image generation. Check console.", "error");
        return;
    }

    if (!prompt.trim() && !uploadedBaseImageBase64) {
        setError('Please enter a prompt or upload a base image to generate an image.');
        updateUI();
        console.warn(Date.now(), "generateImage: Prompt and image are empty.");
        showToast("Please enter a prompt or upload an image.", "info");
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
        let finalPromptForImagen = prompt;

        // If a base image is uploaded, synthesize the prompt using Gemini
        if (uploadedBaseImageBase64) {
            console.log(Date.now(), "generateImage: Base image detected. Synthesizing prompt with Gemini.");
            finalPromptForImagen = await synthesizeImagePromptWithGemini(prompt, uploadedBaseImageBase64);
            if (!finalPromptForImagen) {
                // Error already handled by synthesizeImagePromptWithGemini
                return; 
            }
            showToast("Generated prompt from image and text. Now generating image...", "info");
        }

        // Only add text-specific keywords if the prompt explicitly implies text content
        const textKeywords = ['text', 'number', 'letter', 'font', 'word', 'digits', 'characters'];
        const containsTextKeyword = textKeywords.some(keyword => finalPromptForImagen.toLowerCase().includes(keyword));

        if (containsTextKeyword) {
            finalPromptForImagen += ", clear, legible, sharp, high-resolution text, sans-serif font, precisely rendered, not distorted, no gibberish, accurate spelling, crisp edges";
            console.log(Date.now(), "generateImage: Added text-specific enhancements to prompt.");
        }

        // --- ENHANCED ASPECT RATIO PROMPT ENGINEERING ---
        let aspectRatioInstruction = '';
        switch (aspectRatio) {
            case '1:1': 
                aspectRatioInstruction = ', square format, 1:1 aspect ratio, balanced composition'; 
                break;
            case '4:5': 
                aspectRatioInstruction = ', portrait orientation, 4:5 aspect ratio, tall and narrow composition, vertical format'; 
                break;
            case '9:16': 
                aspectRatioInstruction = ', ultra-portrait orientation, 9:16 aspect ratio, extremely tall and narrow composition, vertical smartphone screen format'; 
                break;
            case '16:9': 
                aspectRatioInstruction = ', landscape orientation, 16:9 aspect ratio, wide and cinematic composition, horizontal widescreen format'; 
                break;
        }
        finalPromptForImagen += aspectRatioInstruction;
        // --- END ENHANCED ASPECT RATIO PROMPT ENGINEERING ---

        console.log(Date.now(), "generateImage: Final prompt for Imagen API:", finalPromptForImagen);


        const payload = { instances: { prompt: finalPromptForImagen }, parameters: { "sampleCount": 1 } };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${IMAGEN_GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(Date.now(), "generateImage: API fetch response received.");

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Imagen API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
        }

        const result = await response.json();
        console.log(Date.now(), "generateImage: API response parsed.", result);

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

// Removed getImageDisplayStyles as its logic is now handled by updateImageWrapperAspectRatio
// function getImageDisplayStyles() {
//     switch (aspectRatio) {
//         case '1:1': return 'width: 100%; height: auto; aspect-ratio: 1 / 1;';
//         case '4:5': return 'width: 100%; height: auto; aspect-ratio: 4 / 5;';
//         case '9:16': return 'width: 100%; height: auto; aspect-ratio: 9 / 16;';
//         case '16:9': return 'width: 100%; height: auto; aspect-ratio: 16 / 9;';
//         default: return 'width: 100%; height: auto;';
//     }
// }


// --- Event Listeners Setup (Declared at top level, called in initApp) ---
function setupEventListeners() {
    console.log(Date.now(), "setupEventListeners: Setting up all event listeners...");

    // Header Navigation Buttons
    const homeBtn = getElement('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Home button clicked."); setPage('home'); });
        console.log(Date.now(), "Event Listener Attached: home-btn");
    }

    const generatorBtn = getElement('generator-btn');
    if (generatorBtn) {
        generatorBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Generator button clicked."); setPage('generator'); });
        console.log(Date.now(), "Event Listener Attached: generator-btn");
    }

    if (logoBtn) {
        logoBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Logo button clicked."); setPage('home'); });
        console.log(Date.now(), "Event Listener Attached: logoBtn");
    }

    // Mobile Menu Buttons
    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Hamburger button clicked."); toggleMobileMenu(); });
        console.log(Date.now(), "Event Listener Attached: hamburgerBtn");
    }

    if (closeMobileMenuBtn) {
        closeMobileMenuBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Close Mobile Menu button clicked."); toggleMobileMenu(); });
        console.log(Date.now(), "Event Listener Attached: closeMobileMenuBtn");
    }

    if (mobileMenuOverlay) {
        mobileMenuOverlay.addEventListener('click', () => {
            console.log(Date.now(), "Event: Mobile menu overlay clicked.");
            if (mobileMenu?.classList.contains('translate-x-0')) {
                toggleMobileMenu();
            }
        });
        console.log(Date.now(), "Event Listener Attached: mobileMenuOverlay");
    }

    mobileNavLinks.forEach(link => {
        if (link) {
            link.addEventListener('click', (e) => {
                console.log(Date.now(), `Event: Mobile nav link clicked: ${e.target.id}`);
                if (e.target.id === 'mobile-home-btn') setPage('home');
                else if (e.target.id === 'mobile-generator-btn') setPage('generator');
                toggleMobileMenu();
            });
            console.log(Date.now(), `Event Listener Attached: mobile-nav-link (${link.id})`);
        }
    });

    // Home Page Button
    if (startCreatingBtn) {
        startCreatingBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Start Creating Now button clicked."); setPage('generator'); });
        console.log(Date.now(), "Event Listener Attached: startCreatingBtn");
    }

    // Generator Page Controls
    if (promptInput) {
        promptInput.addEventListener('input', (e) => {
            prompt = e.target.value;
            console.log(Date.now(), "Event: Prompt input changed. Current prompt:", prompt);
        });
        console.log(Date.now(), "Event Listener Attached: promptInput");
    }

    if (copyPromptBtn) {
        copyPromptBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Copy Prompt button clicked."); copyToClipboard(promptInput.value); });
        console.log(Date.now(), "Event Listener Attached: copyPromptBtn");
    }

    if (clearPromptBtn) {
        clearPromptBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Clear Prompt button clicked.");
            promptInput.value = '';
            prompt = '';
            enhancedPrompt = ''; // Clear enhanced prompt too
            variationIdeas = []; // Clear variation ideas too
            clearBaseImage(); // Clear base image too
            updateUI(); // Re-render UI to hide enhanced/variation displays
            showToast("Prompt cleared!", "info");
        });
        console.log(Date.now(), "Event Listener Attached: clearPromptBtn");
    }

    // New: Base Image Upload and Clear
    if (baseImageUploadInput) {
        baseImageUploadInput.addEventListener('change', handleBaseImageUpload);
        console.log(Date.now(), "Event Listener Attached: base-image-upload");
    }
    if (clearBaseImageBtn) {
        clearBaseImageBtn.addEventListener('click', clearBaseImage);
        console.log(Date.now(), "Event Listener Attached: clear-base-image-btn");
    }


    if (generateBtn) {
        generateBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Generate Image button clicked."); generateImage(); });
        console.log(Date.now(), "Event Listener Attached: generateBtn");
    }
    if (enhanceBtn) {
        enhanceBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Enhance Prompt button clicked."); enhancePrompt(); });
        console.log(Date.now(), "Event Listener Attached: enhanceBtn");
    }
    if (variationBtn) {
        variationBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Get Variation Ideas button clicked."); generateVariationIdeas(); });
        console.log(Date.now(), "Event Listener Attached: variationBtn");
    }

    if (useEnhancedPromptBtn) {
        useEnhancedPromptBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Use Enhanced Prompt button clicked.");
            prompt = enhancedPrompt;
            enhancedPrompt = ''; // Clear it after use
            updateUI();
            showToast("Enhanced prompt applied!", "success");
        });
        console.log(Date.now(), "Event Listener Attached: useEnhancedPromptBtn");
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Download Image button clicked."); downloadImage(); });
        console.log(Date.now(), "Event Listener Attached: downloadBtn");
    }

    // Auth Buttons
    if (signInBtnDesktop) {
        signInBtnDesktop.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Sign In button clicked."); signInWithGoogle(); });
        console.log(Date.now(), "Event Listener Attached: signInBtnDesktop");
    }
    if (signOutBtnDesktop) {
        signOutBtnDesktop.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Sign Out button clicked."); signOutUser(); });
        console.log(Date.now(), "Event Listener Attached: signOutBtnDesktop");
    }
    if (signInBtnMobile) {
        signInBtnMobile.addEventListener('click', () => { console.log(Date.now(), "Event: Mobile Sign In button clicked."); signInWithGoogle(); });
        console.log(Date.now(), "Event Listener Attached: signInBtnMobile");
    }
    if (signOutBtnMobile) {
        signOutBtnMobile.addEventListener('click', () => { console.log(Date.now(), "Event: Mobile Sign Out button clicked."); signOutUser(); });
        console.log(Date.now(), "Event Listener Attached: signOutBtnMobile");
    }
    if (modalSignInBtn) {
        modalSignInBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Modal Sign In button clicked."); signInWithGoogle(); });
        console.log(Date.now(), "Event Listener Attached: modalSignInBtn");
    }

    if (closeSigninModalBtn) {
        closeSigninModalBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Close Sign-in Modal button clicked.");
            signinRequiredModal?.classList.add('hidden');
        });
        console.log(Date.now(), "Event Listener Attached: closeSigninModalBtn");
    }

    if (closeDebugMessageBtn) {
        closeDebugMessageBtn.addEventListener('click', () => {
            console.log(Date.now(), "Event: Close Debug Message button clicked.");
            persistentDebugMessage?.classList.add('hidden');
        });
        console.log(Date.now(), "Event Listener Attached: closeDebugMessageBtn");
    }

    populateAspectRatioRadios();
    console.log(Date.now(), "setupEventListeners: All event listeners setup attempted.");
}

// --- Main application initialization function ---
function initApp() {
    console.log(Date.now(), "initApp: Starting application initialization.");
    console.time("AppInitialization");

    try {
        // Initialize Firebase services first
        initFirebase();

        // Populate UI Element References here, after DOM is ready
        homePageElement = getElement('home-page-element');
        generatorPageElement = getElement('generator-page-element');
        allPageElements = [homePageElement, generatorPageElement].filter(Boolean); // Filter out nulls

        persistentDebugMessage = getElement('persistent-debug-message');
        closeDebugMessageBtn = getElement('close-debug-message-btn');

        promptInput = getElement('prompt-input');
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
        generatedImageWrapper = getElement('generated-image-wrapper'); // Get reference to the new wrapper

        baseImageUploadInput = getElement('base-image-upload'); // New
        baseImagePreview = getElement('base-image-preview'); // New
        baseImagePreviewContainer = getElement('base-image-preview-container'); // New
        clearBaseImageBtn = getElement('clear-base-image-btn'); // New


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
        mobileNavLinks = document.querySelectorAll('#mobile-menu .mobile-nav-link'); // NodeList, not single element

        toastContainer = getElement('toast-container');

        console.log(Date.now(), "initApp: All UI element references obtained.");

        console.log(Date.now(), "initApp: Calling setupEventListeners().");
        setupEventListeners();
        console.log(Date.now(), "initApp: Calling setPage('home').");
        setPage('home'); // Set initial page
        updateUI(); // Initial UI update after all elements are ready and listeners are set up

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

// --- DOMContentLoaded Listener (Main entry point after DOM is ready) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log(Date.now(), "script.js: DOMContentLoaded event listener triggered.");
    initApp(); // Call the main initialization function
});
