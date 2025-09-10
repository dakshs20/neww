// --- IMPORTS & THIRD-PARTY LIBS ---
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.es.mjs";

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Verse page specific scripts
    if (document.getElementById('chat-container')) {
        initializeVersePage();
    }
});

// --- GLOBAL STATE ---
let chatHistory = []; // Single source of truth for the conversation
let attachedFile = null;
let currentTypingSpeed = 30; // Default typing speed (milliseconds per word)
let currentAnswerLength = 'medium'; // Default answer length
let isAwaitingResponse = false; // Prevents multiple submissions

// --- INITIALIZATION ---
function initializeVersePage() {
    // --- DOM Element References ---
    const chatContainer = document.getElementById('chat-container');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const fileUploadBtn = document.getElementById('file-upload-btn');
    const fileUploadInput = document.getElementById('file-upload-input');
    const filePreview = document.getElementById('file-preview');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const dropZone = document.getElementById('drop-zone');
    const lengthButtons = document.querySelectorAll('.answer-length-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('close-settings-modal-btn');
    const speedSlider = document.getElementById('typing-speed-slider');
    const speedValue = document.getElementById('typing-speed-value');

    // --- EVENT LISTENERS ---
    sendBtn.addEventListener('click', handleSendMessage);
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    fileUploadBtn.addEventListener('click', () => fileUploadInput.click());
    fileUploadInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
    removeFileBtn.addEventListener('click', removeAttachedFile);

    // Drag & Drop Listeners
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('bg-blue-50', 'border-blue-300');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('bg-blue-50', 'border-blue-300');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-blue-50', 'border-blue-300');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    // Settings Modal
    settingsBtn.addEventListener('click', () => settingsModal.setAttribute('aria-hidden', 'false'));
    closeModalBtn.addEventListener('click', () => settingsModal.setAttribute('aria-hidden', 'true'));
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
             settingsModal.setAttribute('aria-hidden', 'true');
        }
    });

    // Typing Speed Slider
    speedSlider.addEventListener('input', (e) => {
        currentTypingSpeed = parseInt(e.target.value);
        speedValue.textContent = `${currentTypingSpeed}ms`;
    });

    // Answer Length Buttons
    lengthButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            lengthButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentAnswerLength = btn.dataset.length;
        });
    });

    // --- INITIAL CHAT MESSAGE ---
    chatHistory.push({
        role: 'model',
        parts: [{ text: "Hello! I'm Verse, your AI assistant. How can I help you today?" }]
    });
    renderChat();
}

// --- CORE FUNCTIONS ---

/**
 * Renders the entire chat UI based on the chatHistory array.
 * This is the single source of truth for what is displayed.
 */
function renderChat() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.innerHTML = ''; // Clear the container before rendering

    chatHistory.forEach(message => {
        const messageWrapper = createMessageElement(message.role, message.parts[0].text, message.isError);
        chatContainer.appendChild(messageWrapper);
    });

    // Auto-scroll to the latest message
    chatContainer.scrollTop = chatContainer.scrollHeight;
}


/**
 * Handles the logic for sending a user's prompt to the backend.
 */
async function handleSendMessage() {
    if (isAwaitingResponse) return;

    const promptInput = document.getElementById('prompt-input');
    const prompt = promptInput.value.trim();
    if (!prompt && !attachedFile) return;

    isAwaitingResponse = true;
    updateInputState(true);

    const userQueryText = prompt || `File attached: ${attachedFile.name}`;
    let userQueryParts = [{ text: prompt }];

    // Add user message to history and re-render the chat
    chatHistory.push({ role: 'user', parts: [{ text: userQueryText }] });
    renderChat();
    
    // Reset input fields
    promptInput.value = '';
    promptInput.style.height = 'auto';

    let fileData = null;
    if (attachedFile) {
        fileData = await readFileAsBase64(attachedFile);
        userQueryParts.push({ inlineData: { mimeType: fileData.mimeType, data: fileData.content } });
        removeAttachedFile();
    }
    
    const typingIndicator = displayTypingIndicator();

    try {
        const apiHistory = chatHistory.slice(0, -1); // Send history *before* the current question

        const response = await fetch('/api/verse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                fileContent: fileData ? fileData.content : null,
                fileName: fileData ? fileData.name : null,
                fileMimeType: fileData ? fileData.mimeType : null,
                chatHistory: apiHistory,
                answerLength: currentAnswerLength
            })
        });
        
        typingIndicator.remove();

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || 'An unknown network error occurred.');
        }

        const result = await response.json();
        const responseText = result.text;
        
        // Add a placeholder for the AI message, then render it
        const aiMessagePlaceholder = { role: 'model', parts: [{ text: '' }] };
        chatHistory.push(aiMessagePlaceholder);
        renderChat();

        // Find the last message element (the empty one we just created) to type into
        const allMessages = document.querySelectorAll('.ai-message, .user-message');
        const lastMessageElement = allMessages[allMessages.length - 1];
        const lastMessageContent = lastMessageElement.querySelector('.message-content');

        await typeWriter(responseText, lastMessageContent);
        
        // Once typing is done, update the history with the final text
        aiMessagePlaceholder.parts[0].text = responseText;

    } catch (error) {
        console.error('Verse API Error:', error);
        if(typingIndicator) typingIndicator.remove();
        // Add error to history and re-render
        chatHistory.push({
            role: 'model',
            parts: [{ text: `Sorry, something went wrong: ${error.message}` }],
            isError: true
        });
        renderChat();
    } finally {
        isAwaitingResponse = false;
        updateInputState(false);
    }
}

