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

// --- Special Credits for Specific Users ---
const specialUsers = [
    { email: "developer.techsquadz@gmail.com", credits: 5000 },
    { email: "interactweb24@gmail.com", credits: 10000 },
    { email: "anuj.suthar@gmail.com", credits: 5000 },
    { email: "nilsone230384.002@gmail.com", credits: 5000 },
    { email: "omnp646@gmail.com", credits: 5000 },
    { email: "raginisuthar.2008@gmail.com", credits: 5000 },
    { email: "rajiv.ranjan.prakash786@gmail.com", credits: 10000 },
    { email: "parth@genart.space", credits: 5000 },
    { email: "mehul@genart.space", credits: 5000 },
    { email: "preetvirenrajpara@gmail.com", credits: 5000 },
    { email: "shachibathwal@gmail.com", credits: 5000 },
    { email: "parth.jadeja2003@gmail.com", credits: 5000 },
];

export default async function handler(req, res) {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: 'No token provided.' });
    }

    try {
        const user = await admin.auth().verifyIdToken(idToken);
        const userRef = db.collection('users').doc(user.uid);

        // Handle GET request (Fetch credits)
        if (req.method === 'GET') {
            const specialUser = specialUsers.find(su => su.email === user.email);
            const userDoc = await userRef.get();
            const isNew = !userDoc.exists; // Check if the user is new before any changes

            if (specialUser) {
                if (isNew || userDoc.data().credits !== specialUser.credits) {
                    await userRef.set({
                        email: user.email,
                        credits: specialUser.credits,
                    }, { merge: true });
                    console.log(`Set/updated special credits for ${user.email} to ${specialUser.credits}`);
                }
                return res.status(200).json({ credits: specialUser.credits, isNewUser: isNew });
            }

            if (userDoc.exists) {
                // Existing regular user
                return res.status(200).json({ credits: userDoc.data().credits, isNewUser: false });
            } else {
                // New regular user
                const initialCredits = 10; // Default free credits for new users
                await userRef.set({
                    email: user.email,
                    credits: initialCredits,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                // Let the frontend know this user is new and what their credit balance is
                return res.status(200).json({ credits: initialCredits, isNewUser: true });
            }
        }

        // Handle POST request (Deduct credit)
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
