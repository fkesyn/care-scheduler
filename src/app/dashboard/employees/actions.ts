"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type CreateEmployeeState = {
    status: "idle" | "success" | "error";
    message?: string;
    fieldErrors?: {
        name?: string;
        role?: string;
    };
};

export type UpdateEmployeeState = CreateEmployeeState;

export type DeleteEmployeeState = {
    status: "idle" | "success" | "error";
    message?: string;
};

const allowedRoles = new Set(["nurse", "assistant", "caregiver", "other"]);
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createEmployee(
    _previousState: CreateEmployeeState,
    formData: FormData
): Promise<CreateEmployeeState> {
    const name = String(formData.get("name") ?? "").trim();
    const role = String(formData.get("role") ?? "assistant").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const professionalLicenseNumber = String(
        formData.get("professional_license_number") ?? ""
    ).trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const active = formData.get("active") === "on";

    const fieldErrors: CreateEmployeeState["fieldErrors"] = {};

    if (!name) {
        fieldErrors.name = "O nome é obrigatório.";
    }

    if (!allowedRoles.has(role)) {
        fieldErrors.role = "Escolhe uma categoria válida.";
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

    const { error } = await supabase.rpc("create_employee", {
        p_name: name,
        p_role: role,
        p_phone: phone || null,
        p_email: email || null,
        p_professional_license_number: professionalLicenseNumber || null,
        p_notes: notes || null,
        p_active: active,
    });

    if (error) {
        return {
            status: "error",
            message: `Não consegui criar a pessoa: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard/calendar");

    return {
        status: "success",
        message: `"${name}" adicionado à equipa.`,
    };
}

export async function updateEmployee(
    _previousState: UpdateEmployeeState,
    formData: FormData
): Promise<UpdateEmployeeState> {
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const role = String(formData.get("role") ?? "assistant").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const professionalLicenseNumber = String(
        formData.get("professional_license_number") ?? ""
    ).trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const active = formData.get("active") === "on";

    const fieldErrors: UpdateEmployeeState["fieldErrors"] = {};

    if (!uuidPattern.test(id)) {
        return {
            status: "error",
            message: "Pessoa inválida.",
        };
    }

    if (!name) {
        fieldErrors.name = "O nome é obrigatório.";
    }

    if (!allowedRoles.has(role)) {
        fieldErrors.role = "Escolhe uma categoria válida.";
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
        .from("employees")
        .update({
            name,
            role,
            phone: phone || null,
            email: email || null,
            professional_license_number: professionalLicenseNumber || null,
            notes: notes || null,
            active,
        })
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui atualizar a pessoa: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: `"${name}" atualizado.`,
    };
}

export async function deleteEmployee(
    _previousState: DeleteEmployeeState,
    formData: FormData
): Promise<DeleteEmployeeState> {
    const id = String(formData.get("id") ?? "").trim();

    if (!uuidPattern.test(id)) {
        return {
            status: "error",
            message: "Pessoa inválida.",
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
        .from("employees")
        .delete()
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        return {
            status: "error",
            message: `Não consegui apagar a pessoa: ${error.message}`,
        };
    }

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return {
        status: "success",
        message: "Pessoa apagada.",
    };
}
