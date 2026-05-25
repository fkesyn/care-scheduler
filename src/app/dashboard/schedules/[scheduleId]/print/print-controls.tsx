"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintControls() {
    return (
        <div className="print-controls mb-4 flex justify-end">
            <Button type="button" onClick={() => window.print()}>
                <PrinterIcon />
                Imprimir / Guardar PDF
            </Button>
        </div>
    );
}
