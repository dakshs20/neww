// File: /api/generate.js
// Final working version.

export default async function handler(req, res) {
    // This is a test to see if the file is reachable.
    // Go to https://your-website-url/api/generate in your browser.
    // If you see a success message, this file is working.
    if (req.method === 'GET') {
        return res.status(200).json({ status: "ok", message: "API endpoint is working correctly." });
    }

    // Only allow POST requests for the actual image generation.
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { prompt, imageData } = req.body;
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            // This error means the key is missing from Vercel's settings.
            return res.status(500).json({ error: "Server configuration error: API key not found." });
        }

        let apiUrl, payload;

        if (imageData) {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`;
            payload = {
                "contents": [{ "parts": [{ "text": prompt }, { "inlineData": { "mimeType": imageData.mimeType, "data": imageData.data } }] }],
                "generationConfig": { "responseModalities": ["IMAGE", "TEXT"] }
            };
        } else {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
            payload = { instances: [{ prompt }], parameters: { "sampleCount": 1 } };
        }

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            return res.status(apiResponse.status).json({ error: `Google API Error: ${errorText}` });
        }

        const result = await apiResponse.json();
        res.status(200).json(result);

    } catch (error) {
        res.status(500).json({ error: 'The API function crashed.', details: error.message });
    }
}
