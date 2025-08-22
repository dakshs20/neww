// File: /api/generate.js
// This code runs on the server, where your secret key is safe.

export default async function handler(req, res) {
    try {
        const { prompt, imageData } = req.body;

        // 1. It securely gets the key from your Vercel settings.
        const apiKey = process.env.GOOGLE_API_KEY; // The name you requested!

        if (!apiKey) {
            return res.status(500).json({ error: "Server is missing the API Key." });
        }

        let apiUrl, payload;

        // 2. It prepares the correct API call based on the request.
        if (imageData) {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${apiKey}`;
            payload = {
                "contents": [{
                    "parts": [
                        { "text": prompt },
                        { "inlineData": { "mimeType": imageData.mimeType, "data": imageData.data } }
                    ]
                }],
                "generationConfig": { "responseModalities": ["IMAGE", "TEXT"] }
            };
        } else {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
            payload = { instances: [{ prompt }], parameters: { "sampleCount": 1 } };
        }

        // 3. It calls Google and sends the result back to your main script.js file.
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            return res.status(apiResponse.status).json({ error: `API Error: ${errorText}` });
        }

        const result = await apiResponse.json();
        res.status(200).json(result);

    } catch (error) {
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
}
