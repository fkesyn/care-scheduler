"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type CreateEmployeeState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        name?: string;
        role?: string;
    };
};

export type UpdateEmployeeState = CreateEmployeeState;

export type DeleteEmployeeState = {
    status: "idle" | "success" | "error";
    message?: string;
};

export type WorkPreferenceFormState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        id?: string;
        employeeId?: string;
        preferenceType?: string;
        shiftTypeId?: string;
        weekday?: string;
        notes?: string;
    };
};

export type DeleteWorkPreferenceState = {
    status: "idle" | "success" | "error";
    message?: string;
};

const allowedRoles = new Set(["nurse", "assistant", "caregiver", "other"]);
const allowedPreferenceTypes = new Set([
    "preferred_shift",
    "avoid_shift",
    "only_shift",
    "preferred_day_off",
    "unavailable_weekday",
    "max_shifts_per_week",
]);
const shiftRequiredPreferenceTypes = new Set([
    "preferred_shift",
    "avoid_shift",
    "only_shift",
]);
const noShiftAllowedPreferenceTypes = new Set([
    "preferred_day_off",
    "unavailable_weekday",
    "max_shifts_per_week",
]);
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getEmployeeActionContext() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            error: "A sessão expirou. Faz login novamente.",
            organizationId: null,
            supabase,
        };
    }

    const { data: organizationId, error: organizationError } = await supabase.rpc(
        "my_organization_id"
    );

    if (organizationError || !organizationId) {
        return {
            error:
                "Não consegui encontrar a organização deste utilizador. Confirma a ligação do user à organização.",
            organizationId: null,
            supabase,
        };
    }

    return {
        error: null,
        organizationId: String(organizationId),
        supabase,
    };
}

async function validateEmployeeForOrganization(
    supabase: Awaited<ReturnType<typeof createClient>>,
    employeeId: string,
    organizationId: string
) {
    if (!uuidPattern.test(employeeId)) {
        return false;
    }

    const { data, error } = await supabase
        .from("employees")
        .select("id")
        .eq("id", employeeId)
        .eq("organization_id", organizationId)
        .maybeSingle();

    return !error && Boolean(data);
}

async function validateShiftTypeForOrganization(
    supabase: Awaited<ReturnType<typeof createClient>>,
    shiftTypeId: string,
    organizationId: string
) {
    if (!uuidPattern.test(shiftTypeId)) {
        return false;
    }

    const { data, error } = await supabase
        .from("shift_types")
        .select("id")
        .eq("id", shiftTypeId)
        .eq("organization_id", organizationId)
        .maybeSingle();

    return !error && Boolean(data);
}

function normalizeWeekday(value: string) {
    if (!value) {
        return null;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6) {
        return null;
    }

    return parsed;
}

function parseWeekdayValues(formData: FormData) {
    const rawValues = formData
        .getAll("weekday_values")
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);

    const includesAllDays = rawValues.includes("all");
    if (includesAllDays && rawValues.length === 1) {
        return { weekdays: null as number[] | null, error: null as string | null };
    }

    const specificDayValues = rawValues.filter((value) => value !== "all");

    if (specificDayValues.length === 0) {
        const legacyWeekdayInput = String(formData.get("weekday") ?? "").trim();
        if (!legacyWeekdayInput) {
            return { weekdays: null as number[] | null, error: null as string | null };
        }

        const legacyWeekday = normalizeWeekday(legacyWeekdayInput);
        if (legacyWeekday === null) {
            return {
                weekdays: null as number[] | null,
                error: "Escolhe um dia da semana válido.",
            };
        }

        return { weekdays: [legacyWeekday], error: null as string | null };
    }

    const weekdays = [...new Set(specificDayValues.map((value) => Number(value)))];
    const hasInvalidValue = weekdays.some(
        (weekday) => !Number.isInteger(weekday) || weekday < 0 || weekday > 6
    );

    if (hasInvalidValue) {
        return {
            weekdays: null as number[] | null,
            error: "Escolhe um dia da semana válido.",
        };
    }

    return { weekdays: weekdays.sort((a, b) => a - b), error: null as string | null };
}

