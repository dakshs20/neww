// --- IMPORTS & THIRD-PARTY LIBS ---
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.es.mjs";

document.addEventListener('DOMContentLoaded', initializeVersePage);

// --- GLOBAL STATE ---
let chatHistory = []; // Single source of truth for the conversation
let attachedFile = null;
let currentTypingSpeed = 30;
let currentAnswerLength = 'medium';
let isAwaitingResponse = false;

// --- INITIALIZATION ---
function initializeVersePage() {
    // --- DOM Element References ---
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const fileUploadBtn = document.getElementById('file-upload-btn');
    const fileUploadInput = document.getElementById('file-upload-input');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const dropZone = document.getElementById('drop-zone');
    const lengthButtons = document.querySelectorAll('.answer-length-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.getElementById('close-settings-modal-btn');
    const speedSlider = document.getElementById('typing-speed-slider');
    const speedValue = document.getElementById('typing-speed-value');

    // --- CRITICAL ELEMENTS CHECK ---
    if (!promptInput || !sendBtn || !document.getElementById('chat-container')) {
        console.error("Fatal Error: A critical chat component is missing from the DOM. App cannot start.");
        return;
    }

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

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('bg-blue-50', 'border-blue-300'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('bg-blue-50', 'border-blue-300'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('bg-blue-50', 'border-blue-300');
        if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
    });

    // Settings
    settingsBtn.addEventListener('click', () => settingsModal.setAttribute('aria-hidden', 'false'));
    closeModalBtn.addEventListener('click', () => settingsModal.setAttribute('aria-hidden', 'true'));
    settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) settingsModal.setAttribute('aria-hidden', 'true'); });
    speedSlider.addEventListener('input', (e) => {
        currentTypingSpeed = parseInt(e.target.value);
        speedValue.textContent = `${currentTypingSpeed}ms`;
    });

    // Length Buttons
    lengthButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            lengthButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            currentAnswerLength = btn.dataset.length;
        });
    });

    // --- INITIAL RENDER ---
    chatHistory.push({ role: 'model', parts: [{ text: "Hello! I'm Verse, your AI assistant. How can I help you today?" }] });
    renderChat();
}

/**
 * Centralized function to lock and unlock the entire UI input state.
 * @param {boolean} isLocked - Whether to lock or unlock the UI.
 */
function setUiLockState(isLocked) {
    const sendBtn = document.getElementById('send-btn');
    const promptInput = document.getElementById('prompt-input');
    const sendIcon = document.getElementById('send-icon');
    const spinner = document.getElementById('spinner');

    if (!sendBtn || !promptInput || !sendIcon || !spinner) return;

    if (isLocked) {
        isAwaitingResponse = true;
        sendBtn.disabled = true;
        promptInput.disabled = true;
        promptInput.placeholder = 'Verse is thinking...';
        sendBtn.classList.add('generating');
        sendIcon.classList.add('hidden');
        spinner.classList.remove('hidden');
    } else {
        isAwaitingResponse = false;
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
 * Handles sending a message.
 */
async function handleSendMessage() {
    const promptInput = document.getElementById('prompt-input');
    if (isAwaitingResponse) return;

    const prompt = promptInput.value.trim();
    if (!prompt && !attachedFile) return;

    setUiLockState(true);
    
    let typingIndicator;

    try {
        const userQueryText = prompt || `File attached: ${attachedFile.name}`;
        chatHistory.push({ role: 'user', parts: [{ text: userQueryText }] });
        renderChat();

        promptInput.value = '';
        promptInput.style.height = 'auto';

        let fileData = null;
        if (attachedFile) {
            fileData = await readFileAsBase64(attachedFile);
            removeAttachedFile();
        }

        typingIndicator = displayTypingIndicator();
        const apiHistory = chatHistory.slice(0, -1);

        const response = await fetch('/api/verse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                fileContent: fileData?.content,
                fileName: fileData?.name,
                fileMimeType: fileData?.mimeType,
                chatHistory: apiHistory,
                answerLength: currentAnswerLength
            })
        });

        if (typingIndicator) typingIndicator.remove();

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || 'An unknown network error occurred.');
        }

        const result = await response.json();
        const responseText = result.text;
        const aiMessagePlaceholder = { role: 'model', parts: [{ text: '' }] };
        chatHistory.push(aiMessagePlaceholder);
        renderChat();

        const allMessages = document.querySelectorAll('.ai-message, .user-message');
        const lastMessageElement = allMessages[allMessages.length - 1];
        const lastMessageContent = lastMessageElement.querySelector('.message-content');

        await typeWriter(responseText, lastMessageContent);
        aiMessagePlaceholder.parts[0].text = responseText;

    } catch (error) {
        console.error('Verse API Error:', error);
        if (typingIndicator) typingIndicator.remove();
        chatHistory.push({ role: 'model', parts: [{ text: `Sorry, something went wrong: ${error.message}` }], isError: true });
        renderChat();
    } finally {
        setUiLockState(false);
    }
}

function renderChat() {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.innerHTML = '';
    chatHistory.forEach(message => {
        const messageWrapper = createMessageElement(message.role, message.parts[0].text, message.isError);
        chatContainer.appendChild(messageWrapper);
    });
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Creates and returns a message DOM element.
 * THIS FUNCTION CONTAINED THE BUG. IT'S NOW FIXED.
 * @param {string} sender - 'user' or 'model'.
 * @param {string} text - The message content.
 * @param {boolean} isError - If the message is an error.
 * @returns {HTMLElement} The message wrapper element.
 */
function createMessageElement(sender, text, isError = false) {
    const role = (sender === 'ai' || sender === 'model') ? 'model' : 'user';
    const messageWrapper = document.createElement('div');
    messageWrapper.className = role === 'user' ? 'user-message' : 'ai-message';
    if (isError) messageWrapper.classList.add('error-message');
    
    const content = document.createElement('div');
    content.className = 'message-content';

    // *** THE FIX IS HERE ***
    // We now correctly handle setting content for BOTH model and user.
    if (role === 'model') {
        content.innerHTML = DOMPurify.sanitize(marked.parse(text || ''));
    } else {
        content.textContent = text; // This line was missing its assignment!
    }
    
    messageWrapper.appendChild(content);
    return messageWrapper;
}


function displayTypingIndicator() {
    const chatContainer = document.getElementById('chat-container');
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'ai-message';
    indicator.innerHTML = `<div class="message-content"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
    chatContainer.appendChild(indicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return indicator;
}

async function typeWriter(text, element) {
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
    element.innerHTML = DOMPurify.sanitize(marked.parse(text));
}

function handleFileSelect(file) {
    if (!file) return;
    attachedFile = file;
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = `${(file.size / 1024).toFixed(1)} KB`;
    document.getElementById('file-preview').classList.remove('hidden');
    document.getElementById('file-upload-prompt').classList.add('hidden');
}

function removeAttachedFile() {
    attachedFile = null;
    document.getElementById('file-upload-input').value = '';
    document.getElementById('file-preview').classList.add('hidden');
    document.getElementById('file-upload-prompt').classList.remove('hidden');
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
            content: reader.result.split(',')[1],
            name: file.name,
            mimeType: file.type
        });
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

