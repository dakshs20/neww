import admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';

// Ensure Firebase Admin is initialized only once
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            // This line is crucial for connecting to your storage
            storageBucket: "genart-a693a.appspot.com"
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in share.js:", error);
    }
}

const db = admin.firestore();
// Get a direct reference to your storage bucket
const bucket = getStorage().bucket();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Authenticate the user
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const user = await admin.auth().verifyIdToken(idToken);

        const { imageDataUrl } = req.body;
        if (!imageDataUrl || !imageDataUrl.startsWith('data:image/png;base64,')) {
            return res.status(400).json({ error: 'Invalid image data format provided.' });
        }

        // 1. Prepare the image for upload
        const base64Data = imageDataUrl.replace(/^data:image\/png;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const fileName = `shared/${user.uid}-${Date.now()}.png`;
        const file = bucket.file(fileName);

        // 2. Save the image to the bucket
        await file.save(imageBuffer, {
            metadata: { contentType: 'image/png' },
        });

        // 3. Make the file publicly readable
        await file.makePublic();

        // 4. Construct the permanent public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        // 5. Save the public URL to the Firestore database
        await db.collection('shared_images').add({
            imageUrl: publicUrl,
            userId: user.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({ success: true, url: publicUrl });

    } catch (error) {
        console.error("Image sharing API failed:", error);
        // Send a more detailed error message back to the user for easier debugging
        res.status(500).json({ error: `Sharing failed on the server. Reason: ${error.message}` });
    }
}

