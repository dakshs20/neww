// This is your secure backend function: /api/generate-image.js
// It runs on Vercel's servers, keeping your key safe.

export default async function handler(request, response) {
    // We only want to accept POST requests to this endpoint.
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // 1. Get the prompt and any uploaded image data from the request.
        const { prompt, imageData } = request.body;

        // 2. Get the secret API key from Vercel's secure vault.
        const apiKey = process.env.GOOGLE_AI_API_KEY;

        if (!apiKey) {
            console.error("API key is not configured in Vercel Environment Variables.");
            return response.status(500).json({ message: "Server configuration error." });
        }

        let apiUrl, payload;

        // 3. Prepare the correct API call based on whether an image was uploaded.
        if (imageData) {
            // This is for image-to-image editing with Gemini.
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
            // This is for text-to-image generation with Imagen.
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
            payload = { instances: [{ prompt }], parameters: { "sampleCount": 1 } };
        }

        // 4. Securely call the Google API from the backend.
        const googleResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!googleResponse.ok) {
            const errorText = await googleResponse.text();
            console.error("Google API Error:", errorText);
            throw new Error(`The AI model failed to respond. Please try again.`);
        }

        const result = await googleResponse.json();

        // 5. Extract the image data from Google's response.
        let base64Data;
        if (imageData) {
            base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        } else {
            base64Data = result.predictions?.[0]?.bytesBase64Encoded;
        }

        if (!base64Data) {
            throw new Error("No image data was received from the AI model.");
        }

        // 6. Send the successful result back to the user's browser.
        response.status(200).json({ base64Data });

    } catch (error) {
        console.error('Backend generation error:', error);
        // Send a user-friendly error message back.
        response.status(500).json({ message: error.message || "Sorry, something went wrong on our end." });
    }
}
