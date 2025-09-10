// --- Verse AI Page Specific Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the verse.html page
    if (document.getElementById('verse-container')) {
        initializeVersePage();
    }
});

function initializeVersePage() {
    // --- DOM Elements ---
    const chatHistory = document.getElementById('chat-history');
    const promptInput = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');
    const fileUpload = document.getElementById('file-upload');
    const filePreviewContainer = document.getElementById('file-preview-container');
    const fileInfo = document.getElementById('file-info');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const lengthButtons = document.querySelectorAll('.answer-length-btn');

    // --- State ---
    let conversationHistory = [];
    let uploadedFile = null;
    let responseLength = 'Medium'; // Default length

    // --- Pre-programmed Responses ---
    const preProgrammedResponses = {
        "who is the founder of genart?": "Daksh Suthar.",
        "who created you?": "GenArt ML Technologies developed me."
    };
    
    // --- Event Listeners ---
    sendBtn.addEventListener('click', sendMessage);
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    promptInput.addEventListener('input', () => {
        // Auto-resize textarea
        promptInput.style.height = 'auto';
        promptInput.style.height = (promptInput.scrollHeight) + 'px';
    });

    fileUpload.addEventListener('change', handleFileUpload);
    removeFileBtn.addEventListener('click', removeFile);

    lengthButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            lengthButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            responseLength = btn.dataset.length;
        });
    });

    // --- Functions ---
    function displayMessage(sender, message) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${sender === 'user' ? 'user-bubble' : 'bot-bubble'}`;
        
        const proseContainer = document.createElement('div');
        proseContainer.className = 'prose max-w-none';
        
        if (sender === 'user') {
            proseContainer.textContent = message;
        } else {
             // Basic markdown to HTML conversion
            let htmlContent = message
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                .replace(/\*(.*?)\*/g, '<em>$1</em>')       // Italics
                .replace(/(\r\n|\n|\r)/g, '<br>');      // Line breaks
            proseContainer.innerHTML = htmlContent;
        }

        bubble.appendChild(proseContainer);
        chatHistory.appendChild(bubble);
        chatHistory.scrollTop = chatHistory.scrollHeight; // Auto-scroll to bottom
        return bubble;
    }

    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'chat-bubble bot-bubble typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        chatHistory.appendChild(indicator);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return indicator;
    }

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Supported file types
        const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const supportedTextTypes = ['text/plain'];

        if (supportedImageTypes.includes(file.type) || supportedTextTypes.includes(file.type)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedFile = {
                    name: file.name,
                    type: file.type,
                    content: e.target.result.split(',')[1], // Base64 content
                    isText: supportedTextTypes.includes(file.type)
                };
                fileInfo.textContent = `File attached: ${file.name}`;
                filePreviewContainer.classList.remove('hidden');
            };
             reader.readAsDataURL(file);
        } else {
            alert("File type not supported. Please upload an image (JPG, PNG) or a plain text (.txt) file.");
            fileUpload.value = ''; // Reset file input
        }
    }

    function removeFile() {
        uploadedFile = null;
        fileUpload.value = '';
        filePreviewContainer.classList.add('hidden');
    }

    async function sendMessage() {
        const prompt = promptInput.value.trim();
        if (!prompt && !uploadedFile) return;

        // --- 1. Display User Message ---
        let userMessage = prompt;
        if (uploadedFile) {
            userMessage = `[File: ${uploadedFile.name}] ${prompt}`;
        }
        displayMessage('user', userMessage);
        
        // Add user prompt to conversation history
        conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] });

        promptInput.value = '';
        promptInput.style.height = 'auto';
        
        // --- 2. Check for Pre-programmed Responses ---
        const lowerCasePrompt = prompt.toLowerCase().replace(/[?.]/g, '');
        if (preProgrammedResponses[lowerCasePrompt]) {
            const response = preProgrammedResponses[lowerCasePrompt];
            displayMessage('bot', response);
            conversationHistory.push({ role: 'model', parts: [{ text: response }] });
            removeFile(); // Clear file after sending
            return;
        }
        
        // --- 3. Handle AI Generation ---
        const typingIndicator = showTypingIndicator();
        
        try {
            // --- Prepare API Payload ---
            const apiKey = ""; // Leave empty, will be handled by the environment
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

            const systemInstruction = {
                parts: [{ text: `You are Verse, a helpful AI assistant from GenArt. Provide a ${responseLength} response.` }]
            };
            
            let requestContents = [...conversationHistory];

            // If a file is uploaded, add it to the last user message
            if (uploadedFile) {
                 const lastUserMessage = requestContents[requestContents.length - 1];
                 if(uploadedFile.isText){
                     // Decode base64 text file content
                     const textContent = atob(uploadedFile.content);
                     lastUserMessage.parts.push({ text: `\n\nFile Content:\n${textContent}`});
                 } else {
                    lastUserMessage.parts.push({
                        inlineData: {
                            mimeType: uploadedFile.type,
                            data: uploadedFile.content
                        }
                    });
                 }
            }


            const payload = {
                contents: requestContents,
                systemInstruction: systemInstruction,
            };

            // --- Fetch API ---
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const result = await response.json();
            const aiResponseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!aiResponseText) {
                throw new Error("Received an empty response from the AI.");
            }

            // --- 4. Display AI Response with Typing Animation ---
            chatHistory.removeChild(typingIndicator);
            const botBubble = displayMessage('bot', ''); // Create empty bubble
            typeAnimation(botBubble.querySelector('.prose'), aiResponseText);
            
            // Add AI response to history for context
            conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });

        } catch (error) {
            console.error("Verse AI Error:", error);
            chatHistory.removeChild(typingIndicator);
            displayMessage('bot', `Sorry, something went wrong. Please try again. Error: ${error.message}`);
        } finally {
            removeFile();
        }
    }

    function typeAnimation(element, text) {
        let i = 0;
        element.innerHTML = "";
        const speed = 20; // milliseconds

        function typeWriter() {
            if (i < text.length) {
                // Basic markdown to HTML conversion during typing
                let char = text.charAt(i);
                if (char === '\n') {
                    element.innerHTML += '<br>';
                } else {
                    element.innerHTML += char;
                }
                i++;
                chatHistory.scrollTop = chatHistory.scrollHeight;
                setTimeout(typeWriter, speed);
            }
        }
        typeWriter();
    }
}
