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
        appointmentStatus?: string;
    };
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const appointmentStatuses = new Set(["planned", "completed", "canceled"]);

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
    const appointmentStatus = String(formData.get("status") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    const fieldErrors: UpdateAppointmentState["fieldErrors"] = {};

    if (!uuidPattern.test(appointmentId)) {
        fieldErrors.appointmentId = "Marcação inválida.";
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

    const { error } = await supabase
        .from("appointments")
        .update({
            status: appointmentStatus,
            notes: notes || null,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
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
