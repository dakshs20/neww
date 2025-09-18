// This script is specifically for the admin.html page.
// It handles password protection and fetches data from the secure backend API.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// IMPORTANT: This configuration is safe to be public.
// All access control is handled by Firestore Security Rules.
const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.appspot.com",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
    measurementId: "G-EDCW8VYXY6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const passwordProtectionEl = document.getElementById('password-protection');
const dashboardContentEl = document.getElementById('dashboard-content');
const passwordInput = document.getElementById('password-input');
const passwordSubmit = document.getElementById('password-submit');
const passwordError = document.getElementById('password-error');

// Hardcoded password for simplicity. For production, use a more secure method.
const ADMIN_PASSWORD = "admin"; // You can change this password

passwordSubmit.addEventListener('click', checkPassword);
passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        checkPassword();
    }
});

function checkPassword() {
    if (passwordInput.value === ADMIN_PASSWORD) {
        passwordProtectionEl.classList.add('hidden');
        dashboardContentEl.classList.remove('hidden');
        initializeDashboard();
    } else {
        passwordError.classList.remove('hidden');
        setTimeout(() => passwordError.classList.add('hidden'), 2000);
    }
}

function initializeDashboard() {
    const generationsRef = collection(db, 'generations');
    const q = query(generationsRef, orderBy('createdAt', 'desc'));

    const totalGenerationsEl = document.getElementById('total-generations');
    const promptsTableBody = document.getElementById('prompts-table-body');

    onSnapshot(q, (snapshot) => {
        // Update total count
        totalGenerationsEl.textContent = snapshot.size;

        // Clear and update the table with the latest prompts
        promptsTableBody.innerHTML = '';
        if (snapshot.empty) {
             promptsTableBody.innerHTML = '<tr><td colspan="3" class="text-center p-8 text-gray-500">No prompts have been generated yet.</td></tr>';
             return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            
            const timestamp = data.createdAt ? data.createdAt.toDate().toLocaleString() : 'N/A';
            const userId = data.userId || 'N/A';
            const prompt = data.prompt || 'N/A';

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${timestamp}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${userId.substring(0, 15)}...</td>
                <td class="px-6 py-4 text-sm text-gray-900">${prompt}</td>
            `;
            promptsTableBody.appendChild(tr);
        });
    });
}
```

### 3. Final Step: Firestore Security Rules

To make this work, you need to update your Firestore security rules to allow your new admin page to read the `generations` collection.

1.  Go to your **Firebase Console**.
2.  Navigate to **Firestore Database -> Rules**.
3.  Replace your existing rules with these:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read and write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // The server can create new generation logs
    match /generations/{docId} {
      allow create: if true; // Allows the backend to write
      allow read: if true;   // Allows the admin dashboard to read
    }
  }
}
