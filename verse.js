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

// --- State ---
let fileContent = null;
let currentFileName = null;
let isGenerating = false;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // pdf.js worker configuration
    if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;
    }
    
    onAuthStateChanged(auth, user => {
        if (!user) {
            // Optional: You could disable the form if the user is not logged in.
            // For now, we'll just handle it on send.
        }
    });

    promptForm.addEventListener('submit', handleFormSubmit);
    promptInput.addEventListener('keydown', handleKeydown);
    promptInput.addEventListener('input', autoResizeTextarea);
    fileUploadBtn.addEventListener('click', () => fileUploadInput.click());
    fileUploadInput.addEventListener('change', handleFileUpload);
    removeFileBtn.addEventListener('click', removeFile);
});

// --- Event Handlers ---
async function handleFormSubmit(e) {
    e.preventDefault();
    if (isGenerating) return;

    if (!auth.currentUser) {
        document.getElementById('auth-modal')?.setAttribute('aria-hidden', 'false');
        return;
    }

    const prompt = promptInput.value.trim();
    if (!prompt && !fileContent) return;

    addMessageToChat(prompt, 'user');
    promptInput.value = '';
    autoResizeTextarea();

    isGenerating = true;
    updateSendButtonState();
    showTypingIndicator();

    try {
        const response = await fetch('/api/verse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, fileContent, fileName: currentFileName })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();
        hideTypingIndicator();
        addMessageToChat(data.text, 'ai');
    } catch (error) {
        console.error('Verse API error:', error);
        hideTypingIndicator();
        addMessageToChat('Sorry, I encountered an error. Please try again.', 'ai', true);
    } finally {
        isGenerating = false;
        updateSendButtonState();
        if (fileContent) removeFile();
    }
}

function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        promptForm.dispatchEvent(new Event('submit'));
    }
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    showFileInfo(file.name);
    currentFileName = file.name;

    try {
        if (file.type === 'text/plain') {
            fileContent = await file.text();
        } else if (file.type === 'application/pdf') {
            fileContent = await readPdfFile(file);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            fileContent = await readDocxFile(file);
        } else {
            alert('Unsupported file type. Please upload .txt, .pdf, or .docx');
            removeFile();
            return;
        }
    } catch (error) {
        console.error("Error reading file:", error);
        alert("Could not read the file. It may be corrupted or protected.");
        removeFile();
    }
}

// --- File Reading Utilities ---
async function readPdfFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ');
    }
    return text;
}

async function readDocxFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

// --- UI Manipulation ---
function addMessageToChat(text, sender, isError = false) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = sender === 'user' ? 'user-message' : 'ai-message';
    if(isError) messageWrapper.classList.add('error-message');

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    if (sender === 'ai') {
        const formattedText = marked.parse(text);
        typewriterEffect(messageContent, formattedText);
    } else {
        messageContent.textContent = text;
    }
    
    messageWrapper.appendChild(messageContent);
    chatContainer.appendChild(messageWrapper);
    scrollToBottom();
}


function showTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.id = 'typing-indicator';
    typingIndicator.className = 'ai-message';
    typingIndicator.innerHTML = `
        <div class="message-content">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    chatContainer.appendChild(typingIndicator);
    scrollToBottom();
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

function updateSendButtonState() {
    sendBtn.disabled = isGenerating;
    sendBtn.classList.toggle('generating', isGenerating);
    sendBtn.innerHTML = isGenerating 
        ? `<div class="spinner"></div>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
}

function typewriterEffect(element, html) {
    element.innerHTML = html;
    // For simplicity, we are not doing a character-by-character typing animation with Markdown.
    // This can be complex to implement correctly. Instead, we just render the final HTML.
    // The "typing indicator" provides the necessary user feedback.
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
    currentFileName = null;
    fileUploadInput.value = ''; // Reset the input
    fileInfo.classList.add('hidden');
    fileInfo.classList.remove('flex');
}
