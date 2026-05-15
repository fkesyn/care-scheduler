"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type CreateAppointmentState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        employeeId?: string;
        patientId?: string;
        serviceId?: string;
        scheduledDate?: string;
        startTime?: string;
    };
};

export type UpdateAppointmentState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        appointmentId?: string;
        employeeId?: string;
        patientId?: string;
        serviceId?: string;
        scheduledDate?: string;
        startTime?: string;
        appointmentStatus?: string;
    };
};

export type DeleteAppointmentState = {
    status: "idle" | "success" | "error";
    message?: string;
};

export type DeleteMonthlyAppointmentsState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        month?: string;
    };
};

export type UpdateMonthlyAppointmentsStatusState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        month?: string;
        serviceId?: string;
        employeeId?: string;
        appointmentStatus?: string;
    };
};

export type CreateMonthlyAppointmentsState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        month?: string;
        locationId?: string;
        serviceId?: string;
        startTime?: string;
        endTime?: string;
        startDay?: string;
        endDay?: string;
        patientIds?: string;
        employeeId?: string;
    };
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;
const monthPattern = /^\d{4}-\d{2}$/;
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const appointmentStatuses = new Set(["planned", "completed", "canceled"]);

type PatientRow = {
    id: string;
    name: string;
    is_diabetic: boolean | null;
};

type ExistingAppointmentRow = {
    scheduled_date: string;
    start_time: string;
    end_time: string;
};

type BusySlot = {
    start: number;
    end: number;
};

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

function parseTimeToMinutes(timeValue: string) {
    const [hours, minutes] = timeValue.split(":").map(Number);
    return hours * 60 + minutes;
}

function formatMinutesAsTime(minutes: number) {
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minuteValue = String(minutes % 60).padStart(2, "0");

    return `${hours}:${minuteValue}:00`;
}

function formatDateValue(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
    )}`;
}

function findAvailableSlot(
    busySlots: BusySlot[],
    windowStart: number,
    windowEnd: number,
    durationMinutes: number
) {
    let candidateStart = windowStart;

    for (const slot of busySlots) {
        const candidateEnd = candidateStart + durationMinutes;

        if (candidateEnd <= slot.start) {
            break;
        }

        if (candidateStart < slot.end && candidateEnd > slot.start) {
            candidateStart = slot.end;
        }
    }

    const candidateEnd = candidateStart + durationMinutes;

    if (candidateEnd > windowEnd) {
        return null;
    }

    return {
        start: candidateStart,
        end: candidateEnd,
    };
}

export async function createAppointment(
    _previousState: CreateAppointmentState,
    formData: FormData
): Promise<CreateAppointmentState> {
    const employeeId = String(formData.get("employee_id") ?? "").trim();
    const patientId = String(formData.get("patient_id") ?? "").trim();
    const serviceId = String(formData.get("service_id") ?? "").trim();
    const scheduledDate = String(formData.get("scheduled_date") ?? "").trim();
    const startTime = String(formData.get("start_time") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    const fieldErrors: CreateAppointmentState["fieldErrors"] = {};

    if (!employeeId) {
        fieldErrors.employeeId = "Escolhe quem vai fazer o serviço.";
    }

    if (!patientId) {
        fieldErrors.patientId = "Escolhe um utente.";
    }

    if (!serviceId) {
        fieldErrors.serviceId = "Escolhe um serviço.";
    }

    if (!datePattern.test(scheduledDate)) {
        fieldErrors.scheduledDate = "Escolhe uma data válida.";
    }

    if (!timePattern.test(startTime)) {
        fieldErrors.startTime = "Escolhe uma hora válida.";
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

    const { error } = await supabase.rpc("create_appointment", {
        p_employee_id: employeeId,
        p_patient_id: patientId,
        p_service_id: serviceId,
        p_scheduled_date: scheduledDate,
        p_start_time: startTime,
        p_notes: notes || null,
        p_status: "planned",
    });

    if (error) {
        return {
            status: "error",
            message: `Não consegui criar a marcação: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: "Marcação criada.",
    };
}

