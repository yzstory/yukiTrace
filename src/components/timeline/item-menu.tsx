"use client";

import { useTransition } from "react";
import { MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ItemMenu({ onDelete, onEdit, label }: { onDelete: () => Promise<void>; onEdit?: () => void; label: string }) {
  const [pending, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full p-1.5 text-label-tertiary hover:bg-fill active:bg-fill"
        aria-label={`${label}操作`}
        disabled={pending}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="size-4" /> 编辑
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          onClick={() =>
            start(async () => {
              await onDelete();
              toast.success(`已删除${label}`);
            })
          }
        >
          <Trash2 className="size-4" /> 删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
