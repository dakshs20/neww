import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
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

        // Handle GET request (Fetch user plan and credits)
        if (req.method === 'GET') {
            const userDoc = await userRef.get();

            if (userDoc.exists) {
                const data = userDoc.data();
                // Return existing user's data
                return res.status(200).json({
                    credits: data.credits || 0,
                    plan: data.plan || 'free',
                    nextBilling: data.nextBilling ? data.nextBilling.toDate() : null
                });
            } else {
                // New user: set up with the Free plan
                const freePlanData = {
                    email: user.email,
                    credits: 0,
                    plan: 'free',
                    subscriptionStatus: 'active',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                };
                await userRef.set(freePlanData);
                
                return res.status(200).json({ 
                    credits: freePlanData.credits,
                    plan: freePlanData.plan,
                    nextBilling: null
                });
            }
        }

        // Handle POST request (Deduct credit for generation)
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
            return res.status(401).json({ error: 'Token expired.' });
        }
        return res.status(500).json({ error: 'A server error has occurred.' });
    }
}
