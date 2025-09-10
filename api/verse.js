// File: /api/verse.js
// This new backend endpoint handles all text-to-text generation for the Verse page.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { conversationHistory, uploadedFile, responseLength } = req.body;

        if (!conversationHistory || conversationHistory.length === 0) {
            return res.status(400).json({ error: "Conversation history is required." });
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server configuration error: API key not found." });
        }
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        // --- Prepare Payload for Gemini API ---
        
        // Define the AI's role and response style.
        const systemInstruction = {
            parts: [{ text: `You are Verse, a helpful AI assistant from GenArt. Provide a ${responseLength || 'Medium'} response.` }]
        };

        let requestContents = [...conversationHistory];

        // If a file is part of the request, add it to the last user message.
        if (uploadedFile) {
            const lastUserMessage = requestContents[requestContents.length - 1];
            if (uploadedFile.isText) {
                // Decode base64 text file content using Node.js Buffer for server-side reliability.
                const textContent = Buffer.from(uploadedFile.content, 'base64').toString('utf-8');
                lastUserMessage.parts.push({ text: `\n\n--- Start of File Content ---\n${textContent}\n--- End of File Content ---` });
            } else {
                // Add image data directly.
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
        };

        // System instructions are best sent only on the first turn of a conversation.
        if (conversationHistory.length === 1) {
            payload.systemInstruction = systemInstruction;
        }

        // --- Make the API Call ---
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error("Google API Error (Verse):", errorText);
            return res.status(apiResponse.status).json({ error: `Google API Error: ${errorText}` });
        }

        const result = await apiResponse.json();
        const aiResponseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiResponseText) {
            return res.status(500).json({ error: "Failed to get a valid response from the AI." });
        }

        res.status(200).json({ text: aiResponseText });

    } catch (error) {
        console.error("API function '/api/verse' crashed:", error);
        res.status(500).json({ error: 'The Verse API function crashed.', details: error.message });
    }
}

