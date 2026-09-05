"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({ label, name, className, ...rest }: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={name} className="text-footnote font-medium text-muted-foreground">
        {label}
      </Label>
      <Input id={name} name={name} className="h-11 rounded-xl bg-fill-secondary text-body" {...rest} />
    </div>
  );
}

export function SelectField({
  label,
  name,
  options,
  className,
  ...rest
}: { label: string; name: string; options: Array<{ value: string; label: string }> } & React.ComponentProps<"select">) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={name} className="text-footnote font-medium text-muted-foreground">
        {label}
      </Label>
      <select
        id={name}
        name={name}
        className="h-11 rounded-xl border border-input bg-fill-secondary px-3 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="rounded-xl bg-destructive/10 px-3 py-2 text-footnote text-destructive">{children}</p>;
}

/** iOS 风格分段选择 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex rounded-xl bg-fill p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-lg py-1.5 text-subhead font-medium transition-all",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
