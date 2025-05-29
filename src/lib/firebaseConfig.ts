
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC6wHrttUcY9DgiNt3ZXMBUBJZpLIeVmMA",
  authDomain: "lottery-analyzer-klvae.firebaseapp.com",
  projectId: "lottery-analyzer-klvae",
  storageBucket: "lottery-analyzer-klvae.appspot.com", // Standard format
  messagingSenderId: "711716823831",
  appId: "1:711716823831:web:3ba6b92f4193a0b2834d52"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db: Firestore = getFirestore(app);

export { app, db };
