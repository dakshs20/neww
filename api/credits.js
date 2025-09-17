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
    { email: "interactweb24@gmail.com", credits: 5000 },
    { email: "anuj.suthar@gmail.com", credits: 5000 },
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

            // --- FIXED LOGIC ---
            // If the user is on the special list, their credits are set/updated to the special amount.
            if (specialUser) {
                const userDoc = await userRef.get();
                // To avoid unnecessary database writes, we only update if they don't exist or their credit count is wrong.
                if (!userDoc.exists || userDoc.data().credits !== specialUser.credits) {
                    await userRef.set({
                        email: user.email,
                        credits: specialUser.credits,
                    }, { merge: true }); // Using merge:true prevents overwriting other fields like createdAt.
                    console.log(`Set/updated special credits for ${user.email} to ${specialUser.credits}`);
                }
                return res.status(200).json({ credits: specialUser.credits });
            }

            // This logic now only runs for REGULAR users.
            const userDoc = await userRef.get();
            if (userDoc.exists) {
                // Regular user who already exists.
                return res.status(200).json({ credits: userDoc.data().credits });
            } else {
                // New, regular user.
                const initialCredits = 25; // Default free credits
                await userRef.set({
                    email: user.email,
                    credits: initialCredits,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return res.status(200).json({ credits: initialCredits });
            }
        }

        // Handle POST request (Deduct credit)
        if (req.method === 'POST') {
            const userDoc = await userRef.get();
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

