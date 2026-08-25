"use client";

import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";

function toPascal(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function DynamicIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ((Lucide as unknown as Record<string, LucideIcon>)[toPascal(name)] ??
    Lucide.Circle) as LucideIcon;
  return <Icon className={className} aria-hidden />;
}
