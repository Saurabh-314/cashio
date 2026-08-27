import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, setDoc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { col, nowIso, stripUndefined } from "@/services/helpers";
import { AI_CONFIG } from "@/lib/ai/config";
import type { AIActionRecord, AIActionView, AIAuditLog, AIConversation, AIMessage } from "@/lib/ai/types";

function actionDoc(uid: string, actionId: string) {
  return doc(getDb(), "users", uid, "aiActions", actionId);
}

function messageCollection(uid: string, conversationId: string) {
  return collection(getDb(), "users", uid, "aiConversations", conversationId, "messages");
}

export async function createConversation(uid: string, title: string): Promise<AIConversation> {
  const stamp = nowIso();
  const ref = await addDoc(
    col(uid, "aiConversations"),
    stripUndefined({
      userId: uid,
      title: title.slice(0, 80),
      createdAt: stamp,
      updatedAt: stamp,
    }),
  );
  return { id: ref.id, userId: uid, title: title.slice(0, 80), createdAt: stamp, updatedAt: stamp };
}

export async function getConversation(uid: string, conversationId: string): Promise<AIConversation | null> {
  const snap = await getDoc(doc(getDb(), "users", uid, "aiConversations", conversationId));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (data.userId && data.userId !== uid) return null;
  return { id: snap.id, userId: uid, title: data.title, createdAt: data.createdAt, updatedAt: data.updatedAt };
}

export async function addMessage(
  uid: string,
  conversationId: string,
  input: { role: "user" | "assistant"; content: string; actions?: AIActionView[] },
): Promise<AIMessage> {
  const stamp = nowIso();
  const ref = await addDoc(
    messageCollection(uid, conversationId),
    stripUndefined({
      conversationId,
      role: input.role,
      content: input.content,
      actions: input.actions,
      createdAt: stamp,
    }),
  );
  await updateDoc(doc(getDb(), "users", uid, "aiConversations", conversationId), { updatedAt: stamp });
  return {
    id: ref.id,
    conversationId,
    role: input.role,
    content: input.content,
    actions: input.actions,
    createdAt: stamp,
  };
}

export async function listRecentMessages(uid: string, conversationId: string): Promise<AIMessage[]> {
  const snap = await getDocs(
    query(messageCollection(uid, conversationId), orderBy("createdAt", "desc"), limit(AI_CONFIG.maxHistoryMessages)),
  );
  return snap.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        conversationId,
        role: data.role as "user" | "assistant",
        content: String(data.content ?? ""),
        actions: Array.isArray(data.actions) ? (data.actions as AIActionView[]) : undefined,
        createdAt: String(data.createdAt ?? ""),
      };
    })
    .reverse();
}

export async function createAction(uid: string, record: Omit<AIActionRecord, "id">): Promise<AIActionRecord> {
  const id = crypto.randomUUID();
  const payload: AIActionRecord = { ...record, id, userId: uid };
  await setDoc(actionDoc(uid, id), stripUndefined({ ...payload }));
  return payload;
}

export async function saveAction(uid: string, record: AIActionRecord): Promise<void> {
  await setDoc(actionDoc(uid, record.id), stripUndefined({ ...record, userId: uid }), { merge: true });
}

export async function getAction(uid: string, actionId: string): Promise<AIActionRecord | null> {
  const snap = await getDoc(actionDoc(uid, actionId));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<AIActionRecord, "id">;
  if (data.userId !== uid) return null;
  return { id: snap.id, ...data };
}

export async function claimAction(uid: string, actionId: string): Promise<AIActionRecord> {
  return runTransaction(getDb(), async (tx) => {
    const ref = actionDoc(uid, actionId);
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error("Action was not found.");
    }
    const data = { id: snap.id, ...(snap.data() as Omit<AIActionRecord, "id">) };
    if (data.userId !== uid) {
      throw new Error("Action was not found.");
    }
    if (data.status === "executed") return data;
    if (data.status !== "pending") {
      throw new Error("This action cannot be confirmed.");
    }
    const next: AIActionRecord = {
      ...data,
      status: "confirmed",
      updatedAt: nowIso(),
    };
    tx.set(ref, stripUndefined({ ...next }), { merge: true });
    return next;
  });
}

export async function writeAudit(uid: string, entry: Omit<AIAuditLog, "id">) {
  await addDoc(col(uid, "aiAuditLog"), stripUndefined({ ...entry, userId: uid }));
}
