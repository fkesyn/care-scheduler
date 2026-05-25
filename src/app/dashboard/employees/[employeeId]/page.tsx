import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { EmployeeWorkPreferencesSection } from "@/app/dashboard/employees/employee-work-preferences-section";

type Employee = {
    id: string;
    name: string;
    role: string;
    phone: string | null;
    email: string | null;
    professional_license_number: string | null;
    notes: string | null;
    active: boolean | null;
    organization_id: string;
};

type WorkPreference = {
    id: string;
    employee_id: string;
    preference_type: string;
    shift_type_id: string | null;
    weekday: number | null;
    active: boolean | null;
    notes: string | null;
};

type ShiftType = {
    id: string;
    code: string;
    name: string;
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

export default async function EmployeeDetailPage({
    params,
}: {
    params: Promise<{ employeeId: string }>;
}) {
    await connection();
    const { employeeId } = await params;
    const supabase = await createClient();
    const { data: employeeData, error: employeeError } = await supabase
        .from("employees")
        .select(
            "id, name, role, phone, email, professional_license_number, notes, active, organization_id"
        )
        .eq("id", employeeId)
        .maybeSingle();

    if (employeeError) {
        return (
            <div className="p-6">
                <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Detalhe do funcionário
                    </h1>
                    <p className="text-sm text-destructive">
                        Erro ao carregar funcionário: {employeeError.message}
                    </p>
                </div>
            </div>
        );
    }

    if (!employeeData) {
        notFound();
    }

    const employee = employeeData as Employee;
    const [{ data: preferencesData, error: preferencesError }, { data: shiftTypesData }] =
        await Promise.all([
            supabase
                .from("employee_work_preferences")
                .select(
                    "id, employee_id, preference_type, shift_type_id, weekday, active, notes"
                )
                .eq("employee_id", employee.id)
                .order("created_at", { ascending: false }),
            supabase
                .from("shift_types")
                .select("id, code, name, active")
                .eq("organization_id", employee.organization_id)
                .order("display_order")
                .order("code"),
        ]);

    const preferences = (preferencesData ?? []) as WorkPreference[];
    const shiftTypes = (shiftTypesData ?? []) as ShiftType[];

    return (
        <div className="p-6">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-2xl font-semibold tracking-tight">
                                {employee.name}
                            </h1>
                            <Badge variant={employee.active ? "secondary" : "outline"}>
                                {employee.active ? "Ativo" : "Inativo"}
                            </Badge>
                            <Badge variant="outline">{roleLabel(employee.role)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {employee.phone || employee.email || "Sem contacto registado"}
                        </p>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/dashboard/employees">Voltar à equipa</Link>
                    </Button>
                </header>

                <section className="rounded-lg border bg-card p-4 shadow-xs">
                    <h2 className="mb-3 text-base font-semibold">Dados do funcionário</h2>
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <p>
                            <span className="text-muted-foreground">Email:</span>{" "}
                            {employee.email ?? "-"}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Telefone:</span>{" "}
                            {employee.phone ?? "-"}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Cédula:</span>{" "}
                            {employee.professional_license_number ?? "-"}
                        </p>
                        <p>
                            <span className="text-muted-foreground">Estado:</span>{" "}
                            {employee.active ? "Ativo" : "Inativo"}
                        </p>
                    </div>
                    {employee.notes ? (
                        <p className="mt-3 text-sm text-muted-foreground">{employee.notes}</p>
                    ) : null}
                </section>

                {preferencesError ? (
                    <p className="text-sm text-destructive">
                        Erro ao carregar preferências fixas: {preferencesError.message}
                    </p>
                ) : (
                    <EmployeeWorkPreferencesSection
                        employeeId={employee.id}
                        preferences={preferences}
                        shiftTypes={shiftTypes}
                    />
                )}
            </div>
        </div>
    );
}
