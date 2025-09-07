// ... existing code ... */
    if(removeImageBtn) removeImageBtn.addEventListener('click', removeUploadedImage);

    // --- NEW: Initialize Prompt of the Day ---
    initializePromptOfTheDay();
}

// --- NEW: Prompt of the Day Logic ---
function initializePromptOfTheDay() {
    const prompts = [
        "A bioluminescent forest at twilight, with glowing mushrooms and ethereal creatures.",
        "An astronaut discovering an ancient alien artifact on a desolate moon.",
        "A steampunk city powered by clockwork and steam, with airships in the sky.",
        "A close-up portrait of a majestic lion with a crown made of stars.",
        "A hidden waterfall in a lush, tropical jungle, rendered in a hyperrealistic style.",
        "A cyberpunk street scene in a rainy, neon-lit city of the future.",
        "A whimsical treehouse built into a giant, ancient oak tree.",
        "An epic fantasy battle between a knight and a fire-breathing dragon.",
        "A serene Japanese zen garden with a koi pond and cherry blossoms.",
        "A surrealist painting of a clock melting over a desert landscape.",
        "A robot artist painting a masterpiece in its futuristic studio.",
        "A magical library with floating books and enchanted scrolls.",
        "A polar bear family under the shimmering aurora borealis.",
        "A futuristic high-speed train traveling through a mountain pass.",
        "An underwater city inhabited by mermaids and mermen.",
        "A brave adventurer exploring a forgotten, treasure-filled tomb.",
        "A portrait of a wise old wizard with a long white beard and a pointed hat.",
        "A cozy, snow-covered cabin in the woods during a blizzard.",
        "A vibrant coral reef teeming with colorful fish and marine life.",
        "A giant, moss-covered golem awakening in an ancient forest.",
        "A retro-futuristic car from the 1950s, but with hovering capabilities.",
        "A beautiful elven queen in her ethereal, nature-inspired throne room.",
        "A detective investigating a mysterious crime in a foggy, 1940s film noir setting.",
        "A bustling marketplace in a fantastical medieval city.",
        "A lone samurai warrior standing on a cliff, overlooking a stormy sea.",
        "A tiny fairy sipping nectar from a giant, glowing flower.",
        "A majestic griffin soaring through a dramatic, cloud-filled sky.",
        "A post-apocalyptic survivor scavenging in the ruins of a modern city.",
        "A secret agent in a high-stakes chase through the streets of Monaco.",
        "A group of friendly robots having a picnic in a sunny park.",
        "A surreal landscape where the ground is made of clouds and islands float in the sky.",
        "A powerful sorceress casting a complex spell, with magical energy swirling around her.",
        "A child discovering a hidden door to a magical world in their bedroom.",
        "A family of red pandas playing in a bamboo forest.",
        "An Art Deco style skyscraper that reaches into the clouds.",
        "A ghostly pirate ship emerging from a mysterious fog.",
        "A scientist in a high-tech laboratory making a groundbreaking discovery.",
        "A whimsical illustration of animals operating a busy coffee shop.",
        "A lone tree on a hill, silhouetted against a spectacular sunset.",
        "A knight's shiny, ornate suit of armor displayed in a castle hall.",
        "An alien planet with two suns and bizarre, colorful flora.",
        "A phoenix rising from the ashes, with fiery, magnificent wings.",
        "A jazz club in the 1920s, full of energy and cool musicians.",
        "A cute, fluffy creature that is a hybrid of a cat and a butterfly.",
        "A tranquil scene of a canoe on a perfectly still, mirror-like lake at dawn.",
        "A medieval alchemist's workshop, filled with strange potions and bubbling concoctions.",
        "A vibrant, abstract painting representing the feeling of joy.",
        "A crystal cave with giant, glowing crystals of every color imaginable.",
        "A close-up of a hummingbird in flight, its wings a blur of motion.",
        "A futuristic soldier in advanced power armor, ready for battle."
    ];

    const popup = document.getElementById('prompt-of-the-day-popup');
    if (!popup) return;

    // Timezone-safe function to get the current date string in EST/EDT
    const getEstDateString = () => {
        return new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" });
    };

    const todayEst = getEstDateString();
    const lastDismissed = localStorage.getItem('potdDismissedDate');

    // If dismissed today, do nothing.
    if (lastDismissed === todayEst) {
        return;
    }

    // Timezone-safe function to calculate the day of the year based on EST/EDT.
    // This ensures the prompt changes at midnight in New York for all users.
    const getDayOfYearEst = () => {
        const now = new Date();
        // Create a date object that represents the current time in the target timezone
        const estDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const startOfYear = new Date(estDate.getFullYear(), 0, 0);
        const diff = estDate - startOfYear;
        const oneDay = 1000 * 60 * 60 * 24;
        return Math.floor(diff / oneDay);
    };

    const dayOfYear = getDayOfYearEst();
    const promptIndex = dayOfYear % prompts.length;
    const dailyPrompt = prompts[promptIndex];

    const promptTextEl = document.getElementById('potd-text');
    const tryBtn = document.getElementById('potd-try-btn');
    const dismissBtn = document.getElementById('potd-dismiss-btn');
    const promptInput = document.getElementById('prompt-input');

    if (!promptTextEl || !tryBtn || !dismissBtn || !promptInput) {
        console.error("One or more 'Prompt of the Day' elements are missing.");
        return;
    }

    promptTextEl.textContent = dailyPrompt;

    const dismissPopup = () => {
        popup.classList.remove('visible'); // Simple class removal for hiding
        localStorage.setItem('potdDismissedDate', todayEst);
    };

    tryBtn.addEventListener('click', () => {
        promptInput.value = dailyPrompt;
        promptInput.dispatchEvent(new Event('input', { bubbles: true }));
        promptInput.dispatchEvent(new Event('change', { bubbles: true }));
        promptInput.focus();
        dismissPopup();
    });

    dismissBtn.addEventListener('click', dismissPopup);

    // Show the popup after a short delay by adding the 'visible' class
    setTimeout(() => {
        popup.classList.add('visible');
    }, 1500);
}


