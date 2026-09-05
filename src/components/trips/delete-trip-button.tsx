"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteTrip } from "@/app/(app)/trips/actions";

export function DeleteTripButton({ tripId, title }: { tripId: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="mt-8 h-11 w-full rounded-xl text-callout text-destructive hover:bg-destructive/10">
          <Trash2 className="size-4" /> 删除这段旅程
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>删除「{title}」？</DialogTitle>
          <DialogDescription>所有站点、条目、花费与照片记录都会一起删除，无法恢复。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={pending}
            className="h-11 rounded-xl"
            onClick={() => start(() => deleteTrip(tripId))}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : "确认删除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
