"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/finance/money";
import type { CurrencyCode } from "@/types";

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  fontSize: 12,
  boxShadow: "var(--shadow-card)",
};

export function IncomeExpenseChart({
  data,
  currency,
}: {
  data: { label: string; income: number; expenses: number; net: number }[];
  currency: CurrencyCode;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="0" vertical={false} stroke="var(--border)" strokeOpacity={0.8} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: "var(--muted-foreground)" }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={56}
            tick={{ fill: "var(--muted-foreground)" }}
            tickFormatter={(value: number) => formatMoney(value, currency, { compact: true })}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value ?? 0), currency)} />
          <Line type="monotone" dataKey="income" stroke="var(--income)" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="expenses" stroke="var(--expense)" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="net" stroke="var(--foreground)" strokeWidth={1.25} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashFlowChart({
  data,
  currency,
}: {
  data: { label: string; income: number; expenses: number; net: number }[];
  currency: CurrencyCode;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="0" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: "var(--muted-foreground)" }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={56}
            tick={{ fill: "var(--muted-foreground)" }}
            tickFormatter={(value: number) => formatMoney(value, currency, { compact: true })}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value ?? 0), currency)} />
          <Bar dataKey="income" fill="var(--income)" radius={[2, 2, 0, 0]} maxBarSize={18} />
          <Bar dataKey="expenses" fill="var(--expense)" radius={[2, 2, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SpendingDonut({
  data,
  currency,
}: {
  data: { name: string; value: number; color: string }[];
  currency: CurrencyCode;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="flex h-64 items-center gap-4">
      <div className="h-full min-w-0 flex-1">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={58} outerRadius={80} paddingAngle={1} stroke="none">
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value ?? 0), currency)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-36 shrink-0 space-y-2 text-xs">
        {data.slice(0, 6).map((item) => (
          <li key={item.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="truncate text-muted-foreground">{item.name}</span>
            </span>
            <span className="tabular-nums text-foreground">
              {total ? Math.round((item.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
