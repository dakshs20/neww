// File: /api/generate.js
// DEBUGGING VERSION - This will add more details to your Vercel logs.

export default async function handler(req, res) {
    console.log("--- [1/7] API function started ---");

    if (req.method !== 'POST') {
        console.error("--- [FAIL] Method was not POST. It was:", req.method);
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        console.log("--- [2/7] Attempting to get API key from environment variables. ---");
        const apiKey = process.env.GOOGLE_API_KEY;

        if (!apiKey) {
            console.error("--- [CRITICAL FAIL] GOOGLE_API_KEY not found in process.env! Check Vercel settings. ---");
            return res.status(500).json({ error: "Server configuration error." });
        }

        console.log("--- [3/7] API Key was found successfully. ---");

        const { prompt, imageData } = req.body;
        console.log(`--- [4/7] Received data: Prompt=${prompt ? 'Yes' : 'No'}, ImageData=${imageData ? 'Yes' : 'No'} ---`);

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

        console.log(`--- [5/7] Preparing to call Google API at: ${apiUrl.split('?')[0]} ---`);

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`--- [FAIL] Google API returned an error: ${apiResponse.status}`, errorText);
            return res.status(apiResponse.status).json({ error: `API Error: ${errorText}` });
        }

        console.log("--- [6/7] Google API call was successful. ---");
        const result = await apiResponse.json();
        res.status(200).json(result);
        console.log("--- [7/7] API function finished and sent response. ---");

    } catch (error) {
        console.error('--- [FATAL CRASH] The API function crashed:', error);
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
}
