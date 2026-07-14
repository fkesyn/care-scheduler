"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
    createAppointment,
    type CreateAppointmentState,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionDialog } from "@/lib/use-action-dialog";
import { cn } from "@/lib/utils";

export type AppointmentPatientOption = {
    id: string;
    name: string;
    isDiabetic: boolean;
    locationName: string;
};

export type AppointmentServiceOption = {
    id: string;
    name: string;
    measurementType: string | null;
};

export type AppointmentEmployeeOption = {
    id: string;
    name: string;
    role: string;
};

type NewAppointmentDialogProps = {
    employees: AppointmentEmployeeOption[];
    patients: AppointmentPatientOption[];
    services: AppointmentServiceOption[];
    selectedDate: string;
};

const initialState: CreateAppointmentState = {
    status: "idle",
};

function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending || disabled}>
            {pending ? "A guardar..." : "Criar marcação"}
        </Button>
    );
}

function serviceLabel(service: AppointmentServiceOption) {
    const suffix =
        service.measurementType === "blood_pressure"
            ? "TA"
            : service.measurementType === "glucose"
              ? "glicémia"
              : null;

    return `${service.name}${suffix ? ` · ${suffix}` : ""}`;
}

function roleLabel(role: string) {
    if (role === "nurse") {
        return "Enfermeiro/a";
    }

    if (role === "caregiver") {
        return "Cuidador/a";
    }

    if (role === "other") {
        return "Outro";
    }

    return "Auxiliar / Funcionário";
}

export function NewAppointmentDialog({
    employees,
    patients,
    services,
    selectedDate,
}: NewAppointmentDialogProps) {
    const [state, formAction] = useActionState(createAppointment, initialState);
    const { closeDialog, open, setOpen, showFormAgain, visibleState } =
        useActionDialog(state, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const isDisabled = patients.length === 0 || services.length === 0;

    useEffect(() => {
        if (visibleState.status === "success") {
            formRef.current?.reset();
        }
    }, [visibleState.status]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={isDisabled}>
                    <PlusIcon />
                    Nova marcação
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nova marcação</DialogTitle>
                    <DialogDescription>
                        Agenda um serviço para um utente numa data.
                    </DialogDescription>
                </DialogHeader>

                {visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p
                            className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                            role="status"
                        >
                            {visibleState.message ?? "Marcação criada com sucesso."}
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={showFormAgain}>
                                Criar outra marcação
                            </Button>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                <form ref={formRef} action={formAction} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="appointment-employee">Equipa</Label>
                        <select
                            id="appointment-employee"
                            name="employee_id"
                            defaultValue=""
                            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            aria-describedby={
                                visibleState.fieldErrors?.employeeId
                                    ? "appointment-employee-error"
                                    : undefined
                            }
                            aria-invalid={Boolean(visibleState.fieldErrors?.employeeId)}
                        >
                            <option value="">
                                Sem responsável atribuído
                            </option>
                            {employees.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                    {employee.name} · {roleLabel(employee.role)}
                                </option>
                            ))}
                        </select>
                        {visibleState.fieldErrors?.employeeId ? (
                            <p
                                id="appointment-employee-error"
                                className="text-sm text-destructive"
                            >
                                {visibleState.fieldErrors.employeeId}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="appointment-patient">Utente</Label>
                        <select
                            id="appointment-patient"
                            name="patient_id"
                            defaultValue=""
                            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            aria-describedby={
                                visibleState.fieldErrors?.patientId
                                    ? "appointment-patient-error"
                                    : undefined
                            }
                            aria-invalid={Boolean(visibleState.fieldErrors?.patientId)}
                            required
                        >
                            <option value="" disabled>
                                Escolher utente
                            </option>
                            {patients.map((patient) => (
                                <option key={patient.id} value={patient.id}>
                                    {patient.name}
                                    {` · ${patient.locationName}`}
                                    {patient.isDiabetic ? " · diabético" : ""}
                                </option>
                            ))}
                        </select>
                        {visibleState.fieldErrors?.patientId ? (
                            <p
                                id="appointment-patient-error"
                                className="text-sm text-destructive"
                            >
                                {visibleState.fieldErrors.patientId}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="appointment-service">Serviço</Label>
                        <select
                            id="appointment-service"
                            name="service_id"
                            defaultValue=""
                            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            aria-describedby={
                                visibleState.fieldErrors?.serviceId
                                    ? "appointment-service-error"
                                    : undefined
                            }
                            aria-invalid={Boolean(visibleState.fieldErrors?.serviceId)}
                            required
                        >
                            <option value="" disabled>
                                Escolher serviço
                            </option>
                            {services.map((service) => (
                                <option key={service.id} value={service.id}>
                                    {serviceLabel(service)}
                                </option>
                            ))}
                        </select>
                        {visibleState.fieldErrors?.serviceId ? (
                            <p
                                id="appointment-service-error"
                                className="text-sm text-destructive"
                            >
                                {visibleState.fieldErrors.serviceId}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="appointment-date">Data</Label>
                        <Input
                            id="appointment-date"
                            name="scheduled_date"
                            type="date"
                            defaultValue={selectedDate}
                            aria-describedby={
                                visibleState.fieldErrors?.scheduledDate
                                    ? "appointment-date-error"
                                    : undefined
                            }
                            aria-invalid={Boolean(
                                visibleState.fieldErrors?.scheduledDate
                            )}
                            required
                        />
                        {visibleState.fieldErrors?.scheduledDate ? (
                            <p
                                id="appointment-date-error"
                                className="text-sm text-destructive"
                            >
                                {visibleState.fieldErrors.scheduledDate}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="appointment-notes">Notas</Label>
                        <Textarea
                            id="appointment-notes"
                            name="notes"
                            placeholder="Observações opcionais"
                        />
                    </div>

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
