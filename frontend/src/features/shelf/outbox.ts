import axios from 'axios';
import { erpApi } from '@/lib/api/erp.api';
import type { AuditLineDraft } from './score';

const DB_NAME = 'gbc-shelf';
const STORE = 'outbox';

type OutboxRecord = {
  id: string;
  customerId: string;
  photo: Blob | null;
  lines: AuditLineDraft[];
  createdAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readAll(): Promise<OutboxRecord[]> {
  const db = await openDb();
  const rows = await requestToPromise(db.transaction(STORE, 'readonly').objectStore(STORE).getAll());
  db.close();
  return (rows as OutboxRecord[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function remove(id: string): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id));
  db.close();
}

async function enqueue(record: OutboxRecord): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction(STORE, 'readwrite').objectStore(STORE).put(record));
  db.close();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `shelf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function send(record: Pick<OutboxRecord, 'customerId' | 'photo' | 'lines'>): Promise<void> {
  let photoId: number | undefined;
  if (record.photo) {
    const file = new File([record.photo], 'shelf.jpg', { type: record.photo.type || 'image/jpeg' });
    const photo = await erpApi.uploadVisitPhoto({
      customerId: record.customerId,
      phase: 'shelf',
      photo: file,
    });
    photoId = photo.id;
  }
  await erpApi.saveShelfAudit({
    customerId: record.customerId,
    photoId,
    lines: record.lines,
  });
}

export async function submitShelf(input: {
  customerId: string;
  photo: Blob | null;
  lines: AuditLineDraft[];
}): Promise<'sent' | 'queued'> {
  const record: OutboxRecord = {
    id: newId(),
    customerId: input.customerId,
    photo: input.photo,
    lines: input.lines,
    createdAt: new Date().toISOString(),
  };
  if (!navigator.onLine) {
    await enqueue(record);
    return 'queued';
  }
  try {
    await send(record);
    return 'sent';
  } catch (error) {
    if (axios.isAxiosError(error) && !error.response) {
      await enqueue(record);
      return 'queued';
    }
    throw error;
  }
}

export async function flushShelfOutbox(): Promise<number> {
  if (typeof indexedDB === 'undefined' || !navigator.onLine) {
    return 0;
  }
  const pending = await readAll().catch(() => []);
  let sent = 0;
  for (const record of pending) {
    try {
      await send(record);
      await remove(record.id);
      sent += 1;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500) {
        continue;
      }
      break;
    }
  }
  return sent;
}
