import Link from "next/link";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import type { PatientClinicalRecord } from "./clinical-records-dialog";
import type { FamilyContact } from "./family-contacts-dialog";
import { NewPatientDialog } from "./new-patient-dialog";
import { PatientRowActions } from "./patient-row-actions";

type PatientsPageProps = {
    searchParams: Promise<{
        location?: string;
    }>;
};

type Location = {
    id: string;
    name: string;
    active: boolean | null;
};

type Patient = {
    id: string;
    name: string;
    location_id: string | null;
    birth_date: string | null;
    health_center: string | null;
    family_doctor: string | null;
    patient_number: string | null;
    notes: string | null;
    is_diabetic: boolean | null;
    is_hypertensive: boolean | null;
    has_active_wounds: boolean | null;
    active: boolean | null;
    created_at: string | null;
};

type Relation<T> = T | T[] | null;

type ClinicalRecordRow = {
    id: string;
    patient_id: string;
    record_date: string;
    record_type: string;
    blood_pressure_value: string | null;
    wound_characteristics: string | null;
    wound_treatment: string | null;
    services: Relation<{
        name: string;
    }>;
    employees: Relation<{
        name: string;
    }>;
    appointments: Relation<{
        notes: string | null;
    }>;
};

function firstRelation<T>(relation: Relation<T>) {
    if (Array.isArray(relation)) {
        return relation[0] ?? null;
    }

    return relation;
}

function formatDate(dateValue: string | null) {
    if (!dateValue) {
        return "-";
    }

    return new Intl.DateTimeFormat("pt-PT", {
        dateStyle: "medium",
    }).format(new Date(`${dateValue}T00:00:00`));
}

function PatientProfileBadges({ patient }: { patient: Patient }) {
    const badges = [
        patient.is_diabetic ? "Diabético" : null,
        patient.is_hypertensive ? "Hipertenso" : null,
        patient.has_active_wounds ? "Feridas ativas" : null,
    ].filter(Boolean);

    if (badges.length === 0) {
        return <span className="text-muted-foreground">-</span>;
    }

    return (
        <div className="flex w-28 flex-col items-start gap-1">
            {badges.map((badge) => (
                <Badge
                    key={badge}
                    variant="secondary"
                    className="w-full justify-start truncate"
                >
                    {badge}
                </Badge>
            ))}
        </div>
    );
}

