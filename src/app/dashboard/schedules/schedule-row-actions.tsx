"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    deleteMonthlySchedule,
    type DeleteScheduleState,
    type ScheduleFormState,
    updateMonthlySchedule,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionDialog } from "@/lib/use-action-dialog";
import { cn } from "@/lib/utils";

type LocationOption = {
    id: string;
    name: string;
};

type ScheduleListItem = {
    id: string;
    location_id: string | null;
    month: string;
    status: string;
};

type ScheduleRowActionsProps = {
    locations: LocationOption[];
    schedule: ScheduleListItem;
};

const updateInitialState: ScheduleFormState = {
    status: "idle",
};

const deleteInitialState: DeleteScheduleState = {
    status: "idle",
};

const statusOptions = [
    { value: "draft", label: "Rascunho" },
    { value: "published", label: "Publicado" },
    { value: "archived", label: "Arquivado" },
];

function toMonthInputValue(month: string) {
    return month.slice(0, 7);
}

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? "A guardar..." : "Guardar alterações"}
        </Button>
    );
}

function DeleteButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "A apagar..." : "Apagar horário"}
        </Button>
    );
}

export function ScheduleRowActions({
    locations,
    schedule,
}: ScheduleRowActionsProps) {
    const [updateState, updateAction] = useActionState(
        updateMonthlySchedule,
        updateInitialState
    );
    const [deleteState, deleteAction] = useActionState(
        deleteMonthlySchedule,
        deleteInitialState
    );
    const updateDialog = useActionDialog(updateState, updateInitialState);
    const deleteDialog = useActionDialog(deleteState, deleteInitialState);

    return (
        <div className="flex justify-end gap-2">
            <Dialog open={updateDialog.open} onOpenChange={updateDialog.setOpen}>
                <DialogTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="Editar horário">
                        <PencilIcon />
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar horário mensal</DialogTitle>
                        <DialogDescription>
                            Atualiza mês, local ou estado do horário.
                        </DialogDescription>
                    </DialogHeader>

                    {updateDialog.visibleState.status === "success" ? (
                        <div className="grid gap-4">
                            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                                {updateDialog.visibleState.message}
                            </p>
                            <DialogFooter>
                                <Button type="button" onClick={updateDialog.closeDialog}>
                                    Fechar
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : (
                        <form action={updateAction} className="grid gap-4">
                            <input type="hidden" name="id" value={schedule.id} />

                            <div className="grid gap-2">
                                <Label htmlFor={`schedule-month-${schedule.id}`}>
                                    Mês
                                </Label>
                                <Input
                                    id={`schedule-month-${schedule.id}`}
                                    name="month"
                                    type="month"
                                    defaultValue={toMonthInputValue(schedule.month)}
                                    aria-invalid={Boolean(
                                        updateDialog.visibleState.fieldErrors?.month
                                    )}
                                    required
                                />
                                {updateDialog.visibleState.fieldErrors?.month ? (
                                    <p className="text-sm text-destructive">
                                        {updateDialog.visibleState.fieldErrors.month}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`schedule-location-${schedule.id}`}>
                                    Local
                                </Label>
                                <select
                                    id={`schedule-location-${schedule.id}`}
                                    name="location_id"
                                    defaultValue={schedule.location_id ?? ""}
                                    className={cn(
                                        "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                                        updateDialog.visibleState.fieldErrors
                                            ?.locationId &&
                                            "border-destructive ring-3 ring-destructive/20"
                                    )}
                                    aria-invalid={Boolean(
                                        updateDialog.visibleState.fieldErrors?.locationId
                                    )}
                                >
                                    <option value="">Geral / todos os locais</option>
                                    {locations.map((location) => (
                                        <option key={location.id} value={location.id}>
                                            {location.name}
                                        </option>
                                    ))}
                                </select>
                                {updateDialog.visibleState.fieldErrors?.locationId ? (
                                    <p className="text-sm text-destructive">
                                        {
                                            updateDialog.visibleState.fieldErrors
                                                .locationId
                                        }
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`schedule-status-${schedule.id}`}>
                                    Estado
                                </Label>
                                <select
                                    id={`schedule-status-${schedule.id}`}
                                    name="status"
                                    defaultValue={schedule.status}
                                    className={cn(
                                        "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                                        updateDialog.visibleState.fieldErrors
                                            ?.scheduleStatus &&
                                            "border-destructive ring-3 ring-destructive/20"
                                    )}
                                    aria-invalid={Boolean(
                                        updateDialog.visibleState.fieldErrors
                                            ?.scheduleStatus
                                    )}
                                    required
                                >
                                    {statusOptions.map((status) => (
                                        <option key={status.value} value={status.value}>
                                            {status.label}
                                        </option>
                                    ))}
                                </select>
                                {updateDialog.visibleState.fieldErrors
                                    ?.scheduleStatus ? (
                                    <p className="text-sm text-destructive">
                                        {
                                            updateDialog.visibleState.fieldErrors
                                                .scheduleStatus
                                        }
                                    </p>
                                ) : null}
                            </div>

                            {updateDialog.visibleState.message ? (
                                <p
                                    className={cn(
                                        "text-sm",
                                        updateDialog.visibleState.status === "error"
                                            ? "text-destructive"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {updateDialog.visibleState.message}
                                </p>
                            ) : null}

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={updateDialog.closeDialog}
                                >
                                    Cancelar
                                </Button>
                                <SubmitButton />
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

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
                                também serão apagadas.
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
