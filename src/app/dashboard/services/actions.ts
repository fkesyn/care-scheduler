"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type CreateServiceState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        name?: string;
        durationMinutes?: string;
    };
};

export type UpdateServiceState = CreateServiceState;

export type DeleteServiceState = {
    status: "idle" | "success" | "error";
    message?: string;
};

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedMeasurementTypes = new Set([
    "",
    "blood_pressure",
    "glucose",
    "wound_care",
]);
const defaultServiceColor = "#0f766e";

export async function createService(
    _previousState: CreateServiceState,
    formData: FormData
): Promise<CreateServiceState> {
    const name = String(formData.get("name") ?? "").trim();
    const durationMinutes = Number(formData.get("duration_minutes") ?? 30);
    const measurementType = String(formData.get("measurement_type") ?? "").trim();
    const active = formData.get("active") === "on";

    const fieldErrors: CreateServiceState["fieldErrors"] = {};

    if (!name) {
        fieldErrors.name = "O nome do serviço é obrigatório.";
    }

    if (
        !Number.isInteger(durationMinutes) ||
        durationMinutes <= 0 ||
        durationMinutes > 480
    ) {
        fieldErrors.durationMinutes = "A duração deve estar entre 1 e 480 minutos.";
    }

    if (!allowedMeasurementTypes.has(measurementType)) {
        return {
            status: "error",
            message: "Escolhe um tipo de registo válido.",
        };
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

    const { error } = await supabase.rpc("create_service", {
        p_name: name,
        p_duration_minutes: durationMinutes,
        p_color: defaultServiceColor,
        p_measurement_type: measurementType || null,
        p_active: active,
    });

    if (error) {
        return {
            status: "error",
            message: `Não consegui criar o serviço: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/services");

    return {
        status: "success",
        message: `Serviço "${name}" criado.`,
    };
}

export async function updateService(
    _previousState: UpdateServiceState,
    formData: FormData
): Promise<UpdateServiceState> {
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const durationMinutes = Number(formData.get("duration_minutes") ?? 30);
    const measurementType = String(formData.get("measurement_type") ?? "").trim();
    const active = formData.get("active") === "on";

    const fieldErrors: UpdateServiceState["fieldErrors"] = {};

    if (!uuidPattern.test(id)) {
        return {
            status: "error",
            message: "Serviço inválido.",
        };
    }

    if (!name) {
        fieldErrors.name = "O nome do serviço é obrigatório.";
    }

    if (
        !Number.isInteger(durationMinutes) ||
        durationMinutes <= 0 ||
        durationMinutes > 480
    ) {
        fieldErrors.durationMinutes = "A duração deve estar entre 1 e 480 minutos.";
    }

    if (!allowedMeasurementTypes.has(measurementType)) {
        return {
            status: "error",
            message: "Escolhe um tipo de registo válido.",
        };
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
        .from("services")
        .update({
            name,
            duration_minutes: durationMinutes,
            measurement_type: measurementType || null,
            active,
        })
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui atualizar o serviço: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: `Serviço "${name}" atualizado.`,
    };
}

export async function deleteService(
    _previousState: DeleteServiceState,
    formData: FormData
): Promise<DeleteServiceState> {
    const id = String(formData.get("id") ?? "").trim();

    if (!uuidPattern.test(id)) {
        return {
            status: "error",
            message: "Serviço inválido.",
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

    const { error: appointmentsError } = await supabase
        .from("appointments")
        .delete()
        .eq("service_id", id);

    if (appointmentsError) {
        return {
            status: "error",
            message: `Não consegui apagar as marcações deste serviço: ${appointmentsError.message}`,
        };
    }

    const { error } = await supabase
        .from("services")
        .delete()
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui apagar o serviço: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: "Serviço e marcações associadas apagados.",
    };
}
