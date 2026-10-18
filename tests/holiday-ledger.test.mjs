import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const org = '10000000-0000-4000-8000-000000000001';
const otherOrg = '10000000-0000-4000-8000-000000000002';
const nurse = '20000000-0000-4000-8000-000000000001';
const otherNurse = '20000000-0000-4000-8000-000000000002';
const schedule = '30000000-0000-4000-8000-000000000001';
const nextSchedule = '30000000-0000-4000-8000-000000000002';
const work = '40000000-0000-4000-8000-000000000001';
const ff = '40000000-0000-4000-8000-000000000002';
const off = '40000000-0000-4000-8000-000000000003';
const holidays = JSON.stringify([{ holiday_date: '2026-10-05', name: 'Implantação da República' }, { holiday_date: '2026-10-10', name: 'Feriado de teste ao sábado' }]);

async function setup() {
    const db = new PGlite();
    await db.exec(`
        create role authenticated; create role anon;
        create function public.my_organization_id() returns uuid language sql as $$ select current_setting('test.organization')::uuid $$;
        create function public.is_admin_user() returns boolean language sql as $$ select current_setting('test.admin')::boolean $$;
        create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
        create table public.organizations(id uuid primary key);
        create table public.employees(id uuid primary key, organization_id uuid, role text, name text);
        create table public.monthly_schedules(id uuid primary key, organization_id uuid, month date);
        create table public.shift_types(id uuid primary key, code text);
        create table public.schedule_entries(id uuid primary key default gen_random_uuid(), schedule_id uuid, employee_id uuid, work_date date, shift_type_id uuid);
        insert into public.organizations values ('${org}'), ('${otherOrg}');
        insert into public.employees values ('${nurse}', '${org}', 'nurse', 'Susana'), ('${otherNurse}', '${otherOrg}', 'nurse', 'Outra organização');
        insert into public.monthly_schedules values ('${schedule}', '${org}', '2026-10-01'), ('${nextSchedule}', '${org}', '2026-11-01');
        insert into public.shift_types values ('${work}', 'M'), ('${ff}', 'FF'), ('${off}', 'B');
        create table public.employee_ff_balances(id uuid primary key default gen_random_uuid(), organization_id uuid, employee_id uuid, ff_days integer check(ff_days between 0 and 999), updated_at timestamptz default now(), unique(organization_id, employee_id));
        insert into public.employee_ff_balances(organization_id, employee_id, ff_days) values ('${org}', '${nurse}', 15), ('${otherOrg}', '${otherNurse}', 3);
        set test.organization = '${org}'; set test.admin = 'true';
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20261018100000_employee_holiday_ledger.sql', import.meta.url), 'utf8'));
    return db;
}
async function count(db, where = 'true') {
    return (await db.query(`select count(*)::int n from employee_holidays where organization_id = '${org}' and ${where}`)).rows[0].n;
}
async function balance(db) {
    return (await db.query('select ff_days from employee_ff_balances where employee_id = $1', [nurse])).rows[0].ff_days;
}
async function validate(db, id = schedule) {
    await db.query('select validate_schedule_holidays($1, $2)', [id, holidays]);
}
async function entry(db, date, shift = work, id = schedule) {
    await db.query('insert into schedule_entries(schedule_id, employee_id, work_date, shift_type_id) values ($1,$2,$3,$4)', [id, nurse, date, shift]);
}
async function manual(db, { id = null, employee = nurse, name = 'Manual', date = null, remove = false } = {}) {
    await db.query('select manage_employee_holiday($1,$2,$3,$4,$5,$6)', [id, employee, name, date, '', remove]);
}

test('legacy migration preserves exact balances as individual unknown days', async () => {
    const db = await setup();
    try { assert.equal(await count(db, "source = 'legacy' and holiday_date is null"), 15); assert.equal(await balance(db), 15); }
    finally { await db.close(); }
});

test('credits only on validation, ignores leave, preserves weekend double credit and is idempotent', async () => {
    const db = await setup();
    try {
        await entry(db, '2026-10-05'); await entry(db, '2026-10-10'); await entry(db, '2026-10-11', off);
        assert.equal(await balance(db), 15);
        await validate(db); assert.equal(await balance(db), 18);
        await validate(db); assert.equal(await balance(db), 18);
        assert.equal(await count(db, "source = 'schedule'"), 3);
        await db.query('delete from schedule_entries where work_date = $1', ['2026-10-10']);
        assert.equal(await balance(db), 18);
        await validate(db); assert.equal(await balance(db), 16);
    } finally { await db.close(); }
});

test('FF uses individual days, revalidation does not spend twice, removing FF restores the day', async () => {
    const db = await setup();
    try {
        await entry(db, '2026-10-06', ff); await validate(db);
        assert.equal(await balance(db), 14); assert.equal(await count(db, 'used_date is not null'), 1);
        await validate(db); assert.equal(await balance(db), 14);
        const used = (await db.query('select id from employee_holidays where used_date is not null')).rows[0].id;
        await assert.rejects(manual(db, { id: used, remove: true }), /já foi usado/);
        await db.exec('delete from schedule_entries'); await validate(db);
        assert.equal(await balance(db), 15);
    } finally { await db.close(); }
});

test('insufficient balance rolls back both credits and deductions', async () => {
    const db = await setup();
    try {
        await db.exec(`delete from employee_holidays where organization_id = '${org}'`);
        await entry(db, '2026-10-05'); await entry(db, '2026-10-06', ff); await entry(db, '2026-10-07', ff);
        await assert.rejects(validate(db), /Saldo de feriados insuficiente/);
        assert.equal(await count(db), 0);
    } finally { await db.close(); }
});

test('manual create/edit/delete updates balances, identified manual holiday is not credited twice', async () => {
    const db = await setup();
    try {
        await manual(db, { date: '2026-10-05' }); assert.equal(await balance(db), 16);
        const id = (await db.query("select id from employee_holidays where source = 'manual'")).rows[0].id;
        await entry(db, '2026-10-05'); await validate(db); assert.equal(await balance(db), 16);
        await manual(db, { id, name: 'Identificado', date: '2026-10-05' });
        assert.equal((await db.query('select name from employee_holidays where id = $1', [id])).rows[0].name, 'Identificado');
        await manual(db, { id, remove: true }); assert.equal(await balance(db), 15);
    } finally { await db.close(); }
});

test('cannot reverse a credit already spent in another month', async () => {
    const db = await setup();
    try {
        await db.exec(`delete from employee_holidays where organization_id = '${org}'`);
        await entry(db, '2026-10-05'); await validate(db);
        await entry(db, '2026-11-02', ff, nextSchedule); await validate(db, nextSchedule);
        await db.query('delete from schedule_entries where schedule_id = $1', [schedule]);
        await assert.rejects(validate(db), /já foi usado noutro mês/);
        assert.equal(await count(db, 'used_date is not null'), 1); assert.equal(await balance(db), 0);
    } finally { await db.close(); }
});

test('RPCs reject viewers and cross-organization records', async () => {
    const db = await setup();
    try {
        await db.exec("set test.admin = 'false'");
        await assert.rejects(manual(db), /Sem permissão/); await assert.rejects(validate(db), /Sem permissão/);
        await db.exec("set test.admin = 'true'");
        await assert.rejects(manual(db, { employee: otherNurse }), /Enfermeiro inválido/);
        const otherId = (await db.query('select id from employee_holidays where employee_id = $1 limit 1', [otherNurse])).rows[0].id;
        await assert.rejects(manual(db, { id: otherId, remove: true }), /não encontrado/);
        await db.exec(`set test.organization = '${otherOrg}'`);
        await assert.rejects(validate(db), /Horário inválido/);
    } finally { await db.close(); }
});

test('row security isolates reads and blocks direct ledger writes', async () => {
    const db = await setup();
    try {
        await db.exec('grant usage on schema public to authenticated; grant select on employee_holidays to authenticated; set role authenticated;');
        assert.equal((await db.query('select count(*)::int n from employee_holidays')).rows[0].n, 15);
        await assert.rejects(db.exec('delete from employee_holidays'), /permission denied/);
        await manual(db); // Authorized mutation still works through the secured RPC.
        assert.equal((await db.query('select count(*)::int n from employee_holidays')).rows[0].n, 16);
        await db.exec(`set test.organization = '${otherOrg}'`);
        assert.equal((await db.query('select count(*)::int n from employee_holidays')).rows[0].n, 3);
    } finally { await db.close(); }
});

test('future credits cannot pay an earlier FF day', async () => {
    const db = await setup();
    try {
        await db.exec(`delete from employee_holidays where organization_id = '${org}'`);
        await entry(db, '2026-10-01', ff); await entry(db, '2026-10-05');
        await assert.rejects(validate(db), /Saldo de feriados insuficiente/);
        assert.equal(await count(db), 0);
    } finally { await db.close(); }
});
