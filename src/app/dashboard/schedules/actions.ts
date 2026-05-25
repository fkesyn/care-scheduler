"use server";

import { revalidatePath } from "next/cache";

import {
    parseScheduleConstraintsWithAi as parseScheduleConstraintsWithAiService,
    type AiScheduleConstraintSuggestion,
    type AiScheduleConstraintWarning,
} from "@/lib/ai/parse-schedule-constraints";
import {
    getHolidayForDateFromList,
    getHolidaysForDateRange,
} from "@/lib/holidays/get-holiday-for-date";
import { syncPortugueseHolidays } from "@/lib/holidays/sync-portuguese-holidays";
import { createClient } from "@/lib/supabase/server";

export type ScheduleFormState = {
    status: "idle" | "success" | "error";
    message?: string;
    scheduleId?: string;
    fieldErrors?: {
        id?: string;
        month?: string;
        locationId?: string;
        scheduleStatus?: string;
    };
};

export type DeleteScheduleState = {
    status: "idle" | "success" | "error";
    message?: string;
};

export type UpdateScheduleStatusState = {
    status: "idle" | "success" | "error";
    message?: string;
};

export type ScheduleConstraintFormState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        id?: string;
        scheduleId?: string;
        employeeId?: string;
        constraintType?: string;
        shiftTypeId?: string;
        specificDate?: string;
        startDate?: string;
        endDate?: string;
    };
};

export type DeleteScheduleConstraintState = {
    status: "idle" | "success" | "error";
    message?: string;
};

export type ClearScheduleConstraintsState = {
    status: "idle" | "success" | "error";
    message?: string;
    deletedCount?: number;
};

export type ScheduleEntryActionState = {
    status: "success" | "error";
    message?: string;
};

export type GenerateMonthlyScheduleState = {
    status: "idle" | "success" | "error";
    message?: string;
    warningsCount?: number;
};

export type UpdateGenerationWarningState = {
    status: "idle" | "success" | "error";
    message?: string;
};

export type ImportScheduleConstraintsState = {
    status: "idle" | "success" | "error";
    message?: string;
    importedCount?: number;
};

export type ParseScheduleConstraintsWithAiInput = {
    scheduleId: string;
    inputText: string;
};

export type ParseScheduleConstraintsWithAiSuggestion =
    AiScheduleConstraintSuggestion;

export type ParseScheduleConstraintsWithAiWarning =
    AiScheduleConstraintWarning;

export type ParseScheduleConstraintsWithAiState = {
    status: "success" | "error";
    message?: string;
    suggestions?: ParseScheduleConstraintsWithAiSuggestion[];
    warnings?: ParseScheduleConstraintsWithAiWarning[];
};

export type UpsertScheduleEntryInput = {
    scheduleId: string;
    employeeId: string;
    workDate: string;
    shiftTypeId: string;
};

export type ClearScheduleEntryInput = {
    scheduleId: string;
    employeeId: string;
    workDate: string;
};

const monthPattern = /^\d{4}-\d{2}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const scheduleStatuses = new Set(["draft", "published", "archived"]);
const constraintTypes = new Set([
    "vacation",
    "preferred_day_off",
    "unavailable_shift",
    "avoid_shift",
    "preferred_shift",
    "only_shift",
    "exception_allowed_shift",
]);
const shiftRequiredConstraintTypes = new Set([
    "unavailable_shift",
    "avoid_shift",
    "preferred_shift",
    "only_shift",
    "exception_allowed_shift",
]);
const workPreferenceTypes = new Set([
    "preferred_shift",
    "avoid_shift",
    "only_shift",
    "preferred_day_off",
    "unavailable_weekday",
    "max_shifts_per_week",
]);

type ConstraintScheduleContext = {
    id: string;
    month: string;
    organization_id: string;
};

type GenerationEmployee = {
    id: string;
    name: string;
};

type GenerationShiftType = {
    id: string;
    code: string;
    name: string;
};

type GenerationConstraint = {
    id: string;
    employee_id: string;
    constraint_type: string;
    shift_type_id: string | null;
    specific_date: string | null;
    start_date: string | null;
    end_date: string | null;
    notes: string | null;
    source_text: string | null;
};

type GenerationWorkPreference = {
    id: string;
    employee_id: string;
    preference_type: string;
    shift_type_id: string | null;
    weekday: number | null;
    active: boolean | null;
    notes: string | null;
};

type GenerationEntry = {
    schedule_id: string;
    employee_id: string;
    work_date: string;
    shift_type_id: string;
    notes?: string | null;
};

type GenerationWarning = {
    schedule_id: string;
    work_date: string;
    shift_type_id: string | null;
    employee_id: string | null;
    message: string;
    resolved: boolean;
};

type ImportConstraintSuggestion = {
    employee_id?: unknown;
    constraint_type?: unknown;
    shift_type_id?: unknown;
    specific_date?: unknown;
    start_date?: unknown;
    end_date?: unknown;
    notes?: unknown;
    source_text?: unknown;
};

type ScheduleConstraintFieldErrors = NonNullable<
    ScheduleConstraintFormState["fieldErrors"]
>;

async function getExistingProfileId(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string
) {
    const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    return String(data.id);
}

function normalizeMonth(monthValue: string) {
    if (!monthPattern.test(monthValue)) {
        return null;
    }

    const [year, month] = monthValue.split("-").map(Number);

    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
        return null;
    }

    return `${year}-${String(month).padStart(2, "0")}-01`;
}

function normalizeOptionalDate(dateValue: string) {
    if (!dateValue) {
        return null;
    }

    if (!datePattern.test(dateValue)) {
        return null;
    }

    const [year, month, day] = dateValue.split("-").map(Number);
    const parsedDate = new Date(year, month - 1, day);

    if (
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() !== month - 1 ||
        parsedDate.getDate() !== day
    ) {
        return null;
    }

    return dateValue;
}

function normalizeTextInput(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function duplicateScheduleMessage(locationId: string | null) {
    if (locationId) {
        return "Já existe um horário mensal para este mês e local.";
    }

    return "Já existe um horário mensal geral para este mês.";
}

async function getAuthenticatedContext() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            auditProfileId: null,
            organizationId: null,
            supabase,
            error: "A sessão expirou. Faz login novamente.",
        };
    }

    const { data: organizationId, error: organizationError } = await supabase.rpc(
        "my_organization_id"
    );

    if (organizationError || !organizationId) {
        return {
            auditProfileId: null,
            organizationId: null,
            supabase,
            error:
                "Não consegui encontrar a organização deste utilizador. Confirma a ligação do user à organização.",
        };
    }

    const auditProfileId = await getExistingProfileId(supabase, user.id);

    return {
        auditProfileId,
        error: null,
        organizationId: String(organizationId),
        supabase,
        user,
    };
}

async function validateLocation(
    supabase: Awaited<ReturnType<typeof createClient>>,
    locationId: string
) {
    if (!uuidPattern.test(locationId)) {
        return false;
    }

    const { data, error } = await supabase
        .from("locations")
        .select("id")
        .eq("id", locationId)
        .maybeSingle();

    return !error && Boolean(data);
}

async function getConstraintScheduleContext(
    supabase: Awaited<ReturnType<typeof createClient>>,
    scheduleId: string
) {
    if (!uuidPattern.test(scheduleId)) {
        return null;
    }

    const { data, error } = await supabase
        .from("monthly_schedules")
        .select("id, month, organization_id")
        .eq("id", scheduleId)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    return data as ConstraintScheduleContext;
}

async function validateEmployeeForConstraint(
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
        .eq("active", true)
        .maybeSingle();

    return !error && Boolean(data);
}

async function validateShiftTypeForConstraint(
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
        .eq("active", true)
        .maybeSingle();

    return !error && Boolean(data);
}

function validateConstraintDates(
    fieldErrors: ScheduleConstraintFieldErrors,
    scheduleMonth: string,
    specificDate: string | null,
    startDate: string | null,
    endDate: string | null
) {
    const monthValue = scheduleMonth.slice(0, 7);

    if (specificDate && !specificDate.startsWith(monthValue)) {
        fieldErrors.specificDate = "A data específica tem de pertencer ao mês.";
    }

    if (startDate && !startDate.startsWith(monthValue)) {
        fieldErrors.startDate = "A data de início tem de pertencer ao mês.";
    }

    if (endDate && !endDate.startsWith(monthValue)) {
        fieldErrors.endDate = "A data de fim tem de pertencer ao mês.";
    }

    if (startDate && endDate && endDate < startDate) {
        fieldErrors.endDate = "A data de fim não pode ser anterior ao início.";
    }
}

