export interface NoteDraft {
  title: string;
  content: string;
  savedAt: string;
}

function draftKey(uid: string, noteId: string) {
  return `cashio.noteDraft.${uid}.${noteId}`;
}

export function loadNoteDraft(uid: string, noteId: string): NoteDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(uid, noteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NoteDraft;
    if (!parsed || typeof parsed.title !== "string" || typeof parsed.content !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveNoteDraft(uid: string, noteId: string, draft: Omit<NoteDraft, "savedAt">): void {
  if (typeof window === "undefined") return;
  const payload: NoteDraft = { ...draft, savedAt: new Date().toISOString() };
  window.localStorage.setItem(draftKey(uid, noteId), JSON.stringify(payload));
}

export function clearNoteDraft(uid: string, noteId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(draftKey(uid, noteId));
}

export function draftIsNewer(draft: NoteDraft, updatedAt?: string): boolean {
  if (!updatedAt) return Boolean(draft.title.trim() || draft.content.trim());
  return draft.savedAt > updatedAt && Boolean(draft.title.trim() || draft.content.trim());
}
