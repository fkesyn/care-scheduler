"use client";

import { Trash2Icon } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    deleteMonthlyAppointments,
    type DeleteMonthlyAppointmentsState,
} from "@/app/dashboard/calendar/actions";
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
import { cn } from "@/lib/utils";

type ClearMonthAppointmentsDialogProps = {
    selectedDate: string;
};

const initialState: DeleteMonthlyAppointmentsState = {
    status: "idle",
};

function formatMonthLabel(monthValue: string) {
    const [year, month] = monthValue.split("-").map(Number);
    const date = new Date(year, month - 1, 1);

    return new Intl.DateTimeFormat("pt-PT", {
        month: "long",
        year: "numeric",
    }).format(date);
}

function DeleteButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "A limpar..." : "Sim, limpar mês"}
        </Button>
    );
}

export function ClearMonthAppointmentsDialog({
    selectedDate,
}: ClearMonthAppointmentsDialogProps) {
    const monthValue = selectedDate.slice(0, 7);
    const [state, formAction] = useActionState(
        deleteMonthlyAppointments,
        initialState
    );
    const { closeDialog, open, setOpen, visibleState } = useActionDialog(
        state,
        initialState
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive">
                    <Trash2Icon />
                    Limpar mês
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Limpar marcações do mês</DialogTitle>
                    <DialogDescription>
                        Esta ação apaga todas as marcações de{" "}
                        {formatMonthLabel(monthValue)}.
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
                        <input type="hidden" name="month" value={monthValue} />

                        <p className="text-sm text-muted-foreground">
                            Vais apagar todas as marcações deste mês. Os utentes,
                            funcionários, serviços e locais não serão apagados.
                        </p>

                        {visibleState.message ? (
                            <p
                                className={cn(
                                    "text-sm",
                                    visibleState.status === "error"
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                )}
                                role={visibleState.status === "error" ? "alert" : "status"}
                            >
                                {visibleState.message}
                            </p>
                        ) : null}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog}>
                                Cancelar
                            </Button>
                            <DeleteButton />
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
