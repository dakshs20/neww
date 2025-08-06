import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut, onAuthStateChanged, getRedirectResult } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.firebasestorage.app",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- DOM Elements ---
const getStartedBtnDesktop = document.getElementById('get-started-btn-desktop');
const userProfileSectionDesktop = document.getElementById('user-profile-section-desktop');
const userCreditsSpanDesktop = document.getElementById('user-credits-desktop');
const userAvatarImgDesktop = document.getElementById('user-avatar-desktop');
const signOutBtnDesktop = document.getElementById('sign-out-btn-desktop');

const getStartedBtnMobile = document.getElementById('get-started-btn-mobile');
const userProfileSectionMobile = document.getElementById('user-profile-section-mobile');
const userCreditsSpanMobile = document.getElementById('user-credits-mobile');
const userAvatarImgMobile = document.getElementById('user-avatar-mobile');
const signOutBtnMobile = document.getElementById('sign-out-btn-mobile');

const menuBtn = document.getElementById('menu-btn');
const closeMenuBtn = document.getElementById('close-menu-btn');
const drawerMenu = document.getElementById('drawer-menu');

const promptInput = document.getElementById('prompt-input');
const generateBtn = document.getElementById('generate-btn');
const generateArrow = document.getElementById('generate-arrow');
const generateSpinner = document.getElementById('generate-spinner');
const enhanceBtn = document.getElementById('enhance-btn');
const copyBtn = document.getElementById('copy-btn');
const clearBtn = document.getElementById('clear-btn');
const suggestionChipsContainer = document.getElementById('suggestion-chips-container');
const galleryContainer = document.getElementById('gallery-container');
const gallery = document.getElementById('gallery');
const messageBox = document.getElementById('message-box');
const messageText = document.getElementById('message-text');
const signInModal = document.getElementById('signin-modal');
const modalSignInBtn = document.getElementById('modal-signin-google-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');

let isGenerating = false;
let isEnhancing = false;
let currentUserCredits = 0;
let isAuthReady = false;

// --- AUTHENTICATION & MODAL ---
const openSignInModal = () => signInModal.classList.remove('hidden');
const closeSignInModal = () => signInModal.classList.add('hidden');
const signInWithGoogleRedirect = () => signInWithRedirect(auth, provider);
const signOutUser = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userProfile = await getUserProfile(user);
        currentUserCredits = userProfile.credits;
        updateUIAfterLogin(user, userProfile);
    } else {
        getRedirectResult(auth).catch((error) => {
            console.error("Redirect Sign-In Error:", error);
            showMessage("Could not sign in. Please try again.", "error");
        });
        updateUIAfterLogout();
    }
    isAuthReady = true;
    setPromptAreaEnabled(!!user);
});

const getUserProfile = async (user) => {
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
        return userDocSnap.data();
    } else {
        const newUserProfile = {
            displayName: user.displayName, email: user.email, photoURL: user.photoURL,
            credits: 5, createdAt: new Date()
        };
        await setDoc(userDocRef, newUserProfile);
        return newUserProfile;
    }
};

// --- UI UPDATES ---
const updateUIAfterLogin = (user, profile) => {
    // Desktop
    getStartedBtnDesktop.classList.add('hidden');
    userProfileSectionDesktop.classList.remove('hidden');
    userProfileSectionDesktop.classList.add('flex');
    userAvatarImgDesktop.src = user.photoURL;
    userCreditsSpanDesktop.textContent = profile.credits;
    // Mobile
    getStartedBtnMobile.classList.add('hidden');
    userProfileSectionMobile.classList.remove('hidden');
    userAvatarImgMobile.src = user.photoURL;
    userCreditsSpanMobile.textContent = profile.credits;
};
const updateUIAfterLogout = () => {
     // Desktop
    getStartedBtnDesktop.classList.remove('hidden');
    userProfileSectionDesktop.classList.add('hidden');
    userProfileSectionDesktop.classList.remove('flex');
     // Mobile
    getStartedBtnMobile.classList.remove('hidden');
    userProfileSectionMobile.classList.add('hidden');
    currentUserCredits = 0;
};

const setPromptAreaEnabled = (isEnabled) => {
    promptInput.disabled = !isEnabled;
    generateBtn.disabled = !isEnabled;
    enhanceBtn.disabled = !isEnabled;
    copyBtn.disabled = !isEnabled;
    clearBtn.disabled = !isEnabled;
};

