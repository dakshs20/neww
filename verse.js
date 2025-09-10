import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const auth = getAuth();

// --- DOM Elements ---
const promptForm = document.getElementById('prompt-form');
const promptInput = document.getElementById('prompt-input');
const sendBtn = document.getElementById('send-btn');
const chatContainer = document.getElementById('chat-container');
const fileUploadBtn = document.getElementById('file-upload-btn');
const fileUploadInput = document.getElementById('file-upload-input');
const fileInfo = document.getElementById('file-info');
const fileNameEl = document.getElementById('file-name');
const removeFileBtn = document.getElementById('remove-file-btn');
const verseUiContainer = document.getElementById('verse-ui-container');
const dragDropOverlay = document.getElementById('drag-drop-overlay');
const fileProgressContainer = document.getElementById('file-progress-container');
const fileProgressBar = document.getElementById('file-progress-bar');
const processingFileName = document.getElementById('processing-file-name');
const answerLengthBtns = document.querySelectorAll('.answer-length-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const typingSpeedSlider = document.getElementById('typing-speed-slider');

// --- State ---
let fileContent = null;
let uploadedFile = null;
let isGenerating = false;
let chatHistory = [];
let answerLength = 'medium'; // 'short', 'medium', 'detailed'
let typingSpeed = 50; // ms delay between words

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;
    }
    
    onAuthStateChanged(auth, user => { /* Handle auth state */ });

    // Event Listeners
    promptForm.addEventListener('submit', handleFormSubmit);
    promptInput.addEventListener('keydown', handleKeydown);
    promptInput.addEventListener('input', autoResizeTextarea);
    fileUploadBtn.addEventListener('click', () => fileUploadInput.click());
    fileUploadInput.addEventListener('change', (e) => handleFileUpload(e.target.files[0]));
    removeFileBtn.addEventListener('click', removeFile);
    
    // Drag and Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        verseUiContainer.addEventListener(eventName, preventDefaults, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        verseUiContainer.addEventListener(eventName, () => dragDropOverlay.style.display = 'flex', false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        verseUiContainer.addEventListener(eventName, () => dragDropOverlay.style.display = 'none', false);
    });
    verseUiContainer.addEventListener('drop', handleDrop, false);

    // Settings
    answerLengthBtns.forEach(btn => btn.addEventListener('click', handleAnswerLengthChange));
    settingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
    closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');
    typingSpeedSlider.addEventListener('input', (e) => {
        // Invert the value so left is fast and right is slow
        typingSpeed = 110 - e.target.value;
    });
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    let dt = e.dataTransfer;
    let file = dt.files[0];
    handleFileUpload(file);
}

// --- Event Handlers ---
async function handleFormSubmit(e) {
    e.preventDefault();
    if (isGenerating) return;

    if (!auth.currentUser) {
        document.getElementById('auth-modal')?.setAttribute('aria-hidden', 'false');
        return;
    }

    const prompt = promptInput.value.trim();
    if (!prompt && !uploadedFile) return;

    addMessageToChat(prompt, 'user');
    chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
    promptInput.value = '';
    autoResizeTextarea();

    isGenerating = true;
    updateSendButtonState();
    const aiMessageEl = showTypingIndicator();

    try {
        const payload = { 
            prompt, 
            fileContent, 
            fileName: uploadedFile ? uploadedFile.name : null,
            fileMimeType: uploadedFile ? uploadedFile.type : null,
            chatHistory: chatHistory.slice(0, -1), // Send history without current prompt
            answerLength 
        };

        const response = await fetch('/api/verse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

        const data = await response.json();
        chatHistory.push({ role: 'model', parts: [{ text: data.text }] });
        hideTypingIndicator();
        await typewriterEffect(aiMessageEl.querySelector('.message-content'), data.text);

    } catch (error) {
        console.error('Verse API error:', error);
        hideTypingIndicator();
        addMessageToChat('Sorry, I encountered an error. Please try again.', 'ai', true);
    } finally {
        isGenerating = false;
        updateSendButtonState();
        if (uploadedFile) removeFile();
    }
}

function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        promptForm.dispatchEvent(new Event('submit'));
    }
}

function handleAnswerLengthChange(e) {
    answerLengthBtns.forEach(b => b.classList.remove('selected'));
    e.target.classList.add('selected');
    answerLength = e.target.dataset.length;
}

