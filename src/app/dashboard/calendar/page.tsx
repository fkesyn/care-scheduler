import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { AppointmentDetailsDialog } from "./appointment-details-dialog";
import {
    NewAppointmentDialog,
    type AppointmentEmployeeOption,
    type AppointmentPatientOption,
    type AppointmentServiceOption,
} from "./new-appointment-dialog";

type CalendarPageProps = {
    searchParams: Promise<{
        date?: string;
    }>;
};

type Location = {
    id: string;
    name: string;
};

type Patient = {
    id: string;
    name: string;
    room: string | null;
    location_id: string | null;
    is_diabetic: boolean | null;
    active: boolean | null;
};

type Service = {
    id: string;
    name: string;
    duration_minutes: number | null;
    color: string | null;
    measurement_type: string | null;
    active: boolean | null;
};

type Employee = {
    id: string;
    name: string;
    role: string;
    active: boolean | null;
};

type AppointmentPatient = {
    id: string;
    name: string;
    room: string | null;
    location_id: string | null;
};

type AppointmentService = {
    id: string;
    name: string;
    color: string | null;
    duration_minutes: number | null;
    measurement_type: string | null;
};

type AppointmentEmployee = {
    id: string;
    name: string;
    role: string;
};

type AppointmentProfile = {
    full_name: string | null;
    email: string | null;
};

type Appointment = {
    id: string;
    scheduled_date: string;
    start_time: string;
    end_time: string;
    status: string;
    notes: string | null;
    employees: AppointmentEmployee | AppointmentEmployee[] | null;
    patients: AppointmentPatient | AppointmentPatient[] | null;
    services: AppointmentService | AppointmentService[] | null;
    created_profile: AppointmentProfile | AppointmentProfile[] | null;
    updated_profile: AppointmentProfile | AppointmentProfile[] | null;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function formatDateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function addDays(dateValue: string, days: number) {
    const [year, month, day] = dateValue.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);

    return formatDateInput(date);
}