function dateBelongsToScheduleMonth(dateValue: string, scheduleMonth: string) {
    return dateValue.startsWith(scheduleMonth.slice(0, 7));
}

function formatDateValue(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
    )}`;
}

function weekdayFromDate(dateValue: string) {
    return new Date(`${dateValue}T12:00:00Z`).getUTCDay();
}

function weekStartKeyFromDate(dateValue: string) {
    const date = new Date(`${dateValue}T12:00:00Z`);
    const dayOfWeek = date.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    date.setUTCDate(date.getUTCDate() + diffToMonday);

    return date.toISOString().slice(0, 10);
}

function buildScheduleMonthDays(monthValue: string) {
    const [year, month] = monthValue.slice(0, 7).split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();

    return Array.from({ length: lastDay }, (_, index) =>
        formatDateValue(year, month, index + 1)
    );
}

function buildEntryKey(employeeId: string, dateValue: string) {
    return `${employeeId}:${dateValue}`;
}

function constraintHasDateScope(constraint: GenerationConstraint) {
    return Boolean(
        constraint.specific_date || constraint.start_date || constraint.end_date
    );
}

function constraintMatchesDate(
    constraint: GenerationConstraint,
    dateValue: string
) {
    if (constraint.specific_date) {
        return constraint.specific_date === dateValue;
    }

    if (constraint.start_date || constraint.end_date) {
        const startDate = constraint.start_date ?? dateValue;
        const endDate = constraint.end_date ?? dateValue;

        return dateValue >= startDate && dateValue <= endDate;
    }

    return true;
}

function scopedConstraintDates(
    constraint: GenerationConstraint,
    monthDays: string[]
) {
    if (!constraintHasDateScope(constraint)) {
        return [];
    }

    return monthDays.filter((dateValue) =>
        constraintMatchesDate(constraint, dateValue)
    );
}

function shiftLabel(
    shiftType: GenerationShiftType | undefined,
    fallback = "turno"
) {
    if (!shiftType) {
        return fallback;
    }

    return `${shiftType.code} - ${shiftType.name}`;
}

function extractMaxShiftsPerWeek(notes: string | null) {
    if (!notes) {
        return null;
    }

    const match = notes.match(/\d+/);

    if (!match) {
        return null;
    }

    const value = Number(match[0]);

    if (!Number.isInteger(value) || value <= 0) {
        return null;
    }

    return value;
}

function hasExceptionAllowedShift(
    constraints: GenerationConstraint[],
    dateValue: string,
    shiftTypeId: string
) {
    return constraints.some(
        (constraint) =>
            constraint.constraint_type === "exception_allowed_shift" &&
            constraintMatchesDate(constraint, dateValue) &&
            (!constraint.shift_type_id || constraint.shift_type_id === shiftTypeId)
    );
}

function isHardBlockedForShift(
    constraints: GenerationConstraint[],
    dateValue: string,
    shiftTypeId: string
) {
    if (hasExceptionAllowedShift(constraints, dateValue, shiftTypeId)) {
        return false;
    }

    return constraints.some((constraint) => {
        if (!constraintMatchesDate(constraint, dateValue)) {
            return false;
        }

        if (constraint.constraint_type === "vacation") {
            return true;
        }

        if (constraint.constraint_type === "unavailable_shift") {
            return !constraint.shift_type_id || constraint.shift_type_id === shiftTypeId;
        }

        if (constraint.constraint_type === "only_shift") {
            return Boolean(
                constraint.shift_type_id && constraint.shift_type_id !== shiftTypeId
            );
        }

        return false;
    });
}

function hasSoftAvoidanceForShift(
    constraints: GenerationConstraint[],
    dateValue: string,
    shiftTypeId: string
) {
    return constraints.some(
        (constraint) =>
            constraintMatchesDate(constraint, dateValue) &&
            ((constraint.constraint_type === "avoid_shift" &&
                (!constraint.shift_type_id ||
                    constraint.shift_type_id === shiftTypeId)) ||
                constraint.constraint_type === "preferred_day_off")
    );
}

function hasPreferredShift(
    constraints: GenerationConstraint[],
    dateValue: string,
    shiftTypeId: string
) {
    return constraints.some(
        (constraint) =>
            constraint.constraint_type === "preferred_shift" &&
            constraint.shift_type_id === shiftTypeId &&
            constraintMatchesDate(constraint, dateValue)
    );
}

export async function createMonthlySchedule(
    _previousState: ScheduleFormState,
    formData: FormData
): Promise<ScheduleFormState> {
    const monthInput = String(formData.get("month") ?? "").trim();
    const locationInput = String(formData.get("location_id") ?? "").trim();
    const month = normalizeMonth(monthInput);
    const locationId = locationInput || null;
    const fieldErrors: ScheduleFormState["fieldErrors"] = {};

    if (!month) {
        fieldErrors.month = "Escolhe um mês válido.";
    }

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    if (locationId && !(await validateLocation(context.supabase, locationId))) {
        fieldErrors.locationId = "Escolhe um local válido.";
    }

    if (Object.keys(fieldErrors).length > 0 || !month) {
        return {
            status: "error",
            message: "Confirma os campos obrigatórios.",
            fieldErrors,
        };
    }

    const { data, error } = await context.supabase
        .from("monthly_schedules")
        .insert({
            organization_id: context.organizationId,
            location_id: locationId,
            month,
            status: "draft",
            ...(context.auditProfileId
                ? {
                      created_by: context.auditProfileId,
                      updated_by: context.auditProfileId,
                  }
                : {}),
        })
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message:
                error.code === "23505"
                    ? duplicateScheduleMessage(locationId)
                    : `Não consegui criar o horário mensal: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/schedules");

    return {
        status: "success",
        message: "Horário mensal criado.",
        scheduleId: String(data.id),
    };
}

export async function updateMonthlySchedule(
    _previousState: ScheduleFormState,
    formData: FormData
): Promise<ScheduleFormState> {
    const id = String(formData.get("id") ?? "").trim();
    const monthInput = String(formData.get("month") ?? "").trim();
    const locationInput = String(formData.get("location_id") ?? "").trim();
    const scheduleStatus = String(formData.get("status") ?? "draft").trim();
    const month = normalizeMonth(monthInput);
    const locationId = locationInput || null;
    const fieldErrors: ScheduleFormState["fieldErrors"] = {};

    if (!uuidPattern.test(id)) {
        fieldErrors.id = "Horário inválido.";
    }

    if (!month) {
        fieldErrors.month = "Escolhe um mês válido.";
    }

    if (!scheduleStatuses.has(scheduleStatus)) {
        fieldErrors.scheduleStatus = "Escolhe um estado válido.";
    }

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    if (locationId && !(await validateLocation(context.supabase, locationId))) {
        fieldErrors.locationId = "Escolhe um local válido.";
    }

    if (Object.keys(fieldErrors).length > 0 || !month) {
        return {
            status: "error",
            message: "Confirma os campos obrigatórios.",
            fieldErrors,
        };
    }

    const { error } = await context.supabase
        .from("monthly_schedules")
        .update({
            location_id: locationId,
            month,
            status: scheduleStatus,
            ...(context.auditProfileId ? { updated_by: context.auditProfileId } : {}),
        })
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message:
                error.code === "23505"
                    ? duplicateScheduleMessage(locationId)
                    : `Não consegui atualizar o horário mensal: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/schedules");
    revalidatePath(`/dashboard/schedules/${id}`);

    return {
        status: "success",
        message: "Horário mensal atualizado.",
        scheduleId: id,
    };
}

export async function deleteMonthlySchedule(
    _previousState: DeleteScheduleState,
    formData: FormData
): Promise<DeleteScheduleState> {
    const id = String(formData.get("id") ?? "").trim();

    if (!uuidPattern.test(id)) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const { error } = await context.supabase
        .from("monthly_schedules")
        .delete()
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui apagar o horário mensal: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/schedules");

    return {
        status: "success",
        message: "Horário mensal apagado.",
    };
}

export async function publishMonthlySchedule(
    _previousState: UpdateScheduleStatusState,
    formData: FormData
): Promise<UpdateScheduleStatusState> {
    const scheduleId = String(formData.get("schedule_id") ?? "").trim();

    if (!uuidPattern.test(scheduleId)) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const schedule = await getConstraintScheduleContext(context.supabase, scheduleId);

    if (!schedule) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    const { data: currentSchedule, error: currentScheduleError } = await context.supabase
        .from("monthly_schedules")
        .select("id, status")
        .eq("id", scheduleId)
        .maybeSingle();

    if (currentScheduleError || !currentSchedule) {
        return {
            status: "error",
            message: "Não consegui validar o estado atual do horário.",
        };
    }

    if (currentSchedule.status !== "draft") {
        return {
            status: "error",
            message: "Só horários em rascunho podem ser publicados.",
        };
    }

    const { error } = await context.supabase
        .from("monthly_schedules")
        .update({
            status: "published",
            ...(context.auditProfileId ? { updated_by: context.auditProfileId } : {}),
        })
        .eq("id", scheduleId);

    if (error) {
        return {
            status: "error",
            message: `Não consegui publicar o horário: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/schedules");
    revalidatePath(`/dashboard/schedules/${scheduleId}`);
    revalidatePath(`/dashboard/schedules/${scheduleId}/print`);

    return {
        status: "success",
        message: "Horário publicado.",
    };
}

