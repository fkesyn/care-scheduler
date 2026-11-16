"use server";

import { revalidatePath } from "next/cache";

import { canManageData, getCurrentUserRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export type VacationActionState = {
    status: "idle" | "success" | "error";
    message?: string;
};

const initialPath = "/dashboard/vacations";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function vacationErrorMessage(message: string) {
    if (message.includes("Employee not found")) {
        return "O teu utilizador não está associado a um funcionário ativo com o mesmo email.";
    }

    if (message.includes("locked")) {
        return "Este ano ainda está bloqueado para marcação de férias.";
    }

    if (message.includes("unavailable") || message.includes("already approved")) {
        return "Um ou mais dias escolhidos já estão ocupados por férias aprovadas.";
    }

    if (message.includes("already in your requests")) {
        return "Um ou mais dias escolhidos já fazem parte de um pedido teu pendente ou aprovado.";
    }

    if (message.includes("allowance exceeded")) {
        return "Este pedido ultrapassa o número de dias de férias disponível.";
    }

    if (message.includes("weekdays")) {
        return "Só podes pedir dias úteis futuros, de segunda a sexta-feira, no mesmo ano.";
    }

    return message;
}

export async function submitVacationRequest(
    _previousState: VacationActionState,
    formData: FormData
): Promise<VacationActionState> {
    const dates = Array.from(
        new Set(
            formData
                .getAll("vacation_dates")
                .map((value) => String(value).trim())
                .filter((value) => datePattern.test(value))
        )
    ).sort();

    if (dates.length === 0) {
        return {
            status: "error",
            message: "Seleciona pelo menos um dia útil para submeter o pedido.",
        };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("request_vacation", {
        p_dates: dates,
    });

    if (error) {
        return {
            status: "error",
            message: vacationErrorMessage(error.message),
        };
    }

    revalidatePath(initialPath);

    return {
        status: "success",
        message: `Pedido submetido com ${dates.length} ${
            dates.length === 1 ? "dia útil" : "dias úteis"
        }.`,
    };
}

export async function reviewVacationRequest(formData: FormData) {
    const requestId = String(formData.get("request_id") ?? "").trim();
    const decision = String(formData.get("decision") ?? "").trim();
    const rejectionReason = String(
        formData.get("rejection_reason") ?? ""
    ).trim();

    if (!uuidPattern.test(requestId) || !["approved", "rejected"].includes(decision)) {
        return;
    }

    const role = await getCurrentUserRole();
    if (!canManageData(role)) {
        return;
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("review_vacation_request", {
        p_request_id: requestId,
        p_decision: decision,
        p_rejection_reason: rejectionReason || null,
    });

    if (error) {
        throw new Error(vacationErrorMessage(error.message));
    }

    revalidatePath(initialPath);
}

export async function updateVacationAllowance(formData: FormData) {
    const employeeId = String(formData.get("employee_id") ?? "").trim();
    const year = Number(formData.get("year"));
    const totalDays = Number(formData.get("total_days"));

    if (
        !uuidPattern.test(employeeId) ||
        !Number.isInteger(year) ||
        year < 2027 ||
        !Number.isInteger(totalDays) ||
        totalDays < 22
    ) {
        return;
    }

    const role = await getCurrentUserRole();
    if (!canManageData(role)) {
        return;
    }

    const supabase = await createClient();
    const [{ data: organizationId }, { data: userData }] = await Promise.all([
        supabase.rpc("my_organization_id"),
        supabase.auth.getUser(),
    ]);

    if (!organizationId || !userData.user) {
        return;
    }

    const { error } = await supabase.from("employee_vacation_allowances").upsert(
        {
            organization_id: organizationId,
            employee_id: employeeId,
            year,
            total_days: totalDays,
            updated_by: userData.user.id,
        },
        { onConflict: "employee_id,year" }
    );

    if (error) {
        throw new Error(`Não consegui atualizar o saldo: ${error.message}`);
    }

    revalidatePath(initialPath);
}

export async function setVacationYearOpen(formData: FormData) {
    const year = Number(formData.get("year"));
    const isOpen = String(formData.get("is_open")) === "true";

    if (!Number.isInteger(year) || year < 2027) {
        return;
    }

    const role = await getCurrentUserRole();
    if (!canManageData(role)) {
        return;
    }

    const supabase = await createClient();
    const [{ data: organizationId }, { data: userData }] = await Promise.all([
        supabase.rpc("my_organization_id"),
        supabase.auth.getUser(),
    ]);

    if (!organizationId || !userData.user) {
        return;
    }

    const { error } = await supabase.from("vacation_year_settings").upsert(
        {
            organization_id: organizationId,
            year,
            is_open: isOpen,
            opened_by: isOpen ? userData.user.id : null,
            opened_at: isOpen ? new Date().toISOString() : null,
        },
        { onConflict: "organization_id,year" }
    );

    if (error) {
        throw new Error(`Não consegui alterar o ano: ${error.message}`);
    }

    revalidatePath(initialPath);
}