// --- CORE APP LOGIC ---
async function callAPI(model, payload) {
    const apiKey = ""; // Handled by environment
    const apiUrl = model.startsWith('imagen') 
        ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
        const response = await fetch(apiUrl, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error calling ${model}:`, error);
        showMessage("An error occurred with the AI network.", 'error');
        return null;
    }
}

const handleEnhancePrompt = async () => {
    if (isEnhancing || isGenerating) return;
    const user = auth.currentUser;
    if (!user) {
        openSignInModal();
        return;
    }
    const currentPrompt = promptInput.value.trim();
    if (!currentPrompt) {
        showMessage("Please enter an idea to enhance.", 'error');
        return;
    }

    isEnhancing = true;
    enhanceBtn.textContent = 'Enhancing...';
    enhanceBtn.disabled = true;

    const systemPrompt = `You are an expert prompt engineer for an AI image generator. Take the user's idea and expand it into a rich, detailed, cinematic, and artistic prompt. Focus on visual details like lighting, composition, and style. Return only the enhanced prompt itself, without any introductory text. User idea: "${currentPrompt}"`;
    const payload = { contents: [{ role: "user", parts: [{ text: systemPrompt }] }] };
    const result = await callAPI('gemini-2.5-flash-preview-05-20', payload);

    if (result && result.candidates?.[0]?.content?.parts?.[0]?.text) {
        promptInput.value = result.candidates[0].content.parts[0].text.trim();
        showMessage('Prompt enhanced!');
    } else {
        showMessage('Could not enhance the prompt.', 'error');
    }

    isEnhancing = false;
    enhanceBtn.textContent = '✨ Enhance';
    enhanceBtn.disabled = false;
};

const handleGenerateImage = async () => {
    if (isGenerating || isEnhancing || !isAuthReady) return;
    const user = auth.currentUser;
    if (!user) {
        openSignInModal();
        return;
    }
    if (currentUserCredits <= 0) {
        showMessage("You are out of credits.", 'error');
        return;
    }
    const prompt = promptInput.value.trim();
    if (!prompt) {
        showMessage("Please describe an idea to generate an image.", 'error');
        return;
    }

    setLoadingState(true);
    const payload = { instances: [{ prompt }], parameters: { "sampleCount": 1 } };
    const result = await callAPI('imagen-3.0-generate-002', payload);

    if (result && result.predictions?.[0]?.bytesBase64Encoded) {
        const imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
        addImageToGallery(prompt, imageUrl);
        
        currentUserCredits--;
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userDocRef, { credits: currentUserCredits });
        // Update UI immediately
        userCreditsSpanDesktop.textContent = currentUserCredits;
        userCreditsSpanMobile.textContent = currentUserCredits;
    } else {
        showMessage("Could not generate image. The AI may have refused the prompt.", 'error');
    }
    setLoadingState(false);
};

const addImageToGallery = (prompt, imageUrl) => {
    gallery.innerHTML = '';
    galleryContainer.classList.remove('hidden');
    const item = document.createElement('div');
    item.className = 'gallery-item';
    const filename = prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.png';
    item.innerHTML = `
        <img src="${imageUrl}" alt="${prompt}" class="w-full h-auto object-contain bg-gray-100">
        <div class="p-4 bg-white flex justify-between items-center">
            <p class="text-sm text-gray-600 truncate pr-4">${prompt}</p>
            <a href="${imageUrl}" download="${filename}" class="download-button flex-shrink-0">Download</a>
        </div>`;
    gallery.appendChild(item);
};

const setLoadingState = (loading) => {
    isGenerating = loading;
    generateBtn.disabled = loading;
    promptInput.disabled = loading;
    copyBtn.disabled = loading;
    clearBtn.disabled = loading;
    enhanceBtn.disabled = loading;
    generateArrow.classList.toggle('hidden', loading);
    generateSpinner.classList.toggle('hidden', !loading);
};

const showMessage = (message, type = 'success') => {
    messageText.textContent = message;
    messageBox.className = 'hidden fixed top-5 right-5 px-6 py-3 rounded-lg shadow-lg z-50';
    if (type === 'error') {
        messageBox.classList.add('bg-red-100', 'text-red-700', 'border', 'border-red-300');
    } else {
        messageBox.classList.add('bg-green-100', 'text-green-700', 'border', 'border-green-300');
    }
    messageBox.classList.remove('hidden');
    setTimeout(() => messageBox.classList.add('hidden'), 3000);
};

const copyPrompt = () => {
    if (!promptInput.value) { showMessage('Nothing to copy.', 'error'); return; }
    const textArea = document.createElement("textarea");
    textArea.value = promptInput.value;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showMessage('Prompt copied to clipboard!');
    } catch (err) {
        showMessage('Failed to copy text.', 'error');
    }
    document.body.removeChild(textArea);
};

const populateSuggestionChips = () => {
    const suggestions = [
        "A lone astronaut",
        "Enchanted forest",
        "Cyberpunk city",
        "Steampunk inventor",
    ];
    suggestionChipsContainer.innerHTML = '';
    suggestions.forEach(text => {
        const button = document.createElement('button');
        button.className = 'suggestion-chip';
        button.textContent = text;
        button.onclick = () => {
            promptInput.value = text;
        };
        suggestionChipsContainer.appendChild(button);
    });
};

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    setPromptAreaEnabled(false); // Initially disable prompt area
    populateSuggestionChips();
    getStartedBtnDesktop.addEventListener('click', signInWithGoogleRedirect);
    getStartedBtnMobile.addEventListener('click', signInWithGoogleRedirect);
    signOutBtnDesktop.addEventListener('click', signOutUser);
    signOutBtnMobile.addEventListener('click', signOutUser);
    generateBtn.addEventListener('click', handleGenerateImage);
    enhanceBtn.addEventListener('click', handleEnhancePrompt);
    copyBtn.addEventListener('click', copyPrompt);
    clearBtn.addEventListener('click', () => { promptInput.value = ''; });
    modalSignInBtn.addEventListener('click', signInWithGoogleRedirect);
    modalCloseBtn.addEventListener('click', closeSignInModal);
    signInModal.addEventListener('click', (e) => { if (e.target === signInModal) closeSignInModal(); });
    
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerateImage(); }
    });

    // Drawer Menu Logic
    menuBtn.addEventListener('click', () => {
        drawerMenu.classList.remove('translate-x-full');
    });
    closeMenuBtn.addEventListener('click', () => {
        drawerMenu.classList.add('translate-x-full');
    });
});
