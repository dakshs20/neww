import admin from 'firebase-admin';

// Initialize Firebase Admin SDK (ensure it's initialized only once for serverless functions)
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Error in credits.js:", error);
    }
}

const db = admin.firestore();

export default async function handler(req, res) {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: 'No token provided.' });
    }

    try {
        const user = await admin.auth().verifyIdToken(idToken);
        const userRef = db.collection('users').doc(user.uid);

        // --- Handle GET request (Fetch full subscription details) ---
        if (req.method === 'GET') {
            const userDoc = await userRef.get();

            // Handle existing users
            if (userDoc.exists) {
                const userData = userDoc.data();
                const responseData = {
                    plan: userData.plan || 'free',
                    credits: userData.credits || 0,
                    nextBilling: userData.nextBilling ? userData.nextBilling.toDate().toISOString() : null,
                    isNewUser: false // This is an existing user
                };
                return res.status(200).json(responseData);
            } else {
                // This is a new user. Create a default "Free" plan with 10 credits.
                const initialCredits = 10;
                const newUserDoc = {
                    email: user.email,
                    plan: 'free',
                    credits: initialCredits,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    nextBilling: null // Free plans do not have a billing date.
                };
                await userRef.set(newUserDoc);
                console.log(`Created new 'free' plan user with ${initialCredits} credits for ${user.email}`);

                // Return the data for the newly created user, flagging them as new.
                return res.status(200).json({
                    plan: newUserDoc.plan,
                    credits: newUserDoc.credits,
                    nextBilling: newUserDoc.nextBilling,
                    isNewUser: true // Flag to trigger the frontend pop-up
                });
            }
        }

        // --- Handle POST request (Deduct credit for image generation) ---
        if (req.method === 'POST') {
            const userDoc = await userRef.get();
            if (!userDoc.exists || userDoc.data().credits <= 0) {
                return res.status(402).json({ error: 'Insufficient credits.' });
            }

            await userRef.update({
                credits: admin.firestore.FieldValue.increment(-1)
            });
            const updatedDoc = await userRef.get();
            return res.status(200).json({ newCredits: updatedDoc.data().credits });
        }

        return res.status(405).json({ error: 'Method Not Allowed' });

    } catch (error) {
        console.error("API Error in /api/credits:", error);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
        }
        return res.status(500).json({ error: 'A server error has occurred.' });
    }
}

