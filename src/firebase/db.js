import { db } from './config';
import { 
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, runTransaction, serverTimestamp,
  getCountFromServer
} from 'firebase/firestore';

// ---- 通用資料存取與批量工具 ----
export async function getCollectionDocs(collectionName, queryConstraints = []) {
  const q = query(collection(db, collectionName), ...queryConstraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getDocById(collectionName, id) {
  const docRef = doc(db, collectionName, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function createDoc(collectionName, data) {
  const colRef = collection(db, collectionName);
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

export async function setDocWithId(collectionName, id, data) {
  const docRef = doc(db, collectionName, id);
  await setDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true });
  return id;
}

export async function updateDocById(collectionName, id, updates) {
  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
}

export async function deleteDocById(collectionName, id) {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
}

// 批量寫入 (自動切分 450 筆以避免 Firestore 500 限制)
export async function batchWriteItems(collectionName, items, operation = 'set') {
  const chunkSize = 450;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const docRef = item.id ? doc(db, collectionName, item.id) : doc(collection(db, collectionName));
      if (operation === 'delete') {
        batch.delete(docRef);
      } else {
        batch.set(docRef, { ...item, updatedAt: serverTimestamp() }, { merge: true });
      }
    }
    await batch.commit();
  }
}

// ---- 活動與報名 Transaction (防止名額超額) ----
export async function registerWithTransaction(registrationData) {
  return await runTransaction(db, async (transaction) => {
    const eventRef = doc(db, 'events', registrationData.eventId);
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists()) {
      throw new Error("活動不存在");
    }
    const event = eventSnap.data();
    
    // 檢查已確認報名人數
    const currentConfirmed = event.currentConfirmedCount || 0;
    const maxParticipants = event.maxParticipants || 999;
    
    let status = '已確認';
    if (currentConfirmed >= maxParticipants) {
      status = '候補中';
    } else {
      transaction.update(eventRef, {
        currentConfirmedCount: currentConfirmed + 1,
        updatedAt: serverTimestamp()
      });
    }

    const regRef = doc(collection(db, 'registrations'));
    transaction.set(regRef, {
      ...registrationData,
      status,
      registeredAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return { registrationId: regRef.id, status };
  });
}

// 取消報名並自動遞補第一順位候補者
export async function cancelRegistrationWithPromotion(regId, eventId) {
  return await runTransaction(db, async (transaction) => {
    const regRef = doc(db, 'registrations', regId);
    const regSnap = await transaction.get(regRef);
    if (!regSnap.exists()) throw new Error("報名紀錄不存在");
    
    const regData = regSnap.data();
    const wasConfirmed = regData.status === '已確認';

    // 標記取消
    transaction.update(regRef, {
      status: '已取消',
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 若取消的是正取名額，查詢是否有候補者進行遞補
    if (wasConfirmed) {
      const waitlistQuery = query(
        collection(db, 'registrations'),
        where('eventId', '==', eventId),
        where('status', '==', '候補中'),
        orderBy('registeredAt', 'asc'),
        limit(1)
      );
      const waitlistSnaps = await getDocs(waitlistQuery);
      if (!waitlistSnaps.empty) {
        const firstCandidate = waitlistSnaps.docs[0];
        transaction.update(doc(db, 'registrations', firstCandidate.id), {
          status: '已確認',
          promotedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        // 沒有候補者，扣減活動確認人數
        const eventRef = doc(db, 'events', eventId);
        const eventSnap = await transaction.get(eventRef);
        if (eventSnap.exists()) {
          const count = Math.max(0, (eventSnap.data().currentConfirmedCount || 1) - 1);
          transaction.update(eventRef, { currentConfirmedCount: count });
        }
      }
    }
  });
}

// 快速計數
export async function getCollectionCount(collectionName, queryConstraints = []) {
  try {
    const q = query(collection(db, collectionName), ...queryConstraints);
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (e) {
    console.warn("Count query fallback:", e);
    const docs = await getCollectionDocs(collectionName, queryConstraints);
    return docs.length;
  }
}
