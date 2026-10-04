"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/hooks/use-finance";
import { billStatus } from "@/lib/finance/calculations";
import { cn } from "@/lib/utils";

export function CalendarView() {
  const { bills, loans, recurring, transactions, creditStatements, creditEmiBills } = useFinance();
  const [cursor, setCursor] = useState(new Date());
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, { label: string; tone: "income" | "expense" | "neutral" }[]>();
    const push = (date: string, label: string, tone: "income" | "expense" | "neutral") => {
      const list = map.get(date) ?? [];
      list.push({ label, tone });
      map.set(date, list);
    };
    for (const bill of bills) {
      if (billStatus(bill) !== "paid") push(bill.dueDate, bill.name, "expense");
    }
    for (const loan of loans) {
      const due = `${format(cursor, "yyyy-MM")}-${String(loan.paymentDueDay).padStart(2, "0")}`;
      push(due, `${loan.name} EMI`, "expense");
    }
    for (const item of recurring) {
      push(item.nextRunDate, item.description, item.type === "income" ? "income" : "expense");
    }
    for (const tx of transactions) {
      if (tx.type === "income" && !tx.udharId) push(tx.date, tx.description, "income");
    }
    for (const statement of creditStatements) {
      if (statement.remaining <= 0) continue;
      push(statement.dueDate, statement.name, "expense");
    }
    for (const bill of creditEmiBills) {
      if (bill.remaining <= 0) continue;
      push(bill.dueDate, bill.name, "expense");
    }
    return map;
  }, [bills, creditEmiBills, creditStatements, cursor, loans, recurring, transactions]);

  return (
    <div>
      <PageHeader title="Calendar" description="Bills, EMIs, income, and due dates">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCursor((value) => addMonths(value, -1))}>
            Previous
          </Button>
          <Button variant="outline" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button variant="outline" onClick={() => setCursor((value) => addMonths(value, 1))}>
            Next
          </Button>
        </div>
      </PageHeader>
      <p className="mb-4 text-lg font-medium">{format(cursor, "MMMM yyyy")}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const events = eventsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                "min-h-24 rounded-2xl border bg-card p-1.5 text-left",
                !isSameMonth(day, cursor) && "opacity-40",
              )}
            >
              <p className="text-xs font-medium">{format(day, "d")}</p>
              <div className="mt-1 space-y-1">
                {events.slice(0, 3).map((event, index) => (
                  <p
                    key={index}
                    className={cn(
                      "truncate rounded-md px-1 py-0.5 text-[10px]",
                      event.tone === "income" && "bg-income/10 text-income",
                      event.tone === "expense" && "bg-expense/10 text-expense",
                    )}
                  >
                    {event.label}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
