"use client";

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

export function EditDrawer({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="max-h-[92dvh] rounded-t-3xl bg-background">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-headline">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">编辑</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">{open && children}</div>
      </DrawerContent>
    </Drawer>
  );
}
