import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="-ml-2 mb-2 inline-flex items-center gap-0.5 rounded-lg py-1 pl-1 pr-2 text-callout text-primary active:bg-primary/10">
      <ChevronLeft className="size-5" strokeWidth={2.4} />
      <span className="max-w-[60vw] truncate">{label}</span>
    </Link>
  );
}
