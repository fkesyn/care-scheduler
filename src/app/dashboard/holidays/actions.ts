"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageData, getCurrentUserRole } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export type HolidayActionState = { status: "idle" | "success" | "error"; message?: string };
const schema = z.object({
    id: z.union([z.uuid(), z.literal("")]),
    employee_id: z.uuid(),
    name: z.string().trim().min(1).max(200),
    holiday_date: z.union([z.iso.date(), z.literal("")]),
    notes: z.string().trim().max(2000),
});

export async function saveHoliday(_previous: HolidayActionState, formData: FormData): Promise<HolidayActionState> {
    if (!canManageData(await getCurrentUserRole())) return { status: "error", message: "Sem permissão para gerir feriados." };
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { status: "error", message: "Confirma o enfermeiro, a designação e a data do feriado." };
    const input = parsed.data;
    const deleting = formData.get("operation") === "delete";
    if (deleting && !input.id) return { status: "error", message: "Feriado inválido." };
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: "error", message: "Inicia sessão novamente." };
    const { error } = await supabase.rpc("manage_employee_holiday", {
        p_id: input.id || null, p_employee: input.employee_id,
        p_name: input.name, p_date: input.holiday_date || null,
        p_notes: input.notes, p_delete: deleting,
    });
    if (error) return { status: "error", message: `Não consegui guardar: ${error.message}` };
    revalidatePath("/dashboard/holidays");
    revalidatePath("/dashboard/schedules", "layout");
    return { status: "success", message: deleting ? "Feriado apagado." : "Feriado guardado." };
}
