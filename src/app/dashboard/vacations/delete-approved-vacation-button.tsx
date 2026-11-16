"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteApprovedVacationRequest } from "@/app/dashboard/vacations/actions";
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
import { Spinner } from "@/components/ui/spinner";

function DeleteButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? <Spinner /> : <Trash2Icon />}
            {pending ? "A apagar..." : "Apagar férias"}
        </Button>
    );
}

export function DeleteApprovedVacationButton({
    employeeName,
    requestId,
}: {
    employeeName: string;
    requestId: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button type="button" size="sm" variant="destructive">
                    <Trash2Icon /> Apagar
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Apagar férias aprovadas?</DialogTitle>
                    <DialogDescription>
                        Todos os dias deste pedido de {employeeName} serão removidos e
                        devolvidos ao saldo disponível. Esta ação não pode ser anulada.
                    </DialogDescription>
                </DialogHeader>
                <form action={deleteApprovedVacationRequest}>
                    <input type="hidden" name="request_id" value={requestId} />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <DeleteButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