async function handleFileUpload(file) {
    if (!file) return;

    removeFile(); // Clear any previous file
    uploadedFile = file;
    showFileInfo(file.name);
    
    // Complex files are handled by the backend
    const complexTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/vnd.dwg', 'image/vnd.dxf'];
    const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];

    showFileProgress(file.name);
    
    try {
        if (file.type === 'text/plain') {
            fileContent = await file.text();
        } else if (file.type === 'application/pdf') {
            fileContent = await readPdfFile(file);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            fileContent = await readDocxFile(file);
        } else if (imageTypes.includes(file.type)) {
            fileContent = await readFileAsBase64(file);
        } else if (complexTypes.includes(file.type)) {
            fileContent = `[Complex file of type ${file.type} uploaded. Analysis will be performed by the backend.]`;
        } else {
            throw new Error('Unsupported file type.');
        }
        fileProgressBar.style.width = '100%';
        setTimeout(() => { fileProgressContainer.classList.add('hidden'); }, 500);

    } catch (error) {
        console.error("Error reading file:", error);
        alert(`Could not read the file: ${error.message}`);
        removeFile();
    }
}

// --- File Reading Utilities ---
async function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

async function readPdfFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ');
        fileProgressBar.style.width = `${(i / pdf.numPages) * 100}%`;
    }
    return text;
}

async function readDocxFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    fileProgressBar.style.width = '50%';
    const result = await mammoth.extractRawText({ arrayBuffer });
    fileProgressBar.style.width = '100%';
    return result.value;
}


// --- UI Manipulation ---
function addMessageToChat(text, sender, isError = false) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = sender === 'user' ? 'user-message' : 'ai-message';
    if(isError) messageWrapper.classList.add('error-message');

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = text;
    
    messageWrapper.appendChild(messageContent);
    chatContainer.appendChild(messageWrapper);
    scrollToBottom();
}

function showTypingIndicator() {
    const existingIndicator = document.getElementById('typing-indicator');
    if (existingIndicator) existingIndicator.remove();
    
    const messageWrapper = document.createElement('div');
    messageWrapper.id = 'typing-indicator';
    messageWrapper.className = 'ai-message';
    messageWrapper.innerHTML = `
        <div class="message-content">
            <div class="typing-dots"><span></span><span></span><span></span></div>
        </div>
    `;
    chatContainer.appendChild(messageWrapper);
    scrollToBottom();
    return messageWrapper;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.innerHTML = '<div class="message-content"></div>'; // Keep shell for typewriter
}

async function typewriterEffect(element, text) {
    const html = marked.parse(text);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    element.innerHTML = ''; // Clear previous content

    async function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const words = node.textContent.split(' ');
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                if (word) {
                    const span = document.createElement('span');
                    span.textContent = word + (i < words.length - 1 ? ' ' : '');
                    element.appendChild(span);
                    await new Promise(resolve => setTimeout(resolve, typingSpeed));
                    scrollToBottom();
                }
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const newNode = document.createElement(node.nodeName);
            for (const attr of node.attributes) {
                newNode.setAttribute(attr.name, attr.value);
            }
            element.appendChild(newNode);
            for (const childNode of Array.from(node.childNodes)) {
                await processNode(childNode);
            }
        }
    }

    for (const childNode of Array.from(tempDiv.childNodes)) {
        await processNode(childNode);
    }
}


function updateSendButtonState() {
    sendBtn.disabled = isGenerating;
    sendBtn.classList.toggle('generating', isGenerating);
    sendBtn.innerHTML = isGenerating 
        ? `<div class="spinner"></div>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
}

function autoResizeTextarea() {
    promptInput.style.height = 'auto';
    promptInput.style.height = `${Math.min(promptInput.scrollHeight, 200)}px`;
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showFileInfo(name) {
    fileNameEl.textContent = name;
    fileInfo.classList.remove('hidden');
    fileInfo.classList.add('flex');
}

function removeFile() {
    fileContent = null;
    uploadedFile = null;
    fileUploadInput.value = ''; 
    fileInfo.classList.add('hidden');
    fileInfo.classList.remove('flex');
    fileProgressContainer.classList.add('hidden');
}

function showFileProgress(name) {
    processingFileName.textContent = `Processing ${name}...`;
    fileProgressBar.style.width = '0%';
    fileProgressContainer.classList.remove('hidden');
}

