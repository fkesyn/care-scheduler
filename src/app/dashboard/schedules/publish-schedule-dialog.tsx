"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    publishMonthlySchedule,
    revertMonthlyScheduleToDraft,
    type UpdateScheduleStatusState,
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

type PublishScheduleDialogProps = {
    scheduleId: string;
    status: string;
};

const initialState: UpdateScheduleStatusState = {
    status: "idle",
};

function ConfirmButton({ label }: { label: string }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? "A guardar..." : label}
        </Button>
    );
}

export function PublishScheduleDialog({
    scheduleId,
    status,
}: PublishScheduleDialogProps) {
    const isDraft = status === "draft";
    const isPublished = status === "published";

    const [publishState, publishAction] = useActionState(
        publishMonthlySchedule,
        initialState
    );
    const [revertState, revertAction] = useActionState(
        revertMonthlyScheduleToDraft,
        initialState
    );
    const publishDialog = useActionDialog(publishState, initialState);
    const revertDialog = useActionDialog(revertState, initialState);

    if (!isDraft && !isPublished) {
        return null;
    }

    const dialog = isDraft ? publishDialog : revertDialog;
    const action = isDraft ? publishAction : revertAction;
    const title = isDraft ? "Publicar horário" : "Voltar a rascunho";
    const triggerLabel = isDraft ? "Publicar horário" : "Voltar a rascunho";
    const confirmLabel = isDraft ? "Sim, publicar" : "Sim, voltar a rascunho";
    const description = isDraft
        ? "Depois de publicado, o horário ficará marcado como final. Ainda poderás voltar a rascunho se necessário."
        : "O horário voltará ao estado de rascunho. Manténs todos os turnos e podes continuar a editar normalmente.";

    return (
        <Dialog open={dialog.open} onOpenChange={dialog.setOpen}>
            <DialogTrigger asChild>
                <Button variant={isDraft ? "default" : "outline"}>{triggerLabel}</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                {dialog.visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                            {dialog.visibleState.message}
                        </p>
                        <DialogFooter>
                            <Button type="button" onClick={dialog.closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form action={action} className="grid gap-4">
                        <input type="hidden" name="schedule_id" value={scheduleId} />

                        {dialog.visibleState.message ? (
                            <p className="text-sm text-destructive">
                                {dialog.visibleState.message}
                            </p>
                        ) : null}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={dialog.closeDialog}
                            >
                                Cancelar
                            </Button>
                            <ConfirmButton label={confirmLabel} />
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
