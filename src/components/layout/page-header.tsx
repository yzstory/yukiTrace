import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-5 flex items-end justify-between gap-4 safe-top", className)}>
      <div>
        {subtitle && <p className="mb-0.5 text-footnote font-medium uppercase tracking-wide text-muted-foreground">{subtitle}</p>}
        <h1 className="text-large-title">{title}</h1>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  );
}
