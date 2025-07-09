// This console log will appear if the script file is even loaded and parsed.
console.log(Date.now(), "script.js: File started parsing.");

// Import Firebase functions directly as a module
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, orderBy, limit, addDoc, serverTimestamp, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// GSAP is loaded via CDN, so it's globally available as `gsap`
// Register ScrollTrigger and TextPlugin for GSAP
gsap.registerPlugin(ScrollTrigger, TextPlugin);

// Marked.js is loaded via CDN, so it's globally available as `marked`
// Configure marked.js for better security and rendering
marked.setOptions({
    gfm: true, // Use GitHub flavored markdown
    breaks: true, // Add <br> on single new line
    sanitize: true // Sanitize the output HTML to prevent XSS attacks
});

console.log(Date.now(), "script.js: Firebase and GSAP imports attempted.");

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
let userId = null; // Will store the authenticated user's UID or a random ID for anonymous

// --- State variables (Declared at top level and initialized) ---
let currentUser = null; // Stores Firebase User object
let freeGenerationsLeft = localStorage.getItem('freeGenerationsLeft') ? parseInt(localStorage.getItem('freeGenerationsLeft')) : 3;
let freeChatMessagesLeft = localStorage.getItem('freeChatMessagesLeft') ? parseInt(localStorage.getItem('freeChatMessagesLeft')) : 5; // 5 free chat messages
let prompt = ''; // For image generator
let imageUrl = ''; // For generated image
let loading = false; // For image generation
let currentError = ''; // Error message for display
let currentPage = 'home'; // 'home', 'generator', 'verse'
let isSigningIn = false; // New state for sign-in loading
let isAuthReady = false; // Flag to indicate if Firebase Auth state has been checked and services initialized

let aspectRatio = '1:1'; // Default aspect ratio

let enhancedPrompt = '';
let loadingEnhancePrompt = false;
let variationIdeas = [];
let loadingVariationIdeas = false;

let chatHistory = []; // Stores chat messages: [{role: 'user', parts: [{text: '...'}]}, {role: 'model', parts: [{text: '...'}]}]
let isChatLoading = false;
let isVoiceInputActive = false;
let isVoiceOutputActive = false;
let speechRecognition = null;
let speechSynthesis = window.speechSynthesis;

// IMPORTANT: Your Google Cloud API Key for Imagen/Gemini (Declared at top level)
const IMAGEN_GEMINI_API_KEY = "AIzaSyBZxXWl9s2AeSCzMrfoEfnYWpGyfvP7jqs";
console.log(Date.now(), "script.js: IMAGEN_GEMINI_API_KEY value set at top level.");


// --- UI Element References (Will be populated in initApp) ---
let homePageElement;
let generatorPageElement;
let versePageElement; // Renamed from chatAIPageElement
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

// Header specific elements
let mainHeader;