function parsePreferenceIds(formData: FormData, fallbackId?: string) {
    const fromForm = formData
        .getAll("preference_ids")
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);

    if (fromForm.length > 0) {
        return [...new Set(fromForm)];
    }

    if (fallbackId && uuidPattern.test(fallbackId)) {
        return [fallbackId];
    }

    return [];
}

export async function createEmployee(
    _previousState: CreateEmployeeState,
    formData: FormData
): Promise<CreateEmployeeState> {
    const name = String(formData.get("name") ?? "").trim();
    const role = String(formData.get("role") ?? "assistant").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const professionalLicenseNumber = String(
        formData.get("professional_license_number") ?? ""
    ).trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const active = formData.get("active") === "on";

    const fieldErrors: CreateEmployeeState["fieldErrors"] = {};

    if (!name) {
        fieldErrors.name = "O nome é obrigatório.";
    }

    if (!allowedRoles.has(role)) {
        fieldErrors.role = "Escolhe uma categoria válida.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            status: "error",
            message: "Confirma os campos obrigatórios.",
            fieldErrors,
        };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            status: "error",
            message: "A sessão expirou. Faz login novamente.",
        };
    }

    const { error } = await supabase.rpc("create_employee", {
        p_name: name,
        p_role: role,
        p_phone: phone || null,
        p_email: email || null,
        p_professional_license_number: professionalLicenseNumber || null,
        p_notes: notes || null,
        p_active: active,
    });

    if (error) {
        return {
            status: "error",
            message: `Não consegui criar a pessoa: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard/calendar");

    return {
        status: "success",
        message: `"${name}" adicionado à equipa.`,
    };
}

export async function updateEmployee(
    _previousState: UpdateEmployeeState,
    formData: FormData
): Promise<UpdateEmployeeState> {
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const role = String(formData.get("role") ?? "assistant").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const professionalLicenseNumber = String(
        formData.get("professional_license_number") ?? ""
    ).trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const active = formData.get("active") === "on";

    const fieldErrors: UpdateEmployeeState["fieldErrors"] = {};

    if (!uuidPattern.test(id)) {
        return {
            status: "error",
            message: "Pessoa inválida.",
        };
    }

    if (!name) {
        fieldErrors.name = "O nome é obrigatório.";
    }

    if (!allowedRoles.has(role)) {
        fieldErrors.role = "Escolhe uma categoria válida.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            status: "error",
            message: "Confirma os campos obrigatórios.",
            fieldErrors,
        };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            status: "error",
            message: "A sessão expirou. Faz login novamente.",
        };
    }

    const { error } = await supabase
        .from("employees")
        .update({
            name,
            role,
            phone: phone || null,
            email: email || null,
            professional_license_number: professionalLicenseNumber || null,
            notes: notes || null,
            active,
        })
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui atualizar a pessoa: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: `"${name}" atualizado.`,
    };
}

export async function deleteEmployee(
    _previousState: DeleteEmployeeState,
    formData: FormData
): Promise<DeleteEmployeeState> {
    const id = String(formData.get("id") ?? "").trim();

    if (!uuidPattern.test(id)) {
        return {
            status: "error",
            message: "Pessoa inválida.",
        };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            status: "error",
            message: "A sessão expirou. Faz login novamente.",
        };
    }

    const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui apagar a pessoa: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: "Pessoa apagada.",
    };
}

export async function createEmployeeWorkPreference(
    _previousState: WorkPreferenceFormState,
    formData: FormData
): Promise<WorkPreferenceFormState> {
    const employeeId = String(formData.get("employee_id") ?? "").trim();
    const preferenceType = String(formData.get("preference_type") ?? "").trim();
    const shiftTypeId = String(formData.get("shift_type_id") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const active = formData.get("active") === "on";
    const fieldErrors: WorkPreferenceFormState["fieldErrors"] = {};

    if (!uuidPattern.test(employeeId)) {
        fieldErrors.employeeId = "Funcionário inválido.";
    }

    if (!allowedPreferenceTypes.has(preferenceType)) {
        fieldErrors.preferenceType = "Escolhe um tipo de preferência válido.";
    }

    if (
        shiftRequiredPreferenceTypes.has(preferenceType) &&
        !uuidPattern.test(shiftTypeId)
    ) {
        fieldErrors.shiftTypeId = "Escolhe um turno válido.";
    }

    if (noShiftAllowedPreferenceTypes.has(preferenceType) && shiftTypeId) {
        fieldErrors.shiftTypeId = "Este tipo não permite turno.";
    }

    const { weekdays, error: weekdayError } = parseWeekdayValues(formData);
    if (weekdayError) {
        fieldErrors.weekday = weekdayError;
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            status: "error",
            message: "Confirma os campos obrigatórios.",
            fieldErrors,
        };
    }

    const context = await getEmployeeActionContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }
    const organizationId = context.organizationId;

    if (!organizationId) {
        return {
            status: "error",
            message:
                "Não consegui encontrar a organização deste utilizador. Confirma a ligação do user à organização.",
        };
    }

    const employeeIsValid = await validateEmployeeForOrganization(
        context.supabase,
        employeeId,
        organizationId
    );

    if (!employeeIsValid) {
        return {
            status: "error",
            message: "Funcionário inválido para esta organização.",
        };
    }

    if (shiftTypeId) {
        const shiftTypeIsValid = await validateShiftTypeForOrganization(
            context.supabase,
            shiftTypeId,
            organizationId
        );

        if (!shiftTypeIsValid) {
            return {
                status: "error",
                message: "Turno inválido para esta organização.",
            };
        }
    }

    const rowsToInsert = (weekdays ?? [null]).map((weekday) => ({
        organization_id: organizationId,
        employee_id: employeeId,
        preference_type: preferenceType,
        shift_type_id: shiftTypeId || null,
        weekday,
        active,
        notes: notes || null,
    }));

    const { error } = await context.supabase
        .from("employee_work_preferences")
        .insert(rowsToInsert);

    if (error) {
        return {
            status: "error",
            message: `Não consegui criar a preferência fixa: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/employees");
    revalidatePath(`/dashboard/employees/${employeeId}`);
    revalidatePath("/dashboard/schedules");

    return {
        status: "success",
        message: "Preferência fixa adicionada.",
    };
}

export async function updateEmployeeWorkPreference(
    _previousState: WorkPreferenceFormState,
    formData: FormData
): Promise<WorkPreferenceFormState> {
    const id = String(formData.get("id") ?? "").trim();
    const employeeId = String(formData.get("employee_id") ?? "").trim();
    const preferenceType = String(formData.get("preference_type") ?? "").trim();
    const shiftTypeId = String(formData.get("shift_type_id") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const active = formData.get("active") === "on";
    const fieldErrors: WorkPreferenceFormState["fieldErrors"] = {};
    const preferenceIds = parsePreferenceIds(formData, id);

    if (!uuidPattern.test(id) && preferenceIds.length === 0) {
        fieldErrors.id = "Preferência inválida.";
    }
    if (preferenceIds.some((preferenceId) => !uuidPattern.test(preferenceId))) {
        fieldErrors.id = "Preferência inválida.";
    }

    if (!uuidPattern.test(employeeId)) {
        fieldErrors.employeeId = "Funcionário inválido.";
    }

    if (!allowedPreferenceTypes.has(preferenceType)) {
        fieldErrors.preferenceType = "Escolhe um tipo de preferência válido.";
    }

    if (
        shiftRequiredPreferenceTypes.has(preferenceType) &&
        !uuidPattern.test(shiftTypeId)
    ) {
        fieldErrors.shiftTypeId = "Escolhe um turno válido.";
    }

    if (noShiftAllowedPreferenceTypes.has(preferenceType) && shiftTypeId) {
        fieldErrors.shiftTypeId = "Este tipo não permite turno.";
    }

    const { weekdays, error: weekdayError } = parseWeekdayValues(formData);
    if (weekdayError) {
        fieldErrors.weekday = weekdayError;
    }

    if (Object.keys(fieldErrors).length > 0) {
        return {
            status: "error",
            message: "Confirma os campos obrigatórios.",
            fieldErrors,
        };
    }

    const context = await getEmployeeActionContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }
    const organizationId = context.organizationId;

    if (!organizationId) {
        return {
            status: "error",
            message:
                "Não consegui encontrar a organização deste utilizador. Confirma a ligação do user à organização.",
        };
    }

    const employeeIsValid = await validateEmployeeForOrganization(
        context.supabase,
        employeeId,
        organizationId
    );

    if (!employeeIsValid) {
        return {
            status: "error",
            message: "Funcionário inválido para esta organização.",
        };
    }

    if (shiftTypeId) {
        const shiftTypeIsValid = await validateShiftTypeForOrganization(
            context.supabase,
            shiftTypeId,
            organizationId
        );

        if (!shiftTypeIsValid) {
            return {
                status: "error",
                message: "Turno inválido para esta organização.",
            };
        }
    }

    const rowsToInsert = (weekdays ?? [null]).map((weekday) => ({
        organization_id: organizationId,
        employee_id: employeeId,
        preference_type: preferenceType,
        shift_type_id: shiftTypeId || null,
        weekday,
        active,
        notes: notes || null,
    }));

    const { error: insertError } = await context.supabase
        .from("employee_work_preferences")
        .insert(rowsToInsert);

    if (insertError) {
        return {
            status: "error",
            message: `Não consegui atualizar a preferência fixa: ${insertError.message}`,
        };
    }

    const { error } = await context.supabase
        .from("employee_work_preferences")
        .delete()
        .in("id", preferenceIds)
        .eq("organization_id", organizationId)
        .eq("employee_id", employeeId);

    if (error) {
        return {
            status: "error",
            message: `Não consegui atualizar a preferência fixa: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/employees");
    revalidatePath(`/dashboard/employees/${employeeId}`);
    revalidatePath("/dashboard/schedules");

    return {
        status: "success",
        message: "Preferência fixa atualizada.",
    };
}

export async function deleteEmployeeWorkPreference(
    _previousState: DeleteWorkPreferenceState,
    formData: FormData
): Promise<DeleteWorkPreferenceState> {
    const id = String(formData.get("id") ?? "").trim();
    const employeeId = String(formData.get("employee_id") ?? "").trim();
    const preferenceIds = parsePreferenceIds(formData, id);

    if (
        !uuidPattern.test(employeeId) ||
        preferenceIds.length === 0 ||
        preferenceIds.some((preferenceId) => !uuidPattern.test(preferenceId))
    ) {
        return {
            status: "error",
            message: "Preferência inválida.",
        };
    }

    const context = await getEmployeeActionContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }
    const organizationId = context.organizationId;

    if (!organizationId) {
        return {
            status: "error",
            message:
                "Não consegui encontrar a organização deste utilizador. Confirma a ligação do user à organização.",
        };
    }

    const { error } = await context.supabase
        .from("employee_work_preferences")
        .delete()
        .in("id", preferenceIds)
        .eq("organization_id", organizationId);

    if (error) {
        return {
            status: "error",
            message: `Não consegui apagar a preferência fixa: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/employees");
    revalidatePath(`/dashboard/employees/${employeeId}`);
    revalidatePath("/dashboard/schedules");

    return {
        status: "success",
        message: "Preferência fixa apagada.",
    };
}
