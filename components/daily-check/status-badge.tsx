import { Badge } from "@/components/ui/badge";
import type { ActivityCheckStatus, SettlementStatus } from "@/types";
import { cn } from "@/lib/utils";

const CHECK_STYLES: Record<ActivityCheckStatus, string> = {
  completed: "border-transparent bg-success/10 text-success",
  pending: "border-transparent bg-muted text-foreground",
  skipped: "border-transparent bg-muted text-muted-foreground",
  cancelled: "border-transparent bg-destructive/10 text-destructive",
  not_applicable: "border-transparent bg-secondary text-muted-foreground",
  missed: "border-transparent bg-destructive/10 text-destructive",
};

const CHECK_LABELS: Record<ActivityCheckStatus, string> = {
  completed: "Completed",
  pending: "Pending",
  skipped: "Skipped",
  cancelled: "Cancelled",
  not_applicable: "Not applicable",
  missed: "Missed",
};

const PAY_STYLES: Record<SettlementStatus, string> = {
  paid: "border-transparent bg-success/10 text-success",
  unpaid: "border-transparent bg-muted text-foreground",
  partially_paid: "border-transparent bg-accent text-accent-foreground",
  overdue: "border-transparent bg-destructive/10 text-destructive",
};

export function CheckStatusBadge({ status, className }: { status: ActivityCheckStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(CHECK_STYLES[status], className)}>
      {CHECK_LABELS[status]}
    </Badge>
  );
}

export function SettlementStatusBadge({ status }: { status: SettlementStatus }) {
  return (
    <Badge variant="outline" className={PAY_STYLES[status]}>
      {status.replace("_", " ")}
    </Badge>
  );
}

export { CHECK_LABELS };
