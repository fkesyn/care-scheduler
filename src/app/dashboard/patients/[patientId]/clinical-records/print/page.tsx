import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { createClient } from "@/lib/supabase/server";

type PatientClinicalRecordsPrintPageProps = {
    params: Promise<{
        patientId: string;
    }>;
};

type Relation<T> = T | T[] | null;

type ClinicalRecord = {
    id: string;
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

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstRelation<T>(relation: Relation<T>) {
    if (Array.isArray(relation)) {
        return relation[0] ?? null;
    }

    return relation;
}

function formatDate(dateValue: string) {
    return new Intl.DateTimeFormat("pt-PT", {
        dateStyle: "medium",
    }).format(new Date(`${dateValue}T00:00:00`));
}

function recordTypeLabel(recordType: string) {
    if (recordType === "blood_pressure") {
        return "Tensão arterial";
    }

    if (recordType === "wound_care") {
        return "Tratamento de feridas";
    }

    return "Registo";
}

export default async function PatientClinicalRecordsPrintPage({
    params,
}: PatientClinicalRecordsPrintPageProps) {
    await connection();

    const { patientId } = await params;

    if (!uuidPattern.test(patientId)) {
        notFound();
    }

    const supabase = await createClient();
    const [{ data: patient }, { data: records, error: recordsError }] =
        await Promise.all([
            supabase.from("patients").select("id, name").eq("id", patientId).maybeSingle(),
            supabase
                .from("appointment_clinical_records")
                .select(
                    `
                    id,
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
                .eq("patient_id", patientId)
                .order("record_date", { ascending: false }),
        ]);

    if (!patient || recordsError) {
        notFound();
    }

    const recordRows = (records ?? []) as ClinicalRecord[];

    return (
        <div className="p-6 print:p-0">
            <div className="mx-auto grid w-full max-w-4xl gap-6 print:max-w-none">
                <div className="flex items-center justify-between gap-3 print:hidden">
                    <Button asChild size="sm" variant="outline">
                        <Link href="/dashboard/patients">Voltar aos utentes</Link>
                    </Button>
                    <PrintButton />
                </div>

                <header className="grid gap-1 text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Registos clínicos
                    </p>
                    <h1 className="text-2xl font-semibold">{patient.name}</h1>
                    <p className="text-sm text-muted-foreground">
                        Impresso em{" "}
                        {new Intl.DateTimeFormat("pt-PT", {
                            dateStyle: "medium",
                            timeStyle: "short",
                        }).format(new Date())}
                    </p>
                </header>

                <section className="grid gap-3">
                    {recordRows.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            Sem registos clínicos.
                        </div>
                    ) : (
                        recordRows.map((record) => {
                            const service = firstRelation(record.services);
                            const employee = firstRelation(record.employees);
                            const appointment = firstRelation(record.appointments);

                            return (
                                <article
                                    key={record.id}
                                    className="grid gap-2 rounded-lg border p-4 text-sm print:break-inside-avoid"
                                >
                                    <div className="flex flex-wrap justify-between gap-3">
                                        <div>
                                            <h2 className="font-semibold">
                                                {recordTypeLabel(record.record_type)}
                                            </h2>
                                            <p className="text-muted-foreground">
                                                {service?.name ?? "Serviço"} ·{" "}
                                                {employee?.name ?? "Sem responsável"}
                                            </p>
                                        </div>
                                        <p className="font-medium">
                                            {formatDate(record.record_date)}
                                        </p>
                                    </div>

                                    {record.blood_pressure_value ? (
                                        <p>
                                            <span className="font-medium">TA:</span>{" "}
                                            {record.blood_pressure_value}
                                        </p>
                                    ) : null}

                                    {record.wound_characteristics ? (
                                        <div>
                                            <p className="font-medium">
                                                Características da ferida
                                            </p>
                                            <p className="whitespace-pre-wrap">
                                                {record.wound_characteristics}
                                            </p>
                                        </div>
                                    ) : null}

                                    {record.wound_treatment ? (
                                        <div>
                                            <p className="font-medium">
                                                Tratamento realizado
                                            </p>
                                            <p className="whitespace-pre-wrap">
                                                {record.wound_treatment}
                                            </p>
                                        </div>
                                    ) : null}

                                    {appointment?.notes ? (
                                        <div>
                                            <p className="font-medium">Notas</p>
                                            <p className="whitespace-pre-wrap">
                                                {appointment.notes}
                                            </p>
                                        </div>
                                    ) : null}
                                </article>
                            );
                        })
                    )}
                </section>
            </div>
        </div>
    );
}
