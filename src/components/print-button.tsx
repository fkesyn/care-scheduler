"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type PrintButtonProps = {
    label?: string;
};

export function PrintButton({ label = "Imprimir" }: PrintButtonProps) {
    return (
        <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => window.print()}
        >
            <PrinterIcon />
            {label}
        </Button>
    );
}