export async function revertMonthlyScheduleToDraft(
    _previousState: UpdateScheduleStatusState,
    formData: FormData
): Promise<UpdateScheduleStatusState> {
    const scheduleId = String(formData.get("schedule_id") ?? "").trim();

    if (!uuidPattern.test(scheduleId)) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const schedule = await getConstraintScheduleContext(context.supabase, scheduleId);

    if (!schedule) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    const { data: currentSchedule, error: currentScheduleError } = await context.supabase
        .from("monthly_schedules")
        .select("id, status")
        .eq("id", scheduleId)
        .maybeSingle();

    if (currentScheduleError || !currentSchedule) {
        return {
            status: "error",
            message: "Não consegui validar o estado atual do horário.",
        };
    }

    if (currentSchedule.status !== "published") {
        return {
            status: "error",
            message: "Só horários publicados podem voltar a rascunho.",
        };
    }

    const { error } = await context.supabase
        .from("monthly_schedules")
        .update({
            status: "draft",
            ...(context.auditProfileId ? { updated_by: context.auditProfileId } : {}),
        })
        .eq("id", scheduleId);

    if (error) {
        return {
            status: "error",
            message: `Não consegui voltar o horário a rascunho: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/schedules");
    revalidatePath(`/dashboard/schedules/${scheduleId}`);
    revalidatePath(`/dashboard/schedules/${scheduleId}/print`);

    return {
        status: "success",
        message: "Horário voltou a rascunho.",
    };
}

export async function createScheduleConstraint(
    _previousState: ScheduleConstraintFormState,
    formData: FormData
): Promise<ScheduleConstraintFormState> {
    const scheduleId = String(formData.get("schedule_id") ?? "").trim();
    const employeeId = String(formData.get("employee_id") ?? "").trim();
    const constraintType = String(formData.get("constraint_type") ?? "").trim();
    const shiftTypeInput = String(formData.get("shift_type_id") ?? "").trim();
    const specificDateInput = String(formData.get("specific_date") ?? "").trim();
    const startDateInput = String(formData.get("start_date") ?? "").trim();
    const endDateInput = String(formData.get("end_date") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const sourceText = String(formData.get("source_text") ?? "").trim();

    const shiftTypeId = shiftTypeInput || null;
    const specificDate = normalizeOptionalDate(specificDateInput);
    const startDate = normalizeOptionalDate(startDateInput);
    const endDate = normalizeOptionalDate(endDateInput);
    const fieldErrors: ScheduleConstraintFieldErrors = {};

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const schedule = await getConstraintScheduleContext(context.supabase, scheduleId);

    if (!schedule) {
        fieldErrors.scheduleId = "Horário inválido.";
    }

    if (!constraintTypes.has(constraintType)) {
        fieldErrors.constraintType = "Escolhe um tipo válido.";
    }

    if (!specificDate && specificDateInput) {
        fieldErrors.specificDate = "Escolhe uma data válida.";
    }

    if (!startDate && startDateInput) {
        fieldErrors.startDate = "Escolhe uma data de início válida.";
    }

    if (!endDate && endDateInput) {
        fieldErrors.endDate = "Escolhe uma data de fim válida.";
    }

    if (
        schedule &&
        !(await validateEmployeeForConstraint(
            context.supabase,
            employeeId,
            schedule.organization_id
        ))
    ) {
        fieldErrors.employeeId = "Escolhe um funcionário ativo.";
    }

    if (
        schedule &&
        shiftTypeId &&
        !(await validateShiftTypeForConstraint(
            context.supabase,
            shiftTypeId,
            schedule.organization_id
        ))
    ) {
        fieldErrors.shiftTypeId = "Escolhe um turno válido.";
    }

    if (schedule) {
        validateConstraintDates(
            fieldErrors,
            schedule.month,
            specificDate,
            startDate,
            endDate
        );
    }

    if (Object.keys(fieldErrors).length > 0 || !schedule) {
        return {
            status: "error",
            message: "Confirma os campos do pedido/restrição.",
            fieldErrors,
        };
    }

    const { error } = await context.supabase
        .from("employee_schedule_constraints")
        .insert({
            organization_id: schedule.organization_id,
            employee_id: employeeId,
            month: schedule.month,
            constraint_type: constraintType,
            shift_type_id: shiftTypeId,
            specific_date: specificDate,
            start_date: startDate,
            end_date: endDate,
            notes: notes || null,
            source_text: sourceText || null,
        });

    if (error) {
        return {
            status: "error",
            message: `Não consegui criar o pedido/restrição: ${error.message}`,
        };
    }

    revalidatePath(`/dashboard/schedules/${schedule.id}`);

    return {
        status: "success",
        message: "Pedido/restrição adicionado.",
    };
}

export async function updateScheduleConstraint(
    _previousState: ScheduleConstraintFormState,
    formData: FormData
): Promise<ScheduleConstraintFormState> {
    const id = String(formData.get("id") ?? "").trim();
    const scheduleId = String(formData.get("schedule_id") ?? "").trim();
    const employeeId = String(formData.get("employee_id") ?? "").trim();
    const constraintType = String(formData.get("constraint_type") ?? "").trim();
    const shiftTypeInput = String(formData.get("shift_type_id") ?? "").trim();
    const specificDateInput = String(formData.get("specific_date") ?? "").trim();
    const startDateInput = String(formData.get("start_date") ?? "").trim();
    const endDateInput = String(formData.get("end_date") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const sourceText = String(formData.get("source_text") ?? "").trim();

    const shiftTypeId = shiftTypeInput || null;
    const specificDate = normalizeOptionalDate(specificDateInput);
    const startDate = normalizeOptionalDate(startDateInput);
    const endDate = normalizeOptionalDate(endDateInput);
    const fieldErrors: ScheduleConstraintFieldErrors = {};

    if (!uuidPattern.test(id)) {
        fieldErrors.id = "Pedido/restrição inválido.";
    }

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const schedule = await getConstraintScheduleContext(context.supabase, scheduleId);

    if (!schedule) {
        fieldErrors.scheduleId = "Horário inválido.";
    }

    if (!constraintTypes.has(constraintType)) {
        fieldErrors.constraintType = "Escolhe um tipo válido.";
    }

    if (!specificDate && specificDateInput) {
        fieldErrors.specificDate = "Escolhe uma data válida.";
    }

    if (!startDate && startDateInput) {
        fieldErrors.startDate = "Escolhe uma data de início válida.";
    }

    if (!endDate && endDateInput) {
        fieldErrors.endDate = "Escolhe uma data de fim válida.";
    }

    if (
        schedule &&
        !(await validateEmployeeForConstraint(
            context.supabase,
            employeeId,
            schedule.organization_id
        ))
    ) {
        fieldErrors.employeeId = "Escolhe um funcionário ativo.";
    }

    if (
        schedule &&
        shiftTypeId &&
        !(await validateShiftTypeForConstraint(
            context.supabase,
            shiftTypeId,
            schedule.organization_id
        ))
    ) {
        fieldErrors.shiftTypeId = "Escolhe um turno válido.";
    }

    if (schedule) {
        validateConstraintDates(
            fieldErrors,
            schedule.month,
            specificDate,
            startDate,
            endDate
        );
    }

    if (Object.keys(fieldErrors).length > 0 || !schedule) {
        return {
            status: "error",
            message: "Confirma os campos do pedido/restrição.",
            fieldErrors,
        };
    }

    const { error } = await context.supabase
        .from("employee_schedule_constraints")
        .update({
            employee_id: employeeId,
            constraint_type: constraintType,
            shift_type_id: shiftTypeId,
            specific_date: specificDate,
            start_date: startDate,
            end_date: endDate,
            notes: notes || null,
            source_text: sourceText || null,
        })
        .eq("id", id)
        .eq("organization_id", schedule.organization_id)
        .eq("month", schedule.month)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui atualizar o pedido/restrição: ${error.message}`,
        };
    }

    revalidatePath(`/dashboard/schedules/${schedule.id}`);

    return {
        status: "success",
        message: "Pedido/restrição atualizado.",
    };
}