// Verse (Chat AI) specific elements
let verseCreditsDisplay; // Renamed from chatCreditsDisplay
let toggleThemeBtn;
let themeIcon;
let toggleVoiceInputBtn;
let voiceInputIcon;
let toggleVoiceOutputBtn;
let voiceOutputIcon;
let stopVoiceOutputBtn;
let clearVerseBtn; // Renamed from clearChatBtn
let verseMessagesContainer; // Renamed from chatMessagesContainer
let typingIndicator;
let verseInput; // Renamed from chatInput
let sendVerseBtn; // Renamed from sendChatBtn
let versePromptTemplatesContainer; // Renamed from promptTemplatesContainer
let versePromptTemplatesList; // Renamed from promptTemplatesList

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
        
        // This is crucial for setting userId and handling initial auth state
        onAuthStateChanged(auth, async (user) => {
            console.log(Date.now(), "onAuthStateChanged: Auth state change detected. User:", user ? user.uid : "null");
            currentUser = user;
            if (user) {
                userId = user.uid;
                console.log(Date.now(), "onAuthStateChanged: User logged in. Attempting to fetch user data from Firestore for UID:", userId);
                console.time("fetchUserData");
                try {
                    await fetchUserData(userId);
                    console.log(Date.now(), "onAuthStateChanged: User data fetch completed successfully.");
                } catch (dataFetchError) {
                    console.error(Date.now(), "onAuthStateChanged: Error fetching user data:", dataFetchError);
                    setError(`Failed to load user data: ${dataFetchError.message}. Some features may be limited.`);
                    showToast(`Failed to load user data: ${dataFetchError.message}`, "error", 5000);
                } finally {
                    console.timeEnd("fetchUserData");
                }
            } else {
                // User is not authenticated, generate a random ID for anonymous use
                userId = crypto.randomUUID();
                console.log(Date.now(), "onAuthStateChanged: User logged out or no user. Generated anonymous userId:", userId);
                
                // For unauthenticated users, load credits from localStorage or set default
                if (localStorage.getItem('freeGenerationsLeft') === null || parseInt(localStorage.getItem('freeGenerationsLeft')) < 0) {
                    freeGenerationsLeft = 3;
                    localStorage.setItem('freeGenerationsLeft', freeGenerationsLeft);
                } else {
                    freeGenerationsLeft = parseInt(localStorage.getItem('freeGenerationsLeft'));
                }

                if (localStorage.getItem('freeChatMessagesLeft') === null || parseInt(localStorage.getItem('freeChatMessagesLeft')) < 0) {
                    freeChatMessagesLeft = 5;
                    localStorage.setItem('freeChatMessagesLeft', freeChatMessagesLeft);
                } else {
                    freeChatMessagesLeft = parseInt(localStorage.getItem('freeChatMessagesLeft'));
                }
                console.log(Date.now(), "onAuthStateChanged: Loaded unauthenticated credits from local storage. Image:", freeGenerationsLeft, "Verse:", freeChatMessagesLeft);
            }
            isAuthReady = true; // Confirm auth state is fully processed
            console.log(Date.now(), "onAuthStateChanged: isAuthReady confirmed true. Updating UI.");
            updateUI(); // Update UI immediately after auth state is determined
            loadChatHistory(); // Load chat history for the determined user ID
            console.log(Date.now(), "onAuthStateChanged: Auth state processing complete.");
        });

    } catch (e) {
        console.error(Date.now(), "initFirebase: CRITICAL ERROR: Error initializing Firebase:", e);
        currentError = `Firebase initialization failed: ${e.message}. App may not function correctly.`;
        if (persistentDebugMessage) {
            persistentDebugMessage.classList.remove('hidden');
            const msgP = persistentDebugMessage.querySelector('p');
            if (msgP) msgP.textContent = currentError + " Please check console (F12) for details.";
        }
        throw e;
    }
}

// --- Toast Notification System ---
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

// --- Mobile Menu Toggle Function ---
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

// --- Authentication Functions ---
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
        console.log(Date.now(), "signInWithPopup: signInWithPopup successful. User:", result.user.uid, result.user.displayName || result.user.email);
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

// Function to update sign-in button states with loading spinner
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
            freeChatMessagesLeft = userData.freeChatMessagesLeft !== undefined ? userData.freeChatMessagesLeft : 0;
            console.log(Date.now(), "fetchUserData: Fetched existing user data:", userData);
            showToast(`Welcome back, ${currentUser.displayName || currentUser.email}!`, "success");
        } else {
            console.log(Date.now(), "fetchUserData: User document does not exist for UID:", uid, ". Initializing new user data in Firestore with default free generations/messages.");
            await setDoc(userDocRef, {
                freeGenerationsLeft: 3,
                freeChatMessagesLeft: 5,
                createdAt: serverTimestamp()
            });
            freeGenerationsLeft = 3;
            freeChatMessagesLeft = 5;
            console.log(Date.now(), "fetchUserData: New user data initialized in Firestore for UID:", uid);
            showToast(`Welcome, ${currentUser.displayName || currentUser.email}! You have 3 image generations and 5 Verse messages.`, "success");
        }
        localStorage.removeItem('freeGenerationsLeft');
        localStorage.removeItem('freeChatMessagesLeft');
        console.log(Date.now(), "fetchUserData: Removed local storage credits for authenticated user.");
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
                });
            }
            aspectRatioSelectionDiv.appendChild(label);
        });
        console.log(Date.now(), "populateAspectRatioRadios: Aspect ratio radios populated.");
    } else {
        console.error(Date.now(), "populateAspectRatioRadios: aspectRatioSelectionDiv element not found.");
    }
}

