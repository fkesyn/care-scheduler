"use client";

import { CalendarPlusIcon, ChevronDownIcon } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import {
    createMonthlyAppointments,
    type CreateMonthlyAppointmentsState,
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
import { useActionDialog } from "@/lib/use-action-dialog";
import { cn } from "@/lib/utils";

type LocationOption = {
    id: string;
    name: string;
};

type EmployeeOption = {
    id: string;
    name: string;
};

type PatientOption = {
    id: string;
    name: string;
    location_id: string | null;
    is_diabetic: boolean | null;
};

type ServiceOption = {
    id: string;
    name: string;
    duration_minutes: number | null;
    measurement_type: string | null;
};

type MonthlyScheduleDialogProps = {
    selectedDate: string;
    selectedLocationId: string;
    locations: LocationOption[];
    employees: EmployeeOption[];
    patients: PatientOption[];
    services: ServiceOption[];
};

const initialState: CreateMonthlyAppointmentsState = {
    status: "idle",
};

function daysInMonth(monthValue: string) {
    const [year, month] = monthValue.split("-").map(Number);

    if (!year || !month) {
        return 31;
    }

    return new Date(year, month, 0).getDate();
}

function serviceLabel(service: ServiceOption) {
    const duration = service.duration_minutes ?? 30;
    const suffix =
        service.measurement_type === "blood_pressure"
            ? "TA"
            : service.measurement_type === "glucose"
              ? "glicémia"
              : null;

    return `${service.name} · ${duration} min${suffix ? ` · ${suffix}` : ""}`;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending || disabled}>
            {pending ? "A criar..." : "Criar agendamento mensal"}
        </Button>
    );
}

