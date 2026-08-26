import { db } from './config';
import { 
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, runTransaction, serverTimestamp
} from 'firebase/firestore';

// ---- 通用 CRUD Helper ----

export async function getCollectionDocs(colName, queryConstraints = []) {
  const q = query(collection(db, colName), ...queryConstraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getDocById(colName, id) {
  const docRef = doc(db, colName, id);
  const snap = await getDoc(docRef);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createDoc(colName, data) {
  const docRef = await addDoc(collection(db, colName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

export async function setDocById(colName, id, data, merge = true) {
  const docRef = doc(db, colName, id);
  await setDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge });
  return id;
}

export async function updateDocById(colName, id, data) {
  const docRef = doc(db, colName, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteDocById(colName, id) {
  const docRef = doc(db, colName, id);
  await deleteDoc(docRef);
}

// ---- 批次寫入 Helper (上限 500 筆) ----
export async function batchWriteItems(colName, items, operation = 'set') {
  const BATCH_SIZE = 400;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = items.slice(i, i + BATCH_SIZE);
    
    chunk.forEach(item => {
      const docRef = item.id ? doc(db, colName, item.id) : doc(collection(db, colName));
      if (operation === 'set') {
        batch.set(docRef, { ...item, updatedAt: serverTimestamp() }, { merge: true });
      } else if (operation === 'delete') {
        batch.delete(docRef);
      }
    });
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
    const maxParticipants = event.maxParticipants || 0;
    
    let status = '已確認';
    const isFull = maxParticipants > 0 && currentConfirmed >= maxParticipants;

    if (isFull) {
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

// 取消報名並自動遞補第一順位候補者 (嚴格遵守 Read-Before-Write 規則)
export async function cancelRegistrationWithPromotion(regId, eventId) {
  // 1. 在 Transaction 外部預先取得候補名單第一順位 (Read 1)
  let candidateDoc = null;
  if (eventId) {
    try {
      const waitlistQuery = query(
        collection(db, 'registrations'),
        where('eventId', '==', eventId),
        where('status', '==', '候補中'),
        orderBy('registeredAt', 'asc'),
        limit(1)
      );
      const waitlistSnaps = await getDocs(waitlistQuery);
      if (!waitlistSnaps.empty) {
        candidateDoc = waitlistSnaps.docs[0];
      }
    } catch (e) {
      console.warn("查詢候補名單警告:", e);
    }
  }

  return await runTransaction(db, async (transaction) => {
    // 2. 執行所有 Transaction Reads (所有讀取必須在任何寫入前完成)
    const regRef = doc(db, 'registrations', regId);
    const regSnap = await transaction.get(regRef); // Read
    if (!regSnap.exists()) throw new Error("報名紀錄不存在");
    
    const regData = regSnap.data();
    const wasConfirmed = regData.status === '已確認';
    const actualEventId = eventId || regData.eventId;

    let eventSnap = null;
    let eventRef = null;
    if (actualEventId) {
      eventRef = doc(db, 'events', actualEventId);
      eventSnap = await transaction.get(eventRef); // Read
    }

    let candidateSnap = null;
    let candidateRef = null;
    if (candidateDoc) {
      candidateRef = doc(db, 'registrations', candidateDoc.id);
      candidateSnap = await transaction.get(candidateRef); // Read
    }

    // 3. 執行所有 Transaction Writes (寫入階段)
    transaction.update(regRef, {
      status: '已取消',
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    if (wasConfirmed) {
      if (candidateSnap && candidateSnap.exists() && candidateSnap.data().status === '候補中') {
        transaction.update(candidateRef, {
          status: '已確認',
          promotedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else if (eventSnap && eventSnap.exists()) {
        const cur = eventSnap.data().currentConfirmedCount || 0;
        transaction.update(eventRef, {
          currentConfirmedCount: Math.max(0, cur - 1),
          updatedAt: serverTimestamp()
        });
      }
    }

    return { success: true };
  });
}
