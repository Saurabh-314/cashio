import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/client";
import type { Attachment } from "@/types";

export async function uploadUserFile(uid: string, file: File, folder: string): Promise<Attachment> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `users/${uid}/${folder}/${Date.now()}-${safeName}`;
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);
  return {
    id: crypto.randomUUID(),
    name: file.name,
    url,
    path,
    contentType: file.type,
    size: file.size,
  };
}

export async function uploadReceipt(
  uid: string,
  file: File,
  transactionId = "draft",
): Promise<Attachment> {
  return uploadUserFile(uid, file, `receipts/${transactionId}`);
}

export async function deleteReceipt(path: string): Promise<void> {
  await deleteObject(ref(getFirebaseStorage(), path));
}