export function MonthlyScheduleDialog({
    selectedDate,
    selectedLocationId,
    locations,
    employees,
    patients,
    services,
}: MonthlyScheduleDialogProps) {
    const defaultMonth = selectedDate.slice(0, 7);
    const defaultLocationId = selectedLocationId || locations[0]?.id || "";
    const [state, formAction] = useActionState(
        createMonthlyAppointments,
        initialState
    );
    const { closeDialog, open, setOpen, showFormAgain, visibleState } =
        useActionDialog(state, initialState);

    const [monthValue, setMonthValue] = useState(defaultMonth);
    const [locationId, setLocationId] = useState(defaultLocationId);
    const [startDay, setStartDay] = useState("1");
    const [endDay, setEndDay] = useState(String(daysInMonth(defaultMonth)));
    const [patientsOpen, setPatientsOpen] = useState(false);
    const [allPatients, setAllPatients] = useState(true);
    const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(
        () =>
            new Set(
                patients
                    .filter((patient) => patient.location_id === defaultLocationId)
                    .map((patient) => patient.id)
            )
    );

    const monthDays = daysInMonth(monthValue);

    const filteredPatients = useMemo(
        () =>
            patients.filter((patient) => patient.location_id === locationId).sort((a, b) =>
                a.name.localeCompare(b.name, "pt-PT", { sensitivity: "base" })
            ),
        [locationId, patients]
    );

    const visibleSelectedPatientIds = useMemo(() => {
        if (allPatients) {
            return new Set(filteredPatients.map((patient) => patient.id));
        }

        return new Set(
            filteredPatients
                .filter((patient) => selectedPatientIds.has(patient.id))
                .map((patient) => patient.id)
        );
    }, [allPatients, filteredPatients, selectedPatientIds]);

    const selectedCount = visibleSelectedPatientIds.size;
    const isDisabled =
        locations.length === 0 || services.length === 0 || filteredPatients.length === 0;

    function handleMonthChange(nextMonth: string) {
        const newMonthDays = daysInMonth(nextMonth);

        setMonthValue(nextMonth);
        setStartDay("1");
        setEndDay(String(newMonthDays));
    }

    function handleLocationChange(nextLocationId: string) {
        const ids = new Set(
            patients
                .filter((patient) => patient.location_id === nextLocationId)
                .map((patient) => patient.id)
        );

        setLocationId(nextLocationId);
        setAllPatients(true);
        setSelectedPatientIds(ids);
        setPatientsOpen(false);
    }

    function togglePatient(patientId: string, checked: boolean) {
        setAllPatients(false);
        setSelectedPatientIds((current) => {
            const next = allPatients
                ? new Set(filteredPatients.map((patient) => patient.id))
                : new Set(current);

            if (checked) {
                next.add(patientId);
            } else {
                next.delete(patientId);
            }

            return next;
        });
    }

    function toggleAllPatients(checked: boolean) {
        setAllPatients(checked);
        setSelectedPatientIds(
            checked
                ? new Set(filteredPatients.map((patient) => patient.id))
                : new Set()
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={locations.length === 0 || services.length === 0}>
                    <CalendarPlusIcon />
                    Agendamento Mensal
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Agendamento mensal</DialogTitle>
                    <DialogDescription>
                        Cria marcações em lote para os utentes de um local.
                    </DialogDescription>
                </DialogHeader>

                {visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p
                            className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                            role="status"
                        >
                            {visibleState.message ?? "Agendamento mensal criado."}
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={showFormAgain}>
                                Criar outro
                            </Button>
                            <Button type="button" onClick={closeDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <form action={formAction} className="grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="grid gap-2">
                                <Label htmlFor="monthly-month">Mês</Label>
                                <Input
                                    id="monthly-month"
                                    name="month"
                                    type="month"
                                    value={monthValue}
                                    onChange={(event) =>
                                        handleMonthChange(event.target.value)
                                    }
                                    aria-describedby={
                                        visibleState.fieldErrors?.month
                                            ? "monthly-month-error"
                                            : undefined
                                    }
                                    aria-invalid={Boolean(visibleState.fieldErrors?.month)}
                                    required
                                />
                                {visibleState.fieldErrors?.month ? (
                                    <p
                                        id="monthly-month-error"
                                        className="text-sm text-destructive"
                                    >
                                        {visibleState.fieldErrors.month}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="monthly-start-day">Dia início</Label>
                                <Input
                                    id="monthly-start-day"
                                    name="start_day"
                                    type="number"
                                    min={1}
                                    max={monthDays}
                                    value={startDay}
                                    onChange={(event) => setStartDay(event.target.value)}
                                    aria-describedby={
                                        visibleState.fieldErrors?.startDay
                                            ? "monthly-start-day-error"
                                            : undefined
                                    }
                                    aria-invalid={Boolean(
                                        visibleState.fieldErrors?.startDay
                                    )}
                                    required
                                />
                                {visibleState.fieldErrors?.startDay ? (
                                    <p
                                        id="monthly-start-day-error"
                                        className="text-sm text-destructive"
                                    >
                                        {visibleState.fieldErrors.startDay}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="monthly-end-day">Dia fim</Label>
                                <Input
                                    id="monthly-end-day"
                                    name="end_day"
                                    type="number"
                                    min={1}
                                    max={monthDays}
                                    value={endDay}
                                    onChange={(event) => setEndDay(event.target.value)}
                                    aria-describedby={
                                        visibleState.fieldErrors?.endDay
                                            ? "monthly-end-day-error"
                                            : undefined
                                    }
                                    aria-invalid={Boolean(
                                        visibleState.fieldErrors?.endDay
                                    )}
                                    required
                                />
                                {visibleState.fieldErrors?.endDay ? (
                                    <p
                                        id="monthly-end-day-error"
                                        className="text-sm text-destructive"
                                    >
                                        {visibleState.fieldErrors.endDay}
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-2">
                                <Label htmlFor="monthly-location">Local</Label>
                                <select
                                    id="monthly-location"
                                    name="location_id"
                                    value={locationId}
                                    className="h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                    onChange={(event) =>
                                        handleLocationChange(event.target.value)
                                    }
                                    aria-describedby={
                                        visibleState.fieldErrors?.locationId
                                            ? "monthly-location-error"
                                            : undefined
                                    }
                                    aria-invalid={Boolean(
                                        visibleState.fieldErrors?.locationId
                                    )}
                                    required
                                >
                                    {locations.map((location) => (
                                        <option key={location.id} value={location.id}>
                                            {location.name}
                                        </option>
                                    ))}
                                </select>
                                {visibleState.fieldErrors?.locationId ? (
                                    <p
                                        id="monthly-location-error"
                                        className="text-sm text-destructive"
                                    >
                                        {visibleState.fieldErrors.locationId}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="monthly-service">Serviço</Label>
                                <select
                                    id="monthly-service"
                                    name="service_id"
                                    defaultValue={services[0]?.id ?? ""}
                                    className="h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                    aria-describedby={
                                        visibleState.fieldErrors?.serviceId
                                            ? "monthly-service-error"
                                            : undefined
                                    }
                                    aria-invalid={Boolean(
                                        visibleState.fieldErrors?.serviceId
                                    )}
                                    required
                                >
                                    {services.map((service) => (
                                        <option key={service.id} value={service.id}>
                                            {serviceLabel(service)}
                                        </option>
                                    ))}
                                </select>
                                {visibleState.fieldErrors?.serviceId ? (
                                    <p
                                        id="monthly-service-error"
                                        className="text-sm text-destructive"
                                    >
                                        {visibleState.fieldErrors.serviceId}
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="grid gap-2">
                                <Label htmlFor="monthly-start-time">Hora início</Label>
                                <Input
                                    id="monthly-start-time"
                                    name="start_time"
                                    type="time"
                                    defaultValue="09:00"
                                    step={300}
                                    aria-describedby={
                                        visibleState.fieldErrors?.startTime
                                            ? "monthly-start-time-error"
                                            : undefined
                                    }
                                    aria-invalid={Boolean(
                                        visibleState.fieldErrors?.startTime
                                    )}
                                    required
                                />
                                {visibleState.fieldErrors?.startTime ? (
                                    <p
                                        id="monthly-start-time-error"
                                        className="text-sm text-destructive"
                                    >
                                        {visibleState.fieldErrors.startTime}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="monthly-end-time">Hora fim</Label>
                                <Input
                                    id="monthly-end-time"
                                    name="end_time"
                                    type="time"
                                    defaultValue="17:00"
                                    step={300}
                                    aria-describedby={
                                        visibleState.fieldErrors?.endTime
                                            ? "monthly-end-time-error"
                                            : undefined
                                    }
                                    aria-invalid={Boolean(
                                        visibleState.fieldErrors?.endTime
                                    )}
                                    required
                                />
                                {visibleState.fieldErrors?.endTime ? (
                                    <p
                                        id="monthly-end-time-error"
                                        className="text-sm text-destructive"
                                    >
                                        {visibleState.fieldErrors.endTime}
                                    </p>
                                ) : null}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="monthly-employee">Funcionário</Label>
                                <select
                                    id="monthly-employee"
                                    name="employee_id"
                                    defaultValue=""
                                    className="h-9 rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                    aria-describedby={
                                        visibleState.fieldErrors?.employeeId
                                            ? "monthly-employee-error"
                                            : undefined
                                    }
                                    aria-invalid={Boolean(
                                        visibleState.fieldErrors?.employeeId
                                    )}
                                >
                                    <option value="">Sem funcionário</option>
                                    {employees.map((employee) => (
                                        <option key={employee.id} value={employee.id}>
                                            {employee.name}
                                        </option>
                                    ))}
                                </select>
                                {visibleState.fieldErrors?.employeeId ? (
                                    <p
                                        id="monthly-employee-error"
                                        className="text-sm text-destructive"
                                    >
                                        {visibleState.fieldErrors.employeeId}
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        <div className="relative grid gap-2">
                            <Label>Utentes</Label>
                            <Button
                                type="button"
                                variant="outline"
                                className="justify-between"
                                onClick={() => setPatientsOpen((current) => !current)}
                            >
                                <span>
                                    {allPatients
                                        ? `Todos (${filteredPatients.length})`
                                        : `${selectedCount} selecionados`}
                                </span>
                                <ChevronDownIcon />
                            </Button>

                            {allPatients ? (
                                <input type="hidden" name="all_patients" value="on" />
                            ) : (
                                Array.from(visibleSelectedPatientIds).map((patientId) => (
                                    <input
                                        key={patientId}
                                        type="hidden"
                                        name="patient_ids"
                                        value={patientId}
                                    />
                                ))
                            )}

                            {patientsOpen ? (
                                <div className="absolute top-full z-20 mt-2 grid max-h-64 w-full gap-2 overflow-y-auto rounded-md border bg-popover p-3 text-sm shadow-md">
                                    <Label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
                                        <input
                                            type="checkbox"
                                            checked={allPatients}
                                            onChange={(event) =>
                                                toggleAllPatients(event.target.checked)
                                            }
                                            className="size-4 rounded border-input accent-foreground"
                                        />
                                        Todos
                                    </Label>

                                    <div className="h-px bg-border" />

                                    {filteredPatients.length === 0 ? (
                                        <p className="px-2 py-1.5 text-muted-foreground">
                                            Não há utentes ativos neste local.
                                        </p>
                                    ) : (
                                        filteredPatients.map((patient) => (
                                            <Label
                                                key={patient.id}
                                                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={visibleSelectedPatientIds.has(
                                                        patient.id
                                                    )}
                                                    onChange={(event) =>
                                                        togglePatient(
                                                            patient.id,
                                                            event.target.checked
                                                        )
                                                    }
                                                    className="size-4 rounded border-input accent-foreground"
                                                />
                                                <span>
                                                    {patient.name}
                                                    {patient.is_diabetic
                                                        ? " · diabético"
                                                        : ""}
                                                </span>
                                            </Label>
                                        ))
                                    )}
                                </div>
                            ) : null}

                            {visibleState.fieldErrors?.patientIds ? (
                                <p className="text-sm text-destructive">
                                    {visibleState.fieldErrors.patientIds}
                                </p>
                            ) : null}
                        </div>

                        {visibleState.message ? (
                            <p
                                className={cn(
                                    "text-sm",
                                    visibleState.status === "error"
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                )}
                                role={
                                    visibleState.status === "error" ? "alert" : "status"
                                }
                            >
                                {visibleState.message}
                            </p>
                        ) : null}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeDialog}>
                                Cancelar
                            </Button>
                            <SubmitButton disabled={isDisabled || selectedCount === 0} />
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
