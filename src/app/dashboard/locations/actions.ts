"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type CreateLocationState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        name?: string;
    };
};

export async function createLocation(
    _previousState: CreateLocationState,
    formData: FormData
): Promise<CreateLocationState> {
    const name = String(formData.get("name") ?? "").trim();
    const active = formData.get("active") === "on";

    if (!name) {
        return {
            status: "error",
            message: "Preenche o nome do local.",
            fieldErrors: {
                name: "O nome do local é obrigatório.",
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
            message:
                "Não consegui encontrar a organização deste utilizador. Confirma a ligação do user à organização.",
        };
    }

    const { error } = await supabase.from("locations").insert({
        organization_id: organizationId,
        name,
        active,
    });

    if (error) {
        return {
            status: "error",
            message: `Não consegui criar o local: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/locations");

    return {
        status: "success",
        message: `Local "${name}" criado.`,
    };
}
