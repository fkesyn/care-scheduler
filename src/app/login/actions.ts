"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type LoginState = {
    status: "idle" | "error";
    message?: string;
};

export type EmailAuthState = {
    status: "idle" | "success" | "error";
    message?: string;
};

function safeRedirectPath(value: FormDataEntryValue | null) {
    const path = String(value ?? "/dashboard/locations");

    if (!path.startsWith("/") || path.startsWith("//")) {
        return "/dashboard/locations";
    }

    return path;
}

async function getRequestOrigin() {
    const headerStore = await headers();
    const forwardedHost = headerStore.get("x-forwarded-host");
    const host = forwardedHost ?? headerStore.get("host");
    const forwardedProto = headerStore.get("x-forwarded-proto");

    if (host) {
        const protocol =
            forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");

        return `${protocol}://${host}`;
    }

    return (
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
        "http://localhost:3000"
    );
}

async function buildAuthCallbackUrl(next: string) {
    const origin = await getRequestOrigin();
    const url = new URL("/auth/callback", origin);
    url.searchParams.set("next", next);

    return url.toString();
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

export async function sendMagicLink(
    _previousState: EmailAuthState,
    formData: FormData
): Promise<EmailAuthState> {
    const email = String(formData.get("email") ?? "").trim();
    const next = safeRedirectPath(formData.get("next"));

    if (!email) {
        return {
            status: "error",
            message: "Escreve o email para receber o link.",
        };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
            emailRedirectTo: await buildAuthCallbackUrl(next),
        },
    });

    if (error) {
        return {
            status: "error",
            message: `Não consegui enviar o magic link: ${error.message}`,
        };
    }

    return {
        status: "success",
        message: "Magic link enviado. Confirma o teu email.",
    };
}

export async function sendPasswordReset(
    _previousState: EmailAuthState,
    formData: FormData
): Promise<EmailAuthState> {
    const email = String(formData.get("email") ?? "").trim();

    if (!email) {
        return {
            status: "error",
            message: "Escreve o email para recuperar a password.",
        };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: await buildAuthCallbackUrl("/update-password"),
    });

    if (error) {
        return {
            status: "error",
            message: `Não consegui enviar o email de recuperação: ${error.message}`,
        };
    }

    return {
        status: "success",
        message: "Email de recuperação enviado. Confirma a tua caixa de entrada.",
    };
}

export async function logout() {
    const supabase = await createClient();

    await supabase.auth.signOut();

    revalidatePath("/", "layout");
    redirect("/login");
}