export default async function PatientsPage({ searchParams }: PatientsPageProps) {
    await connection();

    const { location } = await searchParams;
    const supabase = await createClient();

    const { data: locations, error: locationsError } = await supabase
        .from("locations")
        .select("id, name, active")
        .order("name");

    if (locationsError) {
        return (
            <div className="p-6">
                <div className="mx-auto w-full max-w-5xl">
                    <h1 className="text-2xl font-semibold tracking-tight">Utentes</h1>
                    <p className="mt-4 text-sm text-destructive">
                        Erro ao carregar locais: {locationsError.message}
                    </p>
                </div>
            </div>
        );
    }

    const locationRows = (locations ?? []) as Location[];
    const selectedLocation = locationRows.some((item) => item.id === location)
        ? location
        : undefined;

    let patientsQuery = supabase
        .from("patients")
        .select(
            "id, name, location_id, birth_date, health_center, family_doctor, patient_number, notes, is_diabetic, is_hypertensive, has_active_wounds, active, created_at"
        )
        .order("name");

    if (selectedLocation) {
        patientsQuery = patientsQuery.eq("location_id", selectedLocation);
    }

    const { data: patients, error: patientsError } = await patientsQuery;

    if (patientsError) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold tracking-tight">Utentes</h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar utentes: {patientsError.message}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Se a tabela ainda não existir, aplica a migration em{" "}
                        <code>supabase/migrations/20260515120000_create_patients.sql</code>.
                    </p>
                </div>
            </div>
        );
    }

    const patientRows = (patients ?? []) as Patient[];
    const patientIds = patientRows.map((patient) => patient.id);
    const { data: familyContacts, error: familyContactsError } =
        patientIds.length > 0
            ? await supabase
                  .from("patient_family_contacts")
                  .select("id, patient_id, name, relationship, contact")
                  .in("patient_id", patientIds)
                  .order("name")
            : { data: [], error: null };
    const { data: clinicalRecords, error: clinicalRecordsError } =
        patientIds.length > 0
            ? await supabase
                  .from("appointment_clinical_records")
                  .select(
                      `
                      id,
                      patient_id,
                      record_date,
                      record_type,
                      blood_pressure_value,
                      wound_characteristics,
                      wound_treatment,
                      services (
                        name
                      ),
                      employees (
                        name
                      ),
                      appointments (
                        notes
                      )
                    `
                  )
                  .in("patient_id", patientIds)
                  .order("record_date", { ascending: false })
            : { data: [], error: null };

    if (familyContactsError) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold tracking-tight">Utentes</h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar contactos familiares:{" "}
                        {familyContactsError.message}
                    </p>
                </div>
            </div>
        );
    }

    if (clinicalRecordsError) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold tracking-tight">Utentes</h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar registos clínicos:{" "}
                        {clinicalRecordsError.message}
                    </p>
                </div>
            </div>
        );
    }

    const familyContactsByPatientId = new Map<string, FamilyContact[]>();

    for (const contact of (familyContacts ?? []) as FamilyContact[]) {
        const current = familyContactsByPatientId.get(contact.patient_id) ?? [];
        current.push(contact);
        familyContactsByPatientId.set(contact.patient_id, current);
    }

    const clinicalRecordsByPatientId = new Map<string, PatientClinicalRecord[]>();

    for (const record of (clinicalRecords ?? []) as ClinicalRecordRow[]) {
        const service = firstRelation(record.services);
        const employee = firstRelation(record.employees);
        const appointment = firstRelation(record.appointments);
        const current = clinicalRecordsByPatientId.get(record.patient_id) ?? [];

        current.push({
            id: record.id,
            patient_id: record.patient_id,
            record_date: record.record_date,
            record_type: record.record_type,
            blood_pressure_value: record.blood_pressure_value,
            wound_characteristics: record.wound_characteristics,
            wound_treatment: record.wound_treatment,
            service_name: service?.name ?? null,
            employee_name: employee?.name ?? null,
            appointment_notes: appointment?.notes ?? null,
        });
        clinicalRecordsByPatientId.set(record.patient_id, current);
    }

    const locationNameById = new Map(
        locationRows.map((item) => [item.id, item.name] as const)
    );

    return (
        <div className="p-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
                <header className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                Utentes
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {patientRows.length}{" "}
                                {patientRows.length === 1
                                    ? "utente visível"
                                    : "utentes visíveis"}
                            </p>
                        </div>
                        <NewPatientDialog
                            locations={locationRows}
                            selectedLocation={selectedLocation}
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            asChild
                            size="sm"
                            variant={selectedLocation ? "ghost" : "secondary"}
                        >
                            <Link href="/dashboard/patients">Todos</Link>
                        </Button>
                        {locationRows.map((item) => (
                            <Button
                                key={item.id}
                                asChild
                                size="sm"
                                variant={selectedLocation === item.id ? "secondary" : "ghost"}
                            >
                                <Link href={`/dashboard/patients?location=${item.id}`}>
                                    {item.name}
                                </Link>
                            </Button>
                        ))}
                    </div>
                </header>

                <section className="rounded-lg border bg-card shadow-xs">
                    {patientRows.length === 0 ? (
                        <div className="flex min-h-40 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                            Não há utentes visíveis para este filtro.
                        </div>
                    ) : (
                        <Table className="min-w-[760px]">
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Data nasc.</TableHead>
                                    <TableHead>Centro de Saúde</TableHead>
                                    <TableHead>Médico de Família</TableHead>
                                    <TableHead>N.º Utente</TableHead>
                                    <TableHead>Local</TableHead>
                                    <TableHead className="w-28">Perfil</TableHead>
                                    <TableHead className="w-12 text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {patientRows.map((patient) => {
                                    const contacts =
                                        familyContactsByPatientId.get(patient.id) ?? [];
                                    const clinicalPatientRecords =
                                        clinicalRecordsByPatientId.get(patient.id) ??
                                        [];

                                    return (
                                        <TableRow key={patient.id}>
                                            <TableCell className="font-medium">
                                                {patient.name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {formatDate(patient.birth_date)}
                                            </TableCell>
                                            <TableCell className="max-w-40 truncate text-muted-foreground">
                                                {patient.health_center || "-"}
                                            </TableCell>
                                            <TableCell className="max-w-40 truncate text-muted-foreground">
                                                {patient.family_doctor || "-"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {patient.patient_number || "-"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {patient.location_id
                                                    ? locationNameById.get(patient.location_id) ?? "-"
                                                    : "-"}
                                            </TableCell>
                                            <TableCell className="w-28 max-w-28 align-middle">
                                                <PatientProfileBadges patient={patient} />
                                            </TableCell>
                                            <TableCell className="w-12 align-middle">
                                                <PatientRowActions
                                                    familyContacts={contacts}
                                                    clinicalRecords={
                                                        clinicalPatientRecords
                                                    }
                                                    patient={patient}
                                                    locations={locationRows}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </section>
            </div>
        </div>
    );
}
