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
    { email: "developer.techsquadz@gmail.com", credits: 5000, plan: 'elite' },
    { email: "interactweb24@gmail.com", credits: 10000, plan: 'elite' },
    { email: "anuj.suthar@gmail.com", credits: 5000, plan: 'elite' },
    { email: "nilsone230384.002@gmail.com", credits: 5000, plan: 'elite' },
    { email: "omnp646@gmail.com", credits: 5000, plan: 'elite' },
    { email: "raginisuthar.2008@gmail.com", credits: 5000, plan: 'elite' },
    { email: "rajiv.ranjan.prakash786@gmail.com", credits: 10000, plan: 'elite' },
    { email: "parth@genart.space", credits: 5000, plan: 'elite' },
    { email: "mehul@genart.space", credits: 5000, plan: 'elite' },
];

export default async function handler(req, res) {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).json({ error: 'No token provided.' });
    }

    try {
        const user = await admin.auth().verifyIdToken(idToken);
        const userRef = db.collection('users').doc(user.uid);

        // Handle GET request (Fetch user data)
        if (req.method === 'GET') {
            const userDoc = await userRef.get();
            const isNew = !userDoc.exists;

            // Handle special users
            const specialUser = specialUsers.find(su => su.email === user.email);
            if (specialUser) {
                 await userRef.set({
                    email: user.email,
                    credits: specialUser.credits,
                    plan: specialUser.plan || 'elite'
                }, { merge: true });
                return res.status(200).json({ credits: specialUser.credits, plan: specialUser.plan || 'elite', isNewUser: isNew });
            }
            
            // Handle existing regular user
            if (userDoc.exists) {
                const userData = userDoc.data();
                return res.status(200).json({ 
                    credits: userData.credits, 
                    plan: userData.plan || 'free', // Default to free if plan isn't set
                    isNewUser: false 
                });
            } 
            // Handle new regular user
            else {
                const initialCredits = 10; // Grant 10 free credits to new users
                await userRef.set({
                    email: user.email,
                    credits: initialCredits,
                    plan: 'free',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return res.status(200).json({ 
                    credits: initialCredits, 
                    plan: 'free',
                    isNewUser: true 
                });
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

