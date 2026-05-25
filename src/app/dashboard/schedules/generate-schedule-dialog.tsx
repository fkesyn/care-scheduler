"use client";

import { WandSparklesIcon } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    generateMonthlySchedule,
    type GenerateMonthlyScheduleState,
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

type GenerateScheduleDialogProps = {
    scheduleId: string;
};

const initialState: GenerateMonthlyScheduleState = {
    status: "idle",
};

function GenerateButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? "A gerar..." : "Sim, gerar rascunho"}
        </Button>
    );
}

export function GenerateScheduleDialog({ scheduleId }: GenerateScheduleDialogProps) {
    const [state, formAction] = useActionState(
        generateMonthlySchedule,
        initialState
    );
    const { closeDialog, open, setOpen, visibleState } = useActionDialog(
        state,
        initialState
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <WandSparklesIcon />
                    Gerar rascunho
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Gerar rascunho</DialogTitle>
                    <DialogDescription>
                        Isto vai substituir os turnos atuais deste horário. Queres
                        continuar?
                    </DialogDescription>
                </DialogHeader>

                {visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p
                            className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                            role="status"
                        >
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

                        {visibleState.status === "error" && visibleState.message ? (
                            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                {visibleState.message}
                            </p>
                        ) : null}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog}>
                                Cancelar
                            </Button>
                            <GenerateButton />
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
