import { Badge } from "@/components/ui/badge";
import { UDHAR_STATUS_LABELS } from "@/constants/people";
import { cn } from "@/lib/utils";
import type { UdharStatus } from "@/types";

const STYLES: Record<UdharStatus, string> = {
  active: "border-transparent bg-muted text-foreground",
  partially_paid: "border-transparent bg-accent text-accent-foreground",
  overdue: "border-transparent bg-destructive/10 text-destructive",
  settled: "border-transparent bg-success/10 text-success",
  cancelled: "border-transparent bg-muted text-muted-foreground",
};

export function UdharStatusBadge({ status, className }: { status: UdharStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STYLES[status], className)}>
      {UDHAR_STATUS_LABELS[status]}
    </Badge>
  );
}
