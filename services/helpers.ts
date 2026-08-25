import {
  Timestamp,
  collection,
  doc,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";

export function nowIso(): string {
  return new Date().toISOString();
}

export function toIso(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as Timestamp).toDate().toISOString();
  }
  return nowIso();
}

export function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) next[key] = item;
  }
  return next as T;
}

export function col(uid: string, name: string) {
  return collection(getDb(), "users", uid, name);
}

export function userDoc(uid: string) {
  return doc(getDb(), "users", uid);
}

export function withId<T>(id: string, data: DocumentData): T {
  return { id, ...data } as T;
}
