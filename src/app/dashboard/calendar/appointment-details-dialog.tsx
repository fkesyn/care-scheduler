"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
    updateAppointmentDetails,
    type UpdateAppointmentState,
} from "@/app/dashboard/calendar/actions";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { useActionDialog } from "@/lib/use-action-dialog";
import { cn } from "@/lib/utils";

export type AppointmentDetails = {
    id: string;
    timeLabel: string;
    status: string;
    notes: string | null;
    color: string;
    patientName: string;
    patientRoom: string | null;
    locationName: string | null;
    serviceName: string;
    measurementLabel: string | null;
    employeeLabel: string | null;
};

type AppointmentDetailsDialogProps = {
    appointment: AppointmentDetails;
};

const initialState: UpdateAppointmentState = {
    status: "idle",
};

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? "A guardar..." : "Guardar alterações"}
        </Button>
    );
}

function statusLabel(status: string) {
    if (status === "completed") {
        return "Concluído";
    }

    if (status === "canceled") {
        return "Cancelado";
    }

    return "Planeado";
}

function statusColor(status: string) {
    if (status === "completed") {
        return "#16a34a";
    }

    if (status === "canceled") {
        return "#dc2626";
    }

    return "#facc15";
}

function statusBadgeVariant(status: string) {
    return status === "planned" ? "secondary" : "outline";
}

export function AppointmentDetailsDialog({
    appointment,
}: AppointmentDetailsDialogProps) {
    const [state, formAction] = useActionState(
        updateAppointmentDetails,
        initialState
    );
    const { closeDialog, open, setOpen, visibleState } = useActionDialog(
        state,
        initialState
    );

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className="grid w-full gap-4 p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[7rem_1fr_auto] sm:items-start"
                >
                    <div className="flex items-center gap-2 font-medium">
                        <span
                            className="size-3 rounded-full"
                            style={{ backgroundColor: statusColor(appointment.status) }}
                            aria-hidden="true"
                        />
                        <span>{appointment.timeLabel}</span>
                    </div>

                    <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-medium">{appointment.patientName}</h2>
                            {appointment.patientRoom ? (
                                <Badge variant="outline">
                                    Quarto {appointment.patientRoom}
                                </Badge>
                            ) : null}
                            {appointment.locationName ? (
                                <Badge variant="outline">{appointment.locationName}</Badge>
                            ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {appointment.serviceName}
                            {appointment.measurementLabel
                                ? ` · ${appointment.measurementLabel}`
                                : ""}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {appointment.employeeLabel ?? "Sem responsável atribuído"}
                        </p>
                        {appointment.notes ? (
                            <p className="text-sm text-foreground">{appointment.notes}</p>
                        ) : null}
                    </div>

                    <Badge variant={statusBadgeVariant(appointment.status)}>
                        {statusLabel(appointment.status)}
                    </Badge>
                </button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{appointment.patientName}</DialogTitle>
                    <DialogDescription>
                        {appointment.timeLabel} · {appointment.serviceName}
                    </DialogDescription>
                </DialogHeader>

                <form
                    key={`${appointment.id}-${appointment.status}-${appointment.notes ?? ""}`}
                    action={formAction}
                    className="grid gap-4"
                >
                    <input
                        type="hidden"
                        name="appointment_id"
                        value={appointment.id}
                    />

                    <div className="grid gap-3 rounded-md border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{appointment.timeLabel}</Badge>
                            <Badge variant="outline">{appointment.serviceName}</Badge>
                            {appointment.locationName ? (
                                <Badge variant="outline">{appointment.locationName}</Badge>
                            ) : null}
                        </div>
                        <p className="text-muted-foreground">
                            {appointment.employeeLabel ?? "Sem responsável atribuído"}
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor={`appointment-status-${appointment.id}`}>
                            Estado
                        </Label>
                        <select
                            id={`appointment-status-${appointment.id}`}
                            name="status"
                            defaultValue={appointment.status}
                            className={cn(
                                "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                                visibleState.fieldErrors?.appointmentStatus &&
                                    "border-destructive ring-3 ring-destructive/20"
                            )}
                            aria-describedby={
                                visibleState.fieldErrors?.appointmentStatus
                                    ? `appointment-status-error-${appointment.id}`
                                    : undefined
                            }
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
                            <p
                                id={`appointment-status-error-${appointment.id}`}
                                className="text-sm text-destructive"
                            >
                                {visibleState.fieldErrors.appointmentStatus}
                            </p>
                        ) : null}
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor={`appointment-notes-${appointment.id}`}>
                            Notas
                        </Label>
                        <Textarea
                            id={`appointment-notes-${appointment.id}`}
                            name="notes"
                            defaultValue={appointment.notes ?? ""}
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
                            Fechar
                        </Button>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
