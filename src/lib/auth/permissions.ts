import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "viewer";

const defaultAdminEmails = [
    "fabio.gomes.mota@gmail.com",
    "sfpsclaro@hotmail.com"
];

function normalizeEmail(email: string | null | undefined) {
    return email?.trim().toLowerCase() ?? "";
}

function getAdminEmails() {
    const configuredEmails =
        process.env.CARE_SCHEDULER_ADMIN_EMAILS ??
        process.env.ADMIN_EMAILS ??
        "";
    const configuredAdminEmails = configuredEmails
        .split(",")
        .map((email) => normalizeEmail(email))
        .filter(Boolean);

    return new Set([...defaultAdminEmails, ...configuredAdminEmails]);
}

function isAdminEmail(email: string | null | undefined) {
    return getAdminEmails().has(normalizeEmail(email));
}

export function canManageData(role: UserRole) {
    return role === "admin";
}

export function canEditAppointments(role: UserRole) {
    return role === "admin" || role === "viewer";
}

export async function getCurrentUserRole(): Promise<UserRole> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (isAdminEmail(user?.email)) {
        return "admin";
    }

    const { data, error } = await supabase.rpc("current_user_role");

    if (!error && data === "admin") {
        return "admin";
    }

    return "viewer";
}
