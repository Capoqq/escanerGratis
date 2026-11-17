import type { SavedDocument, SignatureAsset } from '../types/document';

const DB_NAME = 'docuscan_vault_db';
const DB_VERSION = 1;
const STORE_DOCS = 'documents';
const SIGNATURES_KEY = 'docuscan_saved_signatures_v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        const store = db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDocumentToVault(doc: SavedDocument): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCS, 'readwrite');
    tx.objectStore(STORE_DOCS).put(doc);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getAllDocumentsFromVault(): Promise<SavedDocument[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCS, 'readonly');
    const req = tx.objectStore(STORE_DOCS).getAll();
    req.onsuccess = () => {
      db.close();
      const docs = (req.result as SavedDocument[]).sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(docs);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function deleteDocumentFromVault(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DOCS, 'readwrite');
    tx.objectStore(STORE_DOCS).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export function getSavedSignatures(): SignatureAsset[] {
  try {
    const raw = localStorage.getItem(SIGNATURES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SignatureAsset[];
  } catch {
    return [];
  }
}

export function saveSignatureAsset(asset: SignatureAsset): SignatureAsset[] {
  const existing = getSavedSignatures();
  const next = [asset, ...existing].slice(0, 12);
  localStorage.setItem(SIGNATURES_KEY, JSON.stringify(next));
  return next;
}

export function deleteSignatureAsset(id: string): SignatureAsset[] {
  const next = getSavedSignatures().filter((s) => s.id !== id);
  localStorage.setItem(SIGNATURES_KEY, JSON.stringify(next));
  return next;
}
