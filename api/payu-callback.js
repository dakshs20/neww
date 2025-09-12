import admin from 'firebase-admin';
import crypto from 'crypto';

// --- Secure Firebase Admin Initialization ---
// This ensures Firebase Admin is initialized only once in a serverless environment.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { txnid, status, amount, productinfo, hash } = req.body;
    
    // --- 1. Verify the Hash ---
    // This is a critical security step to ensure the response is genuinely from PayU.
    const secretKey = process.env.PAYU_SECRET_KEY;
    
    // The string to hash must be in the exact format PayU expects.
    const hashString = `${secretKey}|${status}|||||||||||${productinfo.split('_')[2]}|${req.body.email}|${req.body.firstname}|${productinfo}|${amount}|${txnid}|${process.env.PAYU_CLIENT_ID}`;
    
    const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');

    if (calculatedHash !== hash) {
      console.error("Hash mismatch. Tampered or invalid response.");
      // Redirect to a failure page or show an error.
      // For simplicity, we redirect to the main page.
      return res.redirect(302, '/');
    }

    // --- 2. Process the Transaction ---
    if (status === 'success') {
      // The productinfo field format is "credits_UID_email"
      const [credits, uid] = productinfo.split('_');
      const creditsToAdd = parseInt(credits, 10);
      
      if (!uid || isNaN(creditsToAdd)) {
        throw new Error("Invalid productinfo received from PayU.");
      }

      const userDocRef = db.collection('users').doc(uid);

      // Atomically increment the user's credits.
      await userDocRef.update({
        credits: admin.firestore.FieldValue.increment(creditsToAdd)
      });
      
      console.log(`Successfully added ${creditsToAdd} credits to user ${uid}.`);
      
      // Redirect to the main page after successful payment.
      return res.redirect(302, '/');

    } else {
      // If status is 'failure' or any other state.
      console.log(`Payment failed for transaction ID: ${txnid} with status: ${status}`);
      // Redirect user back to the main page.
      return res.redirect(302, '/');
    }

  } catch (error) {
    console.error('Error in PayU callback:', error);
    // In case of any server error, redirect the user back to the homepage.
    return res.redirect(302, '/');
  }
}

