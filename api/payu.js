import admin from 'firebase-admin';
import crypto from 'crypto';

// --- Secure Firebase Admin Initialization ---
// This code block ensures that your connection to the Firebase database is
// initialized only once per server instance. This is a critical step for
// performance and to prevent errors in a serverless environment.
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

// The main function that handles all incoming requests to this API endpoint.
export default async function handler(req, res) {
  // We only allow POST requests, as this is a secure action.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // --- STEP 1: Verify the User is Signed In (Security) ---
    // This is a crucial security check. We get the user's ID token from the
    // request header and use Firebase Admin to verify that it's a valid token
    // from a real, signed-in user. This prevents unauthorized payment attempts.
    const { authorization } = req.headers;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }
    const idToken = authorization.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid } = decodedToken;

    // --- STEP 2: Get Payment Details from the Frontend ---
    // We receive the plan details (amount, credits) and user details
    // that the frontend sent in its request.
    const { amount, credits, firstname, email } = req.body;
    if (!amount || !credits || !firstname || !email) {
      return res.status(400).json({ error: 'Missing required payment information.' });
    }

    // --- STEP 3: Prepare All Details for the PayU Transaction ---
    // We get your secret PayU keys from the secure environment variables.
    const key = process.env.PAYU_CLIENT_ID;
    const salt = process.env.PAYU_SECRET_KEY;
    
    // Create a unique transaction ID. This is essential for tracking the payment.
    const txnid = `txn-${uid}-${Date.now()}`;
    
    // We create a 'productinfo' string that includes the number of credits and the user's ID.
    // This is how we'll know who to give credits to when PayU sends us a success signal.
    const productinfo = `${credits}_${uid}_${email}`;
    
    // These are the URLs PayU will use to send the user back to our site after the payment.
    const surl = `${req.headers.origin}/api/payu-callback`; // Success URL
    const furl = `${req.headers.origin}/api/payu-callback`; // Failure URL

    // --- STEP 4: Generate the Secure Hash (The Most Critical Step) ---
    // PayU requires a 'hash' to be sent with every payment request. This hash is a
    // unique signature created using your secret key and the transaction details.
    // It proves that the request is legitimate and hasn't been tampered with.
    // This MUST be done on the server, never on the frontend.
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    // --- STEP 5: Send the Complete Payment Package to the Frontend ---
    // We package up all the data PayU needs, including the secure hash, and
    // send it back to the `pricing.js` script in the browser.
    const paymentData = {
      paymentUrl: 'https://secure.payu.in/_payment', // PayU's live payment server URL
      params: {
        key: key,
        txnid: txnid,
        amount: amount,
        productinfo: productinfo,
        firstname: firstname,
        email: email,
        phone: '9999999999', // A placeholder phone number is required by PayU
        surl: surl,
        furl: furl,
        hash: hash,
      }
    };

    // The frontend will now use this data to redirect the user to PayU.
    res.status(200).json(paymentData);

  } catch (error) {
    // This block catches any errors, like an invalid user token or a server issue,
    // and sends back a proper error message.
    console.error('Error in /api/payu:', error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
    }
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}

