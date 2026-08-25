import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { emailKey, normalizeEmail } from "@/lib/auth/password";
import { nowIso, stripUndefined } from "@/services/helpers";

export interface AppUserRecord {
  uid: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export function appUserDoc(email: string) {
  return doc(getDb(), "appUsers", emailKey(email));
}

export async function findAppUserByEmail(email: string): Promise<AppUserRecord | null> {
  const snap = await getDoc(appUserDoc(email));
  if (!snap.exists()) return null;
  return snap.data() as AppUserRecord;
}

export async function saveAppUser(input: {
  uid: string;
  name: string;
  email: string;
  passwordHash: string;
}): Promise<void> {
  const stamp = nowIso();
  await setDoc(
    appUserDoc(input.email),
    stripUndefined({
      uid: input.uid,
      name: input.name,
      email: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      createdAt: stamp,
      updatedAt: stamp,
    }),
  );
}

export async function updateAppUserPassword(email: string, passwordHash: string): Promise<void> {
  await updateDoc(appUserDoc(email), {
    passwordHash,
    updatedAt: nowIso(),
  });
}

export async function deleteAppUser(email: string): Promise<void> {
  await deleteDoc(appUserDoc(email));
}
