"use client";

import { EraserIcon } from "lucide-react";
import { useActionState } from "react";

import {
    clearScheduleGrid,
    type ClearScheduleGridState,
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

const initialState: ClearScheduleGridState = {
    status: "idle",
};

type ClearScheduleGridDialogProps = {
    entriesCount: number;
    scheduleId: string;
};

export function ClearScheduleGridDialog({
    entriesCount,
    scheduleId,
}: ClearScheduleGridDialogProps) {
    const [state, formAction] = useActionState(clearScheduleGrid, initialState);
    const { closeDialog, open, setOpen, visibleState } = useActionDialog(
        state,
        initialState
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" disabled={entriesCount === 0}>
                    <EraserIcon />
                    Limpar horário
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Limpar horário</DialogTitle>
                    <DialogDescription>
                        Esta ação remove todos os turnos da grelha deste mês. Os
                        pedidos/restrições ficam guardados.
                    </DialogDescription>
                </DialogHeader>

                {visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                            {visibleState.message}
                        </p>
                        <DialogFooter>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form action={formAction} className="grid gap-4">
                        <input type="hidden" name="schedule_id" value={scheduleId} />
                        <p className="text-sm text-muted-foreground">
                            Vais limpar{" "}
                            <strong>
                                {entriesCount}{" "}
                                {entriesCount === 1 ? "célula" : "células"}
                            </strong>{" "}
                            da grelha.
                        </p>

                        {visibleState.status === "error" && visibleState.message ? (
                            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                {visibleState.message}
                            </p>
                        ) : null}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog}>
                                Cancelar
                            </Button>
                            <Button type="submit" variant="destructive">
                                Confirmar limpeza
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
