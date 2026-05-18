import { revalidatePath } from "next/cache";
import { inflateRawSync } from "node:zlib";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CellValue = string;

type ParsedRow = {
    rowNumber: number;
    values: Record<string, string>;
};

type Patient = {
    id: string;
    name: string;
    location_id: string | null;
    patient_number: string | null;
    is_diabetic: boolean | null;
    active: boolean | null;
};

type Service = {
    id: string;
    name: string;
    measurement_type: string | null;
    active: boolean | null;
};

type Employee = {
    id: string;
    name: string;
    active: boolean | null;
};

type Location = {
    id: string;
    name: string;
    active: boolean | null;
};

type ExistingAppointment = {
    id: string;
    scheduled_date: string;
    status: string;
    notes: string | null;
    employee_id: string | null;
    patient_id: string | null;
    service_id: string | null;
};

type ImportOperation = "apagar" | "atualizar" | "criar" | "manter";

type ImportIntent = {
    rowNumber: number;
    operation: ImportOperation;
    appointmentId: string | null;
    scheduledDate: string;
    status: string;
    patientId: string;
    serviceId: string;
    employeeId: string | null;
    notes: string | null;
};

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validStatuses = new Set(["planned", "completed", "canceled"]);
const technicalStartTimeWithSeconds = "00:00:00";
const technicalEndTimeWithSeconds = "00:01:00";

function jsonResponse(data: unknown, status = 200) {
    return Response.json(data, { status });
}

function normalizeText(value: string | null | undefined) {
    return String(value ?? "").trim();
}

function normalizeKey(value: string | null | undefined) {
    return normalizeText(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function decodeXml(value: string) {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/_x000D_/g, "\n");
}

function getAttribute(tag: string, name: string) {
    const match = tag.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "i"));
    return match ? decodeXml(match[1]) : null;
}

function findEndOfCentralDirectory(buffer: Buffer) {
    const minOffset = Math.max(0, buffer.length - 65557);

    for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
        if (buffer.readUInt32LE(offset) === 0x06054b50) {
            return offset;
        }
    }

    throw new Error("Ficheiro XLSX inválido.");
}

function readZipEntries(buffer: Buffer) {
    const entries = new Map<string, Buffer>();
    const endOffset = findEndOfCentralDirectory(buffer);
    const entryCount = buffer.readUInt16LE(endOffset + 10);
    const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
    let offset = centralDirectoryOffset;

    for (let index = 0; index < entryCount; index += 1) {
        if (buffer.readUInt32LE(offset) !== 0x02014b50) {
            throw new Error("Diretório XLSX inválido.");
        }

        const compressionMethod = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const fileNameLength = buffer.readUInt16LE(offset + 28);
        const extraLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localHeaderOffset = buffer.readUInt32LE(offset + 42);
        const fileName = buffer
            .subarray(offset + 46, offset + 46 + fileNameLength)
            .toString("utf8");

        if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
            throw new Error(`Entrada XLSX inválida: ${fileName}`);
        }

        const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
        const dataStart =
            localHeaderOffset + 30 + localFileNameLength + localExtraLength;
        const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
        const data =
            compressionMethod === 0
                ? compressedData
                : compressionMethod === 8
                  ? inflateRawSync(compressedData)
                  : null;

        if (!data) {
            throw new Error(`Compressão XLSX não suportada em ${fileName}.`);
        }

        entries.set(fileName.replace(/\\/g, "/"), data);
        offset += 46 + fileNameLength + extraLength + commentLength;
    }

    return entries;
}

function resolveZipPath(basePath: string, target: string) {
    if (target.startsWith("/")) {
        return target.slice(1);
    }

    const parts = basePath.split("/").filter(Boolean);
    const targetParts = target.split("/");

    for (const part of targetParts) {
        if (!part || part === ".") {
            continue;
        }

        if (part === "..") {
            parts.pop();
        } else {
            parts.push(part);
        }
    }

    return parts.join("/");
}

function readSharedStrings(entries: Map<string, Buffer>) {
    const sharedStringsXml = entries.get("xl/sharedStrings.xml");

    if (!sharedStringsXml) {
        return [];
    }

    return Array.from(
        sharedStringsXml
            .toString("utf8")
            .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)
    ).map((match) =>
        Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
            .map((textMatch) => decodeXml(textMatch[1]))
            .join("")
    );
}

