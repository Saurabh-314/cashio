"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERSON_RELATIONSHIPS } from "@/constants/people";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { getErrorMessage } from "@/lib/firebase/errors";
import { personSchema, type PersonValues } from "@/lib/validations";
import { uploadUserFile } from "@/services/storage";
import type { Person } from "@/types";

export function PersonForm({
  person,
  onDone,
}: {
  person?: Person;
  onDone?: (id: string) => void;
}) {
  const { user } = useAuth();
  const { savePerson } = useFinance();
  const [avatarUrl, setAvatarUrl] = useState(person?.avatarUrl ?? "");
  const [avatarPath, setAvatarPath] = useState(person?.avatarPath ?? "");
  const form = useForm<PersonValues>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      name: person?.name ?? "",
      phone: person?.phone ?? "",
      relationship: person?.relationship ?? "friend",
      notes: person?.notes ?? "",
    },
  });

  return (
    <form
      className="space-y-3"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          const id = await savePerson(
            {
              name: values.name.trim(),
              phone: values.phone?.trim() || undefined,
              relationship: values.relationship,
              notes: values.notes,
              avatarUrl: avatarUrl || undefined,
              avatarPath: avatarPath || undefined,
            },
            person?.id,
          );
          toast.success(person ? "Person updated" : "Person added");
          onDone?.(id);
        } catch (error) {
          toast.error(getErrorMessage(error));
        }
      })}
    >
      <Field label="Name" error={form.formState.errors.name?.message}>
        <Input {...form.register("name")} placeholder="Rahul" />
      </Field>
      <Field label="Phone">
        <Input {...form.register("phone")} inputMode="tel" placeholder="Optional" />
      </Field>
      <Field label="Relationship">
        <Select
          value={form.watch("relationship") ?? "friend"}
          onValueChange={(value) => form.setValue("relationship", value as PersonValues["relationship"])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERSON_RELATIONSHIPS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Photo">
        <Input
          type="file"
          accept="image/*"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file || !user) return;
            try {
              const uploaded = await uploadUserFile(user.uid, file, "people");
              setAvatarUrl(uploaded.url);
              setAvatarPath(uploaded.path);
              toast.success("Photo added");
            } catch (error) {
              toast.error(getErrorMessage(error));
            }
          }}
        />
      </Field>
      <Field label="Notes">
        <Textarea rows={3} {...form.register("notes")} placeholder="Optional" />
      </Field>
      <Button className="w-full" type="submit">
        {person ? "Save person" : "Add person"}
      </Button>
    </form>
  );
}