export async function deleteScheduleConstraint(
    _previousState: DeleteScheduleConstraintState,
    formData: FormData
): Promise<DeleteScheduleConstraintState> {
    const id = String(formData.get("id") ?? "").trim();
    const scheduleId = String(formData.get("schedule_id") ?? "").trim();

    if (!uuidPattern.test(id)) {
        return {
            status: "error",
            message: "Pedido/restrição inválido.",
        };
    }

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const schedule = await getConstraintScheduleContext(context.supabase, scheduleId);

    if (!schedule) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    const { error } = await context.supabase
        .from("employee_schedule_constraints")
        .delete()
        .eq("id", id)
        .eq("organization_id", schedule.organization_id)
        .eq("month", schedule.month)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui apagar o pedido/restrição: ${error.message}`,
        };
    }

    revalidatePath(`/dashboard/schedules/${schedule.id}`);

    return {
        status: "success",
        message: "Pedido/restrição apagado.",
    };
}

export async function clearScheduleConstraints(
    _previousState: ClearScheduleConstraintsState,
    formData: FormData
): Promise<ClearScheduleConstraintsState> {
    const scheduleId = String(formData.get("schedule_id") ?? "").trim();

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const schedule = await getConstraintScheduleContext(context.supabase, scheduleId);

    if (!schedule || schedule.organization_id !== context.organizationId) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    const { data, error } = await context.supabase
        .from("employee_schedule_constraints")
        .delete()
        .eq("organization_id", schedule.organization_id)
        .eq("month", schedule.month)
        .select("id");

    if (error) {
        return {
            status: "error",
            message: `Não consegui limpar os pedidos/restrições: ${error.message}`,
        };
    }

    const deletedCount = data?.length ?? 0;

    revalidatePath(`/dashboard/schedules/${schedule.id}`);

    return {
        status: "success",
        message: `${deletedCount} ${
            deletedCount === 1
                ? "pedido/restrição apagado"
                : "pedidos/restrições apagados"
        }.`,
        deletedCount,
    };
}

export async function importScheduleConstraints(
    _previousState: ImportScheduleConstraintsState,
    formData: FormData
): Promise<ImportScheduleConstraintsState> {
    const scheduleId = String(formData.get("schedule_id") ?? "").trim();
    const suggestionsInput = String(formData.get("suggestions_json") ?? "").trim();

    if (!suggestionsInput) {
        return {
            status: "error",
            message: "Gera e confirma pelo menos uma sugestão antes de importar.",
        };
    }

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const schedule = await getConstraintScheduleContext(context.supabase, scheduleId);

    if (!schedule) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    let suggestions: ImportConstraintSuggestion[];

    try {
        const parsedSuggestions = JSON.parse(suggestionsInput) as unknown;

        if (!Array.isArray(parsedSuggestions)) {
            throw new Error("Invalid suggestions payload");
        }

        suggestions = parsedSuggestions as ImportConstraintSuggestion[];
    } catch {
        return {
            status: "error",
            message: "Não consegui ler as sugestões para importar.",
        };
    }

    if (suggestions.length === 0) {
        return {
            status: "error",
            message: "Gera e confirma pelo menos uma sugestão antes de importar.",
        };
    }

    if (suggestions.length > 150) {
        return {
            status: "error",
            message: "Importa no máximo 150 pedidos/restrições de cada vez.",
        };
    }

    const [
        { data: employeeRows, error: employeesError },
        { data: shiftTypeRows, error: shiftTypesError },
    ] = await Promise.all([
        context.supabase
            .from("employees")
            .select("id")
            .eq("organization_id", schedule.organization_id)
            .eq("active", true),
        context.supabase
            .from("shift_types")
            .select("id")
            .eq("organization_id", schedule.organization_id)
            .eq("active", true),
    ]);

    const loadError = employeesError ?? shiftTypesError;

    if (loadError) {
        return {
            status: "error",
            message: `Não consegui validar os dados da importação: ${loadError.message}`,
        };
    }

    const validEmployeeIds = new Set(
        (employeeRows ?? []).map((employee) => String(employee.id))
    );
    const validShiftTypeIds = new Set(
        (shiftTypeRows ?? []).map((shiftType) => String(shiftType.id))
    );
    const rows: Array<{
        organization_id: string;
        employee_id: string;
        month: string;
        constraint_type: string;
        shift_type_id: string | null;
        specific_date: string | null;
        start_date: string | null;
        end_date: string | null;
        notes: string | null;
        source_text: string | null;
    }> = [];

    for (const [index, suggestion] of suggestions.entries()) {
        const rowNumber = index + 1;
        const employeeId = normalizeTextInput(suggestion.employee_id);
        const constraintType = normalizeTextInput(suggestion.constraint_type);
        const shiftTypeInput = normalizeTextInput(suggestion.shift_type_id);
        const specificDateInput = normalizeTextInput(suggestion.specific_date);
        const startDateInput = normalizeTextInput(suggestion.start_date);
        const endDateInput = normalizeTextInput(suggestion.end_date);
        const notes = normalizeTextInput(suggestion.notes);
        const sourceText = normalizeTextInput(suggestion.source_text);
        const shiftTypeId = shiftTypeInput || null;
        const specificDate = normalizeOptionalDate(specificDateInput);
        const startDate = normalizeOptionalDate(startDateInput);
        const endDate = normalizeOptionalDate(endDateInput);
        const fieldErrors: ScheduleConstraintFieldErrors = {};
        const hasDateScope = Boolean(specificDate || startDate || endDate);

        if (!uuidPattern.test(employeeId) || !validEmployeeIds.has(employeeId)) {
            return {
                status: "error",
                message: `Sugestão ${rowNumber}: escolhe um funcionário ativo.`,
            };
        }

        if (!constraintTypes.has(constraintType)) {
            return {
                status: "error",
                message: `Sugestão ${rowNumber}: escolhe um tipo de restrição válido.`,
            };
        }

        if (shiftRequiredConstraintTypes.has(constraintType) && !shiftTypeId) {
            return {
                status: "error",
                message: `Sugestão ${rowNumber}: escolhe o turno associado à restrição.`,
            };
        }

        if (shiftTypeId && !validShiftTypeIds.has(shiftTypeId)) {
            return {
                status: "error",
                message: `Sugestão ${rowNumber}: escolhe um turno válido.`,
            };
        }

        if (constraintType === "vacation" && (!startDate || !endDate)) {
            return {
                status: "error",
                message: `Sugestão ${rowNumber}: confirma o intervalo de férias.`,
            };
        }

        if (
            (constraintType === "preferred_day_off" ||
                constraintType === "unavailable_shift") &&
            !hasDateScope
        ) {
            return {
                status: "error",
                message: `Sugestão ${rowNumber}: escolhe a data.`,
            };
        }

        if (!specificDate && specificDateInput) {
            fieldErrors.specificDate = "Data específica inválida.";
        }

        if (!startDate && startDateInput) {
            fieldErrors.startDate = "Data de início inválida.";
        }

        if (!endDate && endDateInput) {
            fieldErrors.endDate = "Data de fim inválida.";
        }

        validateConstraintDates(
            fieldErrors,
            schedule.month,
            specificDate,
            startDate,
            endDate
        );

        if (Object.keys(fieldErrors).length > 0) {
            return {
                status: "error",
                message: `Sugestão ${rowNumber}: confirma as datas.`,
            };
        }

        rows.push({
            organization_id: schedule.organization_id,
            employee_id: employeeId,
            month: schedule.month,
            constraint_type: constraintType,
            shift_type_id: shiftTypeId,
            specific_date: specificDate,
            start_date: startDate,
            end_date: endDate,
            notes: notes || null,
            source_text: sourceText || null,
        });
    }

    const { error } = await context.supabase
        .from("employee_schedule_constraints")
        .insert(rows);

    if (error) {
        return {
            status: "error",
            message: `Não consegui importar os pedidos/restrições: ${error.message}`,
        };
    }

    revalidatePath(`/dashboard/schedules/${schedule.id}`);

    return {
        status: "success",
        message: `${rows.length} ${
            rows.length === 1
                ? "pedido/restrição importado"
                : "pedidos/restrições importados"
        }.`,
        importedCount: rows.length,
    };
}

export async function parseScheduleConstraintsWithAi({
    inputText,
    scheduleId,
}: ParseScheduleConstraintsWithAiInput): Promise<ParseScheduleConstraintsWithAiState> {
    const normalizedScheduleId = String(scheduleId ?? "").trim();
    const normalizedInputText = String(inputText ?? "").trim();

    if (!uuidPattern.test(normalizedScheduleId)) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    if (!normalizedInputText) {
        return {
            status: "error",
            message: "Cola o texto original antes de usar IA.",
        };
    }

    if (normalizedInputText.length > 12000) {
        return {
            status: "error",
            message: "O texto é demasiado grande. Divide em blocos mais pequenos.",
        };
    }

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const schedule = await getConstraintScheduleContext(
        context.supabase,
        normalizedScheduleId
    );

    if (!schedule || schedule.organization_id !== context.organizationId) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    const [
        { data: employeeRows, error: employeesError },
        { data: shiftTypeRows, error: shiftTypesError },
    ] = await Promise.all([
        context.supabase
            .from("employees")
            .select("id, name")
            .eq("organization_id", schedule.organization_id)
            .eq("active", true)
            .order("name"),
        context.supabase
            .from("shift_types")
            .select("code, name, description")
            .eq("organization_id", schedule.organization_id)
            .eq("active", true)
            .order("display_order")
            .order("code"),
    ]);

    const loadError = employeesError ?? shiftTypesError;

    if (loadError) {
        return {
            status: "error",
            message: `Não consegui carregar contexto para a IA: ${loadError.message}`,
        };
    }

    const employees = (employeeRows ?? []).map((employee) => ({
        id: String(employee.id),
        name: String(employee.name),
    }));
    const shiftTypes = (shiftTypeRows ?? []).map((shiftType) => ({
        code: String(shiftType.code),
        description: shiftType.description ? String(shiftType.description) : null,
        name: String(shiftType.name),
    }));

    if (employees.length === 0) {
        return {
            status: "error",
            message: "Não há funcionários ativos para a IA conseguir fazer match.",
        };
    }

    if (shiftTypes.length === 0) {
        return {
            status: "error",
            message: "Não há tipos de turno ativos para a IA interpretar pedidos.",
        };
    }

    void syncPortugueseHolidays(Number(schedule.month.slice(0, 4)), context.supabase).catch(
        () => null
    );

    const monthDays = buildScheduleMonthDays(schedule.month);
    const holidayRows = await getHolidaysForDateRange(
        monthDays[0] ?? schedule.month,
        monthDays[monthDays.length - 1] ?? schedule.month
    );
    const holidayContextLines = monthDays
        .map((dateValue) => {
            const holiday = getHolidayForDateFromList(holidayRows, dateValue);

            if (!holiday) {
                return null;
            }

            const [year, month, day] = dateValue.split("-");
            return `- ${day}/${month}/${year}: ${holiday.name}${
                holiday.region ? ` (${holiday.region})` : ""
            }`;
        })
        .filter((line): line is string => Boolean(line));
    const aiInputText =
        holidayContextLines.length > 0
            ? [
                  "Contexto de feriados do mês (usar apenas como apoio para interpretar linguagem natural):",
                  ...holidayContextLines,
                  "",
                  "Texto para interpretar:",
                  normalizedInputText,
              ].join("\n")
            : normalizedInputText;

    try {
        const result = await parseScheduleConstraintsWithAiService({
            employees,
            inputText: aiInputText,
            scheduleMonth: schedule.month,
            shiftTypes,
        });

        return {
            status: "success",
            suggestions: result.suggestions.map((suggestion) => {
                const needsConfirmation =
                    suggestion.status === "needs_confirmation" ||
                    !suggestion.matchedEmployeeId ||
                    (shiftRequiredConstraintTypes.has(suggestion.constraintType) &&
                        !suggestion.shiftCode) ||
                    (suggestion.constraintType === "vacation" &&
                        (!suggestion.startDate || !suggestion.endDate)) ||
                    ((suggestion.constraintType === "preferred_day_off" ||
                        suggestion.constraintType === "unavailable_shift") &&
                        !suggestion.specificDate &&
                        !suggestion.startDate &&
                        !suggestion.endDate);

                return {
                    ...suggestion,
                    status: needsConfirmation ? "needs_confirmation" : "valid",
                };
            }),
            warnings: result.warnings,
        };
    } catch (error) {
        return {
            status: "error",
            message:
                error instanceof Error
                    ? error.message
                    : "Não consegui interpretar o texto com IA.",
        };
    }
}

export async function upsertScheduleEntry(
    input: UpsertScheduleEntryInput
): Promise<ScheduleEntryActionState> {
    const scheduleId = String(input.scheduleId ?? "").trim();
    const employeeId = String(input.employeeId ?? "").trim();
    const workDate = String(input.workDate ?? "").trim();
    const shiftTypeId = String(input.shiftTypeId ?? "").trim();

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const schedule = await getConstraintScheduleContext(context.supabase, scheduleId);

    if (!schedule) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    const normalizedWorkDate = normalizeOptionalDate(workDate);

    if (
        !normalizedWorkDate ||
        !dateBelongsToScheduleMonth(normalizedWorkDate, schedule.month)
    ) {
        return {
            status: "error",
            message: "A data da célula não pertence ao mês deste horário.",
        };
    }

    const [employeeIsValid, shiftTypeIsValid] = await Promise.all([
        validateEmployeeForConstraint(
            context.supabase,
            employeeId,
            schedule.organization_id
        ),
        validateShiftTypeForConstraint(
            context.supabase,
            shiftTypeId,
            schedule.organization_id
        ),
    ]);

    if (!employeeIsValid) {
        return {
            status: "error",
            message: "Funcionário inválido para este horário.",
        };
    }

    if (!shiftTypeIsValid) {
        return {
            status: "error",
            message: "Turno inválido para este horário.",
        };
    }

    const { error } = await context.supabase
        .from("schedule_entries")
        .upsert(
            {
                schedule_id: schedule.id,
                employee_id: employeeId,
                work_date: normalizedWorkDate,
                shift_type_id: shiftTypeId,
            },
            {
                onConflict: "schedule_id,employee_id,work_date",
            }
        )
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui guardar a célula: ${error.message}`,
        };
    }

    revalidatePath(`/dashboard/schedules/${schedule.id}`);

    return {
        status: "success",
        message: "Célula guardada.",
    };
}

