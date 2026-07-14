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
import { Spinner } from "@/components/ui/spinner";
import { useActionDialog } from "@/lib/use-action-dialog";
import { cn } from "@/lib/utils";

type LocationOption = {
    id: string;
    name: string;
};

type ClearMonthAppointmentsDialogProps = {
    selectedDate: string;
    selectedLocationId: string;
    locations: LocationOption[];
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
            {pending ? (
                <>
                    <Spinner />
                    A limpar...
                </>
            ) : (
                "Sim, limpar mês"
            )}
        </Button>
    );
}

export function ClearMonthAppointmentsDialog({
    selectedDate,
    selectedLocationId,
    locations,
}: ClearMonthAppointmentsDialogProps) {
    const monthValue = selectedDate.slice(0, 7);
    const defaultLocationId = selectedLocationId || "all";
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
                        Esta ação apaga marcações de{" "}
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

                        <div className="grid gap-2">
                            <label
                                htmlFor="clear-month-location"
                                className="text-sm font-medium"
                            >
                                Local
                            </label>
                            <select
                                id="clear-month-location"
                                name="location_id"
                                defaultValue={defaultLocationId}
                                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                aria-describedby={
                                    visibleState.fieldErrors?.locationId
                                        ? "clear-month-location-error"
                                        : undefined
                                }
                                aria-invalid={Boolean(
                                    visibleState.fieldErrors?.locationId
                                )}
                            >
                                <option value="all">Todos os locais</option>
                                {locations.map((location) => (
                                    <option key={location.id} value={location.id}>
                                        {location.name}
                                    </option>
                                ))}
                            </select>
                            {visibleState.fieldErrors?.locationId ? (
                                <p
                                    id="clear-month-location-error"
                                    className="text-sm text-destructive"
                                >
                                    {visibleState.fieldErrors.locationId}
                                </p>
                            ) : null}
                        </div>

                        <p className="text-sm text-muted-foreground">
                            Vais apagar as marcações do mês para o local escolhido.
                            Os utentes, funcionários, serviços e locais não serão
                            apagados.
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
