import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, startAfter } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCcSkzSdz_GtjYQBV5sTUuPxu1BwTZAq7Y",
    authDomain: "genart-a693a.firebaseapp.com",
    projectId: "genart-a693a",
    storageBucket: "genart-a693a.appspot.com",
    messagingSenderId: "96958671615",
    appId: "1:96958671615:web:6a0d3aa6bf42c6bda17aca",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const imageGrid = document.getElementById('image-library-grid');
const loader = document.getElementById('loader');
const imageModal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalPrompt = document.getElementById('modal-prompt');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCopyBtn = document.getElementById('modal-copy-btn');

let lastVisible = null;
let isLoading = false;
const IMAGES_PER_PAGE = 12;

async function fetchImages() {
    if (isLoading) return;
    isLoading = true;
    loader.classList.remove('hidden');

    try {
        let q;
        const imagesRef = collection(db, 'library_images');
        
        if (lastVisible) {
            q = query(imagesRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(IMAGES_PER_PAGE));
        } else {
            q = query(imagesRef, orderBy('createdAt', 'desc'), limit(IMAGES_PER_PAGE));
        }

        const documentSnapshots = await getDocs(q);

        if (!documentSnapshots.empty) {
            lastVisible = documentSnapshots.docs[documentSnapshots.docs.length-1];
            
            documentSnapshots.forEach((doc) => {
                const data = doc.data();
                const imgContainer = document.createElement('div');
                imgContainer.className = 'aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer';
                
                const img = document.createElement('img');
                img.src = data.imageUrl;
                img.className = 'w-full h-full object-cover';
                img.loading = 'lazy'; // Lazy load images
                
                imgContainer.appendChild(img);
                imageGrid.appendChild(imgContainer);

                imgContainer.addEventListener('click', () => openImageModal(data));
            });
        } else {
             window.removeEventListener('scroll', handleScroll);
             loader.innerHTML = '<p>You\'ve reached the end!</p>';
        }

    } catch (error) {
        console.error("Error fetching images:", error);
        loader.innerHTML = '<p class="text-red-500">Could not load images.</p>';
    } finally {
        isLoading = false;
        loader.classList.add('hidden');
    }
}

function openImageModal(data) {
    modalImg.src = data.imageUrl;
    modalPrompt.textContent = data.prompt;
    imageModal.classList.remove('hidden');
}

function closeImageModal() {
    imageModal.classList.add('hidden');
    modalImg.src = '';
}

modalCloseBtn.addEventListener('click', closeImageModal);
modalCopyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(modalPrompt.textContent)
        .then(() => {
            modalCopyBtn.innerHTML = 'Copied!';
            setTimeout(() => {
                 modalCopyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zM-1 7a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3A.5.5 0 0 1 -1 7z"/></svg>`;
            }, 1500);
        });
});

// Infinite Scroll Logic
function handleScroll() {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200 && !isLoading) {
        fetchImages();
    }
}

window.addEventListener('scroll', handleScroll);

// Initial Load
fetchImages();
```

### 4. Final Step: Firestore Security Rules

To make this all work, you need to update your Firestore security rules one last time. This will allow authenticated users to add images to the library, and will allow anyone (even non-logged-in users) to view the images on the library page.

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
    
    // Authenticated users can create library images, and anyone can read them
    match /library_images/{docId} {
      allow create: if request.auth != null;
      allow read: if true;
    }
    
    // The server can create generation logs, and the dashboard can read them
    match /generations/{docId} {
      allow create: if true;
      allow read: if true;
    }
  }
}
