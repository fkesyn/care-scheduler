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
import { NewLocationDialog } from "./new-location-dialog";

type Location = {
    id: string;
    name: string;
    active: boolean | null;
    created_at: string | null;
};

export default async function LocationsPage() {
    await connection();

    const supabase = await createClient();
    const { data: locations, error } = await supabase
        .from("locations")
        .select("id, name, active, created_at")
        .order("name");

    if (error) {
        return (
            <main className="p-6">
                <h1 className="text-2xl font-bold">Locais</h1>
                <p className="mt-4 text-red-500">
                    Erro ao carregar locais: {error.message}
                </p>
            </main>
        );
    }

    const locationRows = (locations ?? []) as Location[];

    return (
        <div className="p-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight">Locais</h1>
                        <p className="text-sm text-muted-foreground">
                            {locationRows.length}{" "}
                            {locationRows.length === 1
                                ? "local registado"
                                : "locais registados"}
                        </p>
                    </div>
                    <NewLocationDialog />
                </header>

                <section className="rounded-lg border bg-card shadow-xs">
                    {locationRows.length === 0 ? (
                        <div className="flex min-h-40 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                            Não há locais visíveis para este utilizador.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Criado em</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {locationRows.map((location) => (
                                    <TableRow key={location.id}>
                                        <TableCell className="font-medium">{location.name}</TableCell>
                                        <TableCell>
                                            <Badge variant={location.active ? "secondary" : "outline"}>
                                                {location.active ? "Ativo" : "Inativo"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {location.created_at
                                                ? new Intl.DateTimeFormat("pt-PT", {
                                                    dateStyle: "medium",
                                                }).format(new Date(location.created_at))
                                                : "-"}
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
