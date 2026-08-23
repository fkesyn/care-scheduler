"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { clinicalRecordTypeForService } from "./service-display";

export type CreateAppointmentState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        employeeId?: string;
        patientId?: string;
        serviceId?: string;
        scheduledDate?: string;
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
        appointmentStatus?: string;
        bloodPressureValue?: string;
        heartRateValue?: string;
        woundCharacteristics?: string;
        woundTreatment?: string;
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
        locationId?: string;
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
        startDay?: string;
        endDay?: string;
        weekdays?: string;
        weekdayCapacity?: string;
        patientIds?: string;
        employeeId?: string;
    };
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-\d{2}$/;
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const appointmentStatuses = new Set(["planned", "completed", "canceled"]);
const validWeekdays = new Set([0, 1, 2, 3, 4, 5, 6]);
const technicalStartTime = "00:00";
const technicalStartTimeWithSeconds = "00:00:00";
const technicalEndTimeWithSeconds = "00:01:00";

type PatientRow = {
    id: string;
    name: string;
    is_diabetic: boolean | null;
};

type LocationCapacityRow = {
    id: string;
    name: string;
};

type ExistingPatientAppointmentRow = {
    scheduled_date: string;
    patient_id: string | null;
    service_id: string | null;
};

type ExistingCapacityAppointmentRow = {
    scheduled_date: string;
};

