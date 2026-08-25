import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/client";
import type { Attachment, NoteAttachment } from "@/types";

async function optimizeImage(file: File, maxWidth = 1920, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }
  if (typeof window === "undefined" || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width <= maxWidth && file.size < 900_000) {
      bitmap.close();
      return file;
    }
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, ".jpg");
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

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

export async function uploadNoteFile(uid: string, noteId: string, file: File): Promise<NoteAttachment> {
  const optimized = await optimizeImage(file);
  const uploaded = await uploadUserFile(uid, optimized, `notes/${noteId}`);
  return {
    id: uploaded.id,
    name: file.name,
    type: uploaded.contentType,
    size: uploaded.size,
    storagePath: uploaded.path,
    url: uploaded.url,
    createdAt: new Date().toISOString(),
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