// --- AI & Generation Logic ---

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

async function generateImage(recaptchaToken) {
    const prompt = isRegenerating 
        ? document.getElementById('regenerate-prompt-input').value.trim() 
        : document.getElementById('prompt-input').value.trim();
    lastPrompt = prompt;
    
    const shouldBlur = !auth.currentUser && getGenerationCount() === (FREE_GENERATION_LIMIT - 1);
    
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
        const imageUrl = await generateImageWithRetry(prompt, uploadedImageData, recaptchaToken, selectedAspectRatio);
        if (shouldBlur) { lastGeneratedImageUrl = imageUrl; }
        displayImage(imageUrl, prompt, shouldBlur);
        incrementTotalGenerations();
        if (!auth.currentUser) { incrementGenerationCount(); }
    } catch (error) {
        console.error('Image generation failed:', error);
        showMessage(`Sorry, we couldn't generate the image. ${error.message}`, 'error');
    } finally {
        stopTimer();
        loadingIndicator.classList.add('hidden');
        document.getElementById('regenerate-prompt-input').value = lastPrompt;
        postGenerationControls.classList.remove('hidden');
        addNavigationButtons();
        grecaptcha.reset();
        isRegenerating = false;
    }
}

async function generateImageWithRetry(prompt, imageData, token, aspectRatio, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, imageData, recaptchaToken: token, aspectRatio: aspectRatio })
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


// --- Authentication & User State ---

function handleAuthAction() { if (auth.currentUser) signOut(auth); else signInWithGoogle(); }

function signInWithGoogle() { 
    const authModal = document.getElementById('auth-modal');
    signInWithPopup(auth, provider)
        .then(result => {
            updateUIForAuthState(result.user);
            if (authModal) authModal.setAttribute('aria-hidden', 'true');
        })
        .catch(error => console.error("Authentication Error:", error)); 
}

function updateUIForAuthState(user) {
    const authBtn = document.getElementById('auth-btn');
    const mobileAuthBtn = document.getElementById('mobile-auth-btn');
    const generationCounterEl = document.getElementById('generation-counter');
    const mobileGenerationCounterEl = document.getElementById('mobile-generation-counter');
    
    if (user) {
        const welcomeText = `Welcome, ${user.displayName.split(' ')[0]}`;
        authBtn.textContent = 'Sign Out';
        mobileAuthBtn.textContent = 'Sign Out';
        generationCounterEl.textContent = welcomeText;
        mobileGenerationCounterEl.textContent = welcomeText;
        
        if (lastGeneratedImageUrl) {
            const blurredContainer = document.querySelector('.blurred-image-container');
            if (blurredContainer) {
                const img = blurredContainer.querySelector('img');
                img.classList.remove('blurred-image');
                const overlay = blurredContainer.querySelector('.unlock-overlay');
                if (overlay) overlay.remove();
            }
            lastGeneratedImageUrl = null;
        }
    } else {
        authBtn.textContent = 'Sign In';
        mobileAuthBtn.textContent = 'Sign In';
        updateGenerationCounter();
    }
}

function getGenerationCount() { return parseInt(localStorage.getItem('generationCount') || '0'); }

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
    const generationCounterEl = document.getElementById('generation-counter');
    const mobileGenerationCounterEl = document.getElementById('mobile-generation-counter');
    if (generationCounterEl) generationCounterEl.textContent = text;
    if (mobileGenerationCounterEl) mobileGenerationCounterEl.textContent = text;
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

async function incrementTotalGenerations() {
    const counterRef = doc(db, "stats", "imageGenerations");
    try { await setDoc(counterRef, { count: increment(1) }, { merge: true }); } catch (error) { console.error("Error incrementing generation count:", error); }
}

function displayImage(imageUrl, prompt, shouldBlur = false) {
    const imageGrid = document.getElementById('image-grid');
    const imgContainer = document.createElement('div');
    imgContainer.className = 'bg-white rounded-xl shadow-lg overflow-hidden relative group fade-in-slide-up mx-auto max-w-2xl border border-gray-200/80';
    if (shouldBlur) { imgContainer.classList.add('blurred-image-container'); }
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = prompt;
    img.className = 'w-full h-auto object-contain';
    if (shouldBlur) { img.classList.add('blurred-image'); }
    
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

    if (!shouldBlur) { 
        imgContainer.appendChild(downloadButton); 
    } else {
        const overlay = document.createElement('div');
        overlay.className = 'unlock-overlay';
        overlay.innerHTML = `<h3 class="text-xl font-semibold">Unlock Image</h3><p class="mt-2">Sign in to unlock this image and get unlimited generations.</p><button id="unlock-btn">Sign In to Unlock</button>`;
        overlay.querySelector('#unlock-btn').onclick = () => { document.getElementById('auth-modal').setAttribute('aria-hidden', 'false'); };
        imgContainer.appendChild(overlay);
    }
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

