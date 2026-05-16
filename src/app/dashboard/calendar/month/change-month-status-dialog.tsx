"use client";

import { ListChecksIcon } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    updateMonthlyAppointmentsStatus,
    type UpdateMonthlyAppointmentsStatusState,
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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useActionDialog } from "@/lib/use-action-dialog";
import { cn } from "@/lib/utils";

type MonthServiceOption = {
    id: string;
    name: string;
};

type MonthEmployeeOption = {
    id: string;
    name: string;
};

type ChangeMonthStatusDialogProps = {
    selectedDate: string;
    services: MonthServiceOption[];
    employees: MonthEmployeeOption[];
    hasUnassignedAppointments: boolean;
};

const initialState: UpdateMonthlyAppointmentsStatusState = {
    status: "idle",
};

function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending || disabled}>
            {pending ? (
                <>
                    <Spinner />
                    A alterar...
                </>
            ) : (
                "Alterar estado"
            )}
        </Button>
    );
}

export function ChangeMonthStatusDialog({
    selectedDate,
    services,
    employees,
    hasUnassignedAppointments,
}: ChangeMonthStatusDialogProps) {
    const monthValue = selectedDate.slice(0, 7);
    const [state, formAction] = useActionState(
        updateMonthlyAppointmentsStatus,
        initialState
    );
    const { closeDialog, open, setOpen, showFormAgain, visibleState } =
        useActionDialog(state, initialState);
    const isDisabled = services.length === 0;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={isDisabled}>
                    <ListChecksIcon />
                    Alterar estado
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Alterar estado em lote</DialogTitle>
                    <DialogDescription>
                        Atualiza todas as marcações do mês para um serviço e
                        funcionário.
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
                            <Button type="button" variant="outline" onClick={showFormAgain}>
                                Alterar outro
                            </Button>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form action={formAction} className="grid gap-4">
                        <input type="hidden" name="month" value={monthValue} />

                        <div className="grid gap-2">
                            <Label htmlFor="month-status-service">Serviço</Label>
                            <select
                                id="month-status-service"
                                name="service_id"
                                defaultValue=""
                                className={cn(
                                    "h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                                    visibleState.fieldErrors?.serviceId &&
                                        "border-destructive ring-3 ring-destructive/20"
                                )}
                                aria-invalid={Boolean(
                                    visibleState.fieldErrors?.serviceId
                                )}
                                required
                            >
                                <option value="" disabled>
                                    Escolher serviço
                                </option>
                                {services.map((service) => (
                                    <option key={service.id} value={service.id}>
                                        {service.name}
                                    </option>
                                ))}
                            </select>
                            {visibleState.fieldErrors?.serviceId ? (
                                <p className="text-sm text-destructive">
                                    {visibleState.fieldErrors.serviceId}
                                </p>
                            ) : null}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="month-status-employee">Funcionário</Label>
                            <select
                                id="month-status-employee"
                                name="employee_id"
                                defaultValue=""
                                className={cn(
                                    "h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                                    visibleState.fieldErrors?.employeeId &&
                                        "border-destructive ring-3 ring-destructive/20"
                                )}
                                aria-invalid={Boolean(
                                    visibleState.fieldErrors?.employeeId
                                )}
                            >
                                <option value="">Todos</option>
                                {hasUnassignedAppointments ? (
                                    <option value="unassigned">Sem funcionário</option>
                                ) : null}
                                {employees.map((employee) => (
                                    <option key={employee.id} value={employee.id}>
                                        {employee.name}
                                    </option>
                                ))}
                            </select>
                            {visibleState.fieldErrors?.employeeId ? (
                                <p className="text-sm text-destructive">
                                    {visibleState.fieldErrors.employeeId}
                                </p>
                            ) : null}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="month-status-state">Novo estado</Label>
                            <select
                                id="month-status-state"
                                name="status"
                                defaultValue="completed"
                                className={cn(
                                    "h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                                    visibleState.fieldErrors?.appointmentStatus &&
                                        "border-destructive ring-3 ring-destructive/20"
                                )}
                                aria-invalid={Boolean(
                                    visibleState.fieldErrors?.appointmentStatus
                                )}
                                required
                            >
                                <option value="planned">Planeado</option>
                                <option value="completed">Concluído</option>
                                <option value="canceled">Cancelado</option>
                            </select>
                            {visibleState.fieldErrors?.appointmentStatus ? (
                                <p className="text-sm text-destructive">
                                    {visibleState.fieldErrors.appointmentStatus}
                                </p>
                            ) : null}
                        </div>

                        <p className="text-sm text-muted-foreground">
                            Esta ação altera todas as marcações do mês que correspondam
                            ao serviço e funcionário escolhidos.
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
                            <SubmitButton disabled={isDisabled} />
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
