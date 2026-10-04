"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AccountForm } from "@/components/forms/account-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useFinance } from "@/hooks/use-finance";
import { accountLast4 } from "@/lib/finance/account-label";
import { availableCredit, creditUtilization } from "@/lib/finance/calculations";
import { countTransactionsForAccount } from "@/services/transactions";
import { getErrorMessage } from "@/lib/firebase/errors";
import type { Account } from "@/types";

export function AccountsView() {
  const { user, profile } = useAuth();
  const { accounts, archiveAccount, removeAccount } = useFinance();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>();
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null);
  const currency = profile?.currency ?? "INR";
  const visible = accounts.filter((item) => !item.archived);

  return (
    <div>
      <PageHeader title="Accounts" description="Banks, cash, and credit cards">
        <Button
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
        >
          <Plus /> Add account
        </Button>
      </PageHeader>
      {visible.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((account) => {
            const credit = account.kind === "credit";
            const last4 = accountLast4(account);
            return (
              <Card key={account.id} className="rounded-lg shadow-sm">
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/accounts/${account.id}`} className="min-w-0">
                      <p className="font-medium">{account.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {account.bankName ?? (account.kind === "credit" ? "Credit card" : "Account")}
                        {last4 ? ` · •••• ${last4}` : ""}
                      </p>
                    </Link>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(account);
                        setOpen(true);
                      }}
                    >
                      <Pencil />
                    </Button>
                  </div>
                  {credit ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Outstanding</span>
                        <CurrencyDisplay amount={account.outstanding} currency={currency} />
                      </div>
                      <Progress value={creditUtilization(account)} />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Available {availableCredit(account).toLocaleString("en-IN")}</span>
                        <span>{creditUtilization(account).toFixed(0)}% used</span>
                      </div>
                    </>
                  ) : (
                    <CurrencyDisplay
                      amount={account.currentBalance}
                      currency={currency}
                      className="text-[1.75rem] font-semibold"
                    />
                  )}
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{account.kind}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setPendingDelete(account)}>
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Wallet}
          title="Add your first bank account"
          description="Track savings, cash, and cards in one place."
          actionLabel="Add account"
          onAction={() => setOpen(true)}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit account" : "New account"}</DialogTitle>
          </DialogHeader>
          <AccountForm
            initial={editing}
            onDone={() => {
              setOpen(false);
              toast.success(editing ? "Account updated" : "Account created");
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(openState) => !openState && setPendingDelete(null)}
        title={`Remove ${pendingDelete?.name}?`}
        description="If this account has transactions, archive it instead of deleting so history stays intact."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!pendingDelete || !user) return;
          try {
            const count = await countTransactionsForAccount(user.uid, pendingDelete.id);
            if (count > 0) {
              await archiveAccount(pendingDelete.id);
              toast.success("Account archived because it has transactions");
            } else {
              await removeAccount(pendingDelete.id);
              toast.success("Account deleted");
            }
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
