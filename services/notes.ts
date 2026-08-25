import { deleteDoc, doc, getDocs, updateDoc, writeBatch } from "firebase/firestore";
import { DEFAULT_NOTE_CATEGORIES, DEFAULT_NOTE_TRASH_DAYS } from "@/constants/notes";
import { getDb } from "@/lib/firebase/client";
import { col, nowIso, stripUndefined, toIso, withId } from "@/services/helpers";
import { addDocAt, deleteDocAt, updateDocAt } from "@/services/transactions";
import { deleteReceipt } from "@/services/storage";
import type {
  Note,
  NoteAttachment,
  NoteCategory,
  NoteRelatedEntity,
  NoteTimelineEvent,
  NoteTimelineKind,
} from "@/types";
import type { DocumentData } from "firebase/firestore";

export type NoteInput = {
  title: string;
  content: string;
  categoryId?: string;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  isDeleted?: boolean;
  reminderAt?: string;
  relatedEntity?: NoteRelatedEntity;
  attachments?: NoteAttachment[];
  timeline?: NoteTimelineEvent[];
};

function timelineEvent(kind: NoteTimelineKind, label: string, at = nowIso()): NoteTimelineEvent {
  return { id: crypto.randomUUID(), kind, label, at };
}

export function mapNote(id: string, data: DocumentData): Note {
  const attachments = Array.isArray(data.attachments)
    ? data.attachments.map((item: DocumentData) => ({
        id: String(item.id ?? crypto.randomUUID()),
        name: String(item.name ?? "Attachment"),
        type: String(item.type ?? item.contentType ?? "application/octet-stream"),
        size: Number(item.size ?? 0),
        storagePath: String(item.storagePath ?? item.path ?? ""),
        url: String(item.url ?? ""),
        createdAt: toIso(item.createdAt),
      }))
    : [];
  const timeline = Array.isArray(data.timeline)
    ? data.timeline.map((item: DocumentData) => ({
        id: String(item.id ?? crypto.randomUUID()),
        kind: (item.kind ?? "updated") as NoteTimelineKind,
        label: String(item.label ?? "Updated"),
        at: toIso(item.at),
      }))
    : [];
  const related = data.relatedEntity && typeof data.relatedEntity === "object"
    ? {
        type: data.relatedEntity.type as NoteRelatedEntity["type"],
        id: String(data.relatedEntity.id ?? ""),
      }
    : undefined;

  return {
    id,
    title: String(data.title ?? "Untitled"),
    content: String(data.content ?? ""),
    categoryId: data.categoryId ? String(data.categoryId) : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    isPinned: Boolean(data.isPinned),
    isArchived: Boolean(data.isArchived),
    isDeleted: Boolean(data.isDeleted),
    reminderAt: data.reminderAt ? toIso(data.reminderAt).slice(0, 10) : undefined,
    relatedEntity: related?.id ? related : undefined,
    attachments,
    timeline,
    deletedAt: data.deletedAt ? toIso(data.deletedAt) : undefined,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export function mapNoteCategory(id: string, data: DocumentData): NoteCategory {
  return withId<NoteCategory>(id, {
    name: String(data.name ?? "Other"),
    icon: data.icon ? String(data.icon) : undefined,
    color: data.color ? String(data.color) : undefined,
    isDefault: Boolean(data.isDefault),
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  });
}

export async function seedDefaultNoteCategories(uid: string): Promise<void> {
  const existing = await getDocs(col(uid, "noteCategories"));
  if (!existing.empty) return;

  const batch = writeBatch(getDb());
  const stamp = nowIso();
  for (const seed of DEFAULT_NOTE_CATEGORIES) {
    const ref = doc(col(uid, "noteCategories"));
    batch.set(ref, {
      name: seed.name,
      icon: seed.icon,
      color: seed.color,
      isDefault: true,
      createdAt: stamp,
      updatedAt: stamp,
    });
  }
  await batch.commit();
}

export async function createNote(uid: string, input: NoteInput): Promise<string> {
  const stamp = nowIso();
  const timeline = input.timeline?.length
    ? input.timeline
    : [timelineEvent("created", "Note created", stamp)];
  if (input.reminderAt) {
    timeline.push(timelineEvent("reminder", "Reminder added", stamp));
  }
  return addDocAt(uid, "notes", stripUndefined({
    title: input.title.trim(),
    content: input.content,
    categoryId: input.categoryId,
    tags: input.tags,
    isPinned: Boolean(input.isPinned),
    isArchived: Boolean(input.isArchived),
    isDeleted: false,
    reminderAt: input.reminderAt || undefined,
    relatedEntity: input.relatedEntity,
    attachments: input.attachments ?? [],
    timeline,
  }));
}

export async function saveNote(uid: string, id: string, input: Partial<NoteInput>, previous?: Note): Promise<void> {
  const stamp = nowIso();
  const timeline = [...(previous?.timeline ?? [])];
  if (input.reminderAt && input.reminderAt !== previous?.reminderAt) {
    timeline.push(timelineEvent("reminder", previous?.reminderAt ? "Reminder updated" : "Reminder added", stamp));
  }
  if (input.isPinned && !previous?.isPinned) {
    timeline.push(timelineEvent("pinned", "Note pinned", stamp));
  }
  timeline.push(timelineEvent("updated", "Note updated", stamp));
  await updateDocAt(uid, "notes", id, stripUndefined({
    ...input,
    title: input.title?.trim(),
    timeline,
  }));
}

export async function appendNoteTimeline(
  uid: string,
  note: Note,
  kind: NoteTimelineKind,
  label: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const event = timelineEvent(kind, label);
  await updateDoc(doc(getDb(), "users", uid, "notes", note.id), stripUndefined({
    ...extra,
    timeline: [...note.timeline, event],
    updatedAt: nowIso(),
  }));
}

export async function setNotePinned(uid: string, note: Note, isPinned: boolean): Promise<void> {
  await appendNoteTimeline(uid, note, "pinned", isPinned ? "Note pinned" : "Note unpinned", { isPinned });
}

export async function archiveNote(uid: string, note: Note): Promise<void> {
  await appendNoteTimeline(uid, note, "archived", "Note archived", { isArchived: true, isPinned: false });
}

export async function restoreNote(uid: string, note: Note): Promise<void> {
  await appendNoteTimeline(uid, note, "restored", "Note restored", {
    isArchived: false,
    isDeleted: false,
    deletedAt: null,
  });
}

export async function moveNoteToTrash(uid: string, note: Note): Promise<void> {
  await updateDocAt(uid, "notes", note.id, {
    isDeleted: true,
    deletedAt: nowIso(),
    isPinned: false,
  });
}

export async function restoreFromTrash(uid: string, note: Note): Promise<void> {
  await appendNoteTimeline(uid, note, "restored", "Restored from trash", {
    isDeleted: false,
    deletedAt: null,
  });
}

async function deleteAttachments(attachments: NoteAttachment[]): Promise<void> {
  await Promise.all(
    attachments.map(async (file) => {
      if (!file.storagePath) return;
      try {
        await deleteReceipt(file.storagePath);
      } catch {
        // File may already be gone.
      }
    }),
  );
}

export async function deleteNotePermanently(uid: string, note: Note): Promise<void> {
  await deleteAttachments(note.attachments);
  await deleteDocAt(uid, "notes", note.id);
}

export async function purgeExpiredTrash(
  uid: string,
  notes: Note[],
  trashDays = DEFAULT_NOTE_TRASH_DAYS,
): Promise<void> {
  const cutoff = Date.now() - trashDays * 24 * 60 * 60 * 1000;
  const expired = notes.filter((note) => {
    if (!note.isDeleted || !note.deletedAt) return false;
    return new Date(note.deletedAt).getTime() < cutoff;
  });
  for (const note of expired) {
    await deleteNotePermanently(uid, note);
  }
}

export async function addNoteAttachment(uid: string, note: Note, attachment: NoteAttachment): Promise<void> {
  await appendNoteTimeline(uid, note, "attachment", `Document attached: ${attachment.name}`, {
    attachments: [...note.attachments, attachment],
  });
}

export async function removeNoteAttachment(uid: string, note: Note, attachmentId: string): Promise<void> {
  const attachment = note.attachments.find((item) => item.id === attachmentId);
  if (attachment?.storagePath) {
    try {
      await deleteReceipt(attachment.storagePath);
    } catch {
      // Ignore missing files.
    }
  }
  await updateDocAt(uid, "notes", note.id, {
    attachments: note.attachments.filter((item) => item.id !== attachmentId),
  });
}

export async function saveNoteCategory(
  uid: string,
  input: { name: string; icon?: string; color?: string },
  id?: string,
): Promise<string> {
  if (id) {
    await updateDocAt(uid, "noteCategories", id, { name: input.name, icon: input.icon, color: input.color });
    return id;
  }
  return addDocAt(uid, "noteCategories", {
    name: input.name.trim(),
    icon: input.icon ?? "file-text",
    color: input.color ?? "#737373",
    isDefault: false,
  });
}

export async function removeNoteCategory(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "users", uid, "noteCategories", id));
}
