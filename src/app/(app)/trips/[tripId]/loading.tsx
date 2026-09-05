import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Skeleton className="h-6 w-24 rounded-lg" />
      <Skeleton className="aspect-[16/9] w-full rounded-3xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
