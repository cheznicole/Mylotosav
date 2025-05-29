
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAnalytics, type Analytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAUH5fl6mBwPDyPdBe9G7acWikDGstSt8U",
  authDomain: "sonic-terrain-454712-t6.firebaseapp.com",
  projectId: "sonic-terrain-454712-t6",
  storageBucket: "sonic-terrain-454712-t6.firebasestorage.app",
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

let analytics: Analytics | undefined;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { app, db, analytics };