type ClinicalRecordUpsert = {
    organization_id: string;
    appointment_id: string;
    patient_id: string;
    service_id: string;
    employee_id: string | null;
    record_date: string;
    record_type: "blood_pressure" | "wound_care";
    blood_pressure_value: string | null;
    heart_rate_value: number | null;
    wound_characteristics: string | null;
    wound_treatment: string | null;
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

function formatDateValue(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
    )}`;
}

function formatCountLabel(count: number, singular: string, plural: string) {
    return `${count} ${count === 1 ? singular : plural}`;
}

function hasTextValue(value: string) {
    return value.trim().length > 0;
}

function parseOptionalHeartRate(value: string) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
        return {
            value: null,
            error: null,
        };
    }

    if (!/^\d+$/.test(normalizedValue)) {
        return {
            value: null,
            error: "A FC tem de ser um número.",
        };
    }

    const numericValue = Number(normalizedValue);

    if (numericValue <= 0 || numericValue > 300) {
        return {
            value: null,
            error: "A FC deve estar entre 1 e 300.",
        };
    }

    return {
        value: numericValue,
        error: null,
    };
}

function normalizeLocationName(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function isSaoFranciscoSantoAntonioCapacityGroup(locationName: string) {
    const normalizedName = normalizeLocationName(locationName);

    return (
        normalizedName.includes("s francisco") ||
        normalizedName.includes("sao francisco") ||
        normalizedName.includes("sto antonio") ||
        normalizedName.includes("santo antonio")
    );
}

async function getLocationCapacityScope(
    supabase: Awaited<ReturnType<typeof createClient>>,
    organizationId: string,
    selectedLocation: LocationCapacityRow
) {
    if (!isSaoFranciscoSantoAntonioCapacityGroup(selectedLocation.name)) {
        return {
            locationIds: [selectedLocation.id],
            isGrouped: false,
        };
    }

    const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .eq("organization_id", organizationId)
        .eq("active", true);

    if (error) {
        throw new Error(error.message);
    }

    const groupedLocationIds = ((data ?? []) as LocationCapacityRow[])
        .filter((location) =>
            isSaoFranciscoSantoAntonioCapacityGroup(location.name)
        )
        .map((location) => location.id);

    return {
        locationIds:
            groupedLocationIds.length > 0
                ? Array.from(new Set(groupedLocationIds))
                : [selectedLocation.id],
        isGrouped: groupedLocationIds.length > 1,
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
    const notes = String(formData.get("notes") ?? "").trim();

    const fieldErrors: CreateAppointmentState["fieldErrors"] = {};

    if (employeeId && !uuidPattern.test(employeeId)) {
        fieldErrors.employeeId = "Escolhe um funcionário válido.";
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
        p_employee_id: employeeId || null,
        p_patient_id: patientId,
        p_service_id: serviceId,
        p_scheduled_date: scheduledDate,
        p_start_time: technicalStartTime,
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
    const appointmentStatus = String(formData.get("status") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const bloodPressureValue = String(
        formData.get("blood_pressure_value") ?? ""
    ).trim();
    const heartRateInput = String(formData.get("heart_rate_value") ?? "").trim();
    const woundCharacteristics = String(
        formData.get("wound_characteristics") ?? ""
    ).trim();
    const woundTreatment = String(formData.get("wound_treatment") ?? "").trim();
    const heartRateResult = parseOptionalHeartRate(heartRateInput);

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

    if (!appointmentStatuses.has(appointmentStatus)) {
        fieldErrors.appointmentStatus = "Escolhe um estado válido.";
    }

    if (bloodPressureValue.length > 80) {
        fieldErrors.bloodPressureValue = "O valor de TA é demasiado longo.";
    }

    if (heartRateResult.error) {
        fieldErrors.heartRateValue = heartRateResult.error;
    }

    if (woundCharacteristics.length > 2000) {
        fieldErrors.woundCharacteristics =
            "As características da ferida são demasiado longas.";
    }

    if (woundTreatment.length > 2000) {
        fieldErrors.woundTreatment =
            "O tratamento realizado é demasiado longo.";
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
                .select("id, name, measurement_type")
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

    const clinicalRecordType = clinicalRecordTypeForService(
        service.name,
        service.measurement_type
    );

    if (clinicalRecordType === "glucose" && !patient.is_diabetic) {
        return {
            status: "error",
            message:
                "Para glicémia, escolhe um utente marcado como diabético.",
        };
    }

    const auditProfileId = await getExistingProfileId(supabase, user.id);

    const { data: updatedAppointment, error } = await supabase
        .from("appointments")
        .update({
            employee_id: employeeId || null,
            patient_id: patientId,
            service_id: serviceId,
            scheduled_date: scheduledDate,
            start_time: technicalStartTimeWithSeconds,
            end_time: technicalEndTimeWithSeconds,
            status: appointmentStatus,
            notes: notes || null,
            updated_at: new Date().toISOString(),
            ...(auditProfileId ? { updated_by: auditProfileId } : {}),
        })
        .eq("id", appointmentId)
        .select("id, organization_id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui atualizar a marcação: ${error.message}`,
        };
    }

    const shouldKeepBloodPressureRecord =
        clinicalRecordType === "blood_pressure" &&
        (hasTextValue(bloodPressureValue) || heartRateResult.value !== null);
    const shouldKeepWoundRecord =
        clinicalRecordType === "wound_care" &&
        (hasTextValue(woundCharacteristics) || hasTextValue(woundTreatment));

    if (shouldKeepBloodPressureRecord || shouldKeepWoundRecord) {
        const clinicalRecord: ClinicalRecordUpsert =
            clinicalRecordType === "blood_pressure"
                ? {
                      organization_id: updatedAppointment.organization_id,
                      appointment_id: appointmentId,
                      patient_id: patientId,
                      service_id: serviceId,
                      employee_id: employeeId || null,
                      record_date: scheduledDate,
                      record_type: "blood_pressure",
                      blood_pressure_value: bloodPressureValue,
                      heart_rate_value: heartRateResult.value,
                      wound_characteristics: null,
                      wound_treatment: null,
                  }
                : {
                      organization_id: updatedAppointment.organization_id,
                      appointment_id: appointmentId,
                      patient_id: patientId,
                      service_id: serviceId,
                      employee_id: employeeId || null,
                      record_date: scheduledDate,
                      record_type: "wound_care",
                      blood_pressure_value: null,
                      heart_rate_value: null,
                      wound_characteristics: woundCharacteristics || null,
                      wound_treatment: woundTreatment || null,
                  };

        const { error: clinicalRecordError } = await supabase
            .from("appointment_clinical_records")
            .upsert(clinicalRecord, {
                onConflict: "appointment_id",
            });

        if (clinicalRecordError) {
            return {
                status: "error",
                message: `Marcação atualizada, mas não consegui guardar o registo clínico: ${clinicalRecordError.message}`,
            };
        }
    } else {
        const { error: deleteClinicalRecordError } = await supabase
            .from("appointment_clinical_records")
            .delete()
            .eq("appointment_id", appointmentId);

        if (deleteClinicalRecordError) {
            return {
                status: "error",
                message: `Marcação atualizada, mas não consegui limpar o registo clínico antigo: ${deleteClinicalRecordError.message}`,
            };
        }
    }

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/patients");
    revalidatePath("/dashboard/services");

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
    const locationId = String(formData.get("location_id") ?? "all").trim();

    const fieldErrors: DeleteMonthlyAppointmentsState["fieldErrors"] = {};

    if (!monthPattern.test(month)) {
        fieldErrors.month = "Mês inválido.";
    }

    if (
        locationId &&
        locationId !== "all" &&
        !uuidPattern.test(locationId)
    ) {
        fieldErrors.locationId = "Local inválido.";
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
    let deleteQuery = supabase
        .from("appointments")
        .delete()
        .eq("organization_id", organizationId)
        .gte("scheduled_date", startDate)
        .lte("scheduled_date", endDate);

    let selectedLocationName: string | null = null;

    if (locationId !== "all") {
        const { data: location, error: locationError } = await supabase
            .from("locations")
            .select("id, name")
            .eq("id", locationId)
            .eq("organization_id", organizationId)
            .maybeSingle();

        if (locationError || !location) {
            return {
                status: "error",
                message: "O local escolhido já não está disponível.",
                fieldErrors: {
                    locationId: "Escolhe um local válido.",
                },
            };
        }

        selectedLocationName = String(location.name);

        const { data: patients, error: patientsError } = await supabase
            .from("patients")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("location_id", locationId);

        if (patientsError) {
            return {
                status: "error",
                message: `Não consegui carregar os utentes deste local: ${patientsError.message}`,
            };
        }

        const patientIds = (patients ?? []).map((patient) => String(patient.id));

        if (patientIds.length === 0) {
            return {
                status: "success",
                message: `Não havia utentes para limpar em ${selectedLocationName}.`,
            };
        }

        deleteQuery = deleteQuery.in("patient_id", patientIds);
    }

    const { data, error } = await deleteQuery.select("id");

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
                ? locationId === "all"
                    ? "Não havia marcações para apagar neste mês."
                    : `Não havia marcações para apagar em ${selectedLocationName} neste mês.`
                : locationId === "all"
                  ? `${deletedCount} marcações apagadas deste mês.`
                  : `${deletedCount} marcações apagadas de ${selectedLocationName} neste mês.`,
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
    const startDay = Number(formData.get("start_day") ?? 1);
    const endDay = Number(formData.get("end_day") ?? 31);
    const selectedWeekdays = new Set(
        formData
            .getAll("weekdays")
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && validWeekdays.has(value))
    );
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

    if (selectedWeekdays.size === 0) {
        fieldErrors.weekdays = "Escolhe pelo menos um dia da semana.";
    }

    const weekdayCapacityByDay = new Map<number, number>();

    for (const weekday of selectedWeekdays) {
        const capacity = Number(formData.get(`weekday_capacity_${weekday}`) ?? 1);

        if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) {
            fieldErrors.weekdayCapacity =
                "Cada dia selecionado tem de permitir entre 1 e 50 utentes.";
            break;
        }

        weekdayCapacityByDay.set(weekday, capacity);
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
                .select("id, name")
                .eq("id", locationId)
                .eq("active", true)
                .maybeSingle(),
            supabase
                .from("services")
                .select("id, name, measurement_type")
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

    let capacityScope: {
        locationIds: string[];
        isGrouped: boolean;
    };

    try {
        capacityScope = await getLocationCapacityScope(
            supabase,
            organizationId,
            location as LocationCapacityRow
        );
    } catch (error) {
        return {
            status: "error",
            message: `Não consegui validar locais agrupados: ${
                error instanceof Error ? error.message : "erro desconhecido"
            }`,
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

    const monthlyClinicalRecordType = clinicalRecordTypeForService(
        service.name,
        service.measurement_type
    );

    if (
        monthlyClinicalRecordType === "glucose" &&
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

    const { data: capacityPatients, error: capacityPatientsError } = await supabase
        .from("patients")
        .select("id")
        .eq("organization_id", organizationId)
        .in("location_id", capacityScope.locationIds);

    if (capacityPatientsError) {
        return {
            status: "error",
            message: `Não consegui validar utentes dos locais agrupados: ${capacityPatientsError.message}`,
        };
    }

    const capacityPatientIds = (capacityPatients ?? []).map((patient) =>
        String(patient.id)
    );

    const [existingPatientAppointmentsResult, existingCapacityAppointmentsResult] =
        await Promise.all([
            supabase
                .from("appointments")
                .select("scheduled_date, patient_id, service_id")
                .in(
                    "patient_id",
                    patientRows.map((patient) => patient.id)
                )
                .gte("scheduled_date", startDate)
                .lte("scheduled_date", endDate)
                .neq("status", "canceled")
                .order("scheduled_date"),
            capacityPatientIds.length > 0
                ? supabase
                      .from("appointments")
                      .select("scheduled_date")
                      .eq("organization_id", organizationId)
                      .eq("service_id", serviceId)
                      .in("patient_id", capacityPatientIds)
                      .gte("scheduled_date", startDate)
                      .lte("scheduled_date", endDate)
                      .neq("status", "canceled")
                : Promise.resolve({ data: [], error: null }),
        ]);

    const { data: existingPatientAppointments, error: existingPatientAppointmentsError } =
        existingPatientAppointmentsResult;
    const {
        data: existingCapacityAppointments,
        error: existingCapacityAppointmentsError,
    } = existingCapacityAppointmentsResult;

    if (existingPatientAppointmentsError) {
        return {
            status: "error",
            message: `Não consegui validar marcações existentes dos utentes: ${existingPatientAppointmentsError.message}`,
        };
    }

    if (existingCapacityAppointmentsError) {
        return {
            status: "error",
            message: `Não consegui validar capacidade dos locais agrupados: ${existingCapacityAppointmentsError.message}`,
        };
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

    const allowedDateOrder: string[] = [];
    const allowedDateSet = new Set<string>();
    const remainingCapacityByDate = new Map<string, number>();

    for (let day = startDay; day <= endDay; day += 1) {
        const weekday = new Date(year, monthNumber - 1, day).getDay();

        if (!selectedWeekdays.has(weekday)) {
            continue;
        }

        const capacity = weekdayCapacityByDay.get(weekday) ?? 1;
        const dateValue = formatDateValue(year, monthNumber, day);

        allowedDateOrder.push(dateValue);
        allowedDateSet.add(dateValue);
        remainingCapacityByDate.set(dateValue, capacity);
    }

    if (allowedDateOrder.length === 0) {
        return {
            status: "error",
            message:
                "Não há dias disponíveis no intervalo com os dias da semana escolhidos.",
            fieldErrors: {
                weekdays: "Escolhe dias que existam no intervalo selecionado.",
            },
        };
    }

    for (const appointment of (existingCapacityAppointments ??
        []) as ExistingCapacityAppointmentRow[]) {
        if (!allowedDateSet.has(appointment.scheduled_date)) {
            continue;
        }

        const remainingCapacity =
            remainingCapacityByDate.get(appointment.scheduled_date) ?? 0;

        remainingCapacityByDate.set(
            appointment.scheduled_date,
            remainingCapacity - 1
        );
    }

    const existingDatesByPatient = new Map<string, Set<string>>();
    const existingSameServiceByPatient = new Map<string, Set<string>>();

    for (const appointment of (existingPatientAppointments ??
        []) as ExistingPatientAppointmentRow[]) {
        if (!appointment.patient_id) {
            continue;
        }

        const existingDates =
            existingDatesByPatient.get(appointment.patient_id) ?? new Set<string>();
        existingDates.add(appointment.scheduled_date);
        existingDatesByPatient.set(appointment.patient_id, existingDates);

        if (appointment.service_id === serviceId) {
            const sameServiceDates =
                existingSameServiceByPatient.get(appointment.patient_id) ??
                new Set<string>();
            sameServiceDates.add(appointment.scheduled_date);
            existingSameServiceByPatient.set(
                appointment.patient_id,
                sameServiceDates
            );
        }
    }

    let skippedDuplicateCount = 0;
    const patientsToSchedule: PatientRow[] = [];

    for (const patient of patientRows) {
        const sameServiceDates = existingSameServiceByPatient.get(patient.id);
        const alreadyHasSameService = Array.from(sameServiceDates ?? []).some(
            (dateValue) => allowedDateSet.has(dateValue)
        );

        if (alreadyHasSameService) {
            skippedDuplicateCount += 1;
            continue;
        }

        patientsToSchedule.push(patient);
    }

    const availableSlotCount = Array.from(remainingCapacityByDate.values()).reduce(
        (total, remainingCapacity) => total + Math.max(0, remainingCapacity),
        0
    );

    if (patientsToSchedule.length > availableSlotCount) {
        const patientsLabel = formatCountLabel(
            patientsToSchedule.length,
            "utente selecionado",
            "utentes selecionados"
        );
        const slotsLabel = formatCountLabel(
            availableSlotCount,
            "vaga disponível",
            "vagas disponíveis"
        );

        return {
            status: "error",
            message: capacityScope.isGrouped
                ? `Tens ${patientsLabel} para marcar, mas só há ${slotsLabel} nos dias escolhidos, contando S. Francisco e Sto António em conjunto. Aumenta o intervalo, aumenta os utentes por dia, ou tira utentes da seleção. Nada foi criado.`
                : `Tens ${patientsLabel} para marcar, mas só há ${slotsLabel} nos dias escolhidos. Aumenta o intervalo, aumenta os utentes por dia, ou tira utentes da seleção. Nada foi criado.`,
        };
    }

    const auditProfileId = await getExistingProfileId(supabase, user.id);

    function tryCreateAppointmentForDate(patient: PatientRow, dateValue: string) {
        const remainingCapacity = remainingCapacityByDate.get(dateValue) ?? 0;

        if (remainingCapacity <= 0) {
            return false;
        }

        remainingCapacityByDate.set(dateValue, remainingCapacity - 1);

        appointmentsToCreate.push({
            organization_id: organizationId,
            employee_id: employeeId || null,
            patient_id: patient.id,
            service_id: serviceId,
            scheduled_date: dateValue,
            start_time: technicalStartTimeWithSeconds,
            end_time: technicalEndTimeWithSeconds,
            status: "planned",
            notes: "Agendamento mensal",
            ...(auditProfileId ? { created_by: auditProfileId } : {}),
        });

        return true;
    }

    const patientsForFallback: PatientRow[] = [];

    for (const patient of patientsToSchedule) {
        const existingDates = Array.from(
            existingDatesByPatient.get(patient.id) ?? []
        )
            .filter((dateValue) => allowedDateSet.has(dateValue))
            .sort();
        const grouped = existingDates.some((dateValue) =>
            tryCreateAppointmentForDate(patient, dateValue)
        );

        if (!grouped) {
            patientsForFallback.push(patient);
        }
    }

    for (const patient of patientsForFallback) {
        const scheduled = allowedDateOrder.some((dateValue) =>
            tryCreateAppointmentForDate(patient, dateValue)
        );

        if (!scheduled) {
            return {
                status: "error",
                message: capacityScope.isGrouped
                    ? `Não há capacidade diária para ${patient.name} nos dias escolhidos, contando S. Francisco e Sto António em conjunto. Nada foi criado.`
                    : `Não há capacidade diária para ${patient.name} nos dias escolhidos. Nada foi criado.`,
            };
        }
    }

    if (appointmentsToCreate.length === 0) {
        return {
            status: "success",
            message:
                skippedDuplicateCount > 0
                    ? `${skippedDuplicateCount} marcações já existiam; não criei duplicados.`
                    : "Não havia marcações novas para criar.",
        };
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
        message:
            skippedDuplicateCount > 0
                ? `${appointmentsToCreate.length} marcações criadas com sucesso. ${skippedDuplicateCount} já existiam e foram ignoradas.`
                : `${appointmentsToCreate.length} marcações criadas com sucesso.`,
    };
}
