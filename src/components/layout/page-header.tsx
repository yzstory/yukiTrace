import { cn } from "@/lib/utils";

/**
 * 页面大标题：英文眉标用展示衬线斜体，标题用重字重。
 * subtitle 传英文（如 "Trace"、"All trips"）效果最好；传中文也可。
 */
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
    <header className={cn("mb-6 flex items-end justify-between gap-4 safe-top", className)}>
      <div>
        {subtitle && <p className="eyebrow mb-1">{subtitle}</p>}
        <h1 className="text-large-title">{title}</h1>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  );
}
