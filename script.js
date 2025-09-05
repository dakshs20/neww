// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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
let currentUser = null;
let userCredits = 0;
let userUnsubscribe = null; // To hold the listener unsubscribe function
let isGenerating = false;

// --- DOM Ready ---
document.addEventListener('DOMContentLoaded', () => {
    // Universal scripts for header, auth, modals
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const googleSignInBtn = document.getElementById('google-signin-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const closeNoCreditsModalBtn = document.getElementById('close-no-credits-modal-btn');
    
    if (authBtn) authBtn.addEventListener('click', handleAuthAction);
    if (mobileAuthBtn) mobileAuthBtn.addEventListener('click', handleAuthAction);
    if (googleSignInBtn) googleSignInBtn.addEventListener('click', signInWithGoogle);
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => toggleModal('auth-modal', false));
    if (closeNoCreditsModalBtn) closeNoCreditsModalBtn.addEventListener('click', () => toggleModal('no-credits-modal', false));

    // Page-specific initialization for the generator
    if (document.getElementById('generator-ui')) {
        const generateBtn = document.getElementById('generate-btn');
        const regenerateBtn = document.getElementById('regenerate-btn');
        if (generateBtn) generateBtn.addEventListener('click', () => handleGenerationClick(false));
        if (regenerateBtn) regenerateBtn.addEventListener('click', () => handleGenerationClick(true));
    }

    // Auth state listener
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUser = user;
            setupUserListener(user.uid);
            toggleModal('auth-modal', false); // Close sign-in modal if open
        } else {
            currentUser = null;
            userCredits = 0;
            if (userUnsubscribe) userUnsubscribe(); // Stop listening to old user's data
            updateUICredits(false);
        }
    });
});

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        if (show) {
            modal.classList.remove('hidden');
            modal.setAttribute('aria-hidden', 'false');
        } else {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }
    }
}

function setupUserListener(userId) {
    if (userUnsubscribe) userUnsubscribe(); // Unsubscribe from previous listener if any

    const userDocRef = doc(db, "users", userId);
    userUnsubscribe = onSnapshot(userDocRef, async (docSnap) => {
        if (docSnap.exists()) {
            // User document exists, update credits from database
            const userData = docSnap.data();
            userCredits = userData.credits;
            updateUICredits(true);
        } else {
            // This is the user's first sign-in. Create their document with 5 free credits.
            try {
                await setDoc(userDocRef, {
                    email: currentUser.email,
                    displayName: currentUser.displayName,
                    credits: 5,
                    createdAt: serverTimestamp()
                });
                // After creating, the listener will automatically pick up the new data.
            } catch (error) {
                console.error("Error creating user document:", error);
                alert("There was an error setting up your account. Please try again.");
            }
        }
    }, (error) => {
        console.error("Firestore listener error:", error);
        alert("Could not connect to the database to get your credit balance.");
    });
}

function updateUICredits(isLoggedIn) {
    const creditDisplay = document.getElementById('credit-display');
    const mobileCreditDisplay = document.getElementById('mobile-credit-display');
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');

    if (isLoggedIn && currentUser) {
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        // Desktop Header
        creditDisplay.innerHTML = `
            <span class="text-sm font-medium text-gray-700">Credits: ${userCredits}</span>
            ${userCredits <= 0 ? `<a href="pricing.html" class="ml-2 text-sm font-semibold text-white bg-blue-500 px-3 py-1.5 rounded-md hover:bg-blue-600 transition-colors">Buy Credits</a>` : ''}
        `;
        // Mobile Menu
        mobileCreditDisplay.textContent = `Credits: ${userCredits}`;
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        creditDisplay.innerHTML = '';
        mobileCreditDisplay.innerHTML = '';
    }
}

function handleAuthAction() {
    if (currentUser) {
        signOut(auth).catch(error => console.error("Sign out error:", error));
    } else {
        signInWithGoogle();
    }
}

function signInWithGoogle() {
    signInWithPopup(auth, provider)
        .catch(error => {
            console.error("Authentication Error:", error);
            alert("Could not sign in with Google. Please try again.");
        });
}

function handleGenerationClick(isRegen = false) {
    if (isGenerating) return; // Prevent multiple clicks while generating

    if (!currentUser) {
        toggleModal('auth-modal', true);
        return;
    }

    if (userCredits <= 0) {
        toggleModal('no-credits-modal', true);
        return;
    }

    const promptInput = document.getElementById(isRegen ? 'regenerate-prompt-input' : 'prompt-input');
    const prompt = promptInput.value.trim();

    if (!prompt) {
        alert('Please describe what you want to create.');
        return;
    }

    generateImage(prompt);
}

async function generateImage(prompt) {
    isGenerating = true;
    const loadingIndicator = document.getElementById('loading-indicator');
    const generateBtn = document.getElementById('generate-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');
    
    // UI updates for loading state
    document.getElementById('generator-ui').classList.add('hidden');
    document.getElementById('result-container').classList.remove('hidden');
    document.getElementById('image-grid').innerHTML = ''; // Clear old results
    document.getElementById('post-generation-controls').classList.add('hidden');
    loadingIndicator.classList.remove('hidden');
    if (generateBtn) generateBtn.disabled = true;
    if (regenerateBtn) regenerateBtn.disabled = true;

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                aspectRatio: document.querySelector('.aspect-ratio-btn.selected')?.dataset.ratio || '1:1',
                userId: currentUser.uid // CRITICAL: Send user ID for server-side verification
            })
        });

        const result = await response.json();

        if (!response.ok) {
            // Handle specific error codes from the server
            if (result.code === 'NO_CREDITS') {
                toggleModal('no-credits-modal', true);
            }
            throw new Error(result.error || 'An unknown error occurred during generation.');
        }

        const base64Data = result.predictions?.[0]?.bytesBase64Encoded;
        if (!base64Data) {
            throw new Error("No image data was received from the API.");
        }

        const imageUrl = `data:image/png;base64,${base64Data}`;
        displayImage(imageUrl, prompt);
        document.getElementById('regenerate-prompt-input').value = prompt;
        document.getElementById('post-generation-controls').classList.remove('hidden');

    } catch (error) {
        console.error('Image Generation Failed:', error);
        alert(`Sorry, the image could not be generated: ${error.message}`);
        // Revert UI to initial state on failure
        document.getElementById('generator-ui').classList.remove('hidden');
        document.getElementById('result-container').classList.add('hidden');
    } finally {
        // Reset UI from loading state
        isGenerating = false;
        loadingIndicator.classList.add('hidden');
        if (generateBtn) generateBtn.disabled = false;
        if (regenerateBtn) regenerateBtn.disabled = false;
    }
}

function displayImage(imageUrl, prompt) {
    const imageGrid = document.getElementById('image-grid');
    imageGrid.innerHTML = ''; // Clear previous image or loader
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group fade-in-slide-up mx-auto max-w-2xl';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    
    // Add a download button
    const downloadButton = document.createElement('a');
    downloadButton.href = imageUrl;
    downloadButton.download = 'genart-image.png';
    downloadButton.className = 'absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity';
    downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

    imgContainer.appendChild(img);
    imgContainer.appendChild(downloadButton);
    imageGrid.appendChild(imgContainer);
}

