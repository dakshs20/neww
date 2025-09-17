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

// --- NEW FEATURE: Special Credits for Specific Users ---
// To give a specific user a custom number of credits when they sign in,
// add their email and the desired credit amount to this list.
const specialUsers = [
    { email: "developer.techsquadz@gmail.com", credits: 5000 },
    { email: "interactweb24@gmail.com", credits: 5000 },
];

export default async function handler(req, res) {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: 'No token provided.' });
    }

    try {
        const user = await admin.auth().verifyIdToken(idToken);
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();

        // Handle GET request (Fetch credits)
        if (req.method === 'GET') {
            const specialUser = specialUsers.find(su => su.email === user.email);

            if (userDoc.exists) {
                // If the user exists, just return their credits.
                return res.status(200).json({ credits: userDoc.data().credits });
            } else {
                // If the user is new, create their document.
                let initialCredits = 25; // Default free credits

                // Check if the new user is on the special list.
                if (specialUser) {
                    initialCredits = specialUser.credits;
                    console.log(`Assigning special credits (${initialCredits}) to new user: ${user.email}`);
                }

                await userRef.set({
                    email: user.email,
                    credits: initialCredits,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                const newUserDoc = await userRef.get();
                return res.status(200).json({ credits: newUserDoc.data().credits });
            }
        }

        // Handle POST request (Deduct credit)
        if (req.method === 'POST') {
            if (!userDoc.exists || userDoc.data().credits <= 0) {
                return res.status(402).json({ error: 'Insufficient credits.' }); // 402 Payment Required
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

