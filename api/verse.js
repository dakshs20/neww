export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, fileContent, fileName, fileMimeType, chatHistory = [], answerLength = 'medium' } = req.body;
        
        // 1. Intelligent Pre-Programmed Responses
        const lowerCasePrompt = prompt.toLowerCase().trim();
        const preprogrammedResponses = {
            "who is the founder of genart?": "Daksh Suthar.",
            "who created you?": "GenArt ML Technologies developed me."
        };

        if (preprogrammedResponses[lowerCasePrompt]) {
            return res.status(200).json({ text: preprogrammedResponses[lowerCasePrompt] });
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server configuration error: API key not found." });
        }
        
        // 2. Customizable Answer Length
        let lengthInstruction = "";
        if (answerLength === 'short') {
            lengthInstruction = "Keep your response very short and concise, ideally in one or two sentences.";
        } else if (answerLength === 'detailed') {
            lengthInstruction = "Provide a detailed and comprehensive response, exploring the topic thoroughly.";
        }

        let systemPrompt = `You are Verse, a helpful and friendly AI assistant from GenArt. Provide clear, well-structured, and informative answers. Format your responses using Markdown. ${lengthInstruction}`;

        let userQueryParts = [];
        
        // Add the main text prompt
        if (prompt) {
            userQueryParts.push({ text: prompt });
        }

        // 3. Advanced File Handling & Knowledge
        if (fileContent) {
            const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];
             const complexTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/vnd.dwg', 'image/vnd.dxf'];

            if (imageTypes.includes(fileMimeType)) {
                 userQueryParts.unshift({ text: "Analyze this image and answer the following question:" });
                 userQueryParts.push({ inlineData: { mimeType: fileMimeType, data: fileContent } });
            } else if (complexTypes.includes(fileMimeType)) {
                // Return a canned response for unsupported complex types for now
                return res.status(200).json({ text: `Thank you for uploading "${fileName}". Full analysis for this file type (${fileMimeType}) is currently in development. I can tell you it's a ${fileMimeType.split('/')[1]} file.` });
            } else {
                 let fileContextPrompt = `Based on the content of the document "${fileName}", please answer the following question. If no question is asked, provide a concise summary of the document.`;
                 userQueryParts.unshift({ text: `${fileContextPrompt}\n\n--- Document Content ---\n${fileContent}\n\n--- Question ---` });
            }
        }
        
        if (userQueryParts.length === 0) {
            return res.status(400).json({ error: "A prompt or a file is required." });
        }

        // 4. Context Awareness
        const contents = [...chatHistory, { role: 'user', parts: userQueryParts }];

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const payload = {
            contents,
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
        };

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
        const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            return res.status(500).json({ error: "Failed to get a valid response from the AI." });
        }
        
        res.status(200).json({ text: responseText });

    } catch (error) {
        console.error("API function '/api/verse' crashed:", error);
        res.status(500).json({ error: 'The Verse API function crashed.', details: error.message });
    }
}