function findWorksheetPath(entries: Map<string, Buffer>, sheetName: string) {
    const workbookXml = entries.get("xl/workbook.xml")?.toString("utf8");
    const relsXml = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8");

    if (!workbookXml || !relsXml) {
        throw new Error("Workbook XLSX incompleto.");
    }

    const sheetTag = Array.from(workbookXml.matchAll(/<sheet\b[^>]*>/g)).find(
        (match) => getAttribute(match[0], "name") === sheetName
    );

    if (!sheetTag) {
        throw new Error(`Não encontrei a folha "${sheetName}".`);
    }

    const relationId = getAttribute(sheetTag[0], "r:id");

    if (!relationId) {
        throw new Error(`A folha "${sheetName}" não tem relação XLSX.`);
    }

    const relationshipTag = Array.from(
        relsXml.matchAll(/<Relationship\b[^>]*>/g)
    ).find((match) => getAttribute(match[0], "Id") === relationId);

    if (!relationshipTag) {
        throw new Error(`Não encontrei o ficheiro interno da folha "${sheetName}".`);
    }

    const target = getAttribute(relationshipTag[0], "Target");

    if (!target) {
        throw new Error(`A folha "${sheetName}" não tem destino XLSX.`);
    }

    return resolveZipPath("xl", target);
}

function columnIndex(cellReference: string) {
    const letters = cellReference.match(/[A-Z]+/i)?.[0] ?? "";

    return letters
        .toUpperCase()
        .split("")
        .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}

function cellValue(cellBody: string, type: string | null, sharedStrings: string[]) {
    if (type === "s") {
        const index = Number(cellBody.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? -1);
        return sharedStrings[index] ?? "";
    }

    if (type === "inlineStr") {
        return Array.from(cellBody.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
            .map((match) => decodeXml(match[1]))
            .join("");
    }

    const value = cellBody.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    return value ? decodeXml(value) : "";
}

function readWorksheetRows(
    entries: Map<string, Buffer>,
    worksheetPath: string,
    sharedStrings: string[]
) {
    const worksheetXml = entries.get(worksheetPath)?.toString("utf8");

    if (!worksheetXml) {
        throw new Error("Não consegui abrir a folha Agendamentos.");
    }

    return Array.from(worksheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)).map(
        (rowMatch) => {
            const row: CellValue[] = [];

            for (const cellMatch of rowMatch[1].matchAll(
                /<c\b([^>]*)>([\s\S]*?)<\/c>/g
            )) {
                const attributes = cellMatch[1];
                const ref = getAttribute(attributes, "r");

                if (!ref) {
                    continue;
                }

                row[columnIndex(ref) - 1] = cellValue(
                    cellMatch[2],
                    getAttribute(attributes, "t"),
                    sharedStrings
                );
            }

            return row.map((value) => normalizeText(value));
        }
    );
}

function parseWorkbook(buffer: Buffer): ParsedRow[] {
    const entries = readZipEntries(buffer);
    const sharedStrings = readSharedStrings(entries);
    const worksheetPath = findWorksheetPath(entries, "Agendamentos");
    const rows = readWorksheetRows(entries, worksheetPath, sharedStrings);
    const headerIndex = rows.findIndex((row) => {
        const keys = row.map(normalizeKey);
        return keys.includes("operacao") && keys.includes("appointment_id");
    });

    if (headerIndex < 0) {
        throw new Error("A folha Agendamentos não tem o cabeçalho esperado.");
    }

    const headers = rows[headerIndex].map(normalizeKey);
    const parsedRows: ParsedRow[] = [];

    for (let index = headerIndex + 1; index < rows.length; index += 1) {
        const row = rows[index];
        const values = Object.fromEntries(
            headers.map((header, columnIndexValue) => [
                header,
                normalizeText(row[columnIndexValue]),
            ])
        );
        const meaningfulValues = [
            values.operacao,
            values.appointment_id,
            values.data,
            values.utente_nome,
            values.utente_id,
            values.n_utente,
            values.servico_nome,
            values.servico_id,
            values.funcionario_nome,
            values.funcionario_id,
            values.notas,
        ].filter(Boolean);

        if (meaningfulValues.length === 0) {
            continue;
        }

        parsedRows.push({
            rowNumber: index + 1,
            values,
        });
    }

    return parsedRows;
}

