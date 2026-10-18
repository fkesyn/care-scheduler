"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { PublicHoliday } from "@/lib/holidays/get-holiday-for-date";
import { saveHoliday, type HolidayActionState } from "./actions";

export type EmployeeHoliday = {
    id: string; employee_id: string; name: string; holiday_date: string | null;
    notes: string; source: "manual" | "legacy" | "schedule"; source_date: string | null;
    source_unit: number; used_date: string | null; used_schedule_id: string | null;
};
type Employee = { id: string; name: string };
const selectClass = "h-9 rounded-md border border-input bg-background px-3 text-sm";
const dateLabel = (value: string | null) => value ? value.split("-").reverse().join("/") : "Origem desconhecida";

function HolidayForm({ employees, record, employeeId, onDone }: { employees: Employee[]; record?: EmployeeHoliday; employeeId: string; onDone: () => void }) {
    const [state, action, pending] = useActionState(saveHoliday, { status: "idle" } as HolidayActionState);
    if (state.status === "success") return <div className="flex flex-col gap-4">
        <p role="status" className="text-sm">{state.message}</p>
        <Button onClick={onDone}>Concluir</Button>
    </div>;
    return <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={record?.id ?? ""} />
        <Label>Enfermeiro
            <select name="employee_id" required defaultValue={record?.employee_id ?? employeeId} className={selectClass} disabled={pending}>
                <option value="">Selecionar enfermeiro</option>
                {employees.filter(e => !record || e.id === record.employee_id).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
        </Label>
        <Label>Designação<Input name="name" required maxLength={200} defaultValue={record?.name ?? "Feriado de origem desconhecida"} /></Label>
        <Label>Data do feriado (opcional)<Input name="holiday_date" type="date" defaultValue={record?.holiday_date ?? ""} /></Label>
        <Label>Notas<Input name="notes" maxLength={2000} defaultValue={record?.notes ?? ""} /></Label>
        <p className="text-xs text-muted-foreground">Cada registo corresponde a um dia de compensação. Deixa a data vazia se não souberes a origem.</p>
        {record?.used_date && <p className="text-sm">Usado em {dateLabel(record.used_date)}. Podes corrigir a identificação; o desconto mantém-se associado.</p>}
        {state.message && <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-destructive" : "text-sm"}>{state.message}</p>}
        <div className="flex gap-2">
            <Button type="submit" name="operation" value="save" disabled={pending}>{pending ? "A guardar…" : "Guardar"}</Button>
            {record && !record.used_date && <Button type="submit" name="operation" value="delete" variant="destructive" disabled={pending}
                onClick={event => { if (!window.confirm("Apagar este dia de compensação?")) event.preventDefault(); }}>Apagar</Button>}
        </div>
    </form>;
}

function HolidayEditor(props: { employees: Employee[]; record?: EmployeeHoliday; employeeId: string }) {
    const [open, setOpen] = useState(false);
    return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant={props.record ? "outline" : "default"}>{props.record ? "Editar" : "Associar feriado"}</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>{props.record ? "Editar feriado" : "Associar feriado ao enfermeiro"}</DialogTitle></DialogHeader>
            <HolidayForm {...props} onDone={() => setOpen(false)} />
        </DialogContent></Dialog>;
}

export function HolidayManager({ year, initialEmployee, employees, holidays, records, canManage }: {
    year: number; initialEmployee: string; employees: Employee[]; holidays: PublicHoliday[];
    records: EmployeeHoliday[]; canManage: boolean;
}) {
    const [employeeId, setEmployeeId] = useState(initialEmployee);
    const [allYears, setAllYears] = useState(false);
    const [status, setStatus] = useState("all");
    const employeeNames = new Map(employees.map(e => [e.id, e.name]));
    const selected = records.filter(r => !employeeId || r.employee_id === employeeId);
    const visible = selected.filter(r => (allYears || !r.holiday_date || r.holiday_date.startsWith(`${year}-`)) &&
        (status === "all" || (status === "available" ? !r.used_date : !!r.used_date)));
    return <>
        <div className="flex flex-wrap items-end gap-4">
            <form className="flex items-end gap-2" method="get">
                <Label>Ano<Input name="year" type="number" min={2000} max={2100} defaultValue={year} className="w-28" /></Label>
                <input name="employee" type="hidden" value={employeeId} /><Button variant="outline">Ver ano</Button>
            </form>
            <Label>Enfermeiro<select className={selectClass} value={employeeId} onChange={e => setEmployeeId(e.target.value)}>
                <option value="">Todos os enfermeiros</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select></Label>
            {canManage && <HolidayEditor employees={employees} employeeId={employeeId} />}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">{[
            ["Dias associados", selected.length], ["Disponíveis", selected.filter(r => !r.used_date).length], ["Usados", selected.filter(r => r.used_date).length],
        ].map(([label, count]) => <div className="rounded-lg border p-4" key={label}><p className="text-sm text-muted-foreground">{label} · todos os anos</p><p className="mt-1 text-2xl font-semibold">{count}</p></div>)}</div>
        <section className="rounded-lg border p-4"><h2 className="mb-3 font-semibold">Feriados de {year}</h2>
            <p className="mb-3 text-xs text-muted-foreground">Associações confirmadas na validação ou registadas manualmente. Feriados ao fim de semana mantêm a regra existente de dois dias de compensação.</p>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Data</th><th className="p-2">Feriado</th><th className="p-2">Enfermeiros associados</th></tr></thead>
                <tbody>{holidays.map(h => {
                    const ids = [...new Set(selected.filter(r => r.holiday_date === h.holiday_date).map(r => r.employee_id))];
                    return <tr className="border-b last:border-0" key={h.holiday_date}><td className="p-2 whitespace-nowrap">{dateLabel(h.holiday_date)}</td><td className="p-2">{h.name}</td><td className="p-2">{ids.map(id => employeeNames.get(id) ?? "Enfermeiro").join(", ") || "Sem associações confirmadas"}</td></tr>;
                })}</tbody></table></div>
        </section>
        <section className="rounded-lg border p-4"><div className="mb-4 flex flex-wrap items-center gap-4"><h2 className="font-semibold">Registos por enfermeiro</h2>
            <Label className="font-normal"><input type="checkbox" checked={allYears} onChange={e => setAllYears(e.target.checked)} /> Todos os anos</Label>
            <select aria-label="Estado do feriado" value={status} className={selectClass} onChange={e => setStatus(e.target.value)}><option value="all">Todos os estados</option><option value="available">Disponíveis</option><option value="used">Usados</option></select>
        </div><p className="mb-3 text-xs text-muted-foreground">Os registos de origem desconhecida aparecem em qualquer ano.</p>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b">{["Enfermeiro", "Feriado", "Data", "Estado", "Origem", ""].map((h, i) => <th className="p-2" key={i}>{h}</th>)}</tr></thead>
                <tbody>{visible.map(r => <tr className="border-b last:border-0" key={r.id}>
                    <td className="p-2">{employeeNames.get(r.employee_id) ?? "Enfermeiro"}</td><td className="p-2">{r.name}{r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}</td>
                    <td className="p-2 whitespace-nowrap">{dateLabel(r.holiday_date)}</td><td className="p-2">{r.used_date ? <Link className="underline" href={`/dashboard/schedules/${r.used_schedule_id}`}>Usado em {dateLabel(r.used_date)}</Link> : "Disponível"}</td>
                    <td className="p-2">{r.source === "legacy" ? "Saldo anterior" : r.source === "schedule" ? `Horário validado${r.source_unit === 2 ? " · 2.º dia" : ""}` : "Manual"}</td>
                    <td className="p-2">{canManage && <HolidayEditor employees={employees} employeeId={r.employee_id} record={r} />}</td>
                </tr>)}</tbody></table></div>
            {visible.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Sem feriados para estes filtros.</p>}
        </section>
    </>;
}
