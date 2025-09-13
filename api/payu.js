import admin from 'firebase-admin';
import crypto from 'crypto'; // Node.js module for cryptographic functions like hashing

// --- Bulletproof Firebase Admin Initialization ---
// This pattern ensures that Firebase Admin is initialized only once per server instance,
// which is crucial for performance and stability in serverless environments.
let auth;
try {
  // A critical check to ensure the Firebase service account key is available as an environment variable.
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }
  
  // Parse the JSON string from the environment variable into a JavaScript object.
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

  // Initialize the app only if no other apps have been initialized.
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin Initialized Successfully in payu.js');
  }
  auth = admin.auth(); // Get the authentication service instance.
} catch (error) {
  // If initialization fails, log a detailed error. This is vital for debugging setup issues.
  console.error('CRITICAL: Firebase admin initialization failed in payu.js.', error);
}

// The main handler for the API endpoint (e.g., /api/payu).
export default async function handler(req, res) {
  // We only accept POST requests for creating a payment.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // If Firebase failed to initialize, the API cannot function.
  if (!auth) {
    return res.status(500).json({ error: 'Server configuration error. Firebase service is not available.' });
  }

  // --- Step 1: Authenticate the User ---
  const { authorization } = req.headers;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No Firebase authentication token provided.' });
  }
  
  const idToken = authorization.split('Bearer ')[1];
  let decodedToken;
  try {
    // Verify the token with Firebase. This confirms the user is who they say they are.
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden: The provided authentication token is invalid or has expired.' });
  }

  // --- Step 2: Prepare Payment Data ---
  try {
    const { amount, plan, credits } = req.body;
    const { name, email, uid } = decodedToken;

    // Retrieve PayU credentials securely from environment variables.
    const key = process.env.PAYU_CLIENT_ID;
    const salt = process.env.PAYU_SECRET_KEY;
    
    if (!key || !salt) {
        console.error("CRITICAL: PayU credentials (PAYU_CLIENT_ID or PAYU_SECRET_KEY) are not set in environment variables.");
        return res.status(500).json({ error: "Payment gateway is not configured correctly on the server." });
    }

    // --- FIX: Create a more unique transaction ID to prevent "Too many Requests" errors.
    const randomComponent = crypto.randomBytes(4).toString('hex');
    const txnid = `T${Date.now()}-${uid.slice(0, 5)}-${randomComponent}`;

    const productinfo = `${credits} Credits Pack (${plan})`;
    const firstname = name ? name.split(' ')[0] : 'User'; // Use the first name or a default.

    // These URLs tell PayU where to redirect the user after the transaction.
    // `req.headers.origin` dynamically gets your website's domain (e.g., https://www.yourdomain.com).
    const surl = `${req.headers.origin}/api/payu-callback`; // Success URL
    const furl = `${req.headers.origin}/api/payu-callback`; // Failure URL

    // --- Step 3: Create the Security Hash ---
    // This is a security measure to ensure the payment data is not tampered with.
    // The hash string must be created in the exact order specified by PayU's documentation.
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${uid}|${plan}|${credits}||||||||${salt}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    // --- Step 4: Send the Prepared Data to the Frontend ---
    const paymentData = {
      action: 'https://secure.payu.in/_payment', // PayU's production payment URL.
      params: {
        key: key,
        txnid: txnid,
        amount: amount,
        productinfo: productinfo,
        firstname: firstname,
        email: email,
        phone: '9999999999', // A placeholder phone number is often required by PayU.
        surl: surl,
        furl: furl,
        hash: hash,
        // We use User Defined Fields (udf) to pass our internal data through PayU's system.
        // We will get this data back in the callback to identify the user and credit their account.
        udf1: uid,
        udf2: plan,
        udf3: credits,
      }
    };

    // Send the complete payment package to the frontend script (pricing.js).
    res.status(200).json(paymentData);

  } catch (error) {
    console.error('Error during PayU transaction preparation:', error);
    res.status(500).json({ error: 'An internal error occurred while preparing the transaction.' });
  }
}