/**
 * Creates and returns a message DOM element.
 * @param {string} sender - 'user' or 'ai' ('model').
 * @param {string} text - The message content.
 * @param {boolean} isError - If the message is an error.
 * @returns {HTMLElement} The message wrapper element.
 */
function createMessageElement(sender, text, isError = false) {
    const role = (sender === 'ai' || sender === 'model') ? 'model' : 'user';

    const messageWrapper = document.createElement('div');
    messageWrapper.className = role === 'user' ? 'user-message' : 'ai-message';
    if (isError) {
        messageWrapper.classList.add('error-message');
    }

    const content = document.createElement('div');
    content.className = 'message-content';

    if (role === 'model') {
        content.innerHTML = DOMPurify.sanitize(marked.parse(text || ''));
    } else {
        content.textContent = text;
    }

    messageWrapper.appendChild(content);
    return messageWrapper;
}

/**
 * Displays the typing indicator in the chat.
 * @returns {HTMLElement} The indicator element.
 */
function displayTypingIndicator() {
    const chatContainer = document.getElementById('chat-container');
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'ai-message';
    indicator.innerHTML = `
        <div class="message-content">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>`;
    chatContainer.appendChild(indicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return indicator;
}

/**
 * Simulates a typewriter effect for the AI's response.
 * @param {string} text - The full text to type.
 * @param {HTMLElement} element - The element to type into.
 */
async function typeWriter(text, element) {
    // Use marked.lexer to split by Markdown tokens for better word separation
    const tokens = marked.lexer(text);
    const words = [];
    marked.walkTokens(tokens, token => {
        if (token.type === 'text' || token.type === 'paragraph') {
            words.push(...token.text.split(/(\s+)/));
        } else if (token.raw) {
            words.push(token.raw);
        }
    });

    let currentContent = '';
    for (const word of words) {
        currentContent += word;
        element.innerHTML = DOMPurify.sanitize(marked.parse(currentContent));
        await new Promise(resolve => setTimeout(resolve, currentTypingSpeed));
    }
    // Final parse to ensure all markdown is correctly rendered
    element.innerHTML = DOMPurify.sanitize(marked.parse(text));
}

// --- UTILITY & HELPER FUNCTIONS ---

/**
 * Toggles the input elements' state between active and loading.
 * @param {boolean} isLoading - The loading state.
 */
function updateInputState(isLoading) {
    const sendBtn = document.getElementById('send-btn');
    const sendIcon = document.getElementById('send-icon');
    const spinner = document.getElementById('spinner');
    const promptInput = document.getElementById('prompt-input');

    if (isLoading) {
        sendBtn.disabled = true;
        promptInput.disabled = true;
        promptInput.placeholder = 'Verse is thinking...';
        sendBtn.classList.add('generating');
        sendIcon.classList.add('hidden');
        spinner.classList.remove('hidden');
    } else {
        sendBtn.disabled = false;
        promptInput.disabled = false;
        promptInput.placeholder = 'Ask Verse anything...';
        sendBtn.classList.remove('generating');
        sendIcon.classList.remove('hidden');
        spinner.classList.add('hidden');
        promptInput.focus();
    }
}

/**
 * Handles the selection of a file for upload.
 * @param {File} file - The file selected by the user.
 */
function handleFileSelect(file) {
    if (!file) return;
    attachedFile = file;

    const filePreview = document.getElementById('file-preview');
    const fileNameEl = document.getElementById('file-name');
    const fileSizeEl = document.getElementById('file-size');
    const fileUploadPrompt = document.getElementById('file-upload-prompt');

    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB`;
    filePreview.classList.remove('hidden');
    fileUploadPrompt.classList.add('hidden');
}

/**
 * Removes the currently attached file.
 */
function removeAttachedFile() {
    attachedFile = null;
    document.getElementById('file-upload-input').value = ''; // Reset input
    document.getElementById('file-preview').classList.add('hidden');
    document.getElementById('file-upload-prompt').classList.remove('hidden');
}

/**
 * Reads a file and returns its Base64 encoded content.
 * @param {File} file - The file to read.
 * @returns {Promise<Object>} An object containing file content, name, and mimeType.
 */
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve({
                content: base64String,
                name: file.name,
                mimeType: file.type
            });
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