function formatDateLabel(dateValue: string) {
    const [year, month, day] = dateValue.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return new Intl.DateTimeFormat("pt-PT", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(date);
}

function formatTime(timeValue: string) {
    return timeValue.slice(0, 5);
}

function measurementLabel(type: string | null | undefined) {
    if (type === "blood_pressure") {
        return "TA";
    }

    if (type === "glucose") {
        return "Glicémia";
    }

    return null;
}

function roleLabel(role: string | null | undefined) {
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

function firstRelation<T>(relation: T | T[] | null) {
    if (Array.isArray(relation)) {
        return relation[0] ?? null;
    }

    return relation;
}

function profileLabel(profile: AppointmentProfile | null) {
    return profile?.full_name ?? profile?.email ?? null;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
    await connection();

    const params = await searchParams;

    if (!params.date) {
        redirect(`/dashboard/calendar/month?date=${formatDateInput(new Date())}`);
    }

    const selectedDate =
        params.date && datePattern.test(params.date)
            ? params.date
            : formatDateInput(new Date());

    const supabase = await createClient();

    const [
        { data: locations, error: locationsError },
        { data: employees, error: employeesError },
        { data: patients, error: patientsError },
        { data: services, error: servicesError },
        { data: appointments, error: appointmentsError },
    ] = await Promise.all([
        supabase.from("locations").select("id, name").order("name"),
        supabase
            .from("employees")
            .select("id, name, role, active")
            .eq("active", true)
            .order("name"),
        supabase
            .from("patients")
            .select("id, name, room, location_id, is_diabetic, active")
            .eq("active", true)
            .order("name"),
        supabase
            .from("services")
            .select("id, name, duration_minutes, color, measurement_type, active")
            .eq("active", true)
            .order("name"),
        supabase
            .from("appointments")
            .select(
                `
          id,
          scheduled_date,
          start_time,
          end_time,
          status,
          notes,
          employees (
            id,
            name,
            role
          ),
          patients (
            id,
            name,
            room,
            location_id
          ),
          services (
            id,
            name,
            color,
            duration_minutes,
            measurement_type
          ),
          created_profile:profiles!appointments_created_by_fkey (
            full_name,
            email
          ),
          updated_profile:profiles!appointments_updated_by_fkey (
            full_name,
            email
          )
        `
            )
            .eq("scheduled_date", selectedDate)
            .order("start_time"),
    ]);

    const loadError =
        locationsError ??
        employeesError ??
        patientsError ??
        servicesError ??
        appointmentsError;

    if (loadError) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold">Calendário</h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar calendário: {loadError.message}
                    </p>
                </div>
            </div>
        );
    }

    const locationRows = (locations ?? []) as Location[];
    const employeeRows = (employees ?? []) as Employee[];
    const patientRows = (patients ?? []) as Patient[];
    const serviceRows = (services ?? []) as Service[];
    const appointmentRows = (appointments ?? []) as Appointment[];

    const locationNameById = new Map(
        locationRows.map((location) => [location.id, location.name] as const)
    );

    const employeeOptions: AppointmentEmployeeOption[] = employeeRows.map(
        (employee) => ({
            id: employee.id,
            name: employee.name,
            role: employee.role,
        })
    );

    const patientOptions: AppointmentPatientOption[] = patientRows.map(
        (patient) => ({
            id: patient.id,
            name: patient.name,
            room: patient.room,
            isDiabetic: Boolean(patient.is_diabetic),
            locationName: patient.location_id
                ? locationNameById.get(patient.location_id) ?? "Sem local"
                : "Sem local",
        })
    );

    const serviceOptions: AppointmentServiceOption[] = serviceRows.map(
        (service) => ({
            id: service.id,
            name: service.name,
            durationMinutes: service.duration_minutes ?? 30,
            measurementType: service.measurement_type,
        })
    );

    return (
        <div className="p-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-2xl font-semibold">Calendário</h1>
                            <p className="text-sm capitalize text-muted-foreground">
                                {formatDateLabel(selectedDate)}
                            </p>
                        </div>

                        <NewAppointmentDialog
                            employees={employeeOptions}
                            patients={patientOptions}
                            services={serviceOptions}
                            selectedDate={selectedDate}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                            <Link href={`/dashboard/calendar?date=${addDays(selectedDate, -1)}`}>
                                Dia anterior
                            </Link>
                        </Button>

                        <Button asChild size="sm" variant="secondary">
                            <Link href={`/dashboard/calendar?date=${formatDateInput(new Date())}`}>
                                Hoje
                            </Link>
                        </Button>

                        <Button asChild size="sm" variant="outline">
                            <Link href={`/dashboard/calendar?date=${addDays(selectedDate, 1)}`}>
                                Dia seguinte
                            </Link>
                        </Button>

                        <Button asChild size="sm" variant="outline">
                            <Link href={`/dashboard/calendar/month?date=${selectedDate}`}>
                                Ver mês
                            </Link>
                        </Button>
                    </div>
                </header>

                <section className="rounded-lg border bg-card shadow-xs">
                    {appointmentRows.length === 0 ? (
                        <div className="flex min-h-44 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                            Não há marcações para este dia.
                        </div>
                    ) : (
                        <div className="divide-y">
                            {appointmentRows.map((appointment) => {
                                const employee = firstRelation(appointment.employees);
                                const patient = firstRelation(appointment.patients);
                                const service = firstRelation(appointment.services);
                                const createdProfile = firstRelation(appointment.created_profile);
                                const updatedProfile = firstRelation(appointment.updated_profile);

                                const measurement = measurementLabel(service?.measurement_type);
                                const locationName = patient?.location_id
                                    ? locationNameById.get(patient.location_id) ?? null
                                    : null;

                                return (
                                    <AppointmentDetailsDialog
                                        key={appointment.id}
                                        employees={employeeOptions}
                                        patients={patientOptions}
                                        services={serviceOptions}
                                        appointment={{
                                            id: appointment.id,
                                            color: service?.color ?? "#0f766e",
                                            employeeId: employee?.id ?? null,
                                            employeeLabel: employee
                                                ? `${employee.name} · ${roleLabel(employee.role)}`
                                                : null,
                                            locationName,
                                            measurementLabel: measurement,
                                            notes: appointment.notes,
                                            patientId: patient?.id ?? null,
                                            patientName: patient?.name ?? "Utente removido",
                                            patientRoom: patient?.room ?? null,
                                            scheduledDate: appointment.scheduled_date,
                                            serviceId: service?.id ?? null,
                                            serviceName: service?.name ?? "Serviço removido",
                                            startTime: formatTime(appointment.start_time),
                                            status: appointment.status,
                                            timeLabel: `${formatTime(appointment.start_time)}-${formatTime(
                                                appointment.end_time
                                            )}`,
                                            createdBy: profileLabel(createdProfile),
                                            updatedBy: profileLabel(updatedProfile),
                                        }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
