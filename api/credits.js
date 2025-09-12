import admin from 'firebase-admin';

// --- Firebase Admin Initialization ---
// This ensures we only initialize the app ONCE, preventing errors in a serverless environment.
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Check if the Firebase Admin SDK was initialized correctly
    if (!admin.apps.length) {
        return res.status(500).json({ error: 'Firebase Admin SDK not initialized. Check server logs.' });
    }

    try {
        const { authorization } = req.headers;
        if (!authorization || !authorization.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const idToken = authorization.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDoc.get();

        if (!userDoc.exists) {
            // New user: Grant 25 free credits
            await userDocRef.set({ credits: 25 });
            return res.status(200).json({ credits: 25 });
        } else {
            // Existing user: Return their current credits
            const credits = userDoc.data().credits || 0;
            return res.status(200).json({ credits: credits });
        }

    } catch (error) {
        console.error('Error fetching credits:', error);
        if (error.code === 'auth/id-token-expired') {
            return res.status(401).json({ error: 'Unauthorized: Token expired' });
        }
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}

