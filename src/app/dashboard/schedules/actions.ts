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
import { buildStaticPortugueseHolidays } from "@/lib/holidays/static-portuguese-holidays";
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
    };
};

export type DeleteScheduleState = {
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

export type ClearScheduleGridState = {
    status: "idle" | "success" | "error";
    message?: string;
    clearedCount?: number;
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

export type ReorderScheduleEmployeesInput = {
    scheduleId: string;
    employeeIds: string[];
};

const monthPattern = /^\d{4}-\d{2}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

function normalizeLocationNameForMatch(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
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

async function resolveDefaultScheduleLocationId(
    supabase: Awaited<ReturnType<typeof createClient>>,
    organizationId: string
) {
    const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name");

    if (error || !data || data.length === 0) {
        return null;
    }

    const defaultLocation = data.find((location) => {
        const normalizedName = normalizeLocationNameForMatch(String(location.name ?? ""));
        return normalizedName.includes("sao francisco");
    });

    return defaultLocation ? String(defaultLocation.id) : null;
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

function extractWeeklyShiftTarget(notes: string | null) {
    if (!notes) {
        return null;
    }

    const normalizedNotes = notes.toLocaleLowerCase("pt-PT");

    if (
        !normalizedNotes.includes("objetivo") ||
        !normalizedNotes.includes("turno") ||
        !normalizedNotes.includes("semana")
    ) {
        return null;
    }

    const match = normalizedNotes.match(/\b(\d+)\b/);

    if (!match) {
        return null;
    }

    const value = Number(match[1]);

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

function hasFixedPreferredShift(
    constraints: GenerationConstraint[],
    dateValue: string,
    shiftTypeId: string
) {
    return constraints.some(
        (constraint) =>
            constraint.constraint_type === "preferred_shift" &&
            constraint.source_text === "Preferência fixa" &&
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
    let locationId = locationInput || null;
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

    const organizationId = context.organizationId;
    if (!organizationId) {
        return {
            status: "error",
            message: "Não consegui identificar a organização ativa.",
        };
    }

    if (!locationId) {
        locationId = await resolveDefaultScheduleLocationId(
            context.supabase,
            organizationId
        );
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
            organization_id: organizationId,
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
    const month = normalizeMonth(monthInput);
    const locationId = locationInput || null;
    const fieldErrors: ScheduleFormState["fieldErrors"] = {};

    if (!uuidPattern.test(id)) {
        fieldErrors.id = "Horário inválido.";
    }

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

    const { error } = await context.supabase
        .from("monthly_schedules")
        .update({
            location_id: locationId,
            month,
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

    const schedule = await getConstraintScheduleContext(context.supabase, id);

    if (!schedule) {
        return {
            status: "error",
            message: "Horário inválido.",
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

    const { error: deleteConstraintsError } = await context.supabase
        .from("employee_schedule_constraints")
        .delete()
        .eq("organization_id", schedule.organization_id)
        .eq("month", schedule.month);

    revalidatePath("/dashboard/schedules");
    revalidatePath(`/dashboard/schedules/${id}`);
    revalidatePath("/dashboard/employees");

    if (deleteConstraintsError) {
        return {
            status: "success",
            message:
                "Horário mensal apagado, mas não consegui limpar os pedidos/restrições desse mês.",
        };
    }

    return {
        status: "success",
        message: "Horário mensal apagado com pedidos/restrições desse mês.",
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

export async function clearScheduleGrid(
    _previousState: ClearScheduleGridState,
    formData: FormData
): Promise<ClearScheduleGridState> {
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

    const { count, error } = await context.supabase
        .from("schedule_entries")
        .delete({ count: "exact" })
        .eq("schedule_id", schedule.id);

    if (error) {
        return {
            status: "error",
            message: `Não consegui limpar a grelha: ${error.message}`,
        };
    }

    revalidatePath(`/dashboard/schedules/${schedule.id}`);
    revalidatePath(`/dashboard/schedules/${schedule.id}/print`);

    const clearedCount = count ?? 0;

    return {
        status: "success",
        message:
            clearedCount === 0
                ? "A grelha já estava vazia."
                : `Grelha limpa com ${clearedCount} ${
                      clearedCount === 1 ? "célula apagada" : "células apagadas"
                  }.`,
        clearedCount,
    };
}

export async function reorderScheduleEmployees(
    input: ReorderScheduleEmployeesInput
): Promise<ScheduleEntryActionState> {
    const scheduleId = String(input.scheduleId ?? "").trim();
    const employeeIds = Array.isArray(input.employeeIds)
        ? input.employeeIds.map((employeeId) => String(employeeId ?? "").trim())
        : [];

    if (!uuidPattern.test(scheduleId)) {
        return {
            status: "error",
            message: "Horário inválido.",
        };
    }

    if (
        employeeIds.length === 0 ||
        employeeIds.some((employeeId) => !uuidPattern.test(employeeId))
    ) {
        return {
            status: "error",
            message: "Ordem de funcionários inválida.",
        };
    }

    const uniqueEmployeeIds = [...new Set(employeeIds)];

    if (uniqueEmployeeIds.length !== employeeIds.length) {
        return {
            status: "error",
            message: "A ordem contém funcionários repetidos.",
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

    const { data: employeeRows, error: employeesError } = await context.supabase
        .from("employees")
        .select("id")
        .eq("organization_id", schedule.organization_id)
        .eq("active", true)
        .in("id", uniqueEmployeeIds);

    if (employeesError) {
        return {
            status: "error",
            message: `Não consegui validar funcionários: ${employeesError.message}`,
        };
    }

    const validEmployeeIds = new Set(
        (employeeRows ?? []).map((employee) => String(employee.id))
    );

    if (
        uniqueEmployeeIds.some((employeeId) => !validEmployeeIds.has(employeeId))
    ) {
        return {
            status: "error",
            message: "A ordem contém funcionários inválidos para este horário.",
        };
    }

    for (const [index, employeeId] of uniqueEmployeeIds.entries()) {
        const { error } = await context.supabase
            .from("employees")
            .update({
                display_order: index + 1,
            })
            .eq("id", employeeId)
            .eq("organization_id", schedule.organization_id);

        if (error) {
            return {
                status: "error",
                message: `Não consegui guardar ordem dos funcionários: ${error.message}`,
            };
        }
    }

    revalidatePath("/dashboard/employees");
    revalidatePath(`/dashboard/schedules/${schedule.id}`);
    revalidatePath(`/dashboard/schedules/${schedule.id}/print`);

    return {
        status: "success",
        message: "Ordem atualizada.",
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
            message: `Não consegui carregar dados para gerar o horário: ${loadError.message}`,
        };
    }

    const employees = (employeesData ?? []) as GenerationEmployee[];
    const shiftTypes = (shiftTypesData ?? []) as GenerationShiftType[];
    const constraints = (constraintsData ?? []) as GenerationConstraint[];
    const workPreferences =
        (workPreferencesData ?? []) as GenerationWorkPreference[];
    const holidaysFromDb = (holidaysData ?? []) as Array<{
        holiday_date: string;
        name: string;
        country_code: string;
        region: string | null;
    }>;
    const fallbackHolidays = buildStaticPortugueseHolidays(
        Number(generationSchedule.month.slice(0, 4))
    ).filter(
        (holiday) =>
            holiday.holiday_date >= generationMonthStart &&
            holiday.holiday_date <= generationMonthEnd
    );
    const holidays = [
        ...holidaysFromDb,
        ...fallbackHolidays.filter(
            (fallbackHoliday) =>
                !holidaysFromDb.some(
                    (dbHoliday) =>
                        dbHoliday.holiday_date === fallbackHoliday.holiday_date &&
                        (dbHoliday.region ?? null) === (fallbackHoliday.region ?? null)
                )
        ),
    ];

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
    const extendedDayShift = shiftTypesByCode.get("E");
    const managementSupportShift = shiftTypesByCode.get("E*");
    const medicationSupportShift = shiftTypesByCode.get("M*");
    const weekendCombinedShift = shiftTypesByCode.get("MT");
    const dayOffShift = shiftTypesByCode.get("F");
    const vacationShift = shiftTypesByCode.get("Fe");

    if (!morningShift || !afternoonShift) {
        return {
            status: "error",
            message: "Faltam os turnos M e/ou T nos tipos de turno ativos.",
        };
    }

    if (!extendedDayShift) {
        return {
            status: "error",
            message: "Falta o turno E nos tipos de turno ativos.",
        };
    }

    if (!dayOffShift) {
        return {
            status: "error",
            message: "Falta o turno F (folga) nos tipos de turno ativos.",
        };
    }

    if (!weekendCombinedShift) {
        return {
            status: "error",
            message:
                "Falta o turno MT (Manhã + Tarde) para gerar automaticamente os fins de semana.",
        };
    }
    const morningShiftSafe = morningShift;
    const afternoonShiftSafe = afternoonShift;
    const extendedDayShiftSafe = extendedDayShift;
    const weekendCombinedShiftSafe = weekendCombinedShift;

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
        const date = new Date(`${dateValue}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() - 1);
        return date.toISOString().slice(0, 10);
    }

    const susanaEmployee = employees.find((employee) => {
        const normalizedName = employee.name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("pt-PT");
        return normalizedName.includes("susana");
    });

    function nextDateValue(dateValue: string) {
        const date = new Date(`${dateValue}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() + 1);
        return date.toISOString().slice(0, 10);
    }

    function isMedicationPreferredDate(dateValue: string) {
        if (weekendDates.has(dateValue) || holidayDates.has(dateValue)) {
            return false;
        }

        const weekday = new Date(`${dateValue}T00:00:00`).getDay();
        return weekday === 5 || weekday === 1 || weekday === 3;
    }

    function medicationDatePriority(dateValue: string) {
        const weekday = new Date(`${dateValue}T00:00:00`).getDay();
        if (weekday === 5) {
            return 1;
        }
        if (weekday === 1) {
            return 2;
        }
        if (weekday === 3) {
            return 3;
        }

        return 9;
    }

    function orderMedicationDates(dateValues: string[]) {
        return [...dateValues].sort((first, second) => {
            const firstPriority = medicationDatePriority(first);
            const secondPriority = medicationDatePriority(second);

            if (firstPriority !== secondPriority) {
                return firstPriority - secondPriority;
            }

            return first.localeCompare(second);
        });
    }

    function hasAdjacentMedicationShift(dateValue: string) {
        if (!medicationSupportShift) {
            return false;
        }

        const previousDate = previousDateValue(dateValue);
        const nextDate = nextDateValue(dateValue);

        return entries.some(
            (entry) =>
                entry.shift_type_id === medicationSupportShift.id &&
                (entry.work_date === previousDate || entry.work_date === nextDate)
        );
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

    function shiftWorkUnits(shiftType: GenerationShiftType) {
        return shiftType.code === "MT" ? 2 : 1;
    }

    function previousWeekStartKeyFromDate(dateValue: string) {
        const currentWeekStart = weekStartKeyFromDate(dateValue);
        const date = new Date(`${currentWeekStart}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() - 7);
        return date.toISOString().slice(0, 10);
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
            const shiftUnits = shiftWorkUnits(shiftType);
            workShiftCounts.set(
                employeeId,
                (workShiftCounts.get(employeeId) ?? 0) + shiftUnits
            );
            const weekKey = `${employeeId}:${weekStartKeyFromDate(workDate)}`;
            weeklyWorkShiftCounts.set(
                weekKey,
                (weeklyWorkShiftCounts.get(weekKey) ?? 0) + shiftUnits
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
            const isLongVacation = scopedDates.length >= 7;

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
                const shouldUseWeeklyDayOff =
                    holidayDates.has(dateValue) ||
                    (isLongVacation && weekendDates.has(dateValue));
                const shiftForVacationDate = shouldUseWeeklyDayOff
                    ? dayOffShift
                    : vacationShift;
                const wasAdded = addEntry(
                    employee.id,
                    dateValue,
                    shiftForVacationDate,
                    shouldUseWeeklyDayOff
                        ? "Folga semanal dentro de férias longas"
                        : "Gerado por restrição: férias",
                    false
                );

                if (!wasAdded) {
                    // Keep generation noise low: vacation/day-off overlaps are expected
                    // in some schedules and should not create warnings.
                    continue;
                }
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
                    if (holidayDates.has(dateValue) || weekendDates.has(dateValue)) {
                        continue;
                    }

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
            constraint.constraint_type !== "only_shift"
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
            if (holidayDates.has(dateValue)) {
                continue;
            }

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

    function chooseBestCandidate(
        candidates: GenerationEmployee[],
        requiredShift: GenerationShiftType,
        dateValue: string,
        options?: {
            avoidEmployeeId?: string;
            prioritizeWeekendBalance?: boolean;
            prioritizeHolidayBalance?: boolean;
        }
    ) {
        const avoidEmployeeId = options?.avoidEmployeeId;
        const prioritizeWeekendBalance = options?.prioritizeWeekendBalance ?? false;
        const prioritizeHolidayBalance = options?.prioritizeHolidayBalance ?? false;
        const requiredShiftIds =
            requiredShift.id === weekendCombinedShiftSafe.id
                ? [
                      weekendCombinedShiftSafe.id,
                      morningShiftSafe.id,
                      afternoonShiftSafe.id,
                  ]
                : [requiredShift.id];

        const sortedCandidates = [...candidates].sort((first, second) => {
            const firstConstraints = constraintsByEmployee.get(first.id) ?? [];
            const secondConstraints = constraintsByEmployee.get(second.id) ?? [];
            const oppositePreferredShiftId =
                requiredShift.id === morningShiftSafe.id
                    ? afternoonShiftSafe.id
                    : requiredShift.id === afternoonShiftSafe.id
                      ? morningShiftSafe.id
                      : null;
            const firstPreferred = requiredShiftIds.some((shiftId) =>
                hasPreferredShift(firstConstraints, dateValue, shiftId)
            );
            const secondPreferred = requiredShiftIds.some((shiftId) =>
                hasPreferredShift(secondConstraints, dateValue, shiftId)
            );
            const firstFixedPreferred = requiredShiftIds.some((shiftId) =>
                hasFixedPreferredShift(firstConstraints, dateValue, shiftId)
            );
            const secondFixedPreferred = requiredShiftIds.some((shiftId) =>
                hasFixedPreferredShift(secondConstraints, dateValue, shiftId)
            );
            const firstOppositePreferred = oppositePreferredShiftId
                ? hasPreferredShift(
                      firstConstraints,
                      dateValue,
                      oppositePreferredShiftId
                  )
                : false;
            const secondOppositePreferred = oppositePreferredShiftId
                ? hasPreferredShift(
                      secondConstraints,
                      dateValue,
                      oppositePreferredShiftId
                  )
                : false;
            const firstCount = workShiftCounts.get(first.id) ?? 0;
            const secondCount = workShiftCounts.get(second.id) ?? 0;
            const firstCurrentWeekKey = `${first.id}:${weekStartKeyFromDate(dateValue)}`;
            const secondCurrentWeekKey = `${second.id}:${weekStartKeyFromDate(dateValue)}`;
            const firstCurrentWeekCount =
                weeklyWorkShiftCounts.get(firstCurrentWeekKey) ?? 0;
            const secondCurrentWeekCount =
                weeklyWorkShiftCounts.get(secondCurrentWeekKey) ?? 0;
            const firstPreviousWeekKey = `${first.id}:${previousWeekStartKeyFromDate(dateValue)}`;
            const secondPreviousWeekKey = `${second.id}:${previousWeekStartKeyFromDate(
                dateValue
            )}`;
            const firstPreviousWeekCount =
                weeklyWorkShiftCounts.get(firstPreviousWeekKey) ?? 5;
            const secondPreviousWeekCount =
                weeklyWorkShiftCounts.get(secondPreviousWeekKey) ?? 5;
            const firstWeeklyTarget =
                firstPreviousWeekCount <= 4
                    ? 6
                    : firstPreviousWeekCount >= 6
                      ? 4
                      : 5;
            const secondWeeklyTarget =
                secondPreviousWeekCount <= 4
                    ? 6
                    : secondPreviousWeekCount >= 6
                      ? 4
                      : 5;
            const shiftUnits = shiftWorkUnits(requiredShift);
            const firstProjectedWeekCount = firstCurrentWeekCount + shiftUnits;
            const secondProjectedWeekCount = secondCurrentWeekCount + shiftUnits;
            const firstWeekBalancePenalty =
                Math.abs(firstProjectedWeekCount - firstWeeklyTarget) * 18;
            const secondWeekBalancePenalty =
                Math.abs(secondProjectedWeekCount - secondWeeklyTarget) * 18;
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
            const firstAvoidPenalty = avoidEmployeeId && first.id === avoidEmployeeId ? 500 : 0;
            const secondAvoidPenalty =
                avoidEmployeeId && second.id === avoidEmployeeId ? 500 : 0;
            const weekendWeight = prioritizeWeekendBalance ? 70 : 30;
            const holidayWeight = prioritizeHolidayBalance ? 80 : 35;

            // Weighted score: lower is better.
            const firstScore =
                firstCount * 100 +
                firstWeekendCount * weekendWeight +
                firstHolidayCount * holidayWeight +
                firstConsecutive * 40 +
                (firstAlternates ? 12 : 0) +
                (firstPreferred ? -120 : 0) +
                (firstFixedPreferred ? -220 : 0) +
                (firstOppositePreferred ? 90 : 0) +
                firstWeekBalancePenalty +
                firstAvoidPenalty;
            const secondScore =
                secondCount * 100 +
                secondWeekendCount * weekendWeight +
                secondHolidayCount * holidayWeight +
                secondConsecutive * 40 +
                (secondAlternates ? 12 : 0) +
                (secondPreferred ? -120 : 0) +
                (secondFixedPreferred ? -220 : 0) +
                (secondOppositePreferred ? 90 : 0) +
                secondWeekBalancePenalty +
                secondAvoidPenalty;

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

        return sortedCandidates[0] ?? null;
    }

    function isHardBlockedForRequiredShift(
        constraints: GenerationConstraint[],
        dateValue: string,
        requiredShift: GenerationShiftType
    ) {
        if (requiredShift.id !== weekendCombinedShiftSafe.id) {
            return isHardBlockedForShift(constraints, dateValue, requiredShift.id);
        }

        return (
            isHardBlockedForShift(constraints, dateValue, weekendCombinedShiftSafe.id) ||
            isHardBlockedForShift(constraints, dateValue, morningShiftSafe.id) ||
            isHardBlockedForShift(constraints, dateValue, afternoonShiftSafe.id)
        );
    }

    function hasSoftAvoidanceForRequiredShift(
        constraints: GenerationConstraint[],
        dateValue: string,
        requiredShift: GenerationShiftType
    ) {
        if (requiredShift.id !== weekendCombinedShiftSafe.id) {
            return hasSoftAvoidanceForShift(constraints, dateValue, requiredShift.id);
        }

        return (
            hasSoftAvoidanceForShift(constraints, dateValue, weekendCombinedShiftSafe.id) ||
            hasSoftAvoidanceForShift(constraints, dateValue, morningShiftSafe.id) ||
            hasSoftAvoidanceForShift(constraints, dateValue, afternoonShiftSafe.id)
        );
    }

    function resolveFallbackShiftForEmptyCell(employeeId: string, dateValue: string) {
        if (holidayDates.has(dateValue)) {
            return dayOffShift;
        }

        const employeeConstraints = constraintsByEmployee.get(employeeId) ?? [];

        const vacationConstraint = employeeConstraints.find(
            (constraint) =>
                constraint.constraint_type === "vacation" &&
                constraintMatchesDate(constraint, dateValue)
        );
        if (vacationConstraint && vacationShift) {
            return vacationShift;
        }

        if (
            dayOffShift &&
            !isHardBlockedForShift(employeeConstraints, dateValue, dayOffShift.id)
        ) {
            return dayOffShift;
        }

        const onlyShiftConstraint = employeeConstraints.find(
            (constraint) =>
                constraint.constraint_type === "only_shift" &&
                constraintMatchesDate(constraint, dateValue) &&
                Boolean(constraint.shift_type_id)
        );

        if (onlyShiftConstraint?.shift_type_id) {
            const constrainedShift = shiftTypesById.get(onlyShiftConstraint.shift_type_id);
            if (
                constrainedShift &&
                !isHardBlockedForShift(employeeConstraints, dateValue, constrainedShift.id)
            ) {
                return constrainedShift;
            }
        }

        const preferredShiftConstraint = employeeConstraints.find(
            (constraint) =>
                constraint.constraint_type === "preferred_shift" &&
                constraintMatchesDate(constraint, dateValue) &&
                Boolean(constraint.shift_type_id)
        );

        if (preferredShiftConstraint?.shift_type_id) {
            const preferredShift = shiftTypesById.get(preferredShiftConstraint.shift_type_id);
            if (
                preferredShift &&
                !isHardBlockedForShift(employeeConstraints, dateValue, preferredShift.id)
            ) {
                return preferredShift;
            }
        }

        const fallbackWorkShifts = [
            afternoonShiftSafe,
            morningShiftSafe,
            extendedDayShiftSafe,
            weekendCombinedShiftSafe,
        ].filter(Boolean) as GenerationShiftType[];

        for (const fallbackShift of fallbackWorkShifts) {
            if (!isHardBlockedForShift(employeeConstraints, dateValue, fallbackShift.id)) {
                return fallbackShift;
            }
        }

        return null;
    }

    function adjustCountersForEntryShiftChange(
        employeeId: string,
        workDate: string,
        previousShift: GenerationShiftType,
        nextShift: GenerationShiftType
    ) {
        const previousIsWork = !nonWorkShiftCodes.has(previousShift.code);
        const nextIsWork = !nonWorkShiftCodes.has(nextShift.code);
        const previousUnits = previousIsWork ? shiftWorkUnits(previousShift) : 0;
        const nextUnits = nextIsWork ? shiftWorkUnits(nextShift) : 0;
        const unitsDelta = nextUnits - previousUnits;

        if (unitsDelta !== 0) {
            workShiftCounts.set(
                employeeId,
                (workShiftCounts.get(employeeId) ?? 0) + unitsDelta
            );
            const weekKey = `${employeeId}:${weekStartKeyFromDate(workDate)}`;
            weeklyWorkShiftCounts.set(
                weekKey,
                (weeklyWorkShiftCounts.get(weekKey) ?? 0) + unitsDelta
            );
        }

        if (previousIsWork !== nextIsWork) {
            const dayDelta = nextIsWork ? 1 : -1;
            if (weekendDates.has(workDate)) {
                weekendShiftCounts.set(
                    employeeId,
                    (weekendShiftCounts.get(employeeId) ?? 0) + dayDelta
                );
            }
            if (holidayDates.has(workDate)) {
                holidayShiftCounts.set(
                    employeeId,
                    (holidayShiftCounts.get(employeeId) ?? 0) + dayDelta
                );
            }

            const assignedDates = assignedDatesByEmployee.get(employeeId) ?? new Set<string>();
            if (nextIsWork) {
                assignedDates.add(workDate);
            } else {
                assignedDates.delete(workDate);
            }
            assignedDatesByEmployee.set(employeeId, assignedDates);
        }
    }

    function swapEntryShiftTypes(
        firstEntry: GenerationEntry,
        secondEntry: GenerationEntry,
        workDate: string
    ) {
        const firstShift = shiftTypesById.get(firstEntry.shift_type_id);
        const secondShift = shiftTypesById.get(secondEntry.shift_type_id);

        if (!firstShift || !secondShift) {
            return false;
        }

        firstEntry.shift_type_id = secondShift.id;
        secondEntry.shift_type_id = firstShift.id;
        firstEntry.notes = "Troca automática para respeitar preferência de turno";
        secondEntry.notes = "Troca automática para respeitar preferência de turno";

        adjustCountersForEntryShiftChange(
            firstEntry.employee_id,
            workDate,
            firstShift,
            secondShift
        );
        adjustCountersForEntryShiftChange(
            secondEntry.employee_id,
            workDate,
            secondShift,
            firstShift
        );

        return true;
    }

    for (const dateValue of monthDays) {
        const isWeekend = weekendDates.has(dateValue);
        const isHoliday = holidayDates.has(dateValue);
        const dayAssignedEmployees = new Set<string>();
        const requiredShifts: GenerationShiftType[] = isHoliday
            ? [afternoonShiftSafe, morningShiftSafe]
            : isWeekend
              ? [weekendCombinedShiftSafe]
              : [afternoonShiftSafe, morningShiftSafe, extendedDayShiftSafe];

        for (const requiredShift of requiredShifts) {
            const hardCandidates = employees.filter((employee) => {
                const assignedEmployees = assignedEmployeesByDate.get(dateValue);

                if (assignedEmployees?.has(employee.id)) {
                    return false;
                }

                const maxShiftsPerWeek = maxShiftsPerWeekByEmployee.get(employee.id);
                if (maxShiftsPerWeek) {
                    const weekKey = `${employee.id}:${weekStartKeyFromDate(dateValue)}`;
                    const currentWeekCount = weeklyWorkShiftCounts.get(weekKey) ?? 0;
                    const shiftUnits = shiftWorkUnits(requiredShift);

                    if (currentWeekCount + shiftUnits > maxShiftsPerWeek) {
                        return false;
                    }
                }

                return !isHardBlockedForRequiredShift(
                    constraintsByEmployee.get(employee.id) ?? [],
                    dateValue,
                    requiredShift
                );
            });
            const nonAvoidedCandidates = hardCandidates.filter(
                (employee) =>
                    !hasSoftAvoidanceForRequiredShift(
                        constraintsByEmployee.get(employee.id) ?? [],
                        dateValue,
                        requiredShift
                    )
            );
            const usableCandidates =
                nonAvoidedCandidates.length > 0
                    ? nonAvoidedCandidates
                    : hardCandidates;
            const fixedPreferredCandidates = usableCandidates.filter((employee) =>
                hasFixedPreferredShift(
                    constraintsByEmployee.get(employee.id) ?? [],
                    dateValue,
                    requiredShift.id
                )
            );
            const prioritizedCandidates =
                fixedPreferredCandidates.length > 0
                    ? fixedPreferredCandidates
                    : usableCandidates;

            const avoidEmployeeId =
                isHoliday && requiredShift.code === "T"
                    ? Array.from(dayAssignedEmployees)[0] ?? undefined
                    : undefined;

            if (prioritizedCandidates.length === 0) {
                if (!isWeekend && !isHoliday) {
                    addWarning(
                        dateValue,
                        requiredShift.id,
                        `Não consegui cobrir ${requiredShift.code} (${requiredShift.name}).`
                    );
                }
                continue;
            }

            const chosenEmployee = chooseBestCandidate(
                prioritizedCandidates,
                requiredShift,
                dateValue,
                {
                    avoidEmployeeId,
                    prioritizeWeekendBalance: isWeekend || isHoliday,
                    prioritizeHolidayBalance: isHoliday,
                }
            );

            if (!chosenEmployee) {
                if (!isWeekend && !isHoliday) {
                    addWarning(
                        dateValue,
                        requiredShift.id,
                        `Não consegui escolher funcionário para ${requiredShift.code} (${requiredShift.name}).`
                    );
                }
                continue;
            }

            const chosenConstraints =
                constraintsByEmployee.get(chosenEmployee.id) ?? [];
            const usedSoftAvoidance = hasSoftAvoidanceForRequiredShift(
                chosenConstraints,
                dateValue,
                requiredShift
            );

            addEntry(
                chosenEmployee.id,
                dateValue,
                requiredShift,
                "Gerado automaticamente",
                true
            );
            dayAssignedEmployees.add(chosenEmployee.id);

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

        if ((isWeekend || isHoliday) && dayOffShift) {
            for (const employee of employees) {
                const assignedEmployees = assignedEmployeesByDate.get(dateValue);

                if (assignedEmployees?.has(employee.id)) {
                    continue;
                }

                const employeeConstraints = constraintsByEmployee.get(employee.id) ?? [];
                if (
                    !isHoliday &&
                    isHardBlockedForShift(employeeConstraints, dateValue, dayOffShift.id)
                ) {
                    // Do not warn for automatic weekend/festive balancing conflicts:
                    // this scenario is expected and creates noisy warnings.
                    continue;
                }

                addEntry(
                    employee.id,
                    dateValue,
                    dayOffShift,
                    isHoliday
                        ? "Folga automática em feriado"
                        : "Folga automática de fim de semana",
                    false
                );
            }
        }
    }

    function canAssignShiftToEmployee(
        employeeId: string,
        dateValue: string,
        shiftType: GenerationShiftType
    ) {
        const assignedEmployees = assignedEmployeesByDate.get(dateValue);
        if (assignedEmployees?.has(employeeId)) {
            return false;
        }

        const employeeConstraints = constraintsByEmployee.get(employeeId) ?? [];
        if (isHardBlockedForShift(employeeConstraints, dateValue, shiftType.id)) {
            return false;
        }

        const maxShiftsPerWeek = maxShiftsPerWeekByEmployee.get(employeeId);
        if (maxShiftsPerWeek) {
            const weekKey = `${employeeId}:${weekStartKeyFromDate(dateValue)}`;
            const currentWeekCount = weeklyWorkShiftCounts.get(weekKey) ?? 0;

            if (currentWeekCount + shiftWorkUnits(shiftType) > maxShiftsPerWeek) {
                return false;
            }
        }

        return true;
    }

    function tryAssignMedicationShiftOnDate(dateValue: string) {
        if (!medicationSupportShift) {
            return false;
        }

        const hasMedicationOnDate = entries.some(
            (entry) =>
                entry.shift_type_id === medicationSupportShift.id &&
                entry.work_date === dateValue
        );

        if (hasMedicationOnDate) {
            return false;
        }

        const hardCandidates = employees.filter((employee) =>
            canAssignShiftToEmployee(employee.id, dateValue, medicationSupportShift)
        );

        if (hardCandidates.length > 0) {
            const chosenEmployee = chooseBestCandidate(
                hardCandidates,
                medicationSupportShift,
                dateValue
            );

            if (!chosenEmployee) {
                return false;
            }

            addEntry(
                chosenEmployee.id,
                dateValue,
                medicationSupportShift,
                "Gerado automaticamente: apoio medicação semanal",
                true
            );

            return true;
        }

        for (const entry of entries) {
            if (entry.work_date !== dateValue) {
                continue;
            }

            const currentShift = shiftTypesById.get(entry.shift_type_id);

            if (
                !currentShift ||
                currentShift.id === medicationSupportShift.id ||
                nonWorkShiftCodes.has(currentShift.code) ||
                currentShift.code === "E*" ||
                currentShift.code === "MT"
            ) {
                continue;
            }

            const currentEmployeeConstraints =
                constraintsByEmployee.get(entry.employee_id) ?? [];
            if (
                isHardBlockedForShift(
                    currentEmployeeConstraints,
                    dateValue,
                    medicationSupportShift.id
                )
            ) {
                continue;
            }

            const replacementEmployee = employees.find((candidate) => {
                if (candidate.id === entry.employee_id) {
                    return false;
                }

                const assignedEmployees = assignedEmployeesByDate.get(dateValue);
                if (assignedEmployees?.has(candidate.id)) {
                    return false;
                }

                return canAssignShiftToEmployee(candidate.id, dateValue, currentShift);
            });

            if (!replacementEmployee) {
                continue;
            }

            const handoffAdded = addEntry(
                replacementEmployee.id,
                dateValue,
                currentShift,
                "Reequilibrado para cumprir regra semanal de M*",
                true
            );

            if (!handoffAdded) {
                continue;
            }

            entry.shift_type_id = medicationSupportShift.id;
            entry.notes = "Gerado automaticamente: apoio medicação semanal";
            adjustCountersForEntryShiftChange(
                entry.employee_id,
                dateValue,
                currentShift,
                medicationSupportShift
            );

            return true;
        }

        return false;
    }

    const uniqueWeekStartKeys = [...new Set(monthDays.map(weekStartKeyFromDate))];

    const weeklyMedicationTargets = new Map<string, number>();
    if (medicationSupportShift) {
        for (const constraint of orderedConstraints) {
            if (
                constraint.constraint_type !== "preferred_shift" ||
                constraint.shift_type_id !== medicationSupportShift.id
            ) {
                continue;
            }

            const weeklyTarget = extractWeeklyShiftTarget(constraint.notes);
            if (!weeklyTarget) {
                continue;
            }

            const scopedWeekdays = scopedConstraintDates(constraint, monthDays).filter(
                (dateValue) => !weekendDates.has(dateValue) && !holidayDates.has(dateValue)
            );
            const scopedWeekKeys = [...new Set(scopedWeekdays.map(weekStartKeyFromDate))];
            const cappedTarget = Math.min(weeklyTarget, 3);

            for (const weekStartKey of scopedWeekKeys) {
                const targetKey = `${constraint.employee_id}:${weekStartKey}`;
                const currentTarget = weeklyMedicationTargets.get(targetKey) ?? 0;
                weeklyMedicationTargets.set(targetKey, Math.max(currentTarget, cappedTarget));
            }
        }
    }

    if (medicationSupportShift && weeklyMedicationTargets.size > 0) {
        for (const [targetKey, targetCount] of weeklyMedicationTargets.entries()) {
            const separatorIndex = targetKey.lastIndexOf(":");
            if (separatorIndex < 0) {
                continue;
            }

            const employeeId = targetKey.slice(0, separatorIndex);
            const weekStartKey = targetKey.slice(separatorIndex + 1);
            const employee = employeeById.get(employeeId);

            if (!employee) {
                continue;
            }

            const weekDates = monthDays.filter(
                (dateValue) =>
                    weekStartKeyFromDate(dateValue) === weekStartKey &&
                    isMedicationPreferredDate(dateValue)
            );
            let currentWeekTargetEntries = entries.filter(
                (entry) =>
                    entry.employee_id === employeeId &&
                    entry.shift_type_id === medicationSupportShift.id &&
                    weekStartKeyFromDate(entry.work_date) === weekStartKey
            ).length;

            while (currentWeekTargetEntries < targetCount) {
                let assigned = false;

                const orderedWeekDates = orderMedicationDates(weekDates);
                const nonAdjacentDates = orderedWeekDates.filter(
                    (dateValue) => !hasAdjacentMedicationShift(dateValue)
                );
                const datesToTry =
                    nonAdjacentDates.length > 0 ? nonAdjacentDates : orderedWeekDates;

                for (const dateValue of datesToTry) {
                    const existingEntry = entriesByCell.get(buildEntryKey(employeeId, dateValue));

                    if (existingEntry?.shift_type_id === medicationSupportShift.id) {
                        continue;
                    }

                    if (!existingEntry) {
                        if (
                            !canAssignShiftToEmployee(
                                employeeId,
                                dateValue,
                                medicationSupportShift
                            )
                        ) {
                            continue;
                        }

                        addEntry(
                            employeeId,
                            dateValue,
                            medicationSupportShift,
                            "Gerado automaticamente: objetivo semanal de M*",
                            true
                        );
                        currentWeekTargetEntries += 1;
                        assigned = true;
                        break;
                    }

                    const existingShift = shiftTypesById.get(existingEntry.shift_type_id);
                    const employeeConstraints = constraintsByEmployee.get(employeeId) ?? [];

                    if (
                        !existingShift ||
                        nonWorkShiftCodes.has(existingShift.code) ||
                        existingShift.code === "E*" ||
                        existingShift.code === "MT" ||
                        isHardBlockedForShift(
                            employeeConstraints,
                            dateValue,
                            medicationSupportShift.id
                        )
                    ) {
                        continue;
                    }

                    const replacementEmployee = employees.find((candidate) => {
                        if (candidate.id === employeeId) {
                            return false;
                        }

                        const assignedEmployees = assignedEmployeesByDate.get(dateValue);
                        if (assignedEmployees?.has(candidate.id)) {
                            return false;
                        }

                        return canAssignShiftToEmployee(candidate.id, dateValue, existingShift);
                    });

                    if (!replacementEmployee) {
                        continue;
                    }

                    const handoffAdded = addEntry(
                        replacementEmployee.id,
                        dateValue,
                        existingShift,
                        "Reequilibrado para cumprir objetivo semanal de M*",
                        true
                    );

                    if (!handoffAdded) {
                        continue;
                    }

                    existingEntry.shift_type_id = medicationSupportShift.id;
                    existingEntry.notes = "Gerado automaticamente: objetivo semanal de M*";
                    adjustCountersForEntryShiftChange(
                        employeeId,
                        dateValue,
                        existingShift,
                        medicationSupportShift
                    );
                    currentWeekTargetEntries += 1;
                    assigned = true;
                    break;
                }

                if (!assigned) {
                    break;
                }
            }

            if (currentWeekTargetEntries < targetCount) {
                addWarning(
                    weekDates[0] ?? generationSchedule.month,
                    medicationSupportShift.id,
                    `${employee.name}: não consegui cumprir o objetivo semanal de ${targetCount} turno(s) ${medicationSupportShift.code}.`,
                    employee.id
                );
            }
        }
    }

    if (medicationSupportShift) {
        const minimumWeeklyMedicationCount = 2;
        const idealWeeklyMedicationCount = 3;

        for (const weekStartKey of uniqueWeekStartKeys) {
            const weekDates = monthDays.filter(
                (dateValue) => weekStartKeyFromDate(dateValue) === weekStartKey
            );
            const currentWeekMedicationEntries = entries.filter(
                (entry) =>
                    entry.shift_type_id === medicationSupportShift.id &&
                    weekStartKeyFromDate(entry.work_date) === weekStartKey
            ).length;

            if (currentWeekMedicationEntries > 3) {
                addWarning(
                    weekDates[0] ?? generationSchedule.month,
                    medicationSupportShift.id,
                    `Turno ${medicationSupportShift.code} acima do máximo semanal (3).`
                );
                continue;
            }

            let nextWeekMedicationEntries = currentWeekMedicationEntries;
            const candidateDates = orderMedicationDates(
                weekDates.filter((dateValue) => isMedicationPreferredDate(dateValue))
            );
            const nonAdjacentCandidateDates = candidateDates.filter(
                (dateValue) => !hasAdjacentMedicationShift(dateValue)
            );
            const datesToTry =
                nonAdjacentCandidateDates.length > 0
                    ? nonAdjacentCandidateDates
                    : candidateDates;
            const maximumTargetForWeek = Math.min(
                idealWeeklyMedicationCount,
                datesToTry.length
            );
            const minimumTargetForWeek = Math.min(
                minimumWeeklyMedicationCount,
                datesToTry.length
            );
            const mandatoryBaseDates = datesToTry.filter((dateValue) => {
                const weekday = new Date(`${dateValue}T00:00:00`).getDay();
                return weekday === 5 || weekday === 1;
            });
            const optionalThirdDates = datesToTry.filter((dateValue) => {
                const weekday = new Date(`${dateValue}T00:00:00`).getDay();
                return weekday === 3;
            });
            const fallbackMedicationDates = datesToTry.filter((dateValue) => {
                const weekday = new Date(`${dateValue}T00:00:00`).getDay();
                return weekday !== 5 && weekday !== 1 && weekday !== 3;
            });
            const assignmentOrder = [
                ...mandatoryBaseDates,
                ...optionalThirdDates,
                ...fallbackMedicationDates,
            ];

            for (const dateValue of assignmentOrder) {
                if (nextWeekMedicationEntries >= maximumTargetForWeek) {
                    break;
                }

                if (tryAssignMedicationShiftOnDate(dateValue)) {
                    nextWeekMedicationEntries += 1;
                }
            }

            if (nextWeekMedicationEntries < minimumTargetForWeek) {
                addWarning(
                    weekDates[0] ?? generationSchedule.month,
                    medicationSupportShift.id,
                    `Não consegui garantir o mínimo semanal de ${minimumWeeklyMedicationCount} turnos ${medicationSupportShift.code}.`
                );
            }
        }
    }

    if (managementSupportShift) {
        const currentManagementEntries = entries.filter(
            (entry) => entry.shift_type_id === managementSupportShift.id
        ).length;

        if (currentManagementEntries > 1) {
            addWarning(
                generationSchedule.month,
                managementSupportShift.id,
                `Turno ${managementSupportShift.code} acima do máximo mensal (1).`
            );
        } else if (currentManagementEntries === 0) {
            if (!susanaEmployee) {
                addWarning(
                    generationSchedule.month,
                    managementSupportShift.id,
                    `Não consegui agendar ${managementSupportShift.code}: a Susana não está ativa na equipa.`
                );
            } else {
                const candidateDates = monthDays.filter(
                    (dateValue) =>
                        Number(dateValue.slice(8, 10)) >= 20 &&
                        !weekendDates.has(dateValue) &&
                        !holidayDates.has(dateValue)
                );
                let assignedManagementShift = false;

                for (const dateValue of candidateDates) {
                    const hardCandidates = canAssignShiftToEmployee(
                        susanaEmployee.id,
                        dateValue,
                        managementSupportShift
                    )
                        ? [susanaEmployee]
                        : [];

                    if (hardCandidates.length === 0) {
                        continue;
                    }
                    const chosenEmployee = chooseBestCandidate(
                        hardCandidates,
                        managementSupportShift,
                        dateValue
                    );

                    if (!chosenEmployee) {
                        continue;
                    }

                    addEntry(
                        chosenEmployee.id,
                        dateValue,
                        managementSupportShift,
                        "Gerado automaticamente: turno de gestão mensal",
                        true
                    );
                    assignedManagementShift = true;
                    break;
                }

                if (!assignedManagementShift) {
                    addWarning(
                        generationSchedule.month,
                        managementSupportShift.id,
                        `Não consegui agendar o turno mensal ${managementSupportShift.code} para a Susana (a partir do dia 20).`
                    );
                }
            }
        }
    }

    if (medicationSupportShift) {
        for (const dateValue of monthDays) {
            if (holidayDates.has(dateValue) || weekendDates.has(dateValue)) {
                continue;
            }

            const medicationEntry = entries.find(
                (entry) =>
                    entry.work_date === dateValue &&
                    entry.shift_type_id === medicationSupportShift.id
            );

            if (!medicationEntry) {
                continue;
            }

            const currentEmployeeConstraints =
                constraintsByEmployee.get(medicationEntry.employee_id) ?? [];
            const currentEmployeeAvoidsMedication = hasSoftAvoidanceForShift(
                currentEmployeeConstraints,
                dateValue,
                medicationSupportShift.id
            );
            const currentEmployeePrefersMedication = hasPreferredShift(
                currentEmployeeConstraints,
                dateValue,
                medicationSupportShift.id
            );

            if (!currentEmployeeAvoidsMedication && currentEmployeePrefersMedication) {
                continue;
            }

            let bestSwapEntry: GenerationEntry | null = null;
            let bestSwapScore = Number.POSITIVE_INFINITY;

            for (const candidateEntry of entries) {
                if (
                    candidateEntry.work_date !== dateValue ||
                    candidateEntry.employee_id === medicationEntry.employee_id
                ) {
                    continue;
                }

                const candidateShift = shiftTypesById.get(candidateEntry.shift_type_id);

                if (!candidateShift || nonWorkShiftCodes.has(candidateShift.code)) {
                    continue;
                }

                const candidateConstraints =
                    constraintsByEmployee.get(candidateEntry.employee_id) ?? [];
                if (
                    isHardBlockedForShift(
                        candidateConstraints,
                        dateValue,
                        medicationSupportShift.id
                    ) ||
                    hasSoftAvoidanceForShift(
                        candidateConstraints,
                        dateValue,
                        medicationSupportShift.id
                    ) ||
                    isHardBlockedForShift(
                        currentEmployeeConstraints,
                        dateValue,
                        candidateShift.id
                    )
                ) {
                    continue;
                }

                const candidateFixedPreferred = hasFixedPreferredShift(
                    candidateConstraints,
                    dateValue,
                    medicationSupportShift.id
                );
                const candidatePreferred = hasPreferredShift(
                    candidateConstraints,
                    dateValue,
                    medicationSupportShift.id
                );

                if (!candidatePreferred && !candidateFixedPreferred) {
                    continue;
                }

                const candidateLoad = workShiftCounts.get(candidateEntry.employee_id) ?? 0;
                const currentLoad = workShiftCounts.get(medicationEntry.employee_id) ?? 0;
                const swapScore =
                    (candidateFixedPreferred ? -120 : candidatePreferred ? -80 : 0) +
                    candidateLoad -
                    currentLoad;

                if (swapScore < bestSwapScore) {
                    bestSwapScore = swapScore;
                    bestSwapEntry = candidateEntry;
                }
            }

            if (bestSwapEntry) {
                swapEntryShiftTypes(medicationEntry, bestSwapEntry, dateValue);
            }
        }
    }

    for (const dateValue of monthDays) {
        for (const employee of employees) {
            const cellKey = buildEntryKey(employee.id, dateValue);
            if (entriesByCell.has(cellKey)) {
                continue;
            }

            const fallbackShift = resolveFallbackShiftForEmptyCell(employee.id, dateValue);
            if (!fallbackShift) {
                addWarning(
                    dateValue,
                    null,
                    `${employee.name}: não consegui preencher automaticamente a célula vazia.`,
                    employee.id
                );
                continue;
            }

            const isNonWorkShift = nonWorkShiftCodes.has(fallbackShift.code);
            addEntry(
                employee.id,
                dateValue,
                fallbackShift,
                "Preenchimento automático para evitar célula vazia",
                !isNonWorkShift
            );
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

    const balanceStats = employees.map((employee) => {
        let nonWorkDays = 0;

        for (const dateValue of monthDays) {
            const entry = entriesByCell.get(buildEntryKey(employee.id, dateValue));
            const shift = entry ? shiftTypesById.get(entry.shift_type_id) : null;
            if (shift && nonWorkShiftCodes.has(shift.code)) {
                nonWorkDays += 1;
            }
        }

        const availableDays = monthDays.length - nonWorkDays;
        const workUnits = workShiftCounts.get(employee.id) ?? 0;
        return {
            employeeId: employee.id,
            workUnits,
            weekendUnits: weekendShiftCounts.get(employee.id) ?? 0,
            holidayUnits: holidayShiftCounts.get(employee.id) ?? 0,
            availableDays,
            workloadRatio: workUnits / Math.max(availableDays, 1),
        };
    });

    const minAvailableDaysForBalance = Math.max(
        8,
        Math.floor(monthDays.length * 0.4)
    );
    const balanceEligibleStats = balanceStats.filter(
        (stat) => stat.availableDays >= minAvailableDaysForBalance
    );
    const statsForGlobalBalance =
        balanceEligibleStats.length >= 3 ? balanceEligibleStats : balanceStats;

    const shiftTotals = statsForGlobalBalance.map((stat) => stat.workUnits);
    const weekendTotals = statsForGlobalBalance.map((stat) => stat.weekendUnits);
    const holidayTotals = statsForGlobalBalance.map((stat) => stat.holidayUnits);
    const workloadRatios = statsForGlobalBalance.map((stat) => stat.workloadRatio);
    const maxShifts = Math.max(...shiftTotals, 0);
    const minShifts = Math.min(...shiftTotals, 0);
    const maxWeekendShifts = Math.max(...weekendTotals, 0);
    const minWeekendShifts = Math.min(...weekendTotals, 0);
    const maxHolidayShifts = Math.max(...holidayTotals, 0);
    const minHolidayShifts = Math.min(...holidayTotals, 0);
    const maxWorkloadRatio = Math.max(...workloadRatios, 0);
    const minWorkloadRatio = Math.min(...workloadRatios, 0);
    const averageShifts =
        shiftTotals.length > 0
            ? shiftTotals.reduce((total, value) => total + value, 0) /
              shiftTotals.length
            : 0;
    const relativeShiftGap =
        averageShifts > 0 ? (maxShifts - minShifts) / averageShifts : 0;

    if (
        maxShifts - minShifts >= 12 &&
        maxWorkloadRatio - minWorkloadRatio >= 0.4 &&
        relativeShiftGap >= 0.45
    ) {
        addWarning(
            generationSchedule.month,
            null,
            "Distribuição de turnos desequilibrada entre funcionários."
        );
    }

    if (maxWeekendShifts - minWeekendShifts >= 5) {
        addWarning(
            generationSchedule.month,
            null,
            "Distribuição de fins de semana está desequilibrada."
        );
    }

    if (maxHolidayShifts - minHolidayShifts >= 4) {
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
        const eligibleDates = scopedDates.filter((dateValue) => {
            const isHoliday = holidayDates.has(dateValue);
            const isWeekend = weekendDates.has(dateValue);

            if (isHoliday) {
                return preferredShift.code === "M" || preferredShift.code === "T";
            }

            if (isWeekend) {
                return preferredShift.code === "MT";
            }

            return true;
        });

        if (eligibleDates.length === 0) {
            continue;
        }

        const wasFulfilled = eligibleDates.some((dateValue) => {
            const entry = entriesByCell.get(buildEntryKey(employee.id, dateValue));

            return entry?.shift_type_id === preferredShift.id;
        });

        if (!wasFulfilled) {
            addWarning(
                eligibleDates[0] ?? generationSchedule.month,
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
                message: `Não consegui guardar o horário: ${insertEntriesError.message}`,
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
                message: `Gerei o horário, mas não consegui guardar os avisos: ${insertWarningsError.message}`,
            };
        }
    }

    revalidatePath(`/dashboard/schedules/${generationSchedule.id}`);

    return {
        status: "success",
        message:
            warnings.length > 0
                ? `Horário gerado com ${warnings.length} aviso(s).`
                : "Horário gerado sem avisos.",
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
