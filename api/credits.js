import admin from 'firebase-admin';
import { auth } from 'firebase-admin';

// --- Firebase Admin Initialization ---
// This ensures the Firebase Admin SDK is initialized only once, which is crucial for serverless environments.
if (!admin.apps.length) {
    try {
        // The service account key is securely read from your hosting provider's environment variables.
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("Firebase Admin Initialized Successfully in credits.js");
    } catch (error) {
        console.error("CRITICAL: Firebase Admin Initialization Error in credits.js. Check your FIREBASE_SERVICE_ACCOUNT_KEY environment variable.", error);
    }
}
const db = admin.firestore();

export default async function handler(req, res) {
    let user;
    try {
        // **Security Check**: Verify the user's identity from the token sent in the request header.
        const idToken = req.headers.authorization?.split('Bearer ')[1];
        if (!idToken) {
            return res.status(401).json({ error: 'User not authenticated. No token provided.' });
        }
        user = await auth().verifyIdToken(idToken);
    } catch (error) {
        console.error("Authentication Error:", error);
        return res.status(401).json({ error: 'Invalid or expired user token.' });
    }

    const userRef = db.collection('users').doc(user.uid);

    // --- LOGIC FOR FETCHING CREDITS (GET Request) ---
    if (req.method === 'GET') {
        try {
            const doc = await userRef.get();
            if (!doc.exists) {
                // **New User Logic**: If the user doesn't have a document in the database, create one with 5 free credits.
                console.log(`New user detected: ${user.uid}. Creating account with 5 free credits.`);
                await userRef.set({
                    email: user.email,
                    credits: 5,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return res.status(200).json({ credits: 5 });
            } else {
                // **Existing User Logic**: Return the current credit balance.
                return res.status(200).json({ credits: doc.data().credits });
            }
        } catch (error) {
            console.error("Error fetching credits for user:", user.uid, error);
            return res.status(500).json({ error: 'Failed to retrieve credit balance.' });
        }
    }

    // --- LOGIC FOR DEDUCTING CREDITS (POST Request) ---
    if (req.method === 'POST') {
        try {
            const doc = await userRef.get();

            if (!doc.exists || doc.data().credits <= 0) {
                // **Insufficient Credits Check**: Prevent generation if credits are 0 or less.
                console.log(`User ${user.uid} has insufficient credits. Blocking generation.`);
                return res.status(402).json({ error: 'Insufficient credits.' }); // 402 Payment Required
            }
            
            // **Deduct Credit**: Use an atomic server-side operation to safely decrement the credit count by 1.
            await userRef.update({
                credits: admin.firestore.FieldValue.increment(-1)
            });

            const updatedDoc = await userRef.get();
            const newCredits = updatedDoc.data().credits;

            console.log(`Successfully deducted 1 credit from user ${user.uid}. New balance: ${newCredits}`);
            return res.status(200).json({ success: true, newCredits: newCredits });

        } catch (error) {
            console.error("Error deducting credit for user:", user.uid, error);
            return res.status(500).json({ error: 'Failed to deduct credit due to a server error.' });
        }
    }

    // If the request method is not GET or POST, return an error.
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
