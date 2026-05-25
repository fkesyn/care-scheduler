import { connection } from "next/server";
import Link from "next/link";

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
import { EmployeeRowActions } from "./employee-row-actions";
import { NewEmployeeDialog } from "./new-employee-dialog";

type Employee = {
    id: string;
    name: string;
    role: string;
    phone: string | null;
    email: string | null;
    professional_license_number: string | null;
    notes: string | null;
    active: boolean | null;
};

function roleLabel(role: string) {
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

export default async function EmployeesPage() {
    await connection();

    const supabase = await createClient();
    const { data: employees, error } = await supabase
        .from("employees")
        .select(
            "id, name, role, phone, email, professional_license_number, notes, active"
        )
        .order("name");

    if (error) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold tracking-tight">Equipa</h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar equipa: {error.message}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Se a tabela ainda não existir, aplica a migration em{" "}
                        <code>
                            supabase/migrations/20260515140000_employees_and_appointment_assignments.sql
                        </code>
                        .
                    </p>
                </div>
            </div>
        );
    }

    const employeeRows = (employees ?? []) as Employee[];

    return (
        <div className="p-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight">Equipa</h1>
                        <p className="text-sm text-muted-foreground">
                            {employeeRows.length}{" "}
                            {employeeRows.length === 1
                                ? "pessoa registada"
                                : "pessoas registadas"}
                        </p>
                    </div>
                    <NewEmployeeDialog />
                </header>

                <section className="rounded-lg border bg-card shadow-xs">
                    {employeeRows.length === 0 ? (
                        <div className="flex min-h-40 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                            Ainda não há pessoas na equipa.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>Contacto</TableHead>
                                    <TableHead>Cédula</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">
                                        Preferências fixas
                                    </TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employeeRows.map((employee) => (
                                    <TableRow key={employee.id}>
                                        <TableCell className="font-medium">
                                            <Link
                                                href={`/dashboard/employees/${employee.id}`}
                                                className="hover:underline"
                                            >
                                                {employee.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    employee.role === "nurse"
                                                        ? "secondary"
                                                        : "outline"
                                                }
                                            >
                                                {roleLabel(employee.role)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {employee.phone || employee.email || "-"}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {employee.professional_license_number || "-"}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    employee.active ? "secondary" : "outline"
                                                }
                                            >
                                                {employee.active ? "Ativo" : "Inativo"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild size="sm" variant="outline">
                                                <Link
                                                    href={`/dashboard/employees/${employee.id}`}
                                                >
                                                    Configurar
                                                </Link>
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <EmployeeRowActions employee={employee} />
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
