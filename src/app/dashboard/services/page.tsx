import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { NewServiceDialog } from "./new-service-dialog";
import { ServiceRowActions } from "./service-row-actions";

type Service = {
    id: string;
    name: string;
    duration_minutes: number | null;
    measurement_type: string | null;
    active: boolean | null;
    created_at: string | null;
};

function measurementLabel(type: string | null) {
    if (type === "blood_pressure") {
        return "Tensão arterial";
    }

    if (type === "glucose") {
        return "Glicémia";
    }

    if (type === "wound_care") {
        return "Tratamento de feridas";
    }

    return null;
}

export default async function ServicesPage() {
    await connection();

    const supabase = await createClient();
    const { data: services, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, measurement_type, active, created_at")
        .order("name");

    if (error) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold tracking-tight">Serviços</h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar serviços: {error.message}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Se a tabela ainda não existir, aplica a migration em{" "}
                        <code>supabase/migrations/20260515133000_services_crud.sql</code>.
                    </p>
                </div>
            </div>
        );
    }

    const serviceRows = (services ?? []) as Service[];

    return (
        <div className="p-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight">Serviços</h1>
                        <p className="text-sm text-muted-foreground">
                            {serviceRows.length}{" "}
                            {serviceRows.length === 1
                                ? "serviço configurado"
                                : "serviços configurados"}
                        </p>
                    </div>
                    <NewServiceDialog />
                </header>

                <section className="rounded-lg border bg-card shadow-xs">
                    {serviceRows.length === 0 ? (
                        <div className="flex min-h-40 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                            Ainda não há serviços configurados.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Duração</TableHead>
                                    <TableHead>Registo</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {serviceRows.map((service) => {
                                    const label = measurementLabel(service.measurement_type);

                                    return (
                                        <TableRow key={service.id}>
                                            <TableCell className="font-medium">
                                                {service.name}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {service.duration_minutes ?? 0} min
                                            </TableCell>
                                            <TableCell>
                                                {label ? (
                                                    <Badge variant="secondary">{label}</Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={service.active ? "secondary" : "outline"}
                                            >
                                                {service.active ? "Ativo" : "Inativo"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <ServiceRowActions service={service} />
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