export async function updateAppointmentDetails(
    _previousState: UpdateAppointmentState,
    formData: FormData
): Promise<UpdateAppointmentState> {
    const appointmentId = String(formData.get("appointment_id") ?? "").trim();
    const employeeId = String(formData.get("employee_id") ?? "").trim();
    const patientId = String(formData.get("patient_id") ?? "").trim();
    const serviceId = String(formData.get("service_id") ?? "").trim();
    const scheduledDate = String(formData.get("scheduled_date") ?? "").trim();
    const startTime = String(formData.get("start_time") ?? "").trim();
    const appointmentStatus = String(formData.get("status") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    const fieldErrors: UpdateAppointmentState["fieldErrors"] = {};

    if (!uuidPattern.test(appointmentId)) {
        fieldErrors.appointmentId = "Marcação inválida.";
    }

    if (employeeId && !uuidPattern.test(employeeId)) {
        fieldErrors.employeeId = "Escolhe um funcionário válido.";
    }

    if (!uuidPattern.test(patientId)) {
        fieldErrors.patientId = "Escolhe um utente.";
    }

    if (!uuidPattern.test(serviceId)) {
        fieldErrors.serviceId = "Escolhe um serviço.";
    }

    if (!datePattern.test(scheduledDate)) {
        fieldErrors.scheduledDate = "Escolhe uma data válida.";
    }

    if (!timePattern.test(startTime)) {
        fieldErrors.startTime = "Escolhe uma hora válida.";
    }

    if (!appointmentStatuses.has(appointmentStatus)) {
        fieldErrors.appointmentStatus = "Escolhe um estado válido.";
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

    const [{ data: patient }, { data: service }, employeeResult] =
        await Promise.all([
            supabase
                .from("patients")
                .select("id, is_diabetic")
                .eq("id", patientId)
                .eq("active", true)
                .maybeSingle(),
            supabase
                .from("services")
                .select("id, duration_minutes, measurement_type")
                .eq("id", serviceId)
                .eq("active", true)
                .maybeSingle(),
            employeeId
                ? supabase
                      .from("employees")
                      .select("id")
                      .eq("id", employeeId)
                      .eq("active", true)
                      .maybeSingle()
                : Promise.resolve({ data: null, error: null }),
        ]);

    if (!patient) {
        return {
            status: "error",
            message: "O utente escolhido já não está disponível.",
        };
    }

    if (!service) {
        return {
            status: "error",
            message: "O serviço escolhido já não está disponível.",
        };
    }

    if (employeeId && !employeeResult.data) {
        return {
            status: "error",
            message: "O funcionário escolhido já não está disponível.",
        };
    }

    if (service.measurement_type === "glucose" && !patient.is_diabetic) {
        return {
            status: "error",
            message:
                "Para glicémia, escolhe um utente marcado como diabético.",
        };
    }

    const durationMinutes = Number(service.duration_minutes ?? 30);
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = startMinutes + durationMinutes;

    if (endMinutes > 24 * 60) {
        return {
            status: "error",
            message: "A marcação não pode terminar no dia seguinte.",
        };
    }

    const auditProfileId = await getExistingProfileId(supabase, user.id);

    const { error } = await supabase
        .from("appointments")
        .update({
            employee_id: employeeId || null,
            patient_id: patientId,
            service_id: serviceId,
            scheduled_date: scheduledDate,
            start_time: formatMinutesAsTime(startMinutes),
            end_time: formatMinutesAsTime(endMinutes),
            status: appointmentStatus,
            notes: notes || null,
            updated_at: new Date().toISOString(),
            ...(auditProfileId ? { updated_by: auditProfileId } : {}),
        })
        .eq("id", appointmentId)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui atualizar a marcação: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/calendar");

    return {
        status: "success",
        message: "Marcação atualizada.",
    };
}

export async function deleteAppointment(
    _previousState: DeleteAppointmentState,
    formData: FormData
): Promise<DeleteAppointmentState> {
    const appointmentId = String(formData.get("appointment_id") ?? "").trim();

    if (!uuidPattern.test(appointmentId)) {
        return {
            status: "error",
            message: "Marcação inválida.",
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
        .from("appointments")
        .delete()
        .eq("id", appointmentId)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui apagar a marcação: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: "Marcação apagada.",
    };
}

export async function deleteMonthlyAppointments(
    _previousState: DeleteMonthlyAppointmentsState,
    formData: FormData
): Promise<DeleteMonthlyAppointmentsState> {
    const month = String(formData.get("month") ?? "").trim();

    if (!monthPattern.test(month)) {
        return {
            status: "error",
            message: "Escolhe um mês válido.",
            fieldErrors: {
                month: "Mês inválido.",
            },
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

    const { data: organizationId, error: organizationError } = await supabase.rpc(
        "my_organization_id"
    );

    if (organizationError || !organizationId) {
        return {
            status: "error",
            message: "Não consegui encontrar a organização deste utilizador.",
        };
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const startDate = formatDateValue(year, monthNumber, 1);
    const endDate = formatDateValue(year, monthNumber, daysInMonth);

    const { data, error } = await supabase
        .from("appointments")
        .delete()
        .eq("organization_id", organizationId)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .select("id");

    if (error) {
        return {
            status: "error",
            message: `Não consegui limpar o mês: ${error.message}`,
        };
    }

    const deletedCount = data?.length ?? 0;

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message:
            deletedCount === 0
                ? "Não havia marcações para apagar neste mês."
                : `${deletedCount} marcações apagadas deste mês.`,
    };
}

export async function updateMonthlyAppointmentsStatus(
    _previousState: UpdateMonthlyAppointmentsStatusState,
    formData: FormData
): Promise<UpdateMonthlyAppointmentsStatusState> {
    const month = String(formData.get("month") ?? "").trim();
    const serviceId = String(formData.get("service_id") ?? "").trim();
    const employeeId = String(formData.get("employee_id") ?? "").trim();
    const appointmentStatus = String(formData.get("status") ?? "").trim();

    const fieldErrors: UpdateMonthlyAppointmentsStatusState["fieldErrors"] = {};

    if (!monthPattern.test(month)) {
        fieldErrors.month = "Escolhe um mês válido.";
    }

    if (!uuidPattern.test(serviceId)) {
        fieldErrors.serviceId = "Escolhe um serviço.";
    }

    if (
        employeeId &&
        employeeId !== "unassigned" &&
        !uuidPattern.test(employeeId)
    ) {
        fieldErrors.employeeId = "Escolhe um funcionário válido.";
    }

    if (!appointmentStatuses.has(appointmentStatus)) {
        fieldErrors.appointmentStatus = "Escolhe um estado válido.";
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

    const { data: organizationId, error: organizationError } = await supabase.rpc(
        "my_organization_id"
    );

    if (organizationError || !organizationId) {
        return {
            status: "error",
            message: "Não consegui encontrar a organização deste utilizador.",
        };
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const startDate = formatDateValue(year, monthNumber, 1);
    const endDate = formatDateValue(year, monthNumber, daysInMonth);
    const auditProfileId = await getExistingProfileId(supabase, user.id);

    let updateQuery = supabase
        .from("appointments")
        .update({
            status: appointmentStatus,
            updated_at: new Date().toISOString(),
            ...(auditProfileId ? { updated_by: auditProfileId } : {}),
        })
        .eq("organization_id", organizationId)
        .eq("service_id", serviceId)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate);

    if (employeeId === "unassigned") {
        updateQuery = updateQuery.is("employee_id", null);
    } else if (employeeId) {
        updateQuery = updateQuery.eq("employee_id", employeeId);
    }

    const { data, error } = await updateQuery.select("id");

    if (error) {
        return {
            status: "error",
            message: `Não consegui alterar o estado: ${error.message}`,
        };
    }

    const updatedCount = data?.length ?? 0;

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message:
            updatedCount === 0
                ? "Não encontrei marcações para estes critérios."
                : `${updatedCount} marcações atualizadas.`,
    };
}

export async function createMonthlyAppointments(
    _previousState: CreateMonthlyAppointmentsState,
    formData: FormData
): Promise<CreateMonthlyAppointmentsState> {
    const month = String(formData.get("month") ?? "").trim();
    const locationId = String(formData.get("location_id") ?? "").trim();
    const serviceId = String(formData.get("service_id") ?? "").trim();
    const employeeId = String(formData.get("employee_id") ?? "").trim();
    const startTime = String(formData.get("start_time") ?? "").trim();
    const endTime = String(formData.get("end_time") ?? "").trim();
    const startDay = Number(formData.get("start_day") ?? 1);
    const endDay = Number(formData.get("end_day") ?? 31);
    const useAllPatients = formData.get("all_patients") === "on";
    const patientIds = formData
        .getAll("patient_ids")
        .map((value) => String(value).trim())
        .filter(Boolean);

    const fieldErrors: CreateMonthlyAppointmentsState["fieldErrors"] = {};

    if (!monthPattern.test(month)) {
        fieldErrors.month = "Escolhe um mês válido.";
    }

    if (!uuidPattern.test(locationId)) {
        fieldErrors.locationId = "Escolhe um local.";
    }

    if (!uuidPattern.test(serviceId)) {
        fieldErrors.serviceId = "Escolhe um serviço.";
    }

    if (employeeId && !uuidPattern.test(employeeId)) {
        fieldErrors.employeeId = "Escolhe um funcionário válido.";
    }

    if (!timePattern.test(startTime)) {
        fieldErrors.startTime = "Escolhe uma hora de início válida.";
    }

    if (!timePattern.test(endTime)) {
        fieldErrors.endTime = "Escolhe uma hora de fim válida.";
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const daysInMonth = Number.isInteger(year)
        ? new Date(year, monthNumber, 0).getDate()
        : 31;

    if (!Number.isInteger(startDay) || startDay < 1 || startDay > daysInMonth) {
        fieldErrors.startDay = "Escolhe um dia de início válido.";
    }

    if (!Number.isInteger(endDay) || endDay < 1 || endDay > daysInMonth) {
        fieldErrors.endDay = "Escolhe um dia de fim válido.";
    }

    if (
        Number.isInteger(startDay) &&
        Number.isInteger(endDay) &&
        startDay > endDay
    ) {
        fieldErrors.endDay = "O dia de fim tem de ser igual ou posterior ao início.";
    }

    if (!useAllPatients && patientIds.length === 0) {
        fieldErrors.patientIds = "Escolhe pelo menos um utente.";
    }

    if (timePattern.test(startTime) && timePattern.test(endTime)) {
        const windowStart = parseTimeToMinutes(startTime);
        const windowEnd = parseTimeToMinutes(endTime);

        if (windowEnd <= windowStart) {
            fieldErrors.endTime = "A hora de fim tem de ser posterior ao início.";
        }
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

    const { data: organizationId, error: organizationError } = await supabase.rpc(
        "my_organization_id"
    );

    if (organizationError || !organizationId) {
        return {
            status: "error",
            message: "Não consegui encontrar a organização deste utilizador.",
        };
    }

    const [{ data: location }, { data: service }, employeeResult] =
        await Promise.all([
            supabase
                .from("locations")
                .select("id")
                .eq("id", locationId)
                .eq("active", true)
                .maybeSingle(),
            supabase
                .from("services")
                .select("id, duration_minutes, measurement_type")
                .eq("id", serviceId)
                .eq("active", true)
                .maybeSingle(),
            employeeId
                ? supabase
                      .from("employees")
                      .select("id")
                      .eq("id", employeeId)
                      .eq("active", true)
                      .maybeSingle()
                : Promise.resolve({ data: null, error: null }),
        ]);

    if (!location) {
        return {
            status: "error",
            message: "O local escolhido já não está disponível.",
        };
    }

    if (!service) {
        return {
            status: "error",
            message: "O serviço escolhido já não está disponível.",
        };
    }

    if (employeeId && !employeeResult.data) {
        return {
            status: "error",
            message: "O funcionário escolhido já não está disponível.",
        };
    }

    const durationMinutes = Number(service.duration_minutes ?? 30);
    const windowStart = parseTimeToMinutes(startTime);
    const windowEnd = parseTimeToMinutes(endTime);

    if (durationMinutes <= 0 || windowEnd - windowStart < durationMinutes) {
        return {
            status: "error",
            message: "O intervalo horário não chega para a duração do serviço.",
        };
    }

    let patientsQuery = supabase
        .from("patients")
        .select("id, name, is_diabetic")
        .eq("location_id", locationId)
        .eq("active", true)
        .order("name");

    if (!useAllPatients) {
        patientsQuery = patientsQuery.in("id", patientIds);
    }

    const { data: patients, error: patientsError } = await patientsQuery;

    if (patientsError) {
        return {
            status: "error",
            message: `Não consegui carregar os utentes: ${patientsError.message}`,
        };
    }

    const patientRows = ((patients ?? []) as PatientRow[]).sort((a, b) =>
        a.name.localeCompare(b.name, "pt-PT", { sensitivity: "base" })
    );

    if (patientRows.length === 0) {
        return {
            status: "error",
            message: "Não há utentes ativos para os critérios escolhidos.",
        };
    }

    if (!useAllPatients && patientRows.length !== patientIds.length) {
        return {
            status: "error",
            message: "Alguns utentes escolhidos não pertencem ao local selecionado.",
        };
    }

    if (
        service.measurement_type === "glucose" &&
        patientRows.some((patient) => !patient.is_diabetic)
    ) {
        return {
            status: "error",
            message:
                "Para glicémia, seleciona apenas utentes marcados como diabéticos.",
        };
    }

    const startDate = formatDateValue(year, monthNumber, startDay);
    const endDate = formatDateValue(year, monthNumber, endDay);

    let appointmentsQuery = supabase
        .from("appointments")
        .select("scheduled_date, start_time, end_time")
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate)
        .neq("status", "canceled")
        .order("scheduled_date")
        .order("start_time");

    if (employeeId) {
        appointmentsQuery = appointmentsQuery.eq("employee_id", employeeId);
    }

    const { data: existingAppointments, error: existingAppointmentsError } =
        await appointmentsQuery;

    if (existingAppointmentsError) {
        return {
            status: "error",
            message: `Não consegui validar slots livres: ${existingAppointmentsError.message}`,
        };
    }

    const busySlotsByDate = new Map<string, BusySlot[]>();

    for (const appointment of (existingAppointments ??
        []) as ExistingAppointmentRow[]) {
        const slots = busySlotsByDate.get(appointment.scheduled_date) ?? [];
        slots.push({
            start: parseTimeToMinutes(appointment.start_time.slice(0, 5)),
            end: parseTimeToMinutes(appointment.end_time.slice(0, 5)),
        });
        busySlotsByDate.set(appointment.scheduled_date, slots);
    }

    for (const slots of busySlotsByDate.values()) {
        slots.sort((a, b) => a.start - b.start);
    }

    const appointmentsToCreate: Array<{
        organization_id: string;
        employee_id: string | null;
        patient_id: string;
        service_id: string;
        scheduled_date: string;
        start_time: string;
        end_time: string;
        status: string;
        notes: string;
        created_by?: string;
    }> = [];

    const days = Array.from(
        { length: endDay - startDay + 1 },
        (_, index) => startDay + index
    );

    if (patientRows.length > days.length) {
        return {
            status: "error",
            message: `Selecionaste ${patientRows.length} utentes, mas só há ${days.length} dias no intervalo escolhido. Nada foi criado.`,
        };
    }

    const auditProfileId = await getExistingProfileId(supabase, user.id);

    for (const [index, patient] of patientRows.entries()) {
        const day = days[index];
        const dateValue = formatDateValue(year, monthNumber, day);
        const busySlots = busySlotsByDate.get(dateValue) ?? [];
        const slot = findAvailableSlot(
            busySlots,
            windowStart,
            windowEnd,
            durationMinutes
        );

        if (!slot) {
            return {
                status: "error",
                message: `Não há slot livre para ${patient.name} no dia ${day}. Nada foi criado.`,
            };
        }

        busySlots.push(slot);
        busySlots.sort((a, b) => a.start - b.start);
        busySlotsByDate.set(dateValue, busySlots);

        appointmentsToCreate.push({
            organization_id: organizationId,
            employee_id: employeeId || null,
            patient_id: patient.id,
            service_id: serviceId,
            scheduled_date: dateValue,
            start_time: formatMinutesAsTime(slot.start),
            end_time: formatMinutesAsTime(slot.end),
            status: "planned",
            notes: "Agendamento mensal",
            ...(auditProfileId ? { created_by: auditProfileId } : {}),
        });
    }

    const { error: insertError } = await supabase
        .from("appointments")
        .insert(appointmentsToCreate);

    if (insertError) {
        return {
            status: "error",
            message: `Não consegui criar o agendamento mensal: ${insertError.message}`,
        };
    }

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: `${appointmentsToCreate.length} marcações criadas com sucesso.`,
    };
}
