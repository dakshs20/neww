import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';

// --- Firebase Admin Initialization ---
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: "genart-a693a.appspot.com" // IMPORTANT: Use your actual storage bucket name
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in share.js:", error);
    }
}

const db = admin.firestore();
const bucket = getStorage().bucket();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // --- 1. Authenticate the user ---
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const user = await admin.auth().verifyIdToken(idToken);

        // --- 2. Get the image data from the request ---
        const { imageDataUrl } = req.body;
        if (!imageDataUrl) {
            return res.status(400).json({ error: 'Image data is required.' });
        }

        // --- 3. Convert the Data URL to a Buffer ---
        const base64EncodedImageString = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64EncodedImageString, 'base64');
        
        // --- 4. Upload the image to Firebase Storage ---
        const fileName = `shared/${uuidv4()}.png`;
        const file = bucket.file(fileName);
        
        await file.save(imageBuffer, {
            metadata: {
                contentType: 'image/png',
            },
        });
        
        // --- 5. Make the file public and get its URL ---
        await file.makePublic();
        const publicUrl = file.publicUrl();

        // --- 6. Save the public URL to Firestore ---
        await db.collection('shared_images').add({
            imageUrl: publicUrl,
            userId: user.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.status(200).json({ message: 'Image shared successfully!', url: publicUrl });

    } catch (error) {
        console.error("API function /api/share crashed:", error);
        res.status(500).json({ error: 'Failed to share image due to a server error.' });
    }
}
