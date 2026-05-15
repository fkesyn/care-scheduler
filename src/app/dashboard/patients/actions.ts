"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type CreatePatientState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        name?: string;
        locationId?: string;
    };
};

export async function createPatient(
    _previousState: CreatePatientState,
    formData: FormData
): Promise<CreatePatientState> {
    const name = String(formData.get("name") ?? "").trim();
    const locationId = String(formData.get("location_id") ?? "").trim();
    const room = String(formData.get("room") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const isDiabetic = formData.get("is_diabetic") === "on";
    const active = formData.get("active") === "on";

    const fieldErrors: CreatePatientState["fieldErrors"] = {};

    if (!name) {
        fieldErrors.name = "O nome do utente é obrigatório.";
    }

    if (!locationId) {
        fieldErrors.locationId = "Escolhe um local.";
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

    const { error } = await supabase.rpc("create_patient", {
        p_name: name,
        p_location_id: locationId,
        p_room: room || null,
        p_notes: notes || null,
        p_is_diabetic: isDiabetic,
        p_active: active,
    });

    if (error) {
        return {
            status: "error",
            message: `Não consegui criar o utente: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/patients");

    return {
        status: "success",
        message: `Utente "${name}" criado.`,
    };
}
