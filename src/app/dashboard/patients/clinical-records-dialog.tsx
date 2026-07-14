"use client";

import { FileTextIcon, PrinterIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export type PatientClinicalRecord = {
    id: string;
    patient_id: string;
    record_date: string;
    record_type: string;
    blood_pressure_value: string | null;
    wound_characteristics: string | null;
    wound_treatment: string | null;
    service_name: string | null;
    employee_name: string | null;
    appointment_notes: string | null;
};

type ClinicalRecordsDialogProps = {
    patientId: string;
    patientName: string;
    records: PatientClinicalRecord[];
};

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

function ClinicalRecordCard({ record }: { record: PatientClinicalRecord }) {
    return (
        <article className="grid gap-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                            {recordTypeLabel(record.record_type)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                            {formatDate(record.record_date)}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {record.service_name ?? "Serviço"} ·{" "}
                        {record.employee_name ?? "Sem responsável"}
                    </p>
                </div>
            </div>

            {record.blood_pressure_value ? (
                <p className="text-sm">
                    <span className="font-medium">TA:</span>{" "}
                    {record.blood_pressure_value}
                </p>
            ) : null}

            {record.wound_characteristics ? (
                <div className="grid gap-1 text-sm">
                    <p className="font-medium">Características da ferida</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                        {record.wound_characteristics}
                    </p>
                </div>
            ) : null}

            {record.wound_treatment ? (
                <div className="grid gap-1 text-sm">
                    <p className="font-medium">Tratamento realizado</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                        {record.wound_treatment}
                    </p>
                </div>
            ) : null}

            {record.appointment_notes ? (
                <div className="grid gap-1 text-sm">
                    <p className="font-medium">Notas</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                        {record.appointment_notes}
                    </p>
                </div>
            ) : null}
        </article>
    );
}

export function ClinicalRecordsDialog({
    patientId,
    patientName,
    records,
}: ClinicalRecordsDialogProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="Registos clínicos">
                    <FileTextIcon />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Registos clínicos</DialogTitle>
                    <DialogDescription>{patientName}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">
                            {records.length}{" "}
                            {records.length === 1
                                ? "registo encontrado"
                                : "registos encontrados"}
                        </span>
                        <Button asChild size="sm" variant="outline">
                            <Link
                                href={`/dashboard/patients/${patientId}/clinical-records/print`}
                            >
                                <PrinterIcon />
                                Imprimir
                            </Link>
                        </Button>
                    </div>

                    {records.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            Sem registos clínicos associados a este utente.
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {records.map((record) => (
                                <ClinicalRecordCard key={record.id} record={record} />
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
