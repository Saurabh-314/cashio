"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { CURRENCIES, DATE_FORMAT_LABELS } from "@/constants/currencies";
import { DEFAULT_WIDGETS, DEFAULT_NOTIFICATIONS } from "@/services/users";
import { downloadTextFile, parseCsv, transactionsToCsv } from "@/lib/csv";
import { getErrorMessage } from "@/lib/firebase/errors";
import { todayISO } from "@/lib/utils/dates";
import type { CurrencyCode, DateFormat, DashboardWidgets } from "@/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { seedDemoData } from "@/services/demo-seed";

export function SettingsView() {
  const { user, profile, changePassword: updateLoginPassword, deleteAccount } = useAuth();
  const { accounts, categories, transactions, saveTransaction, updateProfile } = useFinance();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof parseCsv>>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function saveProfile() {
    await updateProfile({ displayName: name });
    toast.success("Profile updated");
  }

  async function changePassword() {
    if (!user?.email) return;
    try {
      await updateLoginPassword(password, newPassword);
      toast.success("Password updated");
      setPassword("");
      setNewPassword("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Profile, preferences, and data" />

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:max-w-md">
          <Field label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={profile?.email ?? ""} disabled />
          </Field>
          <Button onClick={saveProfile}>Save profile</Button>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Currency">
            <Select
              value={profile?.currency ?? "INR"}
              onValueChange={(value) => updateProfile({ currency: value as CurrencyCode })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(CURRENCIES).map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.symbol} {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date format">
            <Select
              value={profile?.dateFormat ?? "dd MMM yyyy"}
              onValueChange={(value) => updateProfile({ dateFormat: value as DateFormat })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DATE_FORMAT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Month starts on">
            <Input
              type="number"
              min={1}
              max={28}
              value={profile?.monthStartDay ?? 1}
              onChange={(event) => updateProfile({ monthStartDay: Number(event.target.value) })}
            />
          </Field>
          <Field label="Default account">
            <Select
              value={profile?.defaultAccountId ?? "none"}
              onValueChange={(value) => updateProfile({ defaultAccountId: value === "none" ? null : value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Theme">
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Dashboard widgets</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {Object.entries(profile?.widgets ?? DEFAULT_WIDGETS).map(([key, enabled]) => (
            <label key={key} className="flex items-center justify-between rounded-2xl border px-3 py-2 text-sm capitalize">
              {key.replace(/([A-Z])/g, " $1")}
              <Switch
                checked={enabled}
                onCheckedChange={(checked) =>
                  updateProfile({
                    widgets: { ...(profile?.widgets ?? DEFAULT_WIDGETS), [key]: checked } as DashboardWidgets,
                  })
                }
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {Object.entries(profile?.notifications ?? DEFAULT_NOTIFICATIONS).map(([key, enabled]) => (
            <label key={key} className="flex items-center justify-between rounded-2xl border px-3 py-2 text-sm capitalize">
              {key} reminders
              <Switch
                checked={enabled}
                onCheckedChange={(checked) =>
                  updateProfile({
                    notifications: {
                      bills: profile?.notifications.bills ?? true,
                      budgets: profile?.notifications.budgets ?? true,
                      goals: profile?.notifications.goals ?? true,
                      recurring: profile?.notifications.recurring ?? true,
                      dailyCheck: profile?.notifications.dailyCheck ?? true,
                      settlements: profile?.notifications.settlements ?? true,
                      [key]: checked,
                    },
                  })
                }
              />
            </label>
          ))}
          <Field label="Daily Check reminder time" className="sm:col-span-2">
            <Input
              type="time"
              value={profile?.reminderTime ?? "08:00"}
              onChange={(event) => updateProfile({ reminderTime: event.target.value })}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-md gap-3">
          <Field label="Current password">
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Field label="New password">
            <Input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </Field>
          <Button variant="outline" onClick={changePassword}>
            Change password
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete account
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                downloadTextFile(
                  `cashio-transactions-${todayISO()}.csv`,
                  transactionsToCsv(transactions, categories, accounts),
                )
              }
            >
              Export transactions
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadTextFile(
                  `cashio-backup-${todayISO()}.json`,
                  JSON.stringify({ accounts, categories, transactions }, null, 2),
                  "application/json",
                )
              }
            >
              Export financial data
            </Button>
          </div>
          <Field label="Import CSV">
            <Input
              type="file"
              accept=".csv"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                setPreview(parseCsv(text));
              }}
            />
          </Field>
          {preview.length ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {preview.filter((row) => row.valid).length} valid of {preview.length} rows
              </p>
              <div className="max-h-48 overflow-auto rounded-2xl border text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted text-left">
                      <th className="p-2">Date</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Amount</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 20).map((row, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">{row.date}</td>
                        <td className="p-2">{row.description}</td>
                        <td className="p-2">{row.amount}</td>
                        <td className="p-2">{row.type}</td>
                        <td className="p-2">{row.valid ? "OK" : row.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                onClick={async () => {
                  const accountId = profile?.defaultAccountId ?? accounts[0]?.id;
                  if (!accountId) {
                    toast.error("Create an account before importing");
                    return;
                  }
                  for (const row of preview.filter((item) => item.valid)) {
                    const category = categories.find(
                      (item) => item.name.toLowerCase() === row.category?.toLowerCase(),
                    );
                    const account =
                      accounts.find((item) => item.name.toLowerCase() === row.account?.toLowerCase()) ??
                      accounts.find((item) => item.id === accountId);
                    await saveTransaction({
                      type: row.type,
                      amount: Math.abs(row.amount),
                      date: row.date,
                      description: row.description,
                      categoryId: category?.id ?? null,
                      accountId: row.type === "transfer" ? null : account?.id ?? null,
                      fromAccountId: null,
                      toAccountId: null,
                      tags: ["import"],
                      isCreditCardPayment: false,
                      status: "cleared",
                    });
                  }
                  toast.success("Import complete");
                  setPreview([]);
                }}
              >
                Import valid rows
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {process.env.NODE_ENV === "development" ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Development</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={async () => {
                if (!user) return;
                await seedDemoData(user.uid, accounts, categories);
                toast.success("Demo data added");
              }}
            >
              Seed demo data
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your account?"
        description="Enter your current password above, then confirm. This removes your login from the users table."
        confirmLabel="Delete account"
        onConfirm={async () => {
          try {
            await deleteAccount(password);
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        }}
      />
    </div>
  );
}
