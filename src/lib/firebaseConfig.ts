
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth"; // Added
import { getAnalytics, type Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAUH5fl6mBwPDyPdBe9G7acWikDGstSt8U",
  authDomain: "sonic-terrain-454712-t6.firebaseapp.com",
  projectId: "sonic-terrain-454712-t6",
  storageBucket: "sonic-terrain-454712-t6.appspot.com",
  messagingSenderId: "1052251970054",
  appId: "1:1052251970054:web:7246abec77e6d4e9da4187",
  measurementId: "G-HJ1YC55VC5"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app); // Auth instance

let analytics: Analytics | undefined;
if (typeof window !== 'undefined') {
  // Ensure analytics is only initialized on the client-side
  analytics = getAnalytics(app);
}

export { app, db, auth, analytics }; // Export auth
