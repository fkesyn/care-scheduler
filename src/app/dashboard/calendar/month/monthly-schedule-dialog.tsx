"use client";

import { CalendarPlusIcon, ChevronDownIcon } from "lucide-react";
import { Fragment, useActionState, useMemo, useState } from "react";
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
import { Spinner } from "@/components/ui/spinner";
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

const weekdayOptions = [
    { value: 1, label: "Segunda-feira", shortLabel: "Seg" },
    { value: 2, label: "Terça-feira", shortLabel: "Ter" },
    { value: 3, label: "Quarta-feira", shortLabel: "Qua" },
    { value: 4, label: "Quinta-feira", shortLabel: "Qui" },
    { value: 5, label: "Sexta-feira", shortLabel: "Sex" },
    { value: 6, label: "Sábado", shortLabel: "Sáb" },
    { value: 0, label: "Domingo", shortLabel: "Dom" },
];

const weekdayValues = weekdayOptions.map((option) => option.value);
const weekdayCapacityDefaults = Object.fromEntries(
    weekdayOptions.map((option) => [option.value, "1"])
) as Record<number, string>;

function daysInMonth(monthValue: string) {
    const [year, month] = monthValue.split("-").map(Number);

    if (!year || !month) {
        return 31;
    }

    return new Date(year, month, 0).getDate();
}

function serviceLabel(service: ServiceOption) {
    const suffix =
        service.measurement_type === "blood_pressure"
            ? "TA"
            : service.measurement_type === "glucose"
              ? "glicémia"
              : service.measurement_type === "wound_care"
                ? "ferida"
              : null;

    return `${service.name}${suffix ? ` · ${suffix}` : ""}`;
}

