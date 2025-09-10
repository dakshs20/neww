// File: verse.js
// This file contains all the client-side logic for the Verse AI chat interface.

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const chatWindow = document.getElementById('verse-chat-window');
    const messageInput = document.getElementById('verse-input');
    const sendBtn = document.getElementById('verse-send-btn');
    const fileUploadBtn = document.getElementById('verse-upload-btn');
    const fileUploadInput = document.getElementById('verse-file-input');
    const filePreviewContainer = document.getElementById('file-preview-container');
    const filePreviewName = document.getElementById('file-preview-name');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const lengthSelector = document.getElementById('length-selector');
    
    // --- State Management ---
    let conversationHistory = [];
    let uploadedFile = null; 
    let isAwaitingResponse = false;
    
    // --- Pre-programmed GenArt Questions ---
    const genArtKnowledge = {
        "who is the founder of genart?": "Daksh Suthar.",
        "who created you?": "GenArt ML Technologies developed me.",
        "who developed you?": "I was developed by GenArt ML Technologies."
    };

    // --- Core Functions ---

    /**
     * Handles sending a user's message.
     */
    const sendMessage = () => {
        const rawMessage = messageInput.value.trim();
        if (!rawMessage && !uploadedFile) return;
        if (isAwaitingResponse) return;

        // Check for pre-programmed answers
        const lowerCaseMessage = rawMessage.toLowerCase().replace(/[^\w\s]/gi, '');
        if (genArtKnowledge[lowerCaseMessage]) {
            addUserMessage(rawMessage);
            addBotMessage(genArtKnowledge[lowerCaseMessage]);
            resetInput();
            return;
        }

        addUserMessage(rawMessage);
        
        // Prepare for AI response
        isAwaitingResponse = true;
        setUiLoadingState(true);
        addTypingIndicator();

        // Get AI response from our new backend
        getAiResponse();
    };

    /**
     * Fetches a response from the AI model via our backend API.
     */
    const getAiResponse = async () => {
        try {
            const responseLength = lengthSelector.value;
            
            // This now calls our own backend endpoint
            const response = await fetch('/api/verse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationHistory, uploadedFile, responseLength })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `API Error: ${response.status}`);
            }

            const data = await response.json();
            const aiText = data.text;

            // Add AI response to history for context
            conversationHistory.push({ role: 'model', parts: [{ text: aiText }] });

            // Update UI with the response
            removeTypingIndicator();
            addBotMessage(aiText);

        } catch (error) {
            console.error('Error fetching AI response:', error);
            removeTypingIndicator();
            addBotMessage(`Sorry, something went wrong. Please try again. Error: ${error.message}`, true);
        } finally {
            isAwaitingResponse = false;
            setUiLoadingState(false);
            resetInput();
        }
    };
    
    // --- UI Update Functions ---

    /**
     * Adds a user's message to the chat window.
     * @param {string} message - The text of the message.
     */
    const addUserMessage = (message) => {
        // Add user message to conversation history for context
        const userParts = [{ text: message }];
        conversationHistory.push({ role: 'user', parts: userParts });

        const messageElement = document.createElement('div');
        messageElement.className = 'verse-message verse-user-message';
        
        let contentHTML = `<div class="prose max-w-none text-white">${message}</div>`;
        
        if (uploadedFile) {
            const previewHTML = uploadedFile.isText
                ? `<div class="mt-2 p-2 bg-gray-700 rounded-md text-sm text-gray-300">
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="inline-block mr-2" viewBox="0 0 16 16"><path d="M4 0h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2zm0 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H4z"/><path d="M4.5 12.5A.5.5 0 0 1 5 12h3a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5zm0-2A.5.5 0 0 1 5 10h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5zm0-2A.5.5 0 0 1 5 8h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5zm0-2A.5.5 0 0 1 5 6h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5zm0-2A.5.5 0 0 1 5 4h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5z"/></svg>
                     <span>${uploadedFile.name}</span>
                   </div>`
                : `<div class="mt-2"><img src="data:${uploadedFile.type};base64,${uploadedFile.content}" alt="${uploadedFile.name}" class="max-w-xs rounded-lg"/></div>`;
            contentHTML += previewHTML;
        }

        messageElement.innerHTML = contentHTML;
        chatWindow.appendChild(messageElement);
        scrollToBottom();
    };

    /**
     * Adds a bot's message to the chat window with a typing animation.
     * @param {string} message - The text of the message.
     * @param {boolean} isError - If true, formats as an error message.
     */
    const addBotMessage = (message, isError = false) => {
        const messageElement = document.createElement('div');
        messageElement.className = isError ? 'verse-message verse-bot-message-error' : 'verse-message verse-bot-message';
        
        const contentElement = document.createElement('div');
        contentElement.className = 'prose prose-invert max-w-none';
        messageElement.appendChild(contentElement);
        chatWindow.appendChild(messageElement);
        
        // Typing animation logic
        let currentText = '';
        let wordIndex = 0;
        const words = message.split(' ');

        function typeWord() {
            if (wordIndex < words.length) {
                currentText += (wordIndex > 0 ? ' ' : '') + words[wordIndex];
                 // Basic markdown support for bold, italics, lists
                let formattedText = currentText
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/^- (.*$)/gm, '<ul><li>$1</li></ul>')
                    .replace(/(\d+)\. (.*$)/gm, '<ol><li>$2</li></ol>')
                    .replace(/\n/g, '<br>');

                contentElement.innerHTML = formattedText;
                wordIndex++;
                scrollToBottom();
                setTimeout(typeWord, 50); 
            }
        }
        typeWord();
    };

    /**
     * Shows or hides the typing indicator.
     */
    const addTypingIndicator = () => {
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator';
        indicator.className = 'verse-message verse-bot-message';
        indicator.innerHTML = `
            <div class="flex items-center space-x-1">
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0s;"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0.2s;"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style="animation-delay: 0.4s;"></div>
            </div>`;
        chatWindow.appendChild(indicator);
        scrollToBottom();
    };

    const removeTypingIndicator = () => {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    };

    /**
     * Resets the input field and file attachment.
     */
    const resetInput = () => {
        messageInput.value = '';
        uploadedFile = null;
        fileUploadInput.value = '';
        filePreviewContainer.classList.add('hidden');
        messageInput.style.height = 'auto';
    };
    
    /**
     * Sets the loading state for UI elements.
     * @param {boolean} isLoading - The loading state.
     */
    const setUiLoadingState = (isLoading) => {
        sendBtn.disabled = isLoading;
        sendBtn.innerHTML = isLoading 
            ? '<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>';
    };

    const scrollToBottom = () => {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    };
    
    // --- Event Listeners ---

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = (messageInput.scrollHeight) + 'px';
    });

    fileUploadBtn.addEventListener('click', () => fileUploadInput.click());
    fileUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (readEvent) => {
            const base64Content = readEvent.target.result.split(',')[1];
            const isText = file.type.startsWith('text/') || 
                           ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type);

            uploadedFile = {
                name: file.name,
                type: file.type,
                content: base64Content,
                isText: isText
            };
            
            filePreviewName.textContent = file.name;
            filePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    });

    removeFileBtn.addEventListener('click', () => {
        uploadedFile = null;
        fileUploadInput.value = '';
        filePreviewContainer.classList.add('hidden');
    });

    // Initial welcome message
    addBotMessage("Hello! I'm Verse, your AI assistant from GenArt. How can I help you today?");
});

