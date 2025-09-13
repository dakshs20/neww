import admin from 'firebase-admin';
import crypto from 'crypto'; // Import the crypto module for generating unique IDs and hashes

// --- Bulletproof Firebase Admin Initialization ---
// This ensures Firebase is initialized only once in a serverless environment.
let auth;
try {
  // Check if the crucial environment variable is set.
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY is not set.');
  }
  // Parse the service account key from the environment variable.
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

  // Initialize the app only if it hasn't been initialized already.
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
  auth = admin.auth();
  console.log('Firebase Admin Initialized Successfully in payu.js');
} catch (error) {
  // Log a critical error if initialization fails. This is crucial for debugging.
  console.error('CRITICAL: Firebase admin initialization failed in payu.js.', error);
}

// Main handler function for the API endpoint.
export default async function handler(req, res) {
  // Only allow POST requests.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // If Firebase initialization failed, the server cannot proceed.
  if (!auth) {
    return res.status(500).json({ error: 'Server configuration error. Firebase not available.' });
  }

  // --- Authenticate the User ---
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No Firebase token provided.' });
  }
  const idToken = authorization.split('Bearer ')[1];
  let decodedToken;
  try {
    // Verify the token with Firebase to get user details.
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired token.' });
  }

  // --- Prepare Payment Data ---
  try {
    const { amount, plan, credits } = req.body;
    const { name, email, uid } = decodedToken;

    const key = process.env.PAYU_CLIENT_ID;
    const salt = process.env.PAYU_SECRET_KEY;
    
    // Ensure PayU credentials are set on the server.
    if (!key || !salt) {
        console.error("PayU credentials (PAYU_CLIENT_ID or PAYU_SECRET_KEY) are not set in environment variables.");
        return res.status(500).json({ error: "Payment gateway misconfiguration on server." });
    }

    // --- FIX: Create a more unique transaction ID to prevent rate-limiting errors ---
    const randomComponent = crypto.randomBytes(4).toString('hex');
    const txnid = `T${Date.now()}-${uid.slice(0, 5)}-${randomComponent}`;

    const productinfo = `${credits} Credits Pack (${plan})`;
    const firstname = name ? name.split(' ')[0] : 'User';

    // These URLs tell PayU where to redirect the user after payment.
    // `req.headers.origin` dynamically gets your website's domain.
    const surl = `${req.headers.origin}/api/payu-callback`; // Success URL
    const furl = `${req.headers.origin}/api/payu-callback`; // Failure URL

    // --- Create the Security Hash ---
    // The hash string must be in the exact order specified by PayU documentation.
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${uid}|${plan}|${credits}||||||||${salt}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    // --- Return All Necessary Payment Parameters to the Frontend ---
    const paymentData = {
      action: 'https://secure.payu.in/_payment', // PayU's production payment URL
      params: {
        key: key,
        txnid: txnid,
        amount: amount,
        productinfo: productinfo,
        firstname: firstname,
        email: email,
        phone: '9999999999', // A placeholder phone number is often required.
        surl: surl,
        furl: furl,
        hash: hash,
        // User-defined fields (udf) are used to pass our internal data through PayU.
        // We will get these back in the callback to identify the user and what they bought.
        udf1: uid,
        udf2: plan,
        udf3: credits,
      }
    };

    res.status(200).json(paymentData);

  } catch (error) {
    console.error('Error preparing PayU transaction:', error);
    res.status(500).json({ error: 'Could not prepare the transaction.' });
  }
}

