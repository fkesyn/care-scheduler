import Link from "next/link";
import { connection } from "next/server";
import { CheckSquareIcon, DownloadIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ChangeMonthStatusDialog } from "./change-month-status-dialog";
import { ClearMonthAppointmentsDialog } from "./clear-month-appointments-dialog";
import { MonthFilters } from "./month-filters";
import {
    MonthNavigationButton,
    MonthNavigationProvider,
} from "./month-navigation";
import { MonthlyScheduleDialog } from "./monthly-schedule-dialog";

type MonthPageProps = {
    searchParams: Promise<{
        date?: string;
        locationId?: string;
        employeeId?: string;
        patientId?: string;
        serviceId?: string;
    }>;
};

type Location = {
    id: string;
    name: string;
    color: string | null;
};

type Employee = {
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

type AppointmentRelation<T> = T | T[] | null;

type Appointment = {
    id: string;
    scheduled_date: string;
    status: string;
    patients: AppointmentRelation<{
        id: string;
        name: string;
        location_id: string | null;
    }>;
    services: AppointmentRelation<{
        id: string;
        name: string;
    }>;
};

type MonthBulkAppointment = {
    id: string;
    employee_id: string | null;
    service_id: string | null;
    employees: AppointmentRelation<{
        id: string;
        name: string;
    }>;
    services: AppointmentRelation<{
        id: string;
        name: string;
    }>;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function formatDateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function parseDate(dateValue: string) {
    const [year, month, day] = dateValue.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function addMonths(dateValue: string, months: number) {
    const date = parseDate(dateValue);
    date.setMonth(date.getMonth() + months);

    return formatDateInput(date);
}

function AppointmentStatusIcon({ status }: { status: string }) {
    if (status === "completed") {
        return (
            <CheckSquareIcon
                className="size-3.5 shrink-0 text-green-600"
                aria-label="Concluído"
                role="img"
            />
        );
    }

    if (status === "canceled") {
        return (
            <XIcon
                className="size-3.5 shrink-0 text-red-600"
                aria-label="Cancelado"
                role="img"
            />
        );
    }

    return null;
}

function formatMonthLabel(dateValue: string) {
    const date = parseDate(dateValue);

    return new Intl.DateTimeFormat("pt-PT", {
        month: "long",
        year: "numeric",
    }).format(date);
}

function buildMonthDays(selectedDate: string) {
    const date = parseDate(selectedDate);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const firstDayOffset = start.getDay() === 0 ? 6 : start.getDay() - 1;

    const days: Array<{
        date: Date;
        dateValue: string;
        isCurrentMonth: boolean;
    }> = [];

    const gridStart = new Date(start);
    gridStart.setDate(start.getDate() - firstDayOffset);

    for (let i = 0; i < 42; i++) {
        const day = new Date(gridStart);
        day.setDate(gridStart.getDate() + i);

        days.push({
            date: day,
            dateValue: formatDateInput(day),
            isCurrentMonth: day.getMonth() === start.getMonth(),
        });
    }

    return {
        days,
        startValue: formatDateInput(start),
        endValue: formatDateInput(end),
    };
}

function firstRelation<T>(relation: T | T[] | null) {
    if (Array.isArray(relation)) {
        return relation[0] ?? null;
    }

    return relation;
}

export default async function CalendarMonthPage({ searchParams }: MonthPageProps) {
    await connection();

    const params = await searchParams;

    const selectedDate =
        params.date && datePattern.test(params.date)
            ? params.date
            : formatDateInput(new Date());

    const { days, startValue, endValue } = buildMonthDays(selectedDate);

    const supabase = await createClient();

    const [
        { data: locations, error: locationsError },
        { data: employees, error: employeesError },
        { data: patients, error: patientsError },
        { data: services, error: servicesError },
    ] = await Promise.all([
        supabase.from("locations").select("id, name, color").order("name"),
        supabase
            .from("employees")
            .select("id, name")
            .eq("active", true)
            .order("name"),
        supabase
            .from("patients")
            .select("id, name, location_id, is_diabetic")
            .eq("active", true)
            .order("name"),
        supabase
            .from("services")
            .select("id, name, measurement_type")
            .eq("active", true)
            .order("name"),
    ]);

    const filterLoadError =
        locationsError ?? employeesError ?? patientsError ?? servicesError;

    if (filterLoadError) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold">Vista mensal</h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar filtros: {filterLoadError.message}
                    </p>
                </div>
            </div>
        );
    }

    const locationRows = (locations ?? []) as Location[];
    const employeeRows = (employees ?? []) as Employee[];
    const patientRows = (patients ?? []) as PatientOption[];
    const serviceRows = (services ?? []) as ServiceOption[];

    const selectedLocationId =
        params.locationId &&
        locationRows.some((location) => location.id === params.locationId)
            ? params.locationId
            : locationRows[0]?.id ?? "";

    const selectedEmployeeId =
        params.employeeId &&
        employeeRows.some((employee) => employee.id === params.employeeId)
            ? params.employeeId
            : "";

    const selectedPatientId =
        params.patientId &&
        patientRows.some((patient) => patient.id === params.patientId)
            ? params.patientId
            : "";

    const selectedServiceId =
        params.serviceId &&
        serviceRows.some((service) => service.id === params.serviceId)
            ? params.serviceId
            : "";

    function buildMonthHref(overrides: {
        date?: string;
        locationId?: string;
        employeeId?: string;
        patientId?: string;
        serviceId?: string;
    }) {
        const query = new URLSearchParams();

        query.set("date", overrides.date ?? selectedDate);

        const locationId = overrides.locationId ?? selectedLocationId;
        const employeeId = overrides.employeeId ?? selectedEmployeeId;
        const patientId = overrides.patientId ?? selectedPatientId;
        const serviceId = overrides.serviceId ?? selectedServiceId;

        if (locationId) query.set("locationId", locationId);
        if (employeeId) query.set("employeeId", employeeId);
        if (patientId) query.set("patientId", patientId);
        if (serviceId) query.set("serviceId", serviceId);

        return `/dashboard/calendar/month?${query.toString()}`;
    }

    function buildDayHref(dateValue: string) {
        const query = new URLSearchParams();

        query.set("date", dateValue);

        if (selectedLocationId) query.set("locationId", selectedLocationId);
        if (selectedEmployeeId) query.set("employeeId", selectedEmployeeId);
        if (selectedPatientId) query.set("patientId", selectedPatientId);
        if (selectedServiceId) query.set("serviceId", selectedServiceId);

        return `/dashboard/calendar?${query.toString()}`;
    }

    function buildExportHref() {
        const query = new URLSearchParams();

        query.set("date", selectedDate);

        if (selectedLocationId) query.set("locationId", selectedLocationId);
        if (selectedEmployeeId) query.set("employeeId", selectedEmployeeId);
        if (selectedPatientId) query.set("patientId", selectedPatientId);
        if (selectedServiceId) query.set("serviceId", selectedServiceId);

        return `/dashboard/calendar/month/export?${query.toString()}`;
    }

    let appointmentsQuery = supabase
        .from("appointments")
        .select(
            `
        id,
        scheduled_date,
        status,
        patients!inner (
          id,
          name,
          location_id
        ),
        services (
          id,
          name
        )
      `
        )
        .gte("scheduled_date", startValue)
        .lte("scheduled_date", endValue)
        .order("scheduled_date")
        .order("created_at");

    if (selectedLocationId) {
        appointmentsQuery = appointmentsQuery.eq(
            "patients.location_id",
            selectedLocationId
        );
    }

    if (selectedEmployeeId) {
        appointmentsQuery = appointmentsQuery.eq("employee_id", selectedEmployeeId);
    }

    if (selectedPatientId) {
        appointmentsQuery = appointmentsQuery.eq("patient_id", selectedPatientId);
    }

    if (selectedServiceId) {
        appointmentsQuery = appointmentsQuery.eq("service_id", selectedServiceId);
    }

    const { data, error } = await appointmentsQuery;

    const { data: monthBulkData, error: monthBulkError } = await supabase
        .from("appointments")
        .select(
            `
        id,
        employee_id,
        service_id,
        employees (
          id,
          name
        ),
        services (
          id,
          name
        )
      `
        )
        .gte("scheduled_date", startValue)
        .lte("scheduled_date", endValue);

    const calendarError = error ?? monthBulkError;

    if (calendarError) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold">Vista mensal</h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar calendário mensal: {calendarError.message}
                    </p>
                </div>
            </div>
        );
    }

    const appointments = (data ?? []) as Appointment[];
    const monthBulkAppointments = (monthBulkData ?? []) as MonthBulkAppointment[];
    const appointmentsByDate = new Map<string, Appointment[]>();
    const bulkServicesById = new Map<string, { id: string; name: string }>();
    const bulkEmployeesById = new Map<string, { id: string; name: string }>();
    let hasUnassignedAppointments = false;

    for (const appointment of appointments) {
        const current = appointmentsByDate.get(appointment.scheduled_date) ?? [];
        current.push(appointment);
        appointmentsByDate.set(appointment.scheduled_date, current);
    }

    for (const appointment of monthBulkAppointments) {
        const service = firstRelation(appointment.services);
        const employee = firstRelation(appointment.employees);

        if (service) {
            bulkServicesById.set(service.id, service);
        }

        if (employee) {
            bulkEmployeesById.set(employee.id, employee);
        } else {
            hasUnassignedAppointments = true;
        }
    }

    const monthBulkServices = Array.from(bulkServicesById.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "pt-PT", { sensitivity: "base" })
    );
    const monthBulkEmployees = Array.from(bulkEmployeesById.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "pt-PT", { sensitivity: "base" })
    );
    const locationColorById = new Map(
        locationRows.map((location) => [location.id, location.color] as const)
    );
    const hasMonthAppointments = monthBulkAppointments.length > 0;

    return (
        <MonthNavigationProvider currentHref={buildMonthHref({})}>
            <div className="p-6">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Calendário mensal</h1>
                        <p className="text-sm capitalize text-muted-foreground">
                            {formatMonthLabel(selectedDate)}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <MonthNavigationButton
                            href={buildMonthHref({ date: addMonths(selectedDate, -1) })}
                            size="sm"
                            variant="outline"
                        >
                            Anterior
                        </MonthNavigationButton>

                        <MonthNavigationButton
                            href={buildMonthHref({ date: formatDateInput(new Date()) })}
                            size="sm"
                            variant="secondary"
                        >
                            Este mês
                        </MonthNavigationButton>

                        <MonthNavigationButton
                            href={buildMonthHref({ date: addMonths(selectedDate, 1) })}
                            size="sm"
                            variant="outline"
                        >
                            Seguinte
                        </MonthNavigationButton>

                        <Button asChild size="sm">
                            <Link href={buildDayHref(selectedDate)}>Ver dia</Link>
                        </Button>
                    </div>
                </header>

                <div className="flex flex-wrap gap-2">
                    <MonthlyScheduleDialog
                        selectedDate={selectedDate}
                        selectedLocationId={selectedLocationId}
                        locations={locationRows}
                        employees={employeeRows}
                        patients={patientRows}
                        services={serviceRows}
                    />
                    {hasMonthAppointments ? (
                        <ChangeMonthStatusDialog
                            selectedDate={selectedDate}
                            services={monthBulkServices}
                            employees={monthBulkEmployees}
                            hasUnassignedAppointments={hasUnassignedAppointments}
                        />
                    ) : null}
                    <ClearMonthAppointmentsDialog selectedDate={selectedDate} />
                    <Button asChild size="sm" variant="outline">
                        <Link href={buildExportHref()}>
                            <DownloadIcon />
                            Exportar Excel
                        </Link>
                    </Button>
                </div>

                <MonthFilters
                    selectedDate={selectedDate}
                    selectedLocationId={selectedLocationId}
                    selectedEmployeeId={selectedEmployeeId}
                    selectedPatientId={selectedPatientId}
                    selectedServiceId={selectedServiceId}
                    locations={locationRows}
                    employees={employeeRows}
                    patients={patientRows}
                    services={serviceRows}
                />

                <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
                    <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
                        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
                            <div key={day} className="p-3">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7">
                        {days.map((day) => {
                            const dayAppointments = appointmentsByDate.get(day.dateValue) ?? [];
                            const isToday = day.dateValue === formatDateInput(new Date());

                            return (
                                <Link
                                    key={day.dateValue}
                                    href={buildDayHref(day.dateValue)}
                                    className={[
                                        "min-h-32 border-b border-r p-2 transition-colors hover:bg-muted/50",
                                        !day.isCurrentMonth
                                            ? "bg-muted/20 text-muted-foreground"
                                            : "",
                                        isToday ? "bg-primary/5" : "",
                                    ].join(" ")}
                                >
                                    <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {day.date.getDate()}
                    </span>

                                        {dayAppointments.length > 0 ? (
                                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {dayAppointments.length}
                      </span>
                                        ) : null}
                                    </div>

                                    <div className="grid gap-1">
                                        {dayAppointments.slice(0, 3).map((appointment) => {
                                            const patient = firstRelation(appointment.patients);
                                            const service = firstRelation(appointment.services);
                                            const patientColor = patient?.location_id
                                                ? locationColorById.get(patient.location_id)
                                                : null;

                                            return (
                                                <div
                                                    key={appointment.id}
                                                    className="min-w-0 rounded-md border bg-background px-2 py-1 text-xs"
                                                >
                                                    <div className="flex min-w-0 items-center gap-1">
                                                        <AppointmentStatusIcon
                                                            status={appointment.status}
                                                        />
                                                        <span
                                                            className="min-w-0 truncate"
                                                            style={{
                                                                color: patientColor ?? undefined,
                                                            }}
                                                        >
                                                            {patient?.name ?? "Utente"}
                                                        </span>
                                                    </div>

                                                    <div className="mt-1 min-w-0 text-muted-foreground">
                                                        <span className="block truncate">
                                                            {service?.name ?? "Serviço"}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {dayAppointments.length > 3 ? (
                                            <p className="text-xs text-muted-foreground">
                                                +{dayAppointments.length - 3} mais
                                            </p>
                                        ) : null}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            </div>
        </div>
        </MonthNavigationProvider>
    );
}