// --- Page Visibility Logic ---
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
    } else if (newPage === 'verse') { // New case for 'verse' page
        newPageElement = versePageElement;
        // Load chat history when navigating to Verse page
        loadChatHistory();
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
        homePageElement, generatorPageElement, versePageElement, logoBtn,
        hamburgerBtn, closeMobileMenuBtn, mobileMenuOverlay,
        startCreatingBtn, promptInput, copyPromptBtn, clearPromptBtn, generateBtn,
        enhanceBtn, variationBtn, useEnhancedPromptBtn, downloadBtn,
        signInBtnDesktop, signOutBtnDesktop, signInBtnMobile, signOutBtnMobile, modalSignInBtn, closeSigninModalBtn,
        toggleThemeBtn, toggleVoiceInputBtn, toggleVoiceOutputBtn, stopVoiceOutputBtn, clearVerseBtn, verseInput, sendVerseBtn
    ];

    interactiveElements.forEach(el => {
        if (el) {
            const isAuthButton = el.id && (el.id.includes('sign-in-btn') || el.id.includes('sign-out-btn') || el.id.includes('modal-sign-in-btn'));
            const isGeneratorButton = el.id && (el.id === 'generate-image-btn' || el.id === 'enhance-prompt-btn' || el.id === 'generate-variation-ideas-btn');
            const isChatButton = el.id && (el.id === 'send-verse-btn');
            
            if (isAuthButton) {
                el.disabled = isSigningIn;
                el.classList.toggle('opacity-50', isSigningIn);
                el.classList.toggle('cursor-not-allowed', isSigningIn);
            } else if (isGeneratorButton) {
                const shouldDisableGenerator = !isAuthReady || (!currentUser && freeGenerationsLeft <= 0);
                el.disabled = loading || loadingEnhancePrompt || loadingVariationIdeas || shouldDisableGenerator;
                el.classList.toggle('opacity-50', el.disabled);
                el.classList.toggle('cursor-not-allowed', el.disabled);
            } else if (isChatButton) {
                const shouldDisableChat = !isAuthReady || isChatLoading || (!currentUser && freeChatMessagesLeft <= 0);
                el.disabled = shouldDisableChat;
                el.classList.toggle('opacity-50', shouldDisableChat);
                el.classList.toggle('cursor-not-allowed', shouldDisableChat);
            }
            else {
                el.disabled = !isAuthReady;
                el.classList.toggle('opacity-50', !isAuthReady);
                el.classList.toggle('cursor-not-allowed', !isAuthReady);
            }
        }
    });

    // Update active navigation button styles
    document.querySelectorAll('#desktop-nav button').forEach(btn => {
        btn.classList.remove('text-blue-300');
        btn.classList.add('text-gray-100');
    });
    const currentDesktopBtn = getElement(`${currentPage}-btn`);
    if (currentDesktopBtn) {
        currentDesktopBtn.classList.remove('text-gray-100');
        currentDesktopBtn.classList.add('text-blue-300');
    }

    document.querySelectorAll('#mobile-menu button.mobile-nav-link').forEach(btn => {
        btn.classList.remove('text-blue-300');
        btn.classList.add('text-gray-200');
    });
    const currentMobileBtn = getElement(`mobile-${currentPage}-btn`);
    if (currentMobileBtn) {
        currentMobileBtn.classList.remove('text-gray-200');
        currentMobileBtn.classList.add('text-blue-300');
    }


    if (currentPage === 'generator') {
        updateGeneratorPageUI();
    } else if (currentPage === 'verse') {
        updateVersePageUI();
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
        if (loading) {
            imageDisplayContainer.classList.add('hidden');
            console.log(Date.now(), "updateGeneratorPageUI: Image container hidden (loading).");
        } else if (imageUrl) {
            imageDisplayContainer.classList.remove('hidden');
            generatedImageElement.src = imageUrl;
            generatedImageElement.alt = `AI generated image based on prompt: ${prompt}`;
            generatedImageElement.style = getImageDisplayStyles();
            generatedImageElement.classList.add('animate-image-reveal');
            console.log(Date.now(), "updateGeneratorPageUI: Image container shown with new image.");
        } else {
            imageDisplayContainer.classList.add('hidden');
            console.log(Date.now(), "updateGeneratorPageUI: Image container hidden (no image).");
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

function getImageDisplayStyles() {
    switch (aspectRatio) {
        case '1:1': return 'width: 100%; height: auto; aspect-ratio: 1 / 1;';
        case '4:5': return 'width: 100%; height: auto; aspect-ratio: 4 / 5;';
        case '9:16': return 'width: 100%; height: auto; aspect-ratio: 9 / 16;';
        case '16:9': return 'width: 100%; height: auto; aspect-ratio: 16 / 9;';
        default: return 'width: 100%; height: auto;';
    }
}


function setError(message) {
    console.error(Date.now(), "setError: Setting error:", message);
    currentError = message;
}

function clearError() {
    console.log(Date.now(), "clearError: Clearing error.");
    currentError = '';
}

// --- Verse (Chat AI) Functions ---

async function loadChatHistory() {
    console.log(Date.now(), `loadChatHistory: Attempting to load chat history for userId: ${userId}`);
    if (!db || !userId) {
        console.warn(Date.now(), "loadChatHistory: Firestore DB or userId not ready. Cannot load chat history.");
        return;
    }

    const chatCollectionRef = collection(db, `users/${userId}/chatHistory`);
    const q = query(chatCollectionRef, orderBy('timestamp', 'asc'), limit(100)); // Limit to last 100 messages for performance

    try {
        const querySnapshot = await getDocs(q);
        chatHistory = []; // Clear current history before loading
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Ensure message structure matches {role: 'user/model', parts: [{text: '...'}]}
            if (data.role && data.text) { // Simple check for old format
                chatHistory.push({ role: data.role, parts: [{ text: data.text }] });
            } else if (data.role && data.parts) { // New, correct format
                chatHistory.push({ role: data.role, parts: data.parts });
            }
        });
        console.log(Date.now(), `loadChatHistory: Loaded ${chatHistory.length} messages.`);
        renderChatMessages();
        scrollToBottomChat();
    } catch (e) {
        console.error(Date.now(), "loadChatHistory: Error loading chat history:", e);
        showToast("Failed to load Verse history.", "error");
    }
}

