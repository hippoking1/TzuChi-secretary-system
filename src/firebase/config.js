import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// 優先讀取環境變數，若無則提供預設配置
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForDevelopment12345678",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tzuchi-registration.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tzuchi-registration",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tzuchi-registration.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef12345678"
};

const app = initializeApp(firebaseConfig);

// 啟用 Firestore 離線持久化快取 (IndexedDB)
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.warn("Firestore offline persistence fallback:", e);
  db = getFirestore(app);
}

const auth = getAuth(app);

export { app, auth, db };
