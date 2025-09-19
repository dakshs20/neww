import admin from 'firebase-admin';

// Initialize Firebase Admin SDK (ensure it's initialized only once)
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in library.js:", error);
    }
}

const db = admin.firestore();

export default async function handler(req, res) {
    // This API only accepts POST requests to add images
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        
        const user = await admin.auth().verifyIdToken(idToken);
        const { imageUrl, prompt } = req.body;

        if (!imageUrl || !prompt) {
            return res.status(400).json({ error: 'Image data and prompt are required.' });
        }

        // Add the new image to the public 'library_images' collection
        await db.collection('library_images').add({
            userId: user.uid,
            userName: user.name || 'Anonymous', // Store user's name
            prompt: prompt,
            imageUrl: imageUrl, // Storing base64 directly
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({ success: true, message: 'Image added to library.' });

    } catch (error) {
        console.error("API function /api/library crashed:", error);
        res.status(500).json({ error: 'Could not add image to library due to a server error.' });
    }
}
