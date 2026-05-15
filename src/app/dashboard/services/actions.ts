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

export async function createService(
    _previousState: CreateServiceState,
    formData: FormData
): Promise<CreateServiceState> {
    const name = String(formData.get("name") ?? "").trim();
    const durationMinutes = Number(formData.get("duration_minutes") ?? 30);
    const color = String(formData.get("color") ?? "#0f766e").trim();
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
        p_color: color,
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
