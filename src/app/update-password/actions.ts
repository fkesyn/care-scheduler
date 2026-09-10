"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type UpdatePasswordState = {
    status: "idle" | "error";
    message?: string;
};

export async function updatePassword(
    _previousState: UpdatePasswordState,
    formData: FormData
): Promise<UpdatePasswordState> {
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirm_password") ?? "");

    if (!password || !confirmPassword) {
        return {
            status: "error",
            message: "Preenche a password nova nos dois campos.",
        };
    }

    if (password.length < 8) {
        return {
            status: "error",
            message: "A password deve ter pelo menos 8 caracteres.",
        };
    }

    if (password !== confirmPassword) {
        return {
            status: "error",
            message: "As passwords não coincidem.",
        };
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return {
            status: "error",
            message: "A sessão expirou. Pede outro link de recuperação.",
        };
    }

    const { error } = await supabase.auth.updateUser({
        password,
    });

    if (error) {
        return {
            status: "error",
            message: `Não consegui atualizar a password: ${error.message}`,
        };
    }

    revalidatePath("/", "layout");
    redirect("/dashboard/locations");
}
