// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration (updated)
const firebaseConfig = {
  apiKey: "AIzaSyAAxkCBDFef668Lod-1cZQQ7akXdudKLnQ",
  authDomain: "calendly-417be.firebaseapp.com",
  projectId: "calendly-417be",
  storageBucket: "calendly-417be.firebasestorage.app",
  messagingSenderId: "285807807631",
  appId: "1:285807807631:web:10b26e3ac0adcb1bfcf4fa",
  measurementId: "G-2XG4WM5RDH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics only when supported (avoids issues in some dev contexts)
let analytics = null;
(async () => {
  try {
    if (typeof window !== 'undefined' && (await isSupported())) {
      analytics = getAnalytics(app);
    }
  } catch (_) {
    // ignore analytics failures in dev
  }
})();

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

export { app, analytics, auth, googleProvider, db }; 