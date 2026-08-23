"use client";

import { CheckSquareIcon, XIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
    deleteAppointment,
    type DeleteAppointmentState,
    updateAppointmentDetails,
    type UpdateAppointmentState,
} from "@/app/dashboard/calendar/actions";
import { clinicalRecordTypeForService } from "@/app/dashboard/calendar/service-display";
import type {
    AppointmentEmployeeOption,
    AppointmentPatientOption,
    AppointmentServiceOption,
} from "@/app/dashboard/calendar/new-appointment-dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionDialog } from "@/lib/use-action-dialog";
import { cn } from "@/lib/utils";

export type AppointmentDetails = {
    id: string;
    employeeId: string | null;
    patientId: string | null;
    serviceId: string | null;
    serviceMeasurementType: string | null;
    scheduledDate: string;
    status: string;
    notes: string | null;
    patientName: string;
    patientNameColor: string | null;
    locationName: string | null;
    serviceName: string;
    measurementLabel: string | null;
    employeeLabel: string | null;
    createdBy: string | null;
    updatedBy: string | null;
    clinicalRecord: {
        recordType: string;
        bloodPressureValue: string | null;
        heartRateValue: number | null;
        woundCharacteristics: string | null;
        woundTreatment: string | null;
    } | null;
};

type AppointmentDetailsDialogProps = {
    appointment: AppointmentDetails;
    canManage?: boolean;
    employees: AppointmentEmployeeOption[];
    patients: AppointmentPatientOption[];
    services: AppointmentServiceOption[];
    triggerVariant?: "default" | "groupItem";
};

const updateInitialState: UpdateAppointmentState = {
    status: "idle",
};

const deleteInitialState: DeleteAppointmentState = {
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

function DeleteButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" variant="destructive" disabled={pending}>
            {pending ? "A apagar..." : "Apagar marcação"}
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

function AppointmentStatusIcon({ status }: { status: string }) {
    if (status === "completed") {
        return (
            <CheckSquareIcon
                className="size-4 shrink-0 text-green-600"
                aria-label="Concluído"
                role="img"
            />
        );
    }

    if (status === "canceled") {
        return (
            <XIcon
                className="size-4 shrink-0 text-red-600"
                aria-label="Cancelado"
                role="img"
            />
        );
    }

    return null;
}

function statusBadgeVariant(status: string) {
    return status === "planned" ? "secondary" : "outline";
}

function serviceLabel(service: AppointmentServiceOption) {
    const suffix =
        service.measurementType === "blood_pressure"
            ? "TA"
            : service.measurementType === "glucose"
              ? "glicémia"
              : service.measurementType === "wound_care"
                ? "ferida"
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

function selectClassName(hasError: boolean) {
    return cn(
        "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        hasError && "border-destructive ring-3 ring-destructive/20"
    );
}

export function AppointmentDetailsDialog({
    appointment,
    canManage = true,
    employees,
    patients,
    services,
    triggerVariant = "default",
}: AppointmentDetailsDialogProps) {
    const [updateState, updateAction] = useActionState(
        updateAppointmentDetails,
        updateInitialState
    );
    const [deleteState, deleteAction] = useActionState(
        deleteAppointment,
        deleteInitialState
    );
    const updateDialog = useActionDialog(updateState, updateInitialState);
    const deleteDialog = useActionDialog(deleteState, deleteInitialState);
    const visibleState = updateDialog.visibleState;
    const visibleDeleteState = deleteDialog.visibleState;

    const hasCurrentEmployee = appointment.employeeId
        ? employees.some((employee) => employee.id === appointment.employeeId)
        : true;
    const hasCurrentPatient = appointment.patientId
        ? patients.some((patient) => patient.id === appointment.patientId)
        : true;
    const hasCurrentService = appointment.serviceId
        ? services.some((service) => service.id === appointment.serviceId)
        : true;
    const [selectedServiceId, setSelectedServiceId] = useState(
        appointment.serviceId ?? ""
    );
    const selectedService = services.find(
        (service) => service.id === selectedServiceId
    );
    const selectedMeasurementType = clinicalRecordTypeForService(
        selectedService?.name ?? appointment.serviceName,
        selectedService?.measurementType ?? appointment.serviceMeasurementType
    );
    const isBloodPressureService = selectedMeasurementType === "blood_pressure";
    const isWoundCareService = selectedMeasurementType === "wound_care";

    const setOpen = (nextOpen: boolean) => {
        updateDialog.setOpen(nextOpen);
        deleteDialog.setOpen(nextOpen);
    };

    const closeDialog = () => {
        setOpen(false);
    };

    const dialogKey = [
        appointment.id,
        appointment.employeeId ?? "",
        appointment.patientId ?? "",
        appointment.serviceId ?? "",
        appointment.serviceMeasurementType ?? "",
        appointment.scheduledDate,
        appointment.status,
        appointment.notes ?? "",
        appointment.clinicalRecord?.bloodPressureValue ?? "",
        appointment.clinicalRecord?.heartRateValue ?? "",
        appointment.clinicalRecord?.woundCharacteristics ?? "",
        appointment.clinicalRecord?.woundTreatment ?? "",
    ].join("-");
    const isGroupItem = triggerVariant === "groupItem";

    return (
        <Dialog open={updateDialog.open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "grid w-full text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        isGroupItem
                            ? "gap-2 px-3 py-2"
                            : "gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-start"
                    )}
                >
                    <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <AppointmentStatusIcon status={appointment.status} />
                            {isGroupItem ? (
                                <>
                                    <span className="font-medium">
                                        {appointment.serviceName}
                                    </span>
                                    {appointment.measurementLabel ? (
                                        <Badge variant="outline">
                                            {appointment.measurementLabel}
                                        </Badge>
                                    ) : null}
                                </>
                            ) : (
                                <>
                                    <h2
                                        className="font-medium"
                                        style={{
                                            color:
                                                appointment.patientNameColor ??
                                                undefined,
                                        }}
                                    >
                                        {appointment.patientName}
                                    </h2>
                                    {appointment.locationName ? (
                                        <Badge variant="outline">
                                            {appointment.locationName}
                                        </Badge>
                                    ) : null}
                                </>
                            )}
                        </div>

                        {!isGroupItem ? (
                            <p className="text-sm text-muted-foreground">
                                {appointment.serviceName}
                                {appointment.measurementLabel
                                    ? ` · ${appointment.measurementLabel}`
                                    : ""}
                            </p>
                        ) : null}

                        <p className="text-sm text-muted-foreground">
                            {appointment.employeeLabel ?? "Sem responsável atribuído"}
                        </p>

                        {appointment.notes ? (
                            <p className="text-sm text-foreground">{appointment.notes}</p>
                        ) : null}

                        {appointment.clinicalRecord?.bloodPressureValue ||
                        appointment.clinicalRecord?.heartRateValue ? (
                            <div className="grid gap-0.5 text-sm text-foreground">
                                {appointment.clinicalRecord.bloodPressureValue ? (
                                    <p>
                                        TA:{" "}
                                        {
                                            appointment.clinicalRecord
                                                .bloodPressureValue
                                        }
                                    </p>
                                ) : null}
                                {appointment.clinicalRecord.heartRateValue ? (
                                    <p>
                                        FC:{" "}
                                        {appointment.clinicalRecord.heartRateValue}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}

                        {appointment.clinicalRecord?.woundCharacteristics ||
                        appointment.clinicalRecord?.woundTreatment ? (
                            <p className="text-sm text-foreground">
                                Registo de ferida guardado
                            </p>
                        ) : null}
                    </div>

                    {!isGroupItem ? (
                        <Badge variant={statusBadgeVariant(appointment.status)}>
                            {statusLabel(appointment.status)}
                        </Badge>
                    ) : null}
                </button>
            </DialogTrigger>

            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{appointment.patientName}</DialogTitle>
                    <DialogDescription>
                        {appointment.serviceName}
                    </DialogDescription>
                </DialogHeader>

                {!canManage ? (
                    <div className="grid gap-4">
                        <div className="grid gap-3 rounded-md border p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={statusBadgeVariant(appointment.status)}>
                                    {statusLabel(appointment.status)}
                                </Badge>
                                {appointment.locationName ? (
                                    <Badge variant="outline">
                                        {appointment.locationName}
                                    </Badge>
                                ) : null}
                                {appointment.measurementLabel ? (
                                    <Badge variant="outline">
                                        {appointment.measurementLabel}
                                    </Badge>
                                ) : null}
                            </div>

                            <p className="text-muted-foreground">
                                {appointment.employeeLabel ??
                                    "Sem responsável atribuído"}
                            </p>

                            {appointment.notes ? (
                                <div className="grid gap-1">
                                    <span className="font-medium">Notas</span>
                                    <p className="text-muted-foreground">
                                        {appointment.notes}
                                    </p>
                                </div>
                            ) : null}

                            {appointment.clinicalRecord?.bloodPressureValue ? (
                                <div className="grid gap-1">
                                    <span className="font-medium">
                                        Valor da tensão arterial
                                    </span>
                                    <p className="text-muted-foreground">
                                        {
                                            appointment.clinicalRecord
                                                .bloodPressureValue
                                        }
                                    </p>
                                </div>
                            ) : null}

                            {appointment.clinicalRecord?.heartRateValue ? (
                                <div className="grid gap-1">
                                    <span className="font-medium">FC</span>
                                    <p className="text-muted-foreground">
                                        {appointment.clinicalRecord.heartRateValue}
                                    </p>
                                </div>
                            ) : null}

                            {appointment.clinicalRecord?.woundCharacteristics ? (
                                <div className="grid gap-1">
                                    <span className="font-medium">
                                        Características da ferida
                                    </span>
                                    <p className="whitespace-pre-wrap text-muted-foreground">
                                        {
                                            appointment.clinicalRecord
                                                .woundCharacteristics
                                        }
                                    </p>
                                </div>
                            ) : null}

                            {appointment.clinicalRecord?.woundTreatment ? (
                                <div className="grid gap-1">
                                    <span className="font-medium">
                                        Tratamento realizado
                                    </span>
                                    <p className="whitespace-pre-wrap text-muted-foreground">
                                        {appointment.clinicalRecord.woundTreatment}
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        <DialogFooter>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : visibleDeleteState.status === "success" ? (
                    <div className="grid gap-4">
                        <p
                            className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                            role="status"
                        >
                            {visibleDeleteState.message ?? "Marcação apagada."}
                        </p>
                        <DialogFooter>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p
                            className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                            role="status"
                        >
                            {visibleState.message ?? "Marcação atualizada."}
                        </p>
                        <DialogFooter>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="grid gap-5">
                        <form key={dialogKey} action={updateAction} className="grid gap-4">
                            <input type="hidden" name="appointment_id" value={appointment.id} />

                            <div className="grid gap-3 rounded-md border p-3 text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">{appointment.serviceName}</Badge>
                                    {appointment.locationName ? (
                                        <Badge variant="outline">{appointment.locationName}</Badge>
                                    ) : null}
                                </div>

                                <p className="text-muted-foreground">
                                    {appointment.employeeLabel ?? "Sem responsável atribuído"}
                                </p>

                                {appointment.createdBy || appointment.updatedBy ? (
                                    <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                                        {appointment.createdBy ? (
                                            <p>
                                                <span className="font-medium text-foreground">
                                                    Criado por:
                                                </span>{" "}
                                                {appointment.createdBy}
                                            </p>
                                        ) : null}

                                        {appointment.updatedBy ? (
                                            <p>
                                                <span className="font-medium text-foreground">
                                                    Editado por:
                                                </span>{" "}
                                                {appointment.updatedBy}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`appointment-employee-${appointment.id}`}>
                                    Equipa
                                </Label>
                                <select
                                    id={`appointment-employee-${appointment.id}`}
                                    name="employee_id"
                                    defaultValue={appointment.employeeId ?? ""}
                                    className={selectClassName(
                                        Boolean(visibleState.fieldErrors?.employeeId)
                                    )}
                                    aria-describedby={
                                        visibleState.fieldErrors?.employeeId
                                            ? `appointment-employee-error-${appointment.id}`
                                            : undefined
                                    }
                                    aria-invalid={Boolean(
                                        visibleState.fieldErrors?.employeeId
                                    )}
                                >
                                    <option value="">Sem responsável</option>
                                    {appointment.employeeId && !hasCurrentEmployee ? (
                                        <option value={appointment.employeeId}>
                                            {appointment.employeeLabel ??
                                                "Responsável indisponível"}
                                        </option>
                                    ) : null}
                                    {employees.map((employee) => (
                                        <option key={employee.id} value={employee.id}>
                                            {employee.name} · {roleLabel(employee.role)}
                                        </option>
                                    ))}
                                </select>
                                {visibleState.fieldErrors?.employeeId ? (
                                    <p
                                        id={`appointment-employee-error-${appointment.id}`}
                                        className="text-sm text-destructive"
                                    >
                                        {visibleState.fieldErrors.employeeId}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`appointment-patient-${appointment.id}`}>
                                    Utente
                                </Label>
                                <select
                                    id={`appointment-patient-${appointment.id}`}
                                    name="patient_id"
                                    defaultValue={appointment.patientId ?? ""}
                                    className={selectClassName(
                                        Boolean(visibleState.fieldErrors?.patientId)
                                    )}
                                    aria-describedby={
                                        visibleState.fieldErrors?.patientId
                                            ? `appointment-patient-error-${appointment.id}`
                                            : undefined
                                    }
                                    aria-invalid={Boolean(visibleState.fieldErrors?.patientId)}
                                    required
                                >
                                    <option value="" disabled>
                                        Escolher utente
                                    </option>
                                    {appointment.patientId && !hasCurrentPatient ? (
                                        <option value={appointment.patientId}>
                                            {appointment.patientName} · indisponível
                                        </option>
                                    ) : null}
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
                                        id={`appointment-patient-error-${appointment.id}`}
                                        className="text-sm text-destructive"
                                    >
                                        {visibleState.fieldErrors.patientId}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`appointment-service-${appointment.id}`}>
                                    Serviço
                                </Label>
                                <select
                                    id={`appointment-service-${appointment.id}`}
                                    name="service_id"
                                    value={selectedServiceId}
                                    onChange={(event) =>
                                        setSelectedServiceId(event.target.value)
                                    }
                                    className={selectClassName(
                                        Boolean(visibleState.fieldErrors?.serviceId)
                                    )}
                                    aria-describedby={
                                        visibleState.fieldErrors?.serviceId
                                            ? `appointment-service-error-${appointment.id}`
                                            : undefined
                                    }
                                    aria-invalid={Boolean(visibleState.fieldErrors?.serviceId)}
                                    required
                                >
                                    <option value="" disabled>
                                        Escolher serviço
                                    </option>
                                    {appointment.serviceId && !hasCurrentService ? (
                                        <option value={appointment.serviceId}>
                                            {appointment.serviceName} · indisponível
                                        </option>
                                    ) : null}
                                    {services.map((service) => (
                                        <option key={service.id} value={service.id}>
                                            {serviceLabel(service)}
                                        </option>
                                    ))}
                                </select>
                                {visibleState.fieldErrors?.serviceId ? (
                                    <p
                                        id={`appointment-service-error-${appointment.id}`}
                                        className="text-sm text-destructive"
                                    >
                                        {visibleState.fieldErrors.serviceId}
                                    </p>
                                ) : null}
                            </div>

                            {isBloodPressureService ? (
                                <div className="grid gap-3 rounded-md border p-3">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor={`appointment-blood-pressure-${appointment.id}`}
                                            >
                                                Valor da tensão arterial
                                            </Label>
                                            <Input
                                                id={`appointment-blood-pressure-${appointment.id}`}
                                                name="blood_pressure_value"
                                                defaultValue={
                                                    appointment.clinicalRecord
                                                        ?.bloodPressureValue ?? ""
                                                }
                                                placeholder="Ex.: 13/8 ou 130/80"
                                                aria-describedby={
                                                    visibleState.fieldErrors
                                                        ?.bloodPressureValue
                                                        ? `appointment-blood-pressure-error-${appointment.id}`
                                                        : undefined
                                                }
                                                aria-invalid={Boolean(
                                                    visibleState.fieldErrors
                                                        ?.bloodPressureValue
                                                )}
                                            />
                                            {visibleState.fieldErrors
                                                ?.bloodPressureValue ? (
                                                <p
                                                    id={`appointment-blood-pressure-error-${appointment.id}`}
                                                    className="text-sm text-destructive"
                                                >
                                                    {
                                                        visibleState.fieldErrors
                                                            .bloodPressureValue
                                                    }
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="grid gap-2">
                                            <Label
                                                htmlFor={`appointment-heart-rate-${appointment.id}`}
                                            >
                                                FC
                                            </Label>
                                            <Input
                                                id={`appointment-heart-rate-${appointment.id}`}
                                                name="heart_rate_value"
                                                type="number"
                                                inputMode="numeric"
                                                min={1}
                                                max={300}
                                                defaultValue={
                                                    appointment.clinicalRecord
                                                        ?.heartRateValue ?? ""
                                                }
                                                placeholder="Ex.: 72"
                                                aria-describedby={
                                                    visibleState.fieldErrors
                                                        ?.heartRateValue
                                                        ? `appointment-heart-rate-error-${appointment.id}`
                                                        : undefined
                                                }
                                                aria-invalid={Boolean(
                                                    visibleState.fieldErrors
                                                        ?.heartRateValue
                                                )}
                                            />
                                            {visibleState.fieldErrors
                                                ?.heartRateValue ? (
                                                <p
                                                    id={`appointment-heart-rate-error-${appointment.id}`}
                                                    className="text-sm text-destructive"
                                                >
                                                    {
                                                        visibleState.fieldErrors
                                                            .heartRateValue
                                                    }
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {isWoundCareService ? (
                                <div className="grid gap-4 rounded-md border p-3">
                                    <div className="grid gap-2">
                                        <Label
                                            htmlFor={`appointment-wound-characteristics-${appointment.id}`}
                                        >
                                            Características da ferida
                                        </Label>
                                        <Textarea
                                            id={`appointment-wound-characteristics-${appointment.id}`}
                                            name="wound_characteristics"
                                            defaultValue={
                                                appointment.clinicalRecord
                                                    ?.woundCharacteristics ?? ""
                                            }
                                            placeholder="Ex.: localização, aspeto, exsudado, sinais de inflamação"
                                            aria-describedby={
                                                visibleState.fieldErrors
                                                    ?.woundCharacteristics
                                                    ? `appointment-wound-characteristics-error-${appointment.id}`
                                                    : undefined
                                            }
                                            aria-invalid={Boolean(
                                                visibleState.fieldErrors
                                                    ?.woundCharacteristics
                                            )}
                                        />
                                        {visibleState.fieldErrors
                                            ?.woundCharacteristics ? (
                                            <p
                                                id={`appointment-wound-characteristics-error-${appointment.id}`}
                                                className="text-sm text-destructive"
                                            >
                                                {
                                                    visibleState.fieldErrors
                                                        .woundCharacteristics
                                                }
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="grid gap-2">
                                        <Label
                                            htmlFor={`appointment-wound-treatment-${appointment.id}`}
                                        >
                                            Tratamento realizado
                                        </Label>
                                        <Textarea
                                            id={`appointment-wound-treatment-${appointment.id}`}
                                            name="wound_treatment"
                                            defaultValue={
                                                appointment.clinicalRecord
                                                    ?.woundTreatment ?? ""
                                            }
                                            placeholder="Ex.: limpeza, penso aplicado, material utilizado"
                                            aria-describedby={
                                                visibleState.fieldErrors
                                                    ?.woundTreatment
                                                    ? `appointment-wound-treatment-error-${appointment.id}`
                                                    : undefined
                                            }
                                            aria-invalid={Boolean(
                                                visibleState.fieldErrors
                                                    ?.woundTreatment
                                            )}
                                        />
                                        {visibleState.fieldErrors?.woundTreatment ? (
                                            <p
                                                id={`appointment-wound-treatment-error-${appointment.id}`}
                                                className="text-sm text-destructive"
                                            >
                                                {
                                                    visibleState.fieldErrors
                                                        .woundTreatment
                                                }
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            ) : null}

                            <div className="grid gap-2">
                                <Label htmlFor={`appointment-date-${appointment.id}`}>
                                    Data
                                </Label>
                                <Input
                                    id={`appointment-date-${appointment.id}`}
                                    name="scheduled_date"
                                    type="date"
                                    defaultValue={appointment.scheduledDate}
                                    aria-describedby={
                                        visibleState.fieldErrors?.scheduledDate
                                            ? `appointment-date-error-${appointment.id}`
                                            : undefined
                                    }
                                    aria-invalid={Boolean(
                                        visibleState.fieldErrors?.scheduledDate
                                    )}
                                    required
                                />
                                {visibleState.fieldErrors?.scheduledDate ? (
                                    <p
                                        id={`appointment-date-error-${appointment.id}`}
                                        className="text-sm text-destructive"
                                    >
                                        {visibleState.fieldErrors.scheduledDate}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`appointment-status-${appointment.id}`}>
                                    Estado
                                </Label>
                                <select
                                    id={`appointment-status-${appointment.id}`}
                                    name="status"
                                    defaultValue={appointment.status}
                                    className={selectClassName(
                                        Boolean(
                                            visibleState.fieldErrors?.appointmentStatus
                                        )
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
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeDialog}
                                >
                                    Fechar
                                </Button>
                                <SubmitButton />
                            </DialogFooter>
                        </form>

                        <form
                            action={deleteAction}
                            className="grid gap-3 border-t pt-4"
                        >
                            <input
                                type="hidden"
                                name="appointment_id"
                                value={appointment.id}
                            />
                            <div className="grid gap-1">
                                <h3 className="text-sm font-medium">Apagar marcação</h3>
                                <p className="text-sm text-muted-foreground">
                                    Remove definitivamente esta marcação do calendário.
                                </p>
                            </div>

                            {visibleDeleteState.message ? (
                                <p
                                    className={cn(
                                        "text-sm",
                                        visibleDeleteState.status === "error"
                                            ? "text-destructive"
                                            : "text-muted-foreground"
                                    )}
                                    role={
                                        visibleDeleteState.status === "error"
                                            ? "alert"
                                            : "status"
                                    }
                                >
                                    {visibleDeleteState.message}
                                </p>
                            ) : null}

                            <DialogFooter>
                                <DeleteButton />
                            </DialogFooter>
                        </form>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