async function saveChatMessage(role, text) {
    console.log(Date.now(), `saveChatMessage: Saving message for userId: ${userId}, role: ${role}`);
    if (!db || !userId) {
        console.warn(Date.now(), "saveChatMessage: Firestore DB or userId not ready. Cannot save message.");
        return;
    }

    const chatCollectionRef = collection(db, `users/${userId}/chatHistory`);
    try {
        await addDoc(chatCollectionRef, {
            role: role,
            parts: [{ text: text }],
            timestamp: serverTimestamp()
        });
        console.log(Date.now(), "saveChatMessage: Message saved to Firestore.");
    } catch (e) {
        console.error(Date.now(), "saveChatMessage: Error saving message to Firestore:", e);
        showToast("Failed to save message history.", "error");
    }
}

async function sendMessage() {
    console.log(Date.now(), "sendMessage: Function called.");
    const messageText = verseInput.value.trim(); // Changed from chatInput
    if (!messageText) {
        showToast("Please enter a message.", "info");
        return;
    }

    if (!currentUser) {
        if (freeChatMessagesLeft <= 0) {
            showToast("You've used all your free Verse messages. Please sign in for unlimited Verse!", "info");
            signinRequiredModal?.classList.remove('hidden');
            return;
        }
    }

    // Stop any ongoing speech before sending a new message
    stopSpeaking();

    // Add user message to history
    chatHistory.push({ role: 'user', parts: [{ text: messageText }] });
    saveChatMessage('user', messageText); // Save user message to Firestore
    renderChatMessages();
    scrollToBottomChat();
    verseInput.value = ''; // Clear input field (Changed from chatInput)
    verseInput.style.height = 'auto'; // Reset textarea height (Changed from chatInput)

    isChatLoading = true;
    updateUI(); // Show typing indicator

    if (!currentUser) {
        freeChatMessagesLeft--;
        localStorage.setItem('freeChatMessagesLeft', freeChatMessagesLeft);
    }

    console.log(Date.now(), "sendMessage: Sending message to Verse AI.");
    console.time("geminiChatAPI");

    try {
        const payload = { contents: chatHistory }; // Send full history for context
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${IMAGEN_GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Verse AI API error: ${response.status} - ${errorData.error.message || 'Unknown error'}`);
        }

        const result = await response.json();
        let aiResponseText = "I'm sorry, I couldn't generate a response.";
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            aiResponseText = result.candidates[0].content.parts[0].text;
        }

        chatHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
        saveChatMessage('model', aiResponseText); // Save AI message to Firestore
        renderChatMessages();
        scrollToBottomChat();

        if (isVoiceOutputActive) {
            speakText(aiResponseText);
        }
        showToast("Verse responded!", "success");

    } catch (e) {
        console.error(Date.now(), "sendMessage: Error during Verse AI response generation:", e);
        showToast(`Verse response failed: ${e.message}`, "error");
        chatHistory.push({ role: 'model', parts: [{ text: `Error: ${e.message}. Please try again.` }] });
        renderChatMessages();
        scrollToBottomChat();
        // If an error occurs and it's an unauthenticated user, refund the credit
        if (!currentUser) {
            freeChatMessagesLeft++;
            localStorage.setItem('freeChatMessagesLeft', freeChatMessagesLeft);
            showToast(`Credit refunded due to Verse AI error. You now have ${freeChatMessagesLeft} free messages.`, "info", 5000);
        }
    } finally {
        console.timeEnd("geminiChatAPI");
        isChatLoading = false;
        updateUI(); // Hide typing indicator
    }
}

function renderChatMessages() {
    if (!verseMessagesContainer) return; // Changed from chatMessagesContainer

    verseMessagesContainer.innerHTML = ''; // Clear existing messages (Changed from chatMessagesContainer)
    if (chatHistory.length === 0) {
        verseMessagesContainer.innerHTML = `<div class="text-center text-gray-400 text-sm py-4">
            Start a conversation! Type your message below.
        </div>`;
        return;
    }

    chatHistory.forEach((msg, index) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-bubble ${msg.role} opacity-0 transform ${msg.role === 'user' ? 'translate-x-full text-sm sm:text-base' : '-translate-x-full text-base sm:text-lg'}`; // Added responsive text sizes
        
        // Use marked.js to convert Markdown to HTML
        messageDiv.innerHTML = marked.parse(msg.parts[0].text);
        
        verseMessagesContainer.appendChild(messageDiv); // Changed from chatMessagesContainer

        // Animate message in
        gsap.to(messageDiv, {
            opacity: 1,
            x: 0,
            duration: 0.4,
            ease: "power2.out",
            delay: index * 0.05 // Stagger animation slightly
        });
    });
}

