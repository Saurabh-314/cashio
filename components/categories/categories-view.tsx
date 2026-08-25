"use client";

import { useMemo, useState } from "react";
import { Tags } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { ACCOUNT_COLORS } from "@/constants/categories";
import { countTransactionsForCategory } from "@/services/transactions";
import { getErrorMessage } from "@/lib/firebase/errors";
import type { Category, CategoryKind } from "@/types";

export function CategoriesView() {
  const { user } = useAuth();
  const { categories, saveCategory, removeCategory } = useFinance();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);
  const [icon, setIcon] = useState("tag");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const visible = useMemo(
    () => categories.filter((item) => item.kind === kind).sort((a, b) => a.name.localeCompare(b.name)),
    [categories, kind],
  );
  const parents = visible.filter((item) => !item.parentId);

  function startCreate() {
    setEditing(null);
    setName("");
    setParentId("none");
    setColor(ACCOUNT_COLORS[0]);
    setIcon("tag");
    setOpen(true);
  }

  return (
    <div>
      <PageHeader title="Categories" description="Organize income and expenses">
        <Button onClick={startCreate}>Add category</Button>
      </PageHeader>
      <Tabs value={kind} onValueChange={(value) => setKind(value as CategoryKind)}>
        <TabsList className="mb-4">
          <TabsTrigger value="expense">Expenses</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
        </TabsList>
        <TabsContent value={kind}>
          {visible.length ? (
            <div className="space-y-3">
              {parents.map((parent) => {
                const children = visible.filter((item) => item.parentId === parent.id);
                return (
                  <Card key={parent.id} className="rounded-lg">
                    <CardContent className="space-y-2">
                      <CategoryRow
                        category={parent}
                        onEdit={() => {
                          setEditing(parent);
                          setName(parent.name);
                          setParentId("none");
                          setColor(parent.color);
                          setIcon(parent.icon);
                          setOpen(true);
                        }}
                        onDelete={() => setDeleteId(parent.id)}
                      />
                      {children.map((child) => (
                        <div key={child.id} className="pl-8">
                          <CategoryRow
                            category={child}
                            onEdit={() => {
                              setEditing(child);
                              setName(child.name);
                              setParentId(child.parentId ?? "none");
                              setColor(child.color);
                              setIcon(child.icon);
                              setOpen(true);
                            }}
                            onDelete={() => setDeleteId(child.id)}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Tags}
              title="No categories"
              description="Add a category to classify your transactions."
              actionLabel="Add category"
              onAction={startCreate}
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Parent">
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {parents
                    .filter((item) => item.id !== editing?.id)
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Icon">
              <Input value={icon} onChange={(event) => setIcon(event.target.value)} placeholder="utensils" />
            </Field>
            <div className="flex gap-2">
              {ACCOUNT_COLORS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="size-7 rounded-full"
                  style={{ background: item, outline: color === item ? `2px solid ${item}` : undefined }}
                  onClick={() => setColor(item)}
                />
              ))}
            </div>
            <Button
              className="w-full"
              onClick={async () => {
                try {
                  await saveCategory(
                    {
                      name,
                      kind,
                      parentId: parentId === "none" ? null : parentId,
                      icon,
                      color,
                    },
                    editing?.id,
                  );
                  toast.success("Category saved");
                  setOpen(false);
                } catch (error) {
                  toast.error(getErrorMessage(error));
                }
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(openState) => !openState && setDeleteId(null)}
        title="Delete category?"
        description="Categories that are already used cannot be deleted."
        onConfirm={async () => {
          if (!deleteId || !user) return;
          const used = await countTransactionsForCategory(user.uid, deleteId);
          if (used > 0) {
            toast.error("This category is used by existing transactions.");
            setDeleteId(null);
            return;
          }
          await removeCategory(deleteId);
          setDeleteId(null);
          toast.success("Deleted");
        }}
      />
    </div>
  );
}

function CategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span
          className="flex size-8 items-center justify-center rounded-xl"
          style={{ background: `${category.color}22`, color: category.color }}
        >
          <DynamicIcon name={category.icon} className="size-4" />
        </span>
        <span className="text-sm font-medium">{category.name}</span>
      </div>
      <div>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
