"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type LoginState = {
    status: "idle" | "error";
    message?: string;
};

function safeRedirectPath(value: FormDataEntryValue | null) {
    const path = String(value ?? "/dashboard/locations");

    if (!path.startsWith("/") || path.startsWith("//")) {
        return "/dashboard/locations";
    }

    return path;
}

export async function login(
    _previousState: LoginState,
    formData: FormData
): Promise<LoginState> {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const next = safeRedirectPath(formData.get("next"));

    if (!email || !password) {
        return {
            status: "error",
            message: "Preenche o email e a password.",
        };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return {
            status: "error",
            message: "Login falhou. Confirma o email e a password.",
        };
    }

    revalidatePath("/", "layout");
    redirect(next);
}

export async function logout() {
    const supabase = await createClient();

    await supabase.auth.signOut();

    revalidatePath("/", "layout");
    redirect("/login");
}