export async function clearScheduleEntry(
    input: ClearScheduleEntryInput
): Promise<ScheduleEntryActionState> {
    const scheduleId = String(input.scheduleId ?? "").trim();
    const employeeId = String(input.employeeId ?? "").trim();
    const workDate = String(input.workDate ?? "").trim();

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const schedule = await getConstraintScheduleContext(context.supabase, scheduleId);

    if (!schedule) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    const normalizedWorkDate = normalizeOptionalDate(workDate);

    if (
        !normalizedWorkDate ||
        !dateBelongsToScheduleMonth(normalizedWorkDate, schedule.month)
    ) {
        return {
            status: "error",
            message: "A data da célula não pertence ao mês deste horário.",
        };
    }

    const employeeIsValid = await validateEmployeeForConstraint(
        context.supabase,
        employeeId,
        schedule.organization_id
    );

    if (!employeeIsValid) {
        return {
            status: "error",
            message: "Funcionário inválido para este horário.",
        };
    }

    const { error } = await context.supabase
        .from("schedule_entries")
        .delete()
        .eq("schedule_id", schedule.id)
        .eq("employee_id", employeeId)
        .eq("work_date", normalizedWorkDate);

    if (error) {
        return {
            status: "error",
            message: `Não consegui limpar a célula: ${error.message}`,
        };
    }

    revalidatePath(`/dashboard/schedules/${schedule.id}`);

    return {
        status: "success",
        message: "Célula limpa.",
    };
}

