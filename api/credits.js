import admin from 'firebase-admin';

// This is the service account key you generate from Firebase > Project Settings > Service Accounts
// It MUST be stored as an environment variable (e.g., in Vercel/Netlify) and not directly in the code.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

// --- Secure Firebase Admin Initialization ---
// This check prevents the app from crashing in a serverless environment by ensuring
// Firebase Admin is only initialized once.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  // 1. --- Verify User Authentication ---
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }
  const idToken = authorization.split('Bearer ')[1];

  let decodedToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }

  const { uid } = decodedToken;
  const userDocRef = db.collection('users').doc(uid);

  // 2. --- Handle Request based on Method ---
  try {
    if (req.method === 'GET') {
      // --- Get User Credits ---
      const docSnap = await userDocRef.get();

      if (!docSnap.exists) {
        // If user document doesn't exist, create it with 25 initial credits.
        await userDocRef.set({ credits: 25 });
        return res.status(200).json({ credits: 25 });
      } else {
        // If user exists, return their current credit balance.
        return res.status(200).json({ credits: docSnap.data().credits });
      }

    } else if (req.method === 'POST') {
      // --- Deduct One Credit ---
      const docSnap = await userDocRef.get();
      
      if (!docSnap.exists || docSnap.data().credits <= 0) {
        // Prevent deduction if user has no document or no credits.
        return res.status(400).json({ error: 'Insufficient credits.' });
      }

      // Atomically decrement the credit count by 1.
      await userDocRef.update({
        credits: admin.firestore.FieldValue.increment(-1)
      });
      
      const updatedSnap = await userDocRef.get();
      return res.status(200).json({ success: true, newCredits: updatedSnap.data().credits });

    } else {
      // Handle unsupported HTTP methods
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('API Error in /api/credits:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}

