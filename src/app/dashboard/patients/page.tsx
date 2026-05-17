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
    room: string | null;
    birth_date: string | null;
    health_center: string | null;
    family_doctor: string | null;
    patient_number: string | null;
    notes: string | null;
    is_diabetic: boolean | null;
    active: boolean | null;
    created_at: string | null;
};

function formatDate(dateValue: string | null) {
    if (!dateValue) {
        return "-";
    }

    return new Intl.DateTimeFormat("pt-PT", {
        dateStyle: "medium",
    }).format(new Date(`${dateValue}T00:00:00`));
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
            "id, name, location_id, room, birth_date, health_center, family_doctor, patient_number, notes, is_diabetic, active, created_at"
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
                        <Table className="min-w-[1120px]">
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Data nasc.</TableHead>
                                    <TableHead>Centro de Saúde</TableHead>
                                    <TableHead>Médico de Família</TableHead>
                                    <TableHead>N.º Utente</TableHead>
                                    <TableHead>Local</TableHead>
                                    <TableHead>Quarto</TableHead>
                                    <TableHead>Perfil</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {patientRows.map((patient) => (
                                    <TableRow key={patient.id}>
                                        <TableCell className="font-medium">{patient.name}</TableCell>
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
                                        <TableCell className="text-muted-foreground">
                                            {patient.room || "-"}
                                        </TableCell>
                                        <TableCell>
                                            {patient.is_diabetic ? (
                                                <Badge variant="secondary">Diabético</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={patient.active ? "secondary" : "outline"}>
                                                {patient.active ? "Ativo" : "Inativo"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <PatientRowActions
                                                patient={patient}
                                                locations={locationRows}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </section>
            </div>
        </div>
    );
}