export async function generateMonthlySchedule(
    _previousState: GenerateMonthlyScheduleState,
    formData: FormData
): Promise<GenerateMonthlyScheduleState> {
    const scheduleId = String(formData.get("schedule_id") ?? "").trim();
    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const schedule = await getConstraintScheduleContext(context.supabase, scheduleId);

    if (!schedule) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    const generationSchedule = schedule;
    void syncPortugueseHolidays(
        Number(generationSchedule.month.slice(0, 4)),
        context.supabase
    ).catch(() => null);
    const generationMonthDays = buildScheduleMonthDays(generationSchedule.month);
    const generationMonthStart = generationMonthDays[0] ?? generationSchedule.month;
    const generationMonthEnd =
        generationMonthDays[generationMonthDays.length - 1] ?? generationSchedule.month;

    const [
        { data: employeesData, error: employeesError },
        { data: shiftTypesData, error: shiftTypesError },
        { data: constraintsData, error: constraintsError },
        { data: workPreferencesData, error: workPreferencesError },
        { data: holidaysData, error: holidaysError },
    ] = await Promise.all([
        context.supabase
            .from("employees")
            .select("id, name")
            .eq("organization_id", generationSchedule.organization_id)
            .eq("active", true)
            .order("name"),
        context.supabase
            .from("shift_types")
            .select("id, code, name")
            .eq("organization_id", generationSchedule.organization_id)
            .eq("active", true)
            .order("display_order")
            .order("code"),
        context.supabase
            .from("employee_schedule_constraints")
            .select(
                "id, employee_id, constraint_type, shift_type_id, specific_date, start_date, end_date, notes, source_text"
            )
            .eq("organization_id", generationSchedule.organization_id)
            .eq("month", generationSchedule.month),
        context.supabase
            .from("employee_work_preferences")
            .select(
                "id, employee_id, preference_type, shift_type_id, weekday, active, notes"
            )
            .eq("organization_id", generationSchedule.organization_id)
            .eq("active", true),
        context.supabase
            .from("public_holidays")
            .select("holiday_date, name, country_code, region")
            .eq("country_code", "PT")
            .gte("holiday_date", generationMonthStart)
            .lte("holiday_date", generationMonthEnd),
    ]);

    const loadError =
        employeesError ??
        shiftTypesError ??
        constraintsError ??
        workPreferencesError ??
        holidaysError;

    if (loadError) {
        return {
            status: "error",
            message: `Não consegui carregar dados para gerar o rascunho: ${loadError.message}`,
        };
    }

    const employees = (employeesData ?? []) as GenerationEmployee[];
    const shiftTypes = (shiftTypesData ?? []) as GenerationShiftType[];
    const constraints = (constraintsData ?? []) as GenerationConstraint[];
    const workPreferences =
        (workPreferencesData ?? []) as GenerationWorkPreference[];
    const holidays = (holidaysData ?? []) as Array<{
        holiday_date: string;
        name: string;
        country_code: string;
        region: string | null;
    }>;

    if (employees.length === 0) {
        return {
            status: "error",
            message: "Não há funcionários ativos para gerar o horário.",
        };
    }

    const shiftTypesByCode = new Map(
        shiftTypes.map((shiftType) => [shiftType.code, shiftType])
    );
    const shiftTypesById = new Map(
        shiftTypes.map((shiftType) => [shiftType.id, shiftType])
    );
    const morningShift = shiftTypesByCode.get("M");
    const afternoonShift = shiftTypesByCode.get("T");
    const dayOffShift = shiftTypesByCode.get("F");
    const vacationShift = shiftTypesByCode.get("Fe");

    if (!morningShift || !afternoonShift) {
        return {
            status: "error",
            message: "Faltam os turnos M e/ou T nos tipos de turno ativos.",
        };
    }

    const monthDays = generationMonthDays;
    const nonWorkShiftCodes = new Set(["F", "FF", "Fe"]);
    const employeeById = new Map(
        employees.map((employee) => [employee.id, employee])
    );
    const constraintsByEmployee = new Map<string, GenerationConstraint[]>();
    const workShiftCounts = new Map(
        employees.map((employee) => [employee.id, 0])
    );
    const weekendShiftCounts = new Map(
        employees.map((employee) => [employee.id, 0])
    );
    const holidayShiftCounts = new Map(
        employees.map((employee) => [employee.id, 0])
    );
    const assignedDatesByEmployee = new Map<string, Set<string>>(
        employees.map((employee) => [employee.id, new Set<string>()])
    );
    const lastAssignedShiftCodeByEmployee = new Map<string, string>();
    const lastAssignedDateByEmployee = new Map<string, string>();
    const weeklyWorkShiftCounts = new Map<string, number>();
    const maxShiftsPerWeekByEmployee = new Map<string, number>();
    const entriesByCell = new Map<string, GenerationEntry>();
    const assignedEmployeesByDate = new Map<string, Set<string>>();
    const warnings: GenerationWarning[] = [];
    const entries: GenerationEntry[] = [];
    const holidayDates = new Set(holidays.map((holiday) => holiday.holiday_date));
    const weekendDates = new Set(
        monthDays.filter((dateValue) => {
            const date = new Date(`${dateValue}T00:00:00`);
            const weekday = date.getDay();
            return weekday === 0 || weekday === 6;
        })
    );

    function previousDateValue(dateValue: string) {
        const date = new Date(`${dateValue}T00:00:00`);
        date.setDate(date.getDate() - 1);
        return date.toISOString().slice(0, 10);
    }

    function consecutiveDaysBefore(employeeId: string, dateValue: string) {
        const assignedDates = assignedDatesByEmployee.get(employeeId) ?? new Set<string>();
        let streak = 0;
        let cursor = previousDateValue(dateValue);

        while (assignedDates.has(cursor)) {
            streak += 1;
            cursor = previousDateValue(cursor);
        }

        return streak;
    }

    function addWarning(
        workDate: string,
        shiftTypeId: string | null,
        message: string,
        employeeId: string | null = null
    ) {
        const holiday = getHolidayForDateFromList(holidays, workDate);
        const holidaySuffix = holiday ? ` (Feriado: ${holiday.name})` : "";

        warnings.push({
            schedule_id: generationSchedule.id,
            work_date: workDate,
            shift_type_id: shiftTypeId,
            employee_id: employeeId,
            message: `${message}${holidaySuffix}`,
            resolved: false,
        });
    }

    function addEntry(
        employeeId: string,
        workDate: string,
        shiftType: GenerationShiftType,
        notes: string | null,
        countAsWorkShift: boolean
    ) {
        const cellKey = buildEntryKey(employeeId, workDate);

        if (entriesByCell.has(cellKey)) {
            return false;
        }

        const entry: GenerationEntry = {
            schedule_id: generationSchedule.id,
            employee_id: employeeId,
            work_date: workDate,
            shift_type_id: shiftType.id,
            notes,
        };
        const assignedEmployees =
            assignedEmployeesByDate.get(workDate) ?? new Set<string>();

        entriesByCell.set(cellKey, entry);
        assignedEmployees.add(employeeId);
        assignedEmployeesByDate.set(workDate, assignedEmployees);
        entries.push(entry);

        if (countAsWorkShift) {
            workShiftCounts.set(employeeId, (workShiftCounts.get(employeeId) ?? 0) + 1);
            const weekKey = `${employeeId}:${weekStartKeyFromDate(workDate)}`;
            weeklyWorkShiftCounts.set(
                weekKey,
                (weeklyWorkShiftCounts.get(weekKey) ?? 0) + 1
            );
            if (weekendDates.has(workDate)) {
                weekendShiftCounts.set(
                    employeeId,
                    (weekendShiftCounts.get(employeeId) ?? 0) + 1
                );
            }
            if (holidayDates.has(workDate)) {
                holidayShiftCounts.set(
                    employeeId,
                    (holidayShiftCounts.get(employeeId) ?? 0) + 1
                );
            }

            const assignedDates = assignedDatesByEmployee.get(employeeId) ?? new Set<string>();
            assignedDates.add(workDate);
            assignedDatesByEmployee.set(employeeId, assignedDates);
            lastAssignedShiftCodeByEmployee.set(employeeId, shiftType.code);
            lastAssignedDateByEmployee.set(employeeId, workDate);
        }

        return true;
    }

    const preferenceConstraints: GenerationConstraint[] = [];

    for (const preference of workPreferences) {
        const employee = employeeById.get(preference.employee_id);

        if (!employee || !workPreferenceTypes.has(preference.preference_type)) {
            continue;
        }

        if (preference.preference_type === "max_shifts_per_week") {
            const maxValue = extractMaxShiftsPerWeek(preference.notes);

            if (!maxValue) {
                addWarning(
                    generationSchedule.month,
                    null,
                    `${employee.name}: preferência fixa de máximo de turnos/semana sem número válido nas notas.`
                );
                continue;
            }

            const currentMax = maxShiftsPerWeekByEmployee.get(employee.id);
            maxShiftsPerWeekByEmployee.set(
                employee.id,
                currentMax ? Math.min(currentMax, maxValue) : maxValue
            );
            continue;
        }

        if (
            (preference.preference_type === "preferred_shift" ||
                preference.preference_type === "avoid_shift" ||
                preference.preference_type === "only_shift") &&
            !preference.shift_type_id
        ) {
            addWarning(
                generationSchedule.month,
                null,
                `${employee.name}: preferência fixa "${preference.preference_type}" sem turno associado.`
            );
            continue;
        }

        if (
            preference.shift_type_id &&
            !shiftTypesById.has(preference.shift_type_id)
        ) {
            addWarning(
                generationSchedule.month,
                null,
                `${employee.name}: preferência fixa com turno inválido/inativo foi ignorada.`
            );
            continue;
        }

        const mappedConstraintType =
            preference.preference_type === "unavailable_weekday"
                ? "unavailable_shift"
                : preference.preference_type;
        const scopeDates =
            preference.weekday === null
                ? [null]
                : monthDays.filter(
                      (dateValue) => weekdayFromDate(dateValue) === preference.weekday
                  );

        for (const scopedDate of scopeDates) {
            preferenceConstraints.push({
                id: `pref-${preference.id}-${scopedDate ?? "all"}`,
                employee_id: employee.id,
                constraint_type: mappedConstraintType,
                shift_type_id: preference.shift_type_id,
                specific_date: scopedDate,
                start_date: null,
                end_date: null,
                notes: preference.notes,
                source_text: "Preferência fixa",
            });
        }
    }

    const orderedConstraints = [...preferenceConstraints, ...constraints];

    for (const constraint of orderedConstraints) {
        const current = constraintsByEmployee.get(constraint.employee_id) ?? [];
        current.push(constraint);
        constraintsByEmployee.set(constraint.employee_id, current);
    }

    for (const constraint of orderedConstraints) {
        const employee = employeeById.get(constraint.employee_id);

        if (!employee) {
            continue;
        }

        if (constraint.constraint_type === "vacation") {
            const scopedDates = scopedConstraintDates(constraint, monthDays);

            if (scopedDates.length === 0) {
                addWarning(
                    generationSchedule.month,
                    vacationShift?.id ?? null,
                    `${employee.name}: férias sem datas definidas não foram aplicadas.`
                );
                continue;
            }

            if (!vacationShift) {
                addWarning(
                    scopedDates[0] ?? generationSchedule.month,
                    null,
                    `${employee.name}: não consegui marcar férias porque o turno Fe não existe.`
                );
                continue;
            }

            for (const dateValue of scopedDates) {
                addEntry(
                    employee.id,
                    dateValue,
                    vacationShift,
                    "Gerado por restrição: férias",
                    false
                );
            }
        }

        if (constraint.constraint_type === "preferred_day_off") {
            if (constraint.source_text === "Preferência fixa") {
                // Fixed day-off preferences are soft constraints and only influence scoring.
                continue;
            }

            const scopedDates = scopedConstraintDates(constraint, monthDays);

            if (scopedDates.length === 0) {
                addWarning(
                    generationSchedule.month,
                    dayOffShift?.id ?? null,
                    `${employee.name}: folga pedida sem data não foi aplicada.`
                );
                continue;
            }

            if (!dayOffShift) {
                addWarning(
                    scopedDates[0] ?? generationSchedule.month,
                    null,
                    `${employee.name}: não consegui marcar folga porque o turno F não existe.`
                );
                continue;
            }

            for (const dateValue of scopedDates) {
                const wasAdded = addEntry(
                    employee.id,
                    dateValue,
                    dayOffShift,
                    "Gerado por restrição: folga pedida",
                    false
                );

                if (!wasAdded) {
                    addWarning(
                        dateValue,
                        dayOffShift.id,
                        `${employee.name}: folga pedida não pôde ser aplicada porque já tinha outra marcação.`
                    );
                }
            }
        }
    }

    for (const constraint of orderedConstraints) {
        const employee = employeeById.get(constraint.employee_id);

        if (
            !employee ||
            !constraint.shift_type_id ||
            (constraint.constraint_type !== "preferred_shift" &&
                constraint.constraint_type !== "only_shift")
        ) {
            continue;
        }

        const constrainedShift = shiftTypesById.get(constraint.shift_type_id);
        const scopedDates = scopedConstraintDates(constraint, monthDays);

        if (
            !constrainedShift ||
            constrainedShift.code === "M" ||
            constrainedShift.code === "T" ||
            scopedDates.length === 0
        ) {
            continue;
        }

        for (const dateValue of scopedDates) {
            const wasAdded = addEntry(
                employee.id,
                dateValue,
                constrainedShift,
                `Gerado por restrição: ${shiftLabel(constrainedShift)}`,
                false
            );

            if (!wasAdded) {
                addWarning(
                    dateValue,
                    constrainedShift.id,
                    `${employee.name}: não consegui aplicar ${shiftLabel(
                        constrainedShift
                    )} porque já tinha outra marcação.`
                );
            }
        }
    }

    for (const dateValue of monthDays) {
        for (const requiredShift of [morningShift, afternoonShift]) {
            const hardCandidates = employees.filter((employee) => {
                const assignedEmployees = assignedEmployeesByDate.get(dateValue);

                if (assignedEmployees?.has(employee.id)) {
                    return false;
                }

                const maxShiftsPerWeek = maxShiftsPerWeekByEmployee.get(employee.id);
                if (maxShiftsPerWeek) {
                    const weekKey = `${employee.id}:${weekStartKeyFromDate(dateValue)}`;
                    const currentWeekCount = weeklyWorkShiftCounts.get(weekKey) ?? 0;

                    if (currentWeekCount >= maxShiftsPerWeek) {
                        return false;
                    }
                }

                return !isHardBlockedForShift(
                    constraintsByEmployee.get(employee.id) ?? [],
                    dateValue,
                    requiredShift.id
                );
            });
            const nonAvoidedCandidates = hardCandidates.filter(
                (employee) =>
                    !hasSoftAvoidanceForShift(
                        constraintsByEmployee.get(employee.id) ?? [],
                        dateValue,
                        requiredShift.id
                    )
            );
            const usableCandidates =
                nonAvoidedCandidates.length > 0
                    ? nonAvoidedCandidates
                    : hardCandidates;

            if (usableCandidates.length === 0) {
                addWarning(
                    dateValue,
                    requiredShift.id,
                    `Não consegui cobrir ${requiredShift.code} (${requiredShift.name}).`
                );
                continue;
            }

            const sortedCandidates = [...usableCandidates].sort((first, second) => {
                const firstPreferred = hasPreferredShift(
                    constraintsByEmployee.get(first.id) ?? [],
                    dateValue,
                    requiredShift.id
                );
                const secondPreferred = hasPreferredShift(
                    constraintsByEmployee.get(second.id) ?? [],
                    dateValue,
                    requiredShift.id
                );
                const firstCount = workShiftCounts.get(first.id) ?? 0;
                const secondCount = workShiftCounts.get(second.id) ?? 0;
                const firstWeekendCount = weekendShiftCounts.get(first.id) ?? 0;
                const secondWeekendCount = weekendShiftCounts.get(second.id) ?? 0;
                const firstHolidayCount = holidayShiftCounts.get(first.id) ?? 0;
                const secondHolidayCount = holidayShiftCounts.get(second.id) ?? 0;
                const firstConsecutive = consecutiveDaysBefore(first.id, dateValue);
                const secondConsecutive = consecutiveDaysBefore(second.id, dateValue);
                const firstLastShift = lastAssignedShiftCodeByEmployee.get(first.id);
                const secondLastShift = lastAssignedShiftCodeByEmployee.get(second.id);
                const firstLastDate = lastAssignedDateByEmployee.get(first.id);
                const secondLastDate = lastAssignedDateByEmployee.get(second.id);
                const firstAlternates =
                    firstLastDate === previousDateValue(dateValue) &&
                    firstLastShift &&
                    firstLastShift !== requiredShift.code;
                const secondAlternates =
                    secondLastDate === previousDateValue(dateValue) &&
                    secondLastShift &&
                    secondLastShift !== requiredShift.code;

                // Weighted score: lower is better.
                const firstScore =
                    firstCount * 100 +
                    firstWeekendCount * 30 +
                    firstHolidayCount * 35 +
                    firstConsecutive * 40 +
                    (firstAlternates ? 12 : 0) +
                    (firstPreferred ? -20 : 0);
                const secondScore =
                    secondCount * 100 +
                    secondWeekendCount * 30 +
                    secondHolidayCount * 35 +
                    secondConsecutive * 40 +
                    (secondAlternates ? 12 : 0) +
                    (secondPreferred ? -20 : 0);

                if (firstScore !== secondScore) {
                    return firstScore - secondScore;
                }

                if (firstCount !== secondCount) {
                    return firstCount - secondCount;
                }

                if (firstPreferred !== secondPreferred) {
                    return firstPreferred ? -1 : 1;
                }

                return first.name.localeCompare(second.name, "pt-PT", {
                    sensitivity: "base",
                });
            });
            const chosenEmployee = sortedCandidates[0];

            if (!chosenEmployee) {
                addWarning(
                    dateValue,
                    requiredShift.id,
                    `Não consegui escolher funcionário para ${requiredShift.code} (${requiredShift.name}).`
                );
                continue;
            }

            const chosenConstraints =
                constraintsByEmployee.get(chosenEmployee.id) ?? [];
            const usedSoftAvoidance = hasSoftAvoidanceForShift(
                chosenConstraints,
                dateValue,
                requiredShift.id
            );

            addEntry(
                chosenEmployee.id,
                dateValue,
                requiredShift,
                "Gerado automaticamente",
                true
            );

            if (usedSoftAvoidance) {
                addWarning(
                    dateValue,
                    requiredShift.id,
                    `${chosenEmployee.name}: usei ${shiftLabel(
                        requiredShift
                    )} apesar de existir preferência/restrição para evitar.`,
                    chosenEmployee.id
                );
            }
        }
    }

    for (const employee of employees) {
        const assignedDates = assignedDatesByEmployee.get(employee.id) ?? new Set<string>();
        let longestStreak = 0;
        let currentStreak = 0;
        let streakEndDate: string | null = null;

        for (const dateValue of monthDays) {
            if (assignedDates.has(dateValue)) {
                currentStreak += 1;
                if (currentStreak > longestStreak) {
                    longestStreak = currentStreak;
                    streakEndDate = dateValue;
                }
            } else {
                currentStreak = 0;
            }
        }

        if (longestStreak >= 6) {
            addWarning(
                streakEndDate ?? generationSchedule.month,
                null,
                `${employee.name}: sequência longa de ${longestStreak} dias de trabalho.`,
                employee.id
            );
        }
    }

    const shiftTotals = employees.map((employee) => workShiftCounts.get(employee.id) ?? 0);
    const holidayTotals = employees.map(
        (employee) => holidayShiftCounts.get(employee.id) ?? 0
    );
    const weekendTotals = employees.map(
        (employee) => weekendShiftCounts.get(employee.id) ?? 0
    );
    const maxShifts = Math.max(...shiftTotals, 0);
    const minShifts = Math.min(...shiftTotals, 0);
    const maxHolidayShifts = Math.max(...holidayTotals, 0);
    const minHolidayShifts = Math.min(...holidayTotals, 0);
    const maxWeekendShifts = Math.max(...weekendTotals, 0);
    const minWeekendShifts = Math.min(...weekendTotals, 0);

    if (maxShifts - minShifts >= 6) {
        addWarning(
            generationSchedule.month,
            null,
            "Distribuição de turnos desequilibrada entre funcionários."
        );
    }

    if (maxWeekendShifts - minWeekendShifts >= 3) {
        addWarning(
            generationSchedule.month,
            null,
            "Distribuição de fins de semana está desequilibrada."
        );
    }

    if (maxHolidayShifts - minHolidayShifts >= 2) {
        addWarning(
            generationSchedule.month,
            null,
            "Distribuição de feriados/turnos especiais está desequilibrada."
        );
    }

    for (const entry of entries) {
        const shift = shiftTypesById.get(entry.shift_type_id);

        if (shift && nonWorkShiftCodes.has(shift.code)) {
            continue;
        }

        const employeeConstraints = constraintsByEmployee.get(entry.employee_id) ?? [];

        if (
            isHardBlockedForShift(
                employeeConstraints,
                entry.work_date,
                entry.shift_type_id
            )
        ) {
            const employee = employeeById.get(entry.employee_id);
            addWarning(
                entry.work_date,
                entry.shift_type_id,
                `${employee?.name ?? "Funcionário"}: restrição hard violada ao atribuir ${shiftLabel(
                    shift
                )}.`,
                entry.employee_id
            );
        }
    }

    for (const constraint of orderedConstraints) {
        if (
            constraint.constraint_type !== "preferred_shift" ||
            !constraint.shift_type_id
        ) {
            continue;
        }

        const employee = employeeById.get(constraint.employee_id);
        const preferredShift = shiftTypesById.get(constraint.shift_type_id);

        if (!employee || !preferredShift) {
            continue;
        }

        const scopedDates = constraintHasDateScope(constraint)
            ? scopedConstraintDates(constraint, monthDays)
            : monthDays;
        const wasFulfilled = scopedDates.some((dateValue) => {
            const entry = entriesByCell.get(buildEntryKey(employee.id, dateValue));

            return entry?.shift_type_id === preferredShift.id;
        });

        if (!wasFulfilled) {
            addWarning(
                scopedDates[0] ?? generationSchedule.month,
                preferredShift.id,
                `${employee.name}: preferência por ${shiftLabel(
                    preferredShift
                )} não pôde ser cumprida.`,
                employee.id
            );
        }
    }

    const { error: deleteEntriesError } = await context.supabase
        .from("schedule_entries")
        .delete()
        .eq("schedule_id", generationSchedule.id);

    if (deleteEntriesError) {
        return {
            status: "error",
            message: `Não consegui limpar o horário atual: ${deleteEntriesError.message}`,
        };
    }

    const { error: deleteWarningsError } = await context.supabase
        .from("schedule_generation_warnings")
        .delete()
        .eq("schedule_id", generationSchedule.id);

    if (deleteWarningsError) {
        return {
            status: "error",
            message: `Não consegui limpar avisos anteriores: ${deleteWarningsError.message}`,
        };
    }

    if (entries.length > 0) {
        const { error: insertEntriesError } = await context.supabase
            .from("schedule_entries")
            .insert(entries);

        if (insertEntriesError) {
            return {
                status: "error",
                message: `Não consegui guardar o rascunho: ${insertEntriesError.message}`,
            };
        }
    }

    if (warnings.length > 0) {
        const { error: insertWarningsError } = await context.supabase
            .from("schedule_generation_warnings")
            .insert(warnings);

        if (insertWarningsError) {
            return {
                status: "error",
                message: `Gerei o rascunho, mas não consegui guardar os avisos: ${insertWarningsError.message}`,
            };
        }
    }

    revalidatePath(`/dashboard/schedules/${generationSchedule.id}`);

    return {
        status: "success",
        message:
            warnings.length > 0
                ? `Rascunho gerado com ${warnings.length} aviso(s).`
                : "Rascunho gerado sem avisos.",
        warningsCount: warnings.length,
    };
}

