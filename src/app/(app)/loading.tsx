import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-5 pt-2">
      <Skeleton className="h-10 w-40 rounded-xl" />
      <Skeleton className="aspect-[16/10] w-full rounded-3xl" />
      <Skeleton className="aspect-[16/10] w-full rounded-3xl" />
    </div>
  );
}