function scrollToBottomChat() {
    if (verseMessagesContainer) { // Changed from chatMessagesContainer
        gsap.to(verseMessagesContainer, { // Changed from chatMessagesContainer
            scrollTop: verseMessagesContainer.scrollHeight,
            duration: 0.8,
            ease: "power2.out"
        });
    }
}

async function clearChatHistory() {
    console.log(Date.now(), "clearChatHistory: Clearing Verse history.");
    chatHistory = [];
    renderChatMessages();
    showToast("Verse history cleared!", "info");

    if (currentUser && db && userId) {
        const chatCollectionRef = collection(db, `users/${userId}/chatHistory`);
        try {
            const querySnapshot = await getDocs(chatCollectionRef);
            const deletePromises = [];
            querySnapshot.forEach((doc) => {
                deletePromises.push(deleteDoc(doc.ref));
            });
            await Promise.all(deletePromises);
            console.log(Date.now(), "clearChatHistory: Verse history cleared from Firestore.");
        } catch (e) {
            console.error(Date.now(), "clearChatHistory: Error clearing Verse history from Firestore:", e);
            showToast("Failed to clear Verse history from cloud.", "error");
        }
    } else if (!currentUser) {
        // For unauthenticated users, reset free messages if they clear chat
        freeChatMessagesLeft = 5;
        localStorage.setItem('freeChatMessagesLeft', freeChatMessagesLeft);
        updateUI();
        showToast("Free Verse messages reset to 5.", "info");
    }
}

