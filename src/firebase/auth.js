import { auth, db } from './config';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export async function loginUser(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const profile = await getUserProfile(user.uid);
  return { user, profile };
}

export async function logoutUser() {
  await signOut(auth);
}

export async function getUserProfile(uid) {
  try {
    const docRef = doc(db, 'adminUsers', uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.error("Failed to load user profile:", err);
  }
  // 預設給予 convener 角色或一般檢視權限
  return { role: 'convener', name: '志工管理員' };
}

export function subscribeAuthState(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const profile = await getUserProfile(user.uid);
      callback(user, profile);
    } else {
      callback(null, null);
    }
  });
}