function normalizeText(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function isNailCareService(service: ServiceOption | undefined) {
    return service ? normalizeText(service.name).includes("unha") : false;
}

function patientIdsForService(
    patientOptions: PatientOption[],
    locationId: string,
    service: ServiceOption | undefined
) {
    const shouldSelectDiabeticPatients = isNailCareService(service);

    return new Set(
        patientOptions
            .filter((patient) => patient.location_id === locationId)
            .filter(
                (patient) =>
                    !shouldSelectDiabeticPatients || Boolean(patient.is_diabetic)
            )
            .map((patient) => patient.id)
    );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending || disabled}>
            {pending ? (
                <>
                    <Spinner />
                    A criar...
                </>
            ) : (
                "Criar agendamento mensal"
            )}
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
    const defaultServiceId = services[0]?.id ?? "";
    const [state, formAction] = useActionState(
        createMonthlyAppointments,
        initialState
    );
    const { closeDialog, open, setOpen, showFormAgain, visibleState } =
        useActionDialog(state, initialState);

    const [monthValue, setMonthValue] = useState(defaultMonth);
    const [locationId, setLocationId] = useState(defaultLocationId);
    const [serviceId, setServiceId] = useState(defaultServiceId);
    const [startDay, setStartDay] = useState("1");
    const [endDay, setEndDay] = useState(String(daysInMonth(defaultMonth)));
    const [weekdaysOpen, setWeekdaysOpen] = useState(false);
    const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(
        () => new Set(weekdayValues)
    );
    const [weekdayCapacities, setWeekdayCapacities] = useState<
        Record<number, string>
    >(weekdayCapacityDefaults);
    const [patientsOpen, setPatientsOpen] = useState(false);
    const [allPatients, setAllPatients] = useState(
        () => !isNailCareService(services.find((service) => service.id === defaultServiceId))
    );
    const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(
        () =>
            patientIdsForService(
                patients,
                defaultLocationId,
                services.find((service) => service.id === defaultServiceId)
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

    const selectedService = services.find((service) => service.id === serviceId);
    const isNailCareSelected = isNailCareService(selectedService);
    const selectedCount = visibleSelectedPatientIds.size;
    const selectedPatientsAreDiabetic = filteredPatients
        .filter((patient) => visibleSelectedPatientIds.has(patient.id))
        .every((patient) => Boolean(patient.is_diabetic));
    const selectedWeekdayOptions = weekdayOptions.filter((option) =>
        selectedWeekdays.has(option.value)
    );
    const selectedCapacities = selectedWeekdayOptions.map((option) =>
        Number(weekdayCapacities[option.value] || 1)
    );
    const isWeekdaysOnly =
        selectedWeekdays.size === 5 &&
        [1, 2, 3, 4, 5].every((weekday) => selectedWeekdays.has(weekday));
    const weekdayLabel =
        selectedWeekdays.size === 7
            ? "Todos os dias"
            : isWeekdaysOnly
              ? "Dias úteis"
              : selectedWeekdays.size === 0
                ? "Nenhum dia selecionado"
                : selectedWeekdayOptions
                      .map((option) => option.shortLabel)
                      .join(", ");
    const weekdayCapacityLabel =
        selectedCapacities.length > 0 &&
        selectedCapacities.every((capacity) => capacity === selectedCapacities[0])
            ? `${selectedCapacities[0]} utente${
                  selectedCapacities[0] === 1 ? "" : "s"
              }/dia`
            : "capacidade personalizada";
    const isDisabled =
        locations.length === 0 || services.length === 0 || filteredPatients.length === 0;

    function handleMonthChange(nextMonth: string) {
        const newMonthDays = daysInMonth(nextMonth);

        setMonthValue(nextMonth);
        setStartDay("1");
        setEndDay(String(newMonthDays));
    }

    function handleLocationChange(nextLocationId: string) {
        const selectedServiceForLocation = services.find(
            (service) => service.id === serviceId
        );
        const ids = patientIdsForService(
            patients,
            nextLocationId,
            selectedServiceForLocation
        );

        setLocationId(nextLocationId);
        setAllPatients(!isNailCareService(selectedServiceForLocation));
        setSelectedPatientIds(ids);
        setPatientsOpen(false);
    }

    function handleServiceChange(nextServiceId: string) {
        const nextService = services.find((service) => service.id === nextServiceId);
        const ids = patientIdsForService(patients, locationId, nextService);

        setServiceId(nextServiceId);
        setAllPatients(!isNailCareService(nextService));
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

    function toggleWeekday(weekday: number, checked: boolean) {
        setSelectedWeekdays((current) => {
            const next = new Set(current);

            if (checked) {
                next.add(weekday);
            } else {
                next.delete(weekday);
            }

            return next;
        });
    }

    function setWeekdayPreset(weekdays: number[]) {
        setSelectedWeekdays(new Set(weekdays));
    }

    function updateWeekdayCapacity(weekday: number, capacity: string) {
        setWeekdayCapacities((current) => ({
            ...current,
            [weekday]: capacity,
        }));
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
                        Cria marcações em lote, por ordem alfabética, respeitando os
                        dias e a capacidade diária escolhida.
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

                        <div className="relative grid gap-2">
                            <Label>Dias da semana</Label>
                            <Button
                                type="button"
                                variant="outline"
                                className="justify-between"
                                onClick={() => {
                                    setWeekdaysOpen((current) => !current);
                                    setPatientsOpen(false);
                                }}
                            >
                                <span className="truncate">
                                    {weekdayLabel} · {weekdayCapacityLabel}
                                </span>
                                <ChevronDownIcon />
                            </Button>

                            {selectedWeekdayOptions.map((option) => (
                                <Fragment key={option.value}>
                                    <input
                                        type="hidden"
                                        name="weekdays"
                                        value={option.value}
                                    />
                                    <input
                                        type="hidden"
                                        name={`weekday_capacity_${option.value}`}
                                        value={weekdayCapacities[option.value] ?? "1"}
                                    />
                                </Fragment>
                            ))}

                            {weekdaysOpen ? (
                                <div className="absolute top-full z-30 mt-2 grid max-h-80 w-full gap-3 overflow-y-auto rounded-md border bg-popover p-3 text-sm shadow-md">
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            onClick={() =>
                                                setWeekdayPreset(weekdayValues)
                                            }
                                        >
                                            Todos
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            onClick={() =>
                                                setWeekdayPreset([1, 2, 3, 4, 5])
                                            }
                                        >
                                            Dias úteis
                                        </Button>
                                    </div>

                                    <div className="h-px bg-border" />

                                    {weekdayOptions.map((option) => {
                                        const checked = selectedWeekdays.has(
                                            option.value
                                        );

                                        return (
                                            <div
                                                key={option.value}
                                                className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
                                            >
                                                <Label className="flex min-w-0 items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(event) =>
                                                            toggleWeekday(
                                                                option.value,
                                                                event.target.checked
                                                            )
                                                        }
                                                        className="size-4 rounded border-input accent-foreground"
                                                    />
                                                    <span className="truncate">
                                                        {option.label}
                                                    </span>
                                                </Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={50}
                                                        value={
                                                            weekdayCapacities[
                                                                option.value
                                                            ] ?? "1"
                                                        }
                                                        disabled={!checked}
                                                        onChange={(event) =>
                                                            updateWeekdayCapacity(
                                                                option.value,
                                                                event.target.value
                                                            )
                                                        }
                                                        className="h-8 w-16"
                                                        aria-label={`Utentes por ${option.label}`}
                                                    />
                                                    <span className="text-xs text-muted-foreground">
                                                        /dia
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}

                            {visibleState.fieldErrors?.weekdays ? (
                                <p className="text-sm text-destructive">
                                    {visibleState.fieldErrors.weekdays}
                                </p>
                            ) : null}
                            {visibleState.fieldErrors?.weekdayCapacity ? (
                                <p className="text-sm text-destructive">
                                    {visibleState.fieldErrors.weekdayCapacity}
                                </p>
                            ) : null}
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
                                    value={serviceId}
                                    onChange={(event) =>
                                        handleServiceChange(event.target.value)
                                    }
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

                        <div className="grid gap-4">
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
                                onClick={() => {
                                    setPatientsOpen((current) => !current);
                                    setWeekdaysOpen(false);
                                }}
                            >
                                <span>
                                    {allPatients
                                        ? `Todos (${filteredPatients.length})`
                                        : isNailCareSelected && selectedPatientsAreDiabetic
                                          ? `${selectedCount} diabéticos selecionados`
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
                            <SubmitButton
                                disabled={
                                    isDisabled ||
                                    selectedCount === 0 ||
                                    selectedWeekdays.size === 0
                                }
                            />
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