// --- Theme Toggle ---
function toggleTheme() {
    console.log(Date.now(), "toggleTheme: Toggling theme.");
    document.body.classList.toggle('light-mode');
    const isLightMode = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
    if (themeIcon) {
        themeIcon.classList.toggle('fa-sun', !isLightMode);
        themeIcon.classList.toggle('fa-moon', isLightMode);
        toggleThemeBtn.querySelector('span').textContent = isLightMode ? 'Dark Mode' : 'Light Mode';
    }
    showToast(`Switched to ${isLightMode ? 'Light' : 'Dark'} Mode`, "info");
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark'; // Default to dark
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (themeIcon) {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
            toggleThemeBtn.querySelector('span').textContent = 'Dark Mode';
        }
    } else {
        document.body.classList.remove('light-mode');
        if (themeIcon) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
            toggleThemeBtn.querySelector('span').textContent = 'Light Mode';
        }
    }
    console.log(Date.now(), `applySavedTheme: Applied theme: ${savedTheme}`);
}

// --- Voice Input/Output ---
function toggleVoiceInput() {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        if (!speechRecognition) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            speechRecognition = new SpeechRecognition();
            speechRecognition.continuous = false; // Listen for a single utterance
            speechRecognition.interimResults = false; // Only return final results
            speechRecognition.lang = 'en-US'; // Set language

            speechRecognition.onstart = () => {
                isVoiceInputActive = true;
                updateUI();
                showToast("Voice input active. Speak now!", "info");
                verseInput.placeholder = "Listening..."; // Changed from chatInput
            };

            speechRecognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                verseInput.value = transcript; // Changed from chatInput
                verseInput.style.height = 'auto'; // Reset height (Changed from chatInput)
                verseInput.style.height = (verseInput.scrollHeight) + 'px'; // Adjust height (Changed from chatInput)
                console.log(Date.now(), "Voice input result:", transcript);
                // Automatically send message after speech recognition
                sendMessage();
            };

            speechRecognition.onerror = (event) => {
                console.error(Date.now(), "Speech recognition error:", event.error);
                showToast(`Voice input error: ${event.error}`, "error");
                isVoiceInputActive = false;
                updateUI();
                verseInput.placeholder = "Type your message here..."; // Changed from chatInput
            };

            speechRecognition.onend = () => {
                isVoiceInputActive = false;
                updateUI();
                verseInput.placeholder = "Type your message here..."; // Changed from chatInput
                console.log(Date.now(), "Voice input ended.");
            };
        }

        if (isVoiceInputActive) {
            speechRecognition.stop();
        } else {
            speechRecognition.start();
        }
    } else {
        showToast("Voice input not supported by your browser.", "error");
        console.warn(Date.now(), "SpeechRecognition API not available.");
    }
}

