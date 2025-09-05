// File: /api/suggest.js
// This new API endpoint uses a generative model to provide real-time, advanced prompt suggestions.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt } = req.body;

        // We require a minimum length to give the AI enough context.
        if (!prompt || prompt.length < 10) {
            return res.status(400).json({ suggestions: [] });
        }

        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            console.error("Server config error: GOOGLE_API_KEY not found.");
            return res.status(500).json({ error: "Server configuration error." });
        }

        // This prompt instructs the AI to act as a helpful assistant and return a structured JSON response.
        const geminiPrompt = `You are an AI prompt engineer assistant. A user is typing a prompt for an image generator. Based on their current text, suggest up to 3 short, creative keywords or phrases to make the prompt more detailed and visually interesting.

        Rules:
        - Suggestions should be concise and directly appendable.
        - Do not repeat concepts already in the user's prompt.
        - Return ONLY a valid JSON array of strings.

        Example:
        User's prompt: "A wolf in a dark forest"
        Your response:
        ["epic fantasy style", "glowing red eyes", "cinematic lighting"]

        User's current prompt: "${prompt}"`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: geminiPrompt }] }],
            // We request a JSON response type for easier parsing on the frontend.
            generationConfig: {
                responseMimeType: "application/json",
            }
        };

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error("Google API Error (Suggest):", errorText);
            return res.status(apiResponse.status).json({ error: `Google API Error: ${errorText}` });
        }

        const result = await apiResponse.json();
        const suggestionsText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!suggestionsText) {
            return res.status(500).json({ error: "Failed to get suggestions from the API." });
        }

        // The model returns a JSON string, which we parse and send to the client.
        const suggestions = JSON.parse(suggestionsText);
        res.status(200).json({ suggestions });

    } catch (error) {
        console.error("API function '/api/suggest' crashed:", error);
        // If parsing or anything else fails, return an empty array to prevent front-end errors.
        res.status(500).json({ suggestions: [] });
    }
}
