"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { NoteAttachments } from "@/components/notes/note-attachments";
import { NoteEditorCanvas } from "@/components/notes/note-editor-canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { accountLabel } from "@/lib/finance/account-label";
import { parseTags } from "@/lib/notes";
import { parseNoteContent, serializeNoteContent } from "@/lib/note-document";
import { clearNoteDraft, draftIsNewer, loadNoteDraft, saveNoteDraft, type NoteDraft } from "@/lib/notes-draft";
import { ALLOWED_NOTE_FILE_TYPES, MAX_NOTE_FILE_SIZE, NOTE_TEMPLATES } from "@/constants/notes";
import { noteSchema } from "@/lib/validations";
import { uploadNoteFile } from "@/services/storage";
import { getErrorMessage } from "@/lib/firebase/errors";
import type { NoteRelatedType } from "@/types";

const NONE = "__none__";

export function NoteEditorView({ noteId }: { noteId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const {
    notes,
    noteCategories,
    accounts,
    activities,
    providers,
    transactions,
    bills,
    goals,
    loans,
    saveNote,
    saveNoteCategory,
    addNoteFile,
    removeNoteFile,
  } = useFinance();
  const [savedId, setSavedId] = useState(noteId);
  const existing = notes.find((item) => item.id === (noteId ?? savedId));
  const uid = user?.uid;
  const draftId = noteId ?? "new";
  const fileRef = useRef<HTMLInputElement>(null);

  const relatedTypeParam = searchParams.get("relatedType") as NoteRelatedType | null;
  const relatedIdParam = searchParams.get("relatedId");
  const titleParam = searchParams.get("title");
  const templateParam = searchParams.get("template");
  const categoryParam = searchParams.get("category");

  const template = NOTE_TEMPLATES.find((item) => item.id === templateParam);
  const categoryFromName = noteCategories.find(
    (item) => item.name === (categoryParam || template?.category),
  );

  const [title, setTitle] = useState(existing?.title ?? titleParam ?? template?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? template?.content ?? "");
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? categoryFromName?.id ?? "");
  const [tags, setTags] = useState(existing?.tags.join(", ") ?? "");
  const [reminderAt, setReminderAt] = useState(existing?.reminderAt ?? "");
  const [isPinned, setIsPinned] = useState(existing?.isPinned ?? false);
  const [isArchived, setIsArchived] = useState(existing?.isArchived ?? false);
  const [relatedType, setRelatedType] = useState<NoteRelatedType | "none">(
    existing?.relatedEntity?.type ?? relatedTypeParam ?? "none",
  );
  const [relatedId, setRelatedId] = useState(existing?.relatedEntity?.id ?? relatedIdParam ?? "");
  const [saving, setSaving] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<NoteDraft | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saving" | "saved">("idle");
  const [editorSeed, setEditorSeed] = useState(existing?.content ?? template?.content ?? "");
  const [editorKey, setEditorKey] = useState(noteId ?? "new");
  const hydrated = useRef(false);

  useEffect(() => {
    if (existing && !hydrated.current) {
      setTitle(existing.title);
      setContent(existing.content);
      setCategoryId(existing.categoryId ?? "");
      setTags(existing.tags.join(", "));
      setReminderAt(existing.reminderAt ?? "");
      setIsPinned(existing.isPinned);
      setIsArchived(existing.isArchived);
      setRelatedType(existing.relatedEntity?.type ?? "none");
      setRelatedId(existing.relatedEntity?.id ?? "");
      setEditorSeed(existing.content);
      setEditorKey(existing.id);
      hydrated.current = true;
    }
  }, [existing]);

  useEffect(() => {
    if (!uid) return;
    const draft = loadNoteDraft(uid, draftId);
    if (draft && draftIsNewer(draft, existing?.updatedAt)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore local draft once
      setPendingDraft(draft);
      setDraftPrompt(true);
    }
  }, [draftId, existing?.updatedAt, uid]);

  useEffect(() => {
    if (!uid) return;
    const timer = window.setTimeout(() => {
      saveNoteDraft(uid, draftId, { title, content });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [content, draftId, title, uid]);

  const relatedOptions = useMemo(() => {
    if (relatedType === "account") return accounts.map((item) => ({ id: item.id, name: accountLabel(item) }));
    if (relatedType === "activity") return activities.map((item) => ({ id: item.id, name: item.name }));
    if (relatedType === "provider") return providers.map((item) => ({ id: item.id, name: item.name }));
    if (relatedType === "transaction") {
      return transactions.slice(0, 40).map((item) => ({ id: item.id, name: item.description }));
    }
    if (relatedType === "bill") return bills.map((item) => ({ id: item.id, name: item.name }));
    if (relatedType === "goal") return goals.map((item) => ({ id: item.id, name: item.name }));
    if (relatedType === "loan") return loans.map((item) => ({ id: item.id, name: item.name }));
    return [];
  }, [accounts, activities, bills, goals, loans, providers, relatedType, transactions]);

  const persist = useCallback(
    async (id?: string) => {
      const parsed = noteSchema.safeParse({
        title,
        content,
        categoryId: categoryId || undefined,
        tags,
        reminderAt: reminderAt || undefined,
        isPinned,
        isArchived,
        relatedType,
        relatedId: relatedId || undefined,
      });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Check the note");
        return null;
      }
      const relatedEntity =
        relatedType !== "none" && relatedId
          ? { type: relatedType, id: relatedId }
          : undefined;
      const nextId = await saveNote(
        {
          title: parsed.data.title,
          content: serializeNoteContent(parseNoteContent(parsed.data.content ?? content)),
          categoryId: parsed.data.categoryId,
          tags: parseTags(parsed.data.tags ?? ""),
          isPinned: Boolean(parsed.data.isPinned),
          isArchived: Boolean(parsed.data.isArchived),
          reminderAt: parsed.data.reminderAt || undefined,
          relatedEntity,
          attachments: existing?.attachments ?? [],
          timeline: existing?.timeline ?? [],
        },
        id ?? savedId ?? noteId,
      );
      setSavedId(nextId);
      return nextId;
    },
    [
      categoryId,
      content,
      existing?.attachments,
      existing?.timeline,
      isArchived,
      isPinned,
      noteId,
      relatedId,
      relatedType,
      reminderAt,
      savedId,
      saveNote,
      tags,
      title,
    ],
  );

  useEffect(() => {
    if (saveStatus !== "unsaved" || !savedId || !title.trim()) return;
    const timer = window.setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const id = await persist(savedId);
        if (id) setSaveStatus("saved");
        else setSaveStatus("unsaved");
      } catch {
        setSaveStatus("unsaved");
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [content, persist, saveStatus, savedId, title]);

  async function onSave() {
    setSaving(true);
    try {
      const id = await persist();
      if (!id) return;
      if (uid) clearNoteDraft(uid, draftId);
      setSaveStatus("saved");
      toast.success("Note saved");
      router.replace(`/notes/${id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length || !uid) return;
    let id = savedId ?? noteId;
    if (!id) {
      if (!title.trim()) {
        toast.error("Enter a title before attaching a file");
        return;
      }
      const created = await persist();
      if (!created) return;
      id = created;
    }
    for (const file of Array.from(files)) {
      if (!ALLOWED_NOTE_FILE_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
        toast.error(`${file.name} is not a supported file type`);
        continue;
      }
      if (file.size > MAX_NOTE_FILE_SIZE) {
        toast.error(`${file.name} is larger than 10 MB`);
        continue;
      }
      try {
        const attachment = await uploadNoteFile(uid, id, file);
        await addNoteFile(id, attachment);
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" asChild className="-ml-2">
          <Link href="/notes">
            <ArrowLeft /> Notes
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : saveStatus === "unsaved" ? "Unsaved" : null}
          </p>
          <Button variant="ghost" asChild>
            <Link href={savedId ? `/notes/${savedId}` : "/notes"}>Cancel</Link>
          </Button>
          <Button onClick={() => void onSave()} disabled={saving}>
            Save note
          </Button>
        </div>
      </div>

      <Input
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          if (savedId) setSaveStatus("unsaved");
        }}
        placeholder="Title"
        className="h-auto border-0 bg-transparent p-4 font-display text-2xl font-medium tracking-tight shadow-none focus-visible:ring-0 md:text-2xl"
      />

      <NoteEditorCanvas
        key={editorKey}
        initialContent={editorSeed}
        placeholder="Start writing your note..."
        onChange={(doc) => {
          setContent(serializeNoteContent(doc));
          setSaveStatus(savedId ? "unsaved" : "idle");
        }}
      />

      <div className="grid gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
        <Field label="Category">
          <div className="flex gap-2">
            <Select value={categoryId || NONE} onValueChange={(value) => setCategoryId(value === NONE ? "" : value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {noteCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={() => setCategoryOpen(true)}>
              New
            </Button>
          </div>
        </Field>
        <Field label="Tags">
          <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="insurance, home" />
        </Field>
        <Field label="Reminder date">
          <Input type="date" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} />
        </Field>
        <Field label="Template">
          <Select
            value={templateParam ?? NONE}
            onValueChange={(value) => {
              if (value === NONE) return;
              const next = NOTE_TEMPLATES.find((item) => item.id === value);
              if (!next) return;
              setTitle((current) => current || next.title);
              const body = serializeNoteContent(parseNoteContent(next.content));
              setContent(body);
              setEditorSeed(body);
              setEditorKey(`template-${next.id}`);
              if (savedId) setSaveStatus("unsaved");
              const match = noteCategories.find((item) => item.name === next.category);
              if (match) setCategoryId(match.id);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Optional template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {NOTE_TEMPLATES.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
          Pin note
          <Switch checked={isPinned} onCheckedChange={setIsPinned} />
        </label>
        <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
          Archive note
          <Switch checked={isArchived} onCheckedChange={setIsArchived} />
        </label>
        <Field label="Related to">
          <Select
            value={relatedType}
            onValueChange={(value) => {
              setRelatedType(value as NoteRelatedType | "none");
              setRelatedId("");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nothing</SelectItem>
              <SelectItem value="activity">Daily Check</SelectItem>
              <SelectItem value="provider">Provider</SelectItem>
              <SelectItem value="account">Account</SelectItem>
              <SelectItem value="transaction">Transaction</SelectItem>
              <SelectItem value="bill">Bill</SelectItem>
              <SelectItem value="goal">Goal</SelectItem>
              <SelectItem value="loan">Loan</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {relatedType !== "none" ? (
          <Field label="Record">
            <Select value={relatedId || NONE} onValueChange={(value) => setRelatedId(value === NONE ? "" : value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a record" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Choose</SelectItem>
                {relatedOptions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </div>

      <div className="space-y-3">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.rtf"
          onChange={(event) => {
            void onFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          <Paperclip /> Attach file or photo
        </Button>
        {existing?.attachments.length ? (
          <NoteAttachments
            attachments={existing.attachments}
            onRemove={(id) => removeNoteFile(existing.id, id)}
          />
        ) : (
          <p className="text-xs text-muted-foreground">Images, PDFs and documents stay private to your account.</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pb-10">
        <Button variant="ghost" asChild>
          <Link href={savedId ? `/notes/${savedId}` : "/notes"}>Cancel</Link>
        </Button>
        <Button onClick={() => void onSave()} disabled={saving}>
          Save note
        </Button>
      </div>

      <AlertDialog open={draftPrompt} onOpenChange={setDraftPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore unsaved draft?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an unsaved draft from before this page refreshed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (uid) clearNoteDraft(uid, draftId);
              }}
            >
              Discard
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDraft) {
                  setTitle(pendingDraft.title);
                  setContent(pendingDraft.content);
                  setEditorSeed(pendingDraft.content);
                  setEditorKey(`draft-${pendingDraft.savedAt}`);
                  if (savedId) setSaveStatus("unsaved");
                }
              }}
            >
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <Field label="Name">
            <Input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
          </Field>
          <Button
            onClick={async () => {
              if (!newCategory.trim()) return;
              const id = await saveNoteCategory({ name: newCategory.trim() });
              setCategoryId(id);
              setNewCategory("");
              setCategoryOpen(false);
            }}
          >
            Create
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