function normalizeOperation(value: string, appointmentId: string): ImportOperation | null {
    const operation = normalizeKey(value);

    if (!operation && appointmentId) {
        return "atualizar";
    }

    if (!operation) {
        return null;
    }

    if (["criar", "create", "novo", "nova"].includes(operation)) {
        return "criar";
    }

    if (["atualizar", "actualizar", "update", "editar"].includes(operation)) {
        return "atualizar";
    }

    if (["apagar", "delete", "eliminar", "remover"].includes(operation)) {
        return "apagar";
    }

    if (["manter", "ignorar", "skip"].includes(operation)) {
        return "manter";
    }

    return null;
}

function normalizeDate(value: string) {
    const text = normalizeText(value);

    if (datePattern.test(text)) {
        return text;
    }

    const dateParts = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

    if (dateParts) {
        const [, day, month, year] = dateParts;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    const serial = Number(text);

    if (Number.isFinite(serial) && serial > 30000 && serial < 80000) {
        const date = new Date(Math.round((serial - 25569) * 86400000));
        return date.toISOString().slice(0, 10);
    }

    return "";
}

function normalizeStatus(value: string) {
    const status = normalizeKey(value);

    if (["planned", "planeado", "agendado"].includes(status)) {
        return "planned";
    }

    if (["completed", "concluido", "feito"].includes(status)) {
        return "completed";
    }

    if (["canceled", "cancelado", "cancelada"].includes(status)) {
        return "canceled";
    }

    return status;
}

function entityByName<T extends { name: string }>(rows: T[], name: string) {
    const key = normalizeKey(name);
    const matches = rows.filter((row) => normalizeKey(row.name) === key);

    return matches.length === 1 ? matches[0] : null;
}

function resolveLocation(
    values: Record<string, string>,
    locationsById: Map<string, Location>,
    locations: Location[]
) {
    const locationId = values.local_id;

    if (uuidPattern.test(locationId) && locationsById.has(locationId)) {
        return locationsById.get(locationId) ?? null;
    }

    return entityByName(locations, values.local_nome);
}

function resolvePatient(
    values: Record<string, string>,
    patientsById: Map<string, Patient>,
    patients: Patient[],
    locationId: string | null
) {
    const patientId = values.utente_id;

    if (uuidPattern.test(patientId) && patientsById.has(patientId)) {
        return patientsById.get(patientId) ?? null;
    }

    const patientNumber = normalizeText(values.n_utente);

    if (patientNumber) {
        const numberMatches = patients.filter(
            (patient) => patient.patient_number === patientNumber
        );

        if (numberMatches.length === 1) {
            return numberMatches[0];
        }
    }

    const nameKey = normalizeKey(values.utente_nome);
    const nameMatches = patients.filter(
        (patient) =>
            normalizeKey(patient.name) === nameKey &&
            (!locationId || patient.location_id === locationId)
    );

    return nameMatches.length === 1 ? nameMatches[0] : null;
}

function resolveService(
    values: Record<string, string>,
    servicesById: Map<string, Service>,
    services: Service[]
) {
    const serviceId = values.servico_id;

    if (uuidPattern.test(serviceId) && servicesById.has(serviceId)) {
        return servicesById.get(serviceId) ?? null;
    }

    return entityByName(services, values.servico_nome);
}

function resolveEmployee(
    values: Record<string, string>,
    employeesById: Map<string, Employee>,
    employees: Employee[]
) {
    const employeeId = values.funcionario_id;
    const employeeName = values.funcionario_nome;

    if (!employeeId && !employeeName) {
        return null;
    }

    if (uuidPattern.test(employeeId) && employeesById.has(employeeId)) {
        return employeesById.get(employeeId) ?? null;
    }

    return entityByName(employees, employeeName);
}

async function getExistingProfileId(
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string
) {
    const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    return String(data.id);
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return jsonResponse(
            { status: "error", message: "A sessão expirou. Faz login novamente." },
            401
        );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
        return jsonResponse(
            { status: "error", message: "Escolhe um ficheiro Excel para importar." },
            400
        );
    }

    if (file.size > 5 * 1024 * 1024) {
        return jsonResponse(
            { status: "error", message: "O ficheiro é demasiado grande." },
            400
        );
    }

    let rows: ParsedRow[];

    try {
        rows = parseWorkbook(Buffer.from(await file.arrayBuffer()));
    } catch (error) {
        return jsonResponse(
            {
                status: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Não consegui ler o Excel.",
            },
            400
        );
    }

    const { data: organizationId, error: organizationError } = await supabase.rpc(
        "my_organization_id"
    );

    if (organizationError || !organizationId) {
        return jsonResponse(
            {
                status: "error",
                message: "Não consegui encontrar a organização deste utilizador.",
            },
            400
        );
    }

    const [
        { data: patients, error: patientsError },
        { data: services, error: servicesError },
        { data: employees, error: employeesError },
        { data: locations, error: locationsError },
    ] = await Promise.all([
        supabase
            .from("patients")
            .select("id, name, location_id, patient_number, is_diabetic, active")
            .eq("organization_id", organizationId)
            .eq("active", true),
        supabase
            .from("services")
            .select("id, name, measurement_type, active")
            .eq("organization_id", organizationId)
            .eq("active", true),
        supabase
            .from("employees")
            .select("id, name, active")
            .eq("organization_id", organizationId)
            .eq("active", true),
        supabase
            .from("locations")
            .select("id, name, active")
            .eq("organization_id", organizationId)
            .eq("active", true),
    ]);
    const loadError = patientsError ?? servicesError ?? employeesError ?? locationsError;

    if (loadError) {
        return jsonResponse(
            { status: "error", message: `Erro ao validar dados: ${loadError.message}` },
            500
        );
    }

    const patientRows = (patients ?? []) as Patient[];
    const serviceRows = (services ?? []) as Service[];
    const employeeRows = (employees ?? []) as Employee[];
    const locationRows = (locations ?? []) as Location[];
    const patientsById = new Map(patientRows.map((patient) => [patient.id, patient]));
    const servicesById = new Map(serviceRows.map((service) => [service.id, service]));
    const employeesById = new Map(
        employeeRows.map((employee) => [employee.id, employee])
    );
    const locationsById = new Map(
        locationRows.map((location) => [location.id, location])
    );
    const appointmentIds = rows
        .map((row) => row.values.appointment_id)
        .filter((id) => uuidPattern.test(id));
    const { data: existingAppointments, error: existingAppointmentsError } =
        appointmentIds.length > 0
            ? await supabase
                  .from("appointments")
                  .select(
                      "id, scheduled_date, status, notes, employee_id, patient_id, service_id"
                  )
                  .eq("organization_id", organizationId)
                  .in("id", appointmentIds)
            : { data: [], error: null };

    if (existingAppointmentsError) {
        return jsonResponse(
            {
                status: "error",
                message: `Erro ao validar marcações existentes: ${existingAppointmentsError.message}`,
            },
            500
        );
    }

    const existingAppointmentById = new Map(
        ((existingAppointments ?? []) as ExistingAppointment[]).map((appointment) => [
            appointment.id,
            appointment,
        ])
    );
    const errors: string[] = [];
    const intents: ImportIntent[] = [];
    let ignoredCount = 0;

    for (const row of rows) {
        const values = row.values;
        const appointmentId = normalizeText(values.appointment_id);
        const operation = normalizeOperation(values.operacao, appointmentId);
        const hasCreateFields = [
            values.data,
            values.utente_nome,
            values.utente_id,
            values.n_utente,
            values.servico_nome,
            values.servico_id,
            values.funcionario_nome,
            values.funcionario_id,
            values.notas,
        ].some(Boolean);

        if (!operation || (operation === "criar" && !appointmentId && !hasCreateFields)) {
            ignoredCount += 1;
            continue;
        }

        if (operation === "manter") {
            ignoredCount += 1;
            continue;
        }

        const existingAppointment = appointmentId
            ? existingAppointmentById.get(appointmentId)
            : null;

        if (operation !== "criar" && !existingAppointment) {
            errors.push(
                `Linha ${row.rowNumber}: appointment_id inválido ou inexistente.`
            );
            continue;
        }

        if (operation === "apagar") {
            intents.push({
                appointmentId,
                employeeId: null,
                notes: null,
                operation,
                patientId: existingAppointment?.patient_id ?? "",
                rowNumber: row.rowNumber,
                scheduledDate: existingAppointment?.scheduled_date ?? "",
                serviceId: existingAppointment?.service_id ?? "",
                status: existingAppointment?.status ?? "planned",
            });
            continue;
        }

        const location = resolveLocation(values, locationsById, locationRows);
        const patient = resolvePatient(
            values,
            patientsById,
            patientRows,
            location?.id ?? null
        );
        const service = resolveService(values, servicesById, serviceRows);
        const employee = resolveEmployee(values, employeesById, employeeRows);
        const hasPatientValue =
            Boolean(values.utente_id) ||
            Boolean(values.n_utente) ||
            Boolean(values.utente_nome);
        const hasServiceValue =
            Boolean(values.servico_id) || Boolean(values.servico_nome);
        const hasEmployeeValue =
            Boolean(values.funcionario_id) || Boolean(values.funcionario_nome);
        const scheduledDate =
            normalizeDate(values.data) || existingAppointment?.scheduled_date || "";
        const status = normalizeStatus(values.estado || existingAppointment?.status || "");

        if (!scheduledDate || !datePattern.test(scheduledDate)) {
            errors.push(`Linha ${row.rowNumber}: data inválida.`);
        }

        if (!validStatuses.has(status)) {
            errors.push(
                `Linha ${row.rowNumber}: estado inválido. Usa planned, completed ou canceled.`
            );
        }

        if (!patient && (operation === "criar" || hasPatientValue)) {
            errors.push(`Linha ${row.rowNumber}: não consegui identificar o utente.`);
        }

        if (!service && (operation === "criar" || hasServiceValue)) {
            errors.push(`Linha ${row.rowNumber}: não consegui identificar o serviço.`);
        }

        if (hasEmployeeValue && !employee) {
            errors.push(
                `Linha ${row.rowNumber}: não consegui identificar o funcionário.`
            );
        }

        const patientId = patient?.id ?? existingAppointment?.patient_id ?? "";
        const serviceId = service?.id ?? existingAppointment?.service_id ?? "";

        if (!patientId) {
            errors.push(`Linha ${row.rowNumber}: utente obrigatório.`);
        }

        if (!serviceId) {
            errors.push(`Linha ${row.rowNumber}: serviço obrigatório.`);
        }

        const selectedService = service ?? servicesById.get(serviceId);
        const selectedPatient = patient ?? patientsById.get(patientId);

        if (
            selectedService?.measurement_type === "glucose" &&
            !selectedPatient?.is_diabetic
        ) {
            errors.push(
                `Linha ${row.rowNumber}: glicémia só pode ser marcada para utentes diabéticos.`
            );
        }

        intents.push({
            appointmentId: existingAppointment?.id ?? null,
            employeeId: employee?.id ?? null,
            notes: values.notas || existingAppointment?.notes || null,
            operation,
            patientId,
            rowNumber: row.rowNumber,
            scheduledDate,
            serviceId,
            status,
        });
    }

    const createIntents = intents.filter((intent) => intent.operation === "criar");
    const createKeys = new Set<string>();

    for (const intent of createIntents) {
        const key = `${intent.scheduledDate}|${intent.patientId}|${intent.serviceId}`;

        if (createKeys.has(key)) {
            errors.push(`Linha ${intent.rowNumber}: marcação duplicada no ficheiro.`);
        }

        createKeys.add(key);
    }

    let skippedDuplicateCount = 0;
    let duplicateDatabaseKeys = new Set<string>();

    if (createIntents.length > 0) {
        const { data: duplicateAppointments, error: duplicateError } = await supabase
            .from("appointments")
            .select("scheduled_date, patient_id, service_id")
            .eq("organization_id", organizationId)
            .in(
                "scheduled_date",
                Array.from(new Set(createIntents.map((intent) => intent.scheduledDate)))
            )
            .in(
                "patient_id",
                Array.from(new Set(createIntents.map((intent) => intent.patientId)))
            )
            .in(
                "service_id",
                Array.from(new Set(createIntents.map((intent) => intent.serviceId)))
            )
            .neq("status", "canceled");

        if (duplicateError) {
            return jsonResponse(
                {
                    status: "error",
                    message: `Erro ao validar duplicados: ${duplicateError.message}`,
                },
                500
            );
        }

        duplicateDatabaseKeys = new Set(
            (duplicateAppointments ?? []).map(
                (appointment) =>
                    `${appointment.scheduled_date}|${appointment.patient_id}|${appointment.service_id}`
            )
        );

        skippedDuplicateCount = createIntents.filter((intent) =>
            duplicateDatabaseKeys.has(
                `${intent.scheduledDate}|${intent.patientId}|${intent.serviceId}`
            )
        ).length;
    }

    if (errors.length > 0) {
        return jsonResponse(
            {
                errors: errors.slice(0, 30),
                message: "Corrige o ficheiro e volta a importar.",
                status: "error",
            },
            400
        );
    }

    const auditProfileId = await getExistingProfileId(supabase, user.id);
    const deleteIds = intents
        .filter((intent) => intent.operation === "apagar" && intent.appointmentId)
        .map((intent) => intent.appointmentId as string);
    const updateIntents = intents.filter(
        (intent) => intent.operation === "atualizar" && intent.appointmentId
    );
    const insertRows = createIntents
        .filter((intent) => {
            const key = `${intent.scheduledDate}|${intent.patientId}|${intent.serviceId}`;
            return !duplicateDatabaseKeys.has(key);
        })
        .map((intent) => ({
            organization_id: organizationId,
            employee_id: intent.employeeId,
            patient_id: intent.patientId,
            service_id: intent.serviceId,
            scheduled_date: intent.scheduledDate,
            start_time: technicalStartTimeWithSeconds,
            end_time: technicalEndTimeWithSeconds,
            status: intent.status,
            notes: intent.notes,
            ...(auditProfileId ? { created_by: auditProfileId } : {}),
        }));

    if (deleteIds.length > 0) {
        const { error } = await supabase
            .from("appointments")
            .delete()
            .eq("organization_id", organizationId)
            .in("id", deleteIds);

        if (error) {
            return jsonResponse(
                { status: "error", message: `Erro ao apagar marcações: ${error.message}` },
                500
            );
        }
    }

    for (const intent of updateIntents) {
        const { error } = await supabase
            .from("appointments")
            .update({
                employee_id: intent.employeeId,
                patient_id: intent.patientId,
                service_id: intent.serviceId,
                scheduled_date: intent.scheduledDate,
                start_time: technicalStartTimeWithSeconds,
                end_time: technicalEndTimeWithSeconds,
                status: intent.status,
                notes: intent.notes,
                updated_at: new Date().toISOString(),
                ...(auditProfileId ? { updated_by: auditProfileId } : {}),
            })
            .eq("organization_id", organizationId)
            .eq("id", intent.appointmentId);

        if (error) {
            return jsonResponse(
                {
                    status: "error",
                    message: `Erro ao atualizar linha ${intent.rowNumber}: ${error.message}`,
                },
                500
            );
        }
    }

    if (insertRows.length > 0) {
        const { error } = await supabase.from("appointments").insert(insertRows);

        if (error) {
            return jsonResponse(
                { status: "error", message: `Erro ao criar marcações: ${error.message}` },
                500
            );
        }
    }

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/calendar/month");

    return jsonResponse({
        counts: {
            apagadas: deleteIds.length,
            atualizadas: updateIntents.length,
            criadas: insertRows.length,
            duplicadasIgnoradas: skippedDuplicateCount,
            ignoradas: ignoredCount,
        },
        message: `${insertRows.length} criadas, ${updateIntents.length} atualizadas, ${deleteIds.length} apagadas${
            skippedDuplicateCount > 0
                ? `, ${skippedDuplicateCount} duplicadas ignoradas`
                : ""
        }.`,
        status: "success",
    });
}
