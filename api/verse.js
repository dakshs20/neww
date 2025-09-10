export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, fileContent, fileName } = req.body;

        if (!prompt && !fileContent) {
            return res.status(400).json({ error: "A prompt or a file is required." });
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server configuration error: API key not found." });
        }

        let systemPrompt = "You are Verse, a helpful and friendly AI assistant from GenArt. Provide clear, well-structured, and informative answers. Format your responses using Markdown, including headings, bullet points, and code blocks where appropriate.";

        let userQuery = prompt;

        // If there's file content, prepend it to the user's query as context.
        if (fileContent) {
            userQuery = `Based on the content of the document "${fileName}", please answer the following question: "${prompt}".\n\n--- Document Content ---\n${fileContent}`;
            if (!prompt) {
                 userQuery = `Please provide a concise summary of the following document: "${fileName}".\n\n--- Document Content ---\n${fileContent}`;
            }
        }
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
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
