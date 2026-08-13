// Local persistent storage helpers backed by AsyncStorage.
// All data lives on-device only (offline-first per user requirement).

import AsyncStorage from "@react-native-async-storage/async-storage";

export type MasterProduct = {
  barcode: string;
  code: string;
  name: string;
};

export type ScanEntry = {
  id: string;
  sequence: number;
  barcode: string;
  code: string;
  name: string;
  karton: number;
  lusin: number;
  pcs: number;
  createdAt: number;
};

const K = {
  username: "gs.username",
  master: "gs.master",
  entries: "gs.entries",
} as const;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

// ---- Username ----
export const getUsername = () => readJson<string>(K.username, "");
export const setUsername = (name: string) => writeJson(K.username, name);
export const clearUsername = () => AsyncStorage.removeItem(K.username);

// ---- Master products ----
export const getMasterProducts = () => readJson<MasterProduct[]>(K.master, []);
export const setMasterProducts = (list: MasterProduct[]) => writeJson(K.master, list);

export async function addMasterProduct(item: MasterProduct): Promise<MasterProduct[]> {
  const list = await getMasterProducts();
  list.push(item);
  await setMasterProducts(list);
  return list;
}

export async function upsertMasterProducts(items: MasterProduct[]): Promise<MasterProduct[]> {
  // Import behaviour: merge with existing, dedupe by (barcode,code,name) tuple
  const list = await getMasterProducts();
  const key = (p: MasterProduct) => `${p.barcode}||${p.code}||${p.name}`;
  const seen = new Set(list.map(key));
  for (const it of items) {
    const k = key(it);
    if (!seen.has(k)) {
      list.push(it);
      seen.add(k);
    }
  }
  await setMasterProducts(list);
  return list;
}

export async function findMastersByBarcode(barcode: string): Promise<MasterProduct[]> {
  const list = await getMasterProducts();
  return list.filter((p) => p.barcode.trim() === barcode.trim());
}

// ---- Scan entries ----
export const getEntries = () => readJson<ScanEntry[]>(K.entries, []);
export const setEntries = (list: ScanEntry[]) => writeJson(K.entries, list);

export async function addEntry(entry: Omit<ScanEntry, "id" | "sequence" | "createdAt">): Promise<ScanEntry[]> {
  const list = await getEntries();
  const maxSeq = list.reduce((acc, e) => Math.max(acc, e.sequence), 0);
  const newEntry: ScanEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sequence: maxSeq + 1,
    createdAt: Date.now(),
  };
  const next = [newEntry, ...list];
  await setEntries(next);
  return next;
}

export async function updateEntry(id: string, patch: Partial<Omit<ScanEntry, "id" | "sequence" | "createdAt">>): Promise<ScanEntry[]> {
  const list = await getEntries();
  const next = list.map((e) => (e.id === id ? { ...e, ...patch } : e));
  await setEntries(next);
  return next;
}

export async function deleteEntry(id: string): Promise<ScanEntry[]> {
  const list = await getEntries();
  const filtered = list.filter((e) => e.id !== id);
  // Re-sequence so nomor urut has no gaps — keep display order (newest first)
  // Reassign sequence in the order the rows were originally created (ascending createdAt).
  const chronological = [...filtered].sort((a, b) => a.createdAt - b.createdAt);
  const seqMap = new Map<string, number>();
  chronological.forEach((e, i) => seqMap.set(e.id, i + 1));
  const reseq = filtered.map((e) => ({ ...e, sequence: seqMap.get(e.id) ?? e.sequence }));
  await setEntries(reseq);
  return reseq;
}

export async function clearEntries(): Promise<void> {
  await setEntries([]);
}

export async function totalsForCode(code: string): Promise<{ karton: number; lusin: number; pcs: number; count: number }> {
  const list = await getEntries();
  const target = list.filter((e) => e.code === code);
  return target.reduce(
    (acc, e) => ({
      karton: acc.karton + e.karton,
      lusin: acc.lusin + e.lusin,
      pcs: acc.pcs + e.pcs,
      count: acc.count + 1,
    }),
    { karton: 0, lusin: 0, pcs: 0, count: 0 },
  );
}