function toggleVoiceOutput() {
    isVoiceOutputActive = !isVoiceOutputActive;
    updateUI();
    showToast(`Voice output ${isVoiceOutputActive ? 'enabled' : 'disabled'}`, "info");
    // If voice output is turned off, stop any ongoing speech
    if (!isVoiceOutputActive) {
        stopSpeaking();
    }
}

function speakText(text) {
    if (isVoiceOutputActive && speechSynthesis) {
        stopSpeaking(); // Stop any previous speech before starting new one
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US'; // Set language
        utterance.rate = 1.0; // Speed
        utterance.pitch = 1.0; // Pitch
        utterance.onend = () => {
            updateUI(); // Update UI when speech ends (to hide stop button)
        };
        utterance.onstart = () => {
            updateUI(); // Update UI when speech starts (to show stop button)
        };
        speechSynthesis.speak(utterance);
        console.log(Date.now(), "Speaking text:", text);
    }
}

function stopSpeaking() {
    if (speechSynthesis && speechSynthesis.speaking) {
        speechSynthesis.cancel();
        console.log(Date.now(), "Speech synthesis stopped.");
        updateUI(); // Update UI to hide stop button
    }
}

// --- Prompt Templates ---
const defaultPromptTemplates = [
    "Explain quantum physics simply.",
    "Write a short story about a brave knight.",
    "Give me a recipe for chocolate chip cookies.",
    "Summarize the plot of Hamlet.",
    "What are the benefits of meditation?",
    "Generate a creative writing prompt.",
    "Tell me a joke.",
    "How does a blockchain work?",
    "List 5 tips for productivity.",
    "What is the capital of France?"
];

function populatePromptTemplates() {
    if (!versePromptTemplatesList) return; // Changed from promptTemplatesList

    versePromptTemplatesList.innerHTML = ''; // Clear existing templates (Changed from promptTemplatesList)
    defaultPromptTemplates.forEach(templateText => {
        const button = document.createElement('button');
        button.className = 'px-4 py-2 rounded-full bg-blue-500/30 text-blue-200 hover:bg-blue-500/50 transition-colors duration-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500';
        button.textContent = templateText;
        button.addEventListener('click', () => {
            verseInput.value = templateText; // Changed from chatInput
            verseInput.style.height = 'auto'; // Reset height (Changed from chatInput)
            verseInput.style.height = (verseInput.scrollHeight) + 'px'; // Adjust height (Changed from chatInput)
            sendMessage();
        });
        versePromptTemplatesList.appendChild(button); // Changed from promptTemplatesList
    });
    console.log(Date.now(), "populatePromptTemplates: Default prompt templates populated.");
}


