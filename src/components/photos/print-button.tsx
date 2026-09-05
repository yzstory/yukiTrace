"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="h-10 rounded-xl">
      <Printer className="size-4" /> 导出 PDF
    </Button>
  );
}
