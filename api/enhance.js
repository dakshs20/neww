// File: /api/enhance.js
// This new file handles the prompt enhancement logic.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "A prompt is required to enhance." });
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: "Server configuration error: API key not found." });
        }

        const geminiPrompt = `You are an expert prompt engineer for AI image generators. Enhance the following prompt to make it more vivid, detailed, and imaginative. Focus on visual details. Add descriptors like "hyperrealistic, 8k, cinematic lighting, photorealistic". Do not add any explanatory text or conversational filler, and medium length, just return the enhanced prompt itself. Original prompt: "${prompt}"`;
        
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{
                parts: [{ text: geminiPrompt }]
            }]
        };

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error("Google API Error (Enhance):", errorText);
            return res.status(apiResponse.status).json({ error: `Google API Error: ${errorText}` });
        }

        const result = await apiResponse.json();
        
        const enhancedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!enhancedText) {
            return res.status(500).json({ error: "Failed to get an enhanced prompt from the API." });
        }
        
        // Clean up the response to send only the text
        const cleanedText = enhancedText.trim().replace(/^"|"$/g, '').trim();

        res.status(200).json({ text: cleanedText });

    } catch (error) {
        console.error("API function '/api/enhance' crashed:", error);
        res.status(500).json({ error: 'The enhancement API function crashed.', details: error.message });
    }
}
