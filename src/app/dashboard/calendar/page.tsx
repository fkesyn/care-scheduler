import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { canManageData, getCurrentUserRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
    AppointmentDetailsDialog,
    type AppointmentDetails,
} from "./appointment-details-dialog";
import {
    NewAppointmentDialog,
    type AppointmentEmployeeOption,
    type AppointmentPatientOption,
    type AppointmentServiceOption,
} from "./new-appointment-dialog";
import {
    calendarServiceLabel,
    clinicalRecordTypeForService,
} from "./service-display";

type CalendarPageProps = {
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

type Patient = {
    id: string;
    name: string;
    location_id: string | null;
    is_diabetic: boolean | null;
    active: boolean | null;
};

type Service = {
    id: string;
    name: string;
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
    location_id: string | null;
};

type AppointmentService = {
    id: string;
    name: string;
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

type AppointmentClinicalRecord = {
    record_type: string;
    blood_pressure_value: string | null;
    wound_characteristics: string | null;
    wound_treatment: string | null;
};

type Appointment = {
    id: string;
    scheduled_date: string;
    status: string;
    notes: string | null;
    employees: AppointmentEmployee | AppointmentEmployee[] | null;
    patients: AppointmentPatient | AppointmentPatient[] | null;
    services: AppointmentService | AppointmentService[] | null;
    created_profile: AppointmentProfile | AppointmentProfile[] | null;
    updated_profile: AppointmentProfile | AppointmentProfile[] | null;
    appointment_clinical_records:
        | AppointmentClinicalRecord
        | AppointmentClinicalRecord[]
        | null;
};

type AppointmentGroup = {
    key: string;
    locationName: string | null;
    patientName: string;
    patientNameColor: string | null;
    appointments: AppointmentDetails[];
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

function measurementLabel(type: string | null | undefined) {
    if (type === "blood_pressure") {
        return "TA";
    }

    if (type === "glucose") {
        return "Glicémia";
    }

    if (type === "wound_care") {
        return "Ferida";
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

function groupAppointmentsByPatient(appointments: AppointmentDetails[]) {
    const groups = new Map<string, AppointmentGroup>();

    for (const appointment of appointments) {
        const key = appointment.patientId ?? `appointment:${appointment.id}`;
        const current =
            groups.get(key) ??
            ({
                appointments: [],
                key,
                locationName: appointment.locationName,
                patientName: appointment.patientName,
                patientNameColor: appointment.patientNameColor,
            } satisfies AppointmentGroup);

        current.appointments.push(appointment);
        groups.set(key, current);
    }

    return Array.from(groups.values());
}

function buildCalendarHref(
    dateValue: string,
    filters: {
        locationId?: string;
        employeeId?: string;
        patientId?: string;
        serviceId?: string;
    }
) {
    const query = new URLSearchParams();

    query.set("date", dateValue);

    if (filters.locationId) query.set("locationId", filters.locationId);
    if (filters.employeeId) query.set("employeeId", filters.employeeId);
    if (filters.patientId) query.set("patientId", filters.patientId);
    if (filters.serviceId) query.set("serviceId", filters.serviceId);

    return `/dashboard/calendar?${query.toString()}`;
}

function buildMonthHref(
    dateValue: string,
    filters: {
        locationId?: string;
        employeeId?: string;
        patientId?: string;
        serviceId?: string;
    }
) {
    const query = new URLSearchParams();

    query.set("date", dateValue);

    if (filters.locationId) query.set("locationId", filters.locationId);
    if (filters.employeeId) query.set("employeeId", filters.employeeId);
    if (filters.patientId) query.set("patientId", filters.patientId);
    if (filters.serviceId) query.set("serviceId", filters.serviceId);

    return `/dashboard/calendar/month?${query.toString()}`;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
    await connection();

    const params = await searchParams;
    const monthFilters = {
        locationId: params.locationId,
        employeeId: params.employeeId,
        patientId: params.patientId,
        serviceId: params.serviceId,
    };

    if (!params.date) {
        redirect(buildMonthHref(formatDateInput(new Date()), monthFilters));
    }

    const selectedDate =
        params.date && datePattern.test(params.date)
            ? params.date
            : formatDateInput(new Date());

    const role = await getCurrentUserRole();
    const canManage = canManageData(role);
    const supabase = await createClient();

    const [
        { data: locations, error: locationsError },
        { data: employees, error: employeesError },
        { data: patients, error: patientsError },
        { data: services, error: servicesError },
        { data: appointments, error: appointmentsError },
    ] = await Promise.all([
        supabase.from("locations").select("id, name, color").order("name"),
        supabase
            .from("employees")
            .select("id, name, role, active")
            .eq("active", true)
            .order("name"),
        supabase
            .from("patients")
            .select("id, name, location_id, is_diabetic, active")
            .eq("active", true)
            .order("name"),
        supabase
            .from("services")
            .select("id, name, measurement_type, active")
            .eq("active", true)
            .order("name"),
        supabase
            .from("appointments")
            .select(
                `
          id,
          scheduled_date,
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
            location_id
          ),
          services (
            id,
            name,
            measurement_type
          ),
          created_profile:profiles!appointments_created_by_fkey (
            full_name,
            email
          ),
          updated_profile:profiles!appointments_updated_by_fkey (
            full_name,
            email
          ),
          appointment_clinical_records (
            record_type,
            blood_pressure_value,
            wound_characteristics,
            wound_treatment
          )
        `
            )
            .eq("scheduled_date", selectedDate)
            .order("created_at"),
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
    const locationColorById = new Map(
        locationRows.map((location) => [location.id, location.color] as const)
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
            measurementType: clinicalRecordTypeForService(
                service.name,
                service.measurement_type
            ),
        })
    );
    const appointmentDetails = appointmentRows.map((appointment) => {
        const employee = firstRelation(appointment.employees);
        const patient = firstRelation(appointment.patients);
        const service = firstRelation(appointment.services);
        const createdProfile = firstRelation(appointment.created_profile);
        const updatedProfile = firstRelation(appointment.updated_profile);
        const clinicalRecord = firstRelation(
            appointment.appointment_clinical_records
        );
        const clinicalRecordType = clinicalRecordTypeForService(
            service?.name,
            service?.measurement_type
        );
        const measurement = measurementLabel(clinicalRecordType);
        const locationName = patient?.location_id
            ? locationNameById.get(patient.location_id) ?? null
            : null;
        const patientNameColor = patient?.location_id
            ? locationColorById.get(patient.location_id) ?? null
            : null;

        return {
            id: appointment.id,
            employeeId: employee?.id ?? null,
            employeeLabel: employee
                ? `${employee.name} · ${roleLabel(employee.role)}`
                : null,
            locationName,
            measurementLabel: measurement,
            notes: appointment.notes,
            patientId: patient?.id ?? null,
            patientName: patient?.name ?? "Utente removido",
            patientNameColor,
            scheduledDate: appointment.scheduled_date,
            serviceId: service?.id ?? null,
            serviceMeasurementType: clinicalRecordType,
            serviceName: calendarServiceLabel(service?.name, "Serviço removido"),
            status: appointment.status,
            createdBy: profileLabel(createdProfile),
            updatedBy: profileLabel(updatedProfile),
            clinicalRecord: clinicalRecord
                ? {
                      recordType: clinicalRecord.record_type,
                      bloodPressureValue: clinicalRecord.blood_pressure_value,
                      woundCharacteristics: clinicalRecord.wound_characteristics,
                      woundTreatment: clinicalRecord.wound_treatment,
                  }
                : null,
        } satisfies AppointmentDetails;
    });
    const appointmentGroups = groupAppointmentsByPatient(appointmentDetails);

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

                        {canManage ? (
                            <NewAppointmentDialog
                                employees={employeeOptions}
                                patients={patientOptions}
                                services={serviceOptions}
                                selectedDate={selectedDate}
                            />
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild size="sm" variant="outline">
                            <Link
                                href={buildCalendarHref(
                                    addDays(selectedDate, -1),
                                    monthFilters
                                )}
                            >
                                Dia anterior
                            </Link>
                        </Button>

                        <Button asChild size="sm" variant="secondary">
                            <Link
                                href={buildCalendarHref(
                                    formatDateInput(new Date()),
                                    monthFilters
                                )}
                            >
                                Hoje
                            </Link>
                        </Button>

                        <Button asChild size="sm" variant="outline">
                            <Link
                                href={buildCalendarHref(
                                    addDays(selectedDate, 1),
                                    monthFilters
                                )}
                            >
                                Dia seguinte
                            </Link>
                        </Button>

                        <Button asChild size="sm" variant="outline">
                            <Link href={buildMonthHref(selectedDate, monthFilters)}>
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
                        <div className="grid gap-3 p-3">
                            {appointmentGroups.map((group) => (
                                <div
                                    key={group.key}
                                    className="overflow-hidden rounded-md border bg-background"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2
                                                className="font-medium"
                                                style={{
                                                    color:
                                                        group.patientNameColor ??
                                                        undefined,
                                                }}
                                            >
                                                {group.patientName}
                                            </h2>
                                            {group.locationName ? (
                                                <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                                                    {group.locationName}
                                                </span>
                                            ) : null}
                                        </div>
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                            {group.appointments.length}{" "}
                                            {group.appointments.length === 1
                                                ? "marcação"
                                                : "marcações"}
                                        </span>
                                    </div>
                                    <div className="divide-y">
                                        {group.appointments.map((appointment) => (
                                            <AppointmentDetailsDialog
                                                key={appointment.id}
                                                employees={employeeOptions}
                                                patients={patientOptions}
                                                services={serviceOptions}
                                                appointment={appointment}
                                                canManage={canManage}
                                                triggerVariant="groupItem"
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