export async function setScheduleGenerationWarningResolved(
    _previousState: UpdateGenerationWarningState,
    formData: FormData
): Promise<UpdateGenerationWarningState> {
    const warningId = String(formData.get("warning_id") ?? "").trim();
    const scheduleId = String(formData.get("schedule_id") ?? "").trim();
    const resolved = String(formData.get("resolved") ?? "").trim() === "true";

    if (!uuidPattern.test(warningId) || !uuidPattern.test(scheduleId)) {
        return {
            status: "error",
            message: "Aviso inválido.",
        };
    }

    const context = await getAuthenticatedContext();

    if (context.error) {
        return {
            status: "error",
            message: context.error,
        };
    }

    const schedule = await getConstraintScheduleContext(context.supabase, scheduleId);

    if (!schedule) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    const { error } = await context.supabase
        .from("schedule_generation_warnings")
        .update({
            resolved,
            resolved_at: resolved ? new Date().toISOString() : null,
        })
        .eq("id", warningId)
        .eq("schedule_id", scheduleId);

    if (error) {
        return {
            status: "error",
            message: `Não consegui atualizar o aviso: ${error.message}`,
        };
    }

    revalidatePath(`/dashboard/schedules/${scheduleId}`);

    return {
        status: "success",
        message: resolved ? "Aviso marcado como resolvido." : "Aviso reativado.",
    };
}
