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

export type UpdateLocationState = CreateLocationState;

export type DeleteLocationState = {
    status: "idle" | "success" | "error";
    message?: string;
};

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export async function updateLocation(
    _previousState: UpdateLocationState,
    formData: FormData
): Promise<UpdateLocationState> {
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const active = formData.get("active") === "on";

    if (!uuidPattern.test(id)) {
        return {
            status: "error",
            message: "Local inválido.",
        };
    }

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

    const { error } = await supabase
        .from("locations")
        .update({ name, active })
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui atualizar o local: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/locations");
    revalidatePath("/dashboard/patients");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: `Local "${name}" atualizado.`,
    };
}

export async function deleteLocation(
    _previousState: DeleteLocationState,
    formData: FormData
): Promise<DeleteLocationState> {
    const id = String(formData.get("id") ?? "").trim();

    if (!uuidPattern.test(id)) {
        return {
            status: "error",
            message: "Local inválido.",
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
        .from("locations")
        .delete()
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui apagar o local: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/locations");
    revalidatePath("/dashboard/patients");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: "Local apagado.",
    };
}
