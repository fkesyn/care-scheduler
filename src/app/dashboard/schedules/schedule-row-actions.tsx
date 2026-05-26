"use client";

import { EyeIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    deleteMonthlySchedule,
    type DeleteScheduleState,
} from "@/app/dashboard/schedules/actions";
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
import { useActionDialog } from "@/lib/use-action-dialog";
 

type ScheduleListItem = {
    id: string;
};

type ScheduleRowActionsProps = {
    schedule: ScheduleListItem;
};

const deleteInitialState: DeleteScheduleState = {
    status: "idle",
};

function DeleteButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "A apagar..." : "Apagar horário"}
        </Button>
    );
}

export function ScheduleRowActions({ schedule }: ScheduleRowActionsProps) {
    const [deleteState, deleteAction] = useActionState(
        deleteMonthlySchedule,
        deleteInitialState
    );
    const deleteDialog = useActionDialog(deleteState, deleteInitialState);

    return (
        <div className="flex justify-end gap-2">
            <Button asChild size="icon-sm" variant="ghost" aria-label="Abrir calendário">
                <Link href={`/dashboard/schedules/${schedule.id}`}>
                    <EyeIcon />
                </Link>
            </Button>

            <Dialog open={deleteDialog.open} onOpenChange={deleteDialog.setOpen}>
                <DialogTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="Apagar horário">
                        <Trash2Icon />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Apagar horário mensal</DialogTitle>
                        <DialogDescription>
                            Esta ação apaga o horário e todas as entradas desse mês.
                        </DialogDescription>
                    </DialogHeader>

                    {deleteDialog.visibleState.status === "success" ? (
                        <div className="grid gap-4">
                            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                                {deleteDialog.visibleState.message}
                            </p>
                            <DialogFooter>
                                <Button type="button" onClick={deleteDialog.closeDialog}>
                                    Fechar
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <form action={deleteAction} className="grid gap-4">
                            <input type="hidden" name="id" value={schedule.id} />
                            <p className="text-sm text-muted-foreground">
                                Vais apagar este horário mensal. As células já preenchidas
                                e os pedidos/restrições deste mês também serão apagados.
                            </p>

                            {deleteDialog.visibleState.message ? (
                                <p className="text-sm text-destructive">
                                    {deleteDialog.visibleState.message}
                                </p>
                            ) : null}

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={deleteDialog.closeDialog}
                                >
                                    Cancelar
                                </Button>
                                <DeleteButton />
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
