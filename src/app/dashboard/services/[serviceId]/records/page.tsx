import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { PrintButton } from "@/components/print-button";
import { createClient } from "@/lib/supabase/server";

type ServiceRecordsPageProps = {
    params: Promise<{
        serviceId: string;
    }>;
    searchParams: Promise<{
        startDate?: string;
        endDate?: string;
    }>;
};

type Relation<T> = T | T[] | null;

type ClinicalRecord = {
    id: string;
    record_date: string;
    record_type: string;
    blood_pressure_value: string | null;
    heart_rate_value: number | null;
    wound_characteristics: string | null;
    wound_treatment: string | null;
    patients: Relation<{
        name: string;
    }>;
    employees: Relation<{
        name: string;
    }>;
    appointments: Relation<{
        notes: string | null;
    }>;
};

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function firstRelation<T>(relation: Relation<T>) {
    if (Array.isArray(relation)) {
        return relation[0] ?? null;
    }

    return relation;
}

function formatDateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function defaultStartDate() {
    const date = new Date();
    return formatDateInput(new Date(date.getFullYear(), date.getMonth(), 1));
}

function defaultEndDate() {
    return formatDateInput(new Date());
}

function formatDate(dateValue: string) {
    return new Intl.DateTimeFormat("pt-PT", {
        dateStyle: "medium",
    }).format(new Date(`${dateValue}T00:00:00`));
}

function ClinicalRecordValue({ record }: { record: ClinicalRecord }) {
    if (record.record_type === "blood_pressure") {
        if (!record.blood_pressure_value && !record.heart_rate_value) {
            return <span>-</span>;
        }

        return (
            <div className="grid gap-1">
                {record.blood_pressure_value ? (
                    <span>TA - {record.blood_pressure_value}</span>
                ) : null}
                {record.heart_rate_value ? (
                    <span>FC - {record.heart_rate_value}</span>
                ) : null}
            </div>
        );
    }

    if (record.record_type === "wound_care") {
        const parts = [
            record.wound_characteristics
                ? `Características: ${record.wound_characteristics}`
                : null,
            record.wound_treatment
                ? `Tratamento: ${record.wound_treatment}`
                : null,
        ].filter(Boolean);

        if (parts.length === 0) {
            return <span>-</span>;
        }

        return (
            <div className="grid gap-1">
                {parts.map((part) => (
                    <span key={part}>{part}</span>
                ))}
            </div>
        );
    }

    return <span>-</span>;
}

export default async function ServiceRecordsPage({
    params,
    searchParams,
}: ServiceRecordsPageProps) {
    await connection();

    const { serviceId } = await params;
    const filters = await searchParams;

    if (!uuidPattern.test(serviceId)) {
        notFound();
    }

    const startDate =
        filters.startDate && datePattern.test(filters.startDate)
            ? filters.startDate
            : defaultStartDate();
    const endDate =
        filters.endDate && datePattern.test(filters.endDate)
            ? filters.endDate
            : defaultEndDate();

    const supabase = await createClient();
    const [{ data: service }, { data: records, error: recordsError }] =
        await Promise.all([
            supabase
                .from("services")
                .select("id, name, measurement_type")
                .eq("id", serviceId)
                .maybeSingle(),
            supabase
                .from("appointment_clinical_records")
                .select(
                    `
                    id,
                    record_date,
                    record_type,
                    blood_pressure_value,
                    heart_rate_value,
                    wound_characteristics,
                    wound_treatment,
                    patients (
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
                .eq("service_id", serviceId)
                .gte("record_date", startDate)
                .lte("record_date", endDate)
                .order("record_date", { ascending: false }),
        ]);

    if (!service || recordsError) {
        notFound();
    }

    const recordRows = (records ?? []) as ClinicalRecord[];

    return (
        <div className="p-6 print:p-0">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 print:max-w-none">
                <header className="flex flex-col gap-4 print:hidden">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="grid gap-1">
                            <h1 className="text-2xl font-semibold">
                                Registos do serviço
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {service.name}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild size="sm" variant="outline">
                                <Link href="/dashboard/services">Voltar</Link>
                            </Button>
                            <PrintButton />
                        </div>
                    </div>

                    <form className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <div className="grid gap-2">
                            <Label htmlFor="startDate">Data início</Label>
                            <Input
                                id="startDate"
                                name="startDate"
                                type="date"
                                defaultValue={startDate}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="endDate">Data fim</Label>
                            <Input
                                id="endDate"
                                name="endDate"
                                type="date"
                                defaultValue={endDate}
                            />
                        </div>
                        <Button type="submit">Filtrar</Button>
                    </form>
                </header>

                <div className="hidden text-center print:block">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Registos do serviço
                    </p>
                    <h1 className="text-xl font-semibold">{service.name}</h1>
                    <p className="text-sm text-muted-foreground">
                        {formatDate(startDate)} a {formatDate(endDate)}
                    </p>
                </div>

                <section className="rounded-lg border bg-card shadow-xs print:rounded-none print:shadow-none">
                    {recordRows.length === 0 ? (
                        <div className="flex min-h-32 items-center justify-center p-6 text-sm text-muted-foreground">
                            Sem registos neste intervalo.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Data</TableHead>
                                    <TableHead>Utente</TableHead>
                                    <TableHead>Responsável</TableHead>
                                    <TableHead>Registo</TableHead>
                                    <TableHead>Notas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recordRows.map((record) => {
                                    const patient = firstRelation(record.patients);
                                    const employee = firstRelation(record.employees);
                                    const appointment = firstRelation(record.appointments);

                                    return (
                                        <TableRow key={record.id}>
                                            <TableCell>
                                                {formatDate(record.record_date)}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {patient?.name ?? "Utente"}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {employee?.name ?? "Sem responsável"}
                                            </TableCell>
                                            <TableCell className="max-w-md">
                                                <ClinicalRecordValue record={record} />
                                            </TableCell>
                                            <TableCell className="max-w-sm whitespace-pre-wrap text-muted-foreground">
                                                {appointment?.notes ?? "-"}
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
