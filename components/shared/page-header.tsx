import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky top-16 z-20 -mx-4 mb-8 flex flex-col gap-4 bg-background/90 px-4 py-4 backdrop-blur-md sm:flex-row sm:items-start sm:justify-between lg:-mx-10 lg:px-10",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-[1.65rem] leading-tight font-medium tracking-tight lg:text-[2rem]">
          {title}
        </h1>
        {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2 sm:pt-1">{children}</div> : null}
    </div>
  );
}
