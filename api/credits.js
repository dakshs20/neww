import admin from 'firebase-admin';

// --- Bulletproof Firebase Admin Initialization ---
// This new, safer block will initialize Firebase and catch any errors during startup.
let db;
let auth;
try {
  // First, we check if the crucial environment variable even exists.
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. The server cannot connect to the database.');
  }

  // Next, we try to parse the key. If it's not valid JSON, this will fail.
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

  // We initialize the Firebase Admin SDK only if it hasn't been already.
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin Initialized Successfully.');
  }
  
  // If initialization is successful, we get the database and auth services.
  db = admin.firestore();
  auth = admin.auth();

} catch (error) {
  // If ANY of the above steps fail, this will log the exact reason in your server logs.
  console.error('CRITICAL: Firebase admin initialization failed.', error);
}

// This is the main function that handles requests.
export default async function handler(req, res) {
  // First, we check if the database connection was successful during startup.
  // If not, we stop right here and send a clear error.
  if (!db || !auth) {
    console.error('Firestore or Auth is not available due to an initialization failure.');
    return res.status(500).json({ error: 'Server configuration error. Could not connect to the database.' });
  }

  // --- User Authentication Check ---
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No user token provided.' });
  }
  const idToken = authorization.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (error) {
    console.error("Error verifying ID token:", error);
    return res.status(403).json({ error: 'Forbidden: Invalid user token.' });
  }
  const { uid } = decodedToken;

  // --- Handle GET Request (Fetch Credits) ---
  if (req.method === 'GET') {
    try {
      const userDocRef = db.collection('users').doc(uid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        // New user: give them 25 free credits.
        await userDocRef.set({ credits: 25 });
        return res.status(200).json({ credits: 25 });
      } else {
        // Existing user: return their current credit balance.
        return res.status(200).json({ credits: userDoc.data().credits });
      }
    } catch (error) {
      console.error(`Error fetching credits for user ${uid}:`, error);
      return res.status(500).json({ error: 'Failed to fetch credits from database.' });
    }
  }

  // --- Handle POST Request (Deduct Credit) ---
  if (req.method === 'POST') {
    try {
      const userDocRef = db.collection('users').doc(uid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists || userDoc.data().credits <= 0) {
        return res.status(402).json({ error: 'Insufficient credits.' }); // 402 Payment Required
      }

      // Atomically deduct one credit.
      await userDocRef.update({
        credits: admin.firestore.FieldValue.increment(-1)
      });
      
      const newCredits = userDoc.data().credits - 1;
      return res.status(200).json({ success: true, newCredits: newCredits });

    } catch (error) {
      console.error(`Error deducting credit for user ${uid}:`, error);
      return res.status(500).json({ error: 'Failed to deduct credit.' });
    }
  }

  // If the request is not GET or POST
  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}

