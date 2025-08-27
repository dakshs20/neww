// File: /api/remove-background.js
// This is a mock API endpoint to simulate background removal.
// IMPORTANT: This file must be placed in an `/api/` directory in your project.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({ error: "Image data is required." });
        }

        // Simulate the time it takes for an AI to process the image
        await new Promise(resolve => setTimeout(resolve, 2000));

        // In a real application, you would send the `imageUrl` (which is a data URL)
        // to a third-party background removal service and get a new image back.
        // Since we don't have an API key for such a service, we will return a 
        // placeholder image to demonstrate that the front-end flow is working correctly.
        const mockRemovedBgUrl = `https://placehold.co/512x512/e0e0e0/1f2937?text=Background+Removed\\n(Feature+Demo)&font=inter`;

        res.status(200).json({ imageUrl: mockRemovedBgUrl });

    } catch (error) {
        console.error("API function '/api/remove-background' crashed:", error);
        res.status(500).json({ error: 'The background removal API function crashed.', details: error.message });
    }
}
