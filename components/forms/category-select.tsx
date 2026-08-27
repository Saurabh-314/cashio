"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

export function CategorySelect({
  categories,
  value,
  onChange,
  placeholder = "Select category",
  allowAll = false,
  allValue = "all",
  allLabel = "All categories",
}: {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowAll?: boolean;
  allValue?: string;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );
  const selected = sorted.find((item) => item.id === value);
  const isAll = allowAll && value === allValue;

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{selected.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{selected.kind}</span>
            </span>
          ) : isAll ? (
            <span className="truncate">{allLabel}</span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) gap-0 p-0">
        <Command>
          <CommandInput placeholder="Search category..." />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>
            <CommandGroup>
              {allowAll ? (
                <CommandItem
                  value={`${allLabel} ${allValue}`}
                  onSelect={() => {
                    onChange(allValue);
                    setOpen(false);
                  }}
                  className="[&>svg:last-child]:hidden"
                >
                  {allLabel}
                  <Check className={cn("ml-auto", isAll ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ) : null}
              {sorted.map((category) => {
                const isSelected = value === category.id;
                return (
                  <CommandItem
                    key={category.id}
                    value={`${category.name} ${category.kind} ${category.id}`}
                    onSelect={() => {
                      onChange(category.id);
                      setOpen(false);
                    }}
                    className="[&>svg:last-child]:hidden"
                  >
                    <span className="truncate">{category.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{category.kind}</span>
                    <Check className={cn("ml-auto", isSelected ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
