
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// تعريف process لإسكات TypeScript
declare const process: { env: { [key: string]: string | undefined } };

// إعدادات Firebase الخاصة بتطبيق NZ GPT
const firebaseConfig = {
  apiKey: "AIzaSyA0T3lv4PLBbWF7JpJFVnrsh1-NHObM9dE",
  authDomain: "nz-gpt-ai.firebaseapp.com",
  projectId: "nz-gpt-ai",
  storageBucket: "nz-gpt-ai.firebasestorage.app",
  messagingSenderId: "728232369659",
  appId: "1:728232369659:web:b5c68b8764efddfa413f5e",
  measurementId: "G-W5VJCGNTHN"
};

let app;
let auth: Auth | undefined;
let googleProvider: GoogleAuthProvider | undefined;
let db: Firestore | undefined;
let isFirebaseInitialized = false;

// محاولة التهيئة
try {
  // التحقق من وجود المفاتيح الأساسية
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 0 && firebaseConfig.projectId) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    db = getFirestore(app);
    isFirebaseInitialized = true;
  } else {
    console.info("Firebase Config missing: App will run in limited mode.");
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export { auth, googleProvider, db, isFirebaseInitialized };