// --- Event Listeners Setup ---
function setupEventListeners() {
    console.log(Date.now(), "setupEventListeners: Setting up all event listeners...");

    // Header Hover Effect
    if (mainHeader) {
        mainHeader.addEventListener('mouseenter', () => {
            gsap.to(mainHeader, {
                scale: 1.02, // Slightly larger
                boxShadow: '0 15px 30px rgba(0,0,0,0.5)', // More pronounced shadow
                duration: 0.3,
                ease: "power2.out"
            });
        });
        mainHeader.addEventListener('mouseleave', () => {
            gsap.to(mainHeader, {
                scale: 1, // Back to original size
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)', // Original shadow (from style.css or default)
                duration: 0.5,
                ease: "elastic.out(1, 0.7)" // Gentle bounce back
            });
        });
        console.log(Date.now(), "Event Listeners Attached: mainHeader hover effects.");
    }

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

    const verseBtn = getElement('verse-btn'); // Renamed from chat-ai-btn
    if (verseBtn) {
        verseBtn.addEventListener('click', () => { console.log(Date.now(), "Event: Desktop Verse button clicked."); setPage('verse'); });
        console.log(Date.now(), "Event Listener Attached: verse-btn");
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
                else if (e.target.id === 'mobile-verse-btn') setPage('verse'); // Renamed mobile chat AI button
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

    // Image Generator Page Controls
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
            showToast("Prompt cleared!", "info");
            updateUI();
        });
        console.log(Date.now(), "Event Listener Attached: clearPromptBtn");
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
            enhancedPrompt = '';
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

    // Verse Specific Event Listeners
    if (sendVerseBtn) { // Changed from sendChatBtn
        sendVerseBtn.addEventListener('click', sendMessage);
        console.log(Date.now(), "Event Listener Attached: sendVerseBtn");
    }
    if (verseInput) { // Changed from chatInput
        verseInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevent new line
                sendMessage();
            }
        });
        console.log(Date.now(), "Event Listener Attached: verseInput keydown");
    }
    if (clearVerseBtn) { // Changed from clearChatBtn
        clearVerseBtn.addEventListener('click', clearChatHistory);
        console.log(Date.now(), "Event Listener Attached: clearVerseBtn");
    }
    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener('click', toggleTheme);
        console.log(Date.now(), "Event Listener Attached: toggleThemeBtn");
    }
    if (toggleVoiceInputBtn) {
        toggleVoiceInputBtn.addEventListener('click', toggleVoiceInput);
        console.log(Date.now(), "Event Listener Attached: toggleVoiceInputBtn");
    }
    if (toggleVoiceOutputBtn) {
        toggleVoiceOutputBtn.addEventListener('click', toggleVoiceOutput);
        console.log(Date.now(), "Event Listener Attached: toggleVoiceOutputBtn");
    }
    // New: Stop Voice Output Button Listener
    if (stopVoiceOutputBtn) {
        stopVoiceOutputBtn.addEventListener('click', stopSpeaking);
        console.log(Date.now(), "Event Listener Attached: stopVoiceOutputBtn");
    }


    populateAspectRatioRadios();
    populatePromptTemplates(); // Populate templates on load
    console.log(Date.now(), "setupEventListeners: All event listeners setup attempted.");
}

// --- Main application initialization function ---
function initApp() {
    console.log(Date.now(), "initApp: Starting application initialization.");
    console.time("AppInitialization");

    try {
        // Initialize Firebase services first (this will handle auth state and user ID)
        initFirebase();

        // Populate ALL UI Element References here, after DOM is ready
        homePageElement = getElement('home-page-element');
        generatorPageElement = getElement('generator-page-element');
        versePageElement = getElement('verse-page-element'); // Renamed from chatAIPageElement
        allPageElements = [homePageElement, generatorPageElement, versePageElement].filter(Boolean); // Filter out nulls

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

        // Header specific elements
        mainHeader = getElement('header-element');

        // Verse (Chat AI) specific elements
        verseCreditsDisplay = getElement('verse-credits-display'); // Renamed
        toggleThemeBtn = getElement('toggle-theme-btn');
        themeIcon = getElement('theme-icon');
        toggleVoiceInputBtn = getElement('toggle-voice-input-btn');
        voiceInputIcon = getElement('voice-input-icon');
        toggleVoiceOutputBtn = getElement('toggle-voice-output-btn');
        voiceOutputIcon = getElement('voice-output-icon');
        stopVoiceOutputBtn = getElement('stop-voice-output-btn');
        clearVerseBtn = getElement('clear-verse-btn'); // Renamed
        verseMessagesContainer = getElement('verse-messages-container'); // Renamed
        typingIndicator = getElement('typing-indicator');
        verseInput = getElement('verse-input'); // Renamed
        sendVerseBtn = getElement('send-verse-btn'); // Renamed
        versePromptTemplatesContainer = getElement('verse-prompt-templates-container'); // Renamed
        versePromptTemplatesList = getElement('verse-prompt-templates-list'); // Renamed


        console.log(Date.now(), "initApp: All UI element references obtained.");

        console.log(Date.now(), "initApp: Calling setupEventListeners().");
        setupEventListeners();
        console.log(Date.now(), "initApp: Calling setPage('home').");
        setPage('home'); // Set initial page
        applySavedTheme(); // Apply theme on load
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
