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

export type UpdatePatientState = CreatePatientState;

export type DeletePatientState = {
    status: "idle" | "success" | "error";
    message?: string;
};

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export async function updatePatient(
    _previousState: UpdatePatientState,
    formData: FormData
): Promise<UpdatePatientState> {
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const locationId = String(formData.get("location_id") ?? "").trim();
    const room = String(formData.get("room") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const isDiabetic = formData.get("is_diabetic") === "on";
    const active = formData.get("active") === "on";

    const fieldErrors: UpdatePatientState["fieldErrors"] = {};

    if (!uuidPattern.test(id)) {
        return {
            status: "error",
            message: "Utente inválido.",
        };
    }

    if (!name) {
        fieldErrors.name = "O nome do utente é obrigatório.";
    }

    if (!uuidPattern.test(locationId)) {
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

    const { error } = await supabase
        .from("patients")
        .update({
            name,
            location_id: locationId,
            room: room || null,
            notes: notes || null,
            is_diabetic: isDiabetic,
            active,
        })
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui atualizar o utente: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/patients");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: `Utente "${name}" atualizado.`,
    };
}

export async function deletePatient(
    _previousState: DeletePatientState,
    formData: FormData
): Promise<DeletePatientState> {
    const id = String(formData.get("id") ?? "").trim();

    if (!uuidPattern.test(id)) {
        return {
            status: "error",
            message: "Utente inválido.",
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
        .eq("patient_id", id);

    if (appointmentsError) {
        return {
            status: "error",
            message: `Não consegui apagar as marcações deste utente: ${appointmentsError.message}`,
        };
    }

    const { error } = await supabase
        .from("patients")
        .delete()
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui apagar o utente: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/patients");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: "Utente e marcações associadas apagados.",
    };
}
