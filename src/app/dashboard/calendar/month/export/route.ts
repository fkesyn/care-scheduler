import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Relation<T> = T | T[] | null;
type CellValue = boolean | number | string | null | undefined;

type Location = {
    id: string;
    name: string;
    active: boolean | null;
};

type Patient = {
    id: string;
    name: string;
    location_id: string | null;
    patient_number: string | null;
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
    role: string;
    active: boolean | null;
};

type Appointment = {
    id: string;
    scheduled_date: string;
    status: string;
    notes: string | null;
    employee_id: string | null;
    patient_id: string | null;
    service_id: string | null;
    employees: Relation<{
        id: string;
        name: string;
    }>;
    patients: Relation<{
        id: string;
        name: string;
        location_id: string | null;
        patient_number: string | null;
    }>;
    services: Relation<{
        id: string;
        name: string;
    }>;
};

type Worksheet = {
    name: string;
    rows: CellValue[][];
    widths?: number[];
    autoFilter?: boolean;
    freezeHeader?: boolean;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emptyTemplateRows = 20;

function firstRelation<T>(relation: Relation<T>) {
    if (Array.isArray(relation)) {
        return relation[0] ?? null;
    }

    return relation;
}

function parseDate(dateValue: string) {
    const [year, month, day] = dateValue.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatDateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function monthRange(dateValue: string) {
    const date = parseDate(dateValue);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    return {
        endValue: formatDateInput(end),
        monthValue: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        startValue: formatDateInput(start),
    };
}

function roleLabel(role: string | null | undefined) {
    if (role === "nurse") {
        return "Enfermeiro/a";
    }

    if (role === "caregiver") {
        return "Cuidador/a";
    }

    if (role === "other") {
        return "Outro";
    }

    return "Auxiliar / Funcionário";
}

function measurementLabel(type: string | null | undefined) {
    if (type === "blood_pressure") {
        return "TA";
    }

    if (type === "glucose") {
        return "Glicémia";
    }

    if (type === "wound_care") {
        return "Ferida";
    }

    return "";
}

function xmlEscape(value: string) {
    return value
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function columnName(index: number) {
    let value = index;
    let name = "";

    while (value > 0) {
        const modulo = (value - 1) % 26;
        name = String.fromCharCode(65 + modulo) + name;
        value = Math.floor((value - modulo) / 26);
    }

    return name;
}

function cellXml(value: CellValue, rowIndex: number, columnIndex: number, style = 0) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    const ref = `${columnName(columnIndex)}${rowIndex}`;
    const styleAttribute = style ? ` s="${style}"` : "";

    if (typeof value === "number") {
        return `<c r="${ref}"${styleAttribute}><v>${value}</v></c>`;
    }

    if (typeof value === "boolean") {
        return `<c r="${ref}" t="b"${styleAttribute}><v>${value ? 1 : 0}</v></c>`;
    }

    return `<c r="${ref}" t="inlineStr"${styleAttribute}><is><t>${xmlEscape(value)}</t></is></c>`;
}

function worksheetXml(worksheet: Worksheet) {
    const columnCount = Math.max(...worksheet.rows.map((row) => row.length), 1);
    const rowCount = Math.max(worksheet.rows.length, 1);
    const dimension = `A1:${columnName(columnCount)}${rowCount}`;
    const columns = worksheet.widths?.length
        ? `<cols>${worksheet.widths
              .map(
                  (width, index) =>
                      `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
              )
              .join("")}</cols>`
        : "";
    const sheetView = worksheet.freezeHeader
        ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    const rows = worksheet.rows
        .map((row, rowIndex) => {
            const rowNumber = rowIndex + 1;
            const style = rowIndex === 0 ? 1 : 0;
            const cells = row
                .map((value, columnIndex) =>
                    cellXml(value, rowNumber, columnIndex + 1, style)
                )
                .join("");

            return `<row r="${rowNumber}">${cells}</row>`;
        })
        .join("");
    const autoFilter = worksheet.autoFilter ? `<autoFilter ref="${dimension}"/>` : "";

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="${dimension}"/>
${sheetView}
${columns}
<sheetData>${rows}</sheetData>
${autoFilter}
</worksheet>`;
}

function workbookXml(worksheets: Worksheet[]) {
    const sheets = worksheets
        .map(
            (worksheet, index) =>
                `<sheet name="${xmlEscape(worksheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
        )
        .join("");

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets}</sheets>
</workbook>`;
}

function workbookRelsXml(worksheets: Worksheet[]) {
    const sheetRels = worksheets
        .map(
            (_worksheet, index) =>
                `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
        )
        .join("");
    const styleRelationshipId = worksheets.length + 1;

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetRels}
<Relationship Id="rId${styleRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function contentTypesXml(worksheets: Worksheet[]) {
    const worksheetOverrides = worksheets
        .map(
            (_worksheet, index) =>
                `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
        )
        .join("");

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${worksheetOverrides}
</Types>`;
}

function rootRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function stylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function crc32(buffer: Buffer) {
    let crc = 0xffffffff;

    for (const byte of buffer) {
        crc ^= byte;

        for (let bit = 0; bit < 8; bit += 1) {
            crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
        }
    }

    return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
    const time =
        (date.getHours() << 11) |
        (date.getMinutes() << 5) |
        Math.floor(date.getSeconds() / 2);
    const day =
        ((date.getFullYear() - 1980) << 9) |
        ((date.getMonth() + 1) << 5) |
        date.getDate();

    return { day, time };
}

function createXlsx(worksheets: Worksheet[]) {
    const files = [
        { path: "[Content_Types].xml", data: contentTypesXml(worksheets) },
        { path: "_rels/.rels", data: rootRelsXml() },
        { path: "xl/workbook.xml", data: workbookXml(worksheets) },
        { path: "xl/_rels/workbook.xml.rels", data: workbookRelsXml(worksheets) },
        { path: "xl/styles.xml", data: stylesXml() },
        ...worksheets.map((worksheet, index) => ({
            path: `xl/worksheets/sheet${index + 1}.xml`,
            data: worksheetXml(worksheet),
        })),
    ];
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;
    const { day, time } = dosDateTime();

    for (const file of files) {
        const path = Buffer.from(file.path, "utf8");
        const data = Buffer.from(file.data, "utf8");
        const crc = crc32(data);
        const localHeader = Buffer.alloc(30);

        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(time, 10);
        localHeader.writeUInt16LE(day, 12);
        localHeader.writeUInt32LE(crc, 14);
        localHeader.writeUInt32LE(data.length, 18);
        localHeader.writeUInt32LE(data.length, 22);
        localHeader.writeUInt16LE(path.length, 26);
        localHeader.writeUInt16LE(0, 28);

        localParts.push(localHeader, path, data);

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(time, 12);
        centralHeader.writeUInt16LE(day, 14);
        centralHeader.writeUInt32LE(crc, 16);
        centralHeader.writeUInt32LE(data.length, 20);
        centralHeader.writeUInt32LE(data.length, 24);
        centralHeader.writeUInt16LE(path.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(offset, 42);
        centralParts.push(centralHeader, path);

        offset += localHeader.length + path.length + data.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const endOfCentralDirectory = Buffer.alloc(22);

    endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
    endOfCentralDirectory.writeUInt16LE(0, 4);
    endOfCentralDirectory.writeUInt16LE(0, 6);
    endOfCentralDirectory.writeUInt16LE(files.length, 8);
    endOfCentralDirectory.writeUInt16LE(files.length, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
    endOfCentralDirectory.writeUInt32LE(offset, 16);
    endOfCentralDirectory.writeUInt16LE(0, 20);

    return Buffer.concat([
        ...localParts,
        centralDirectory,
        endOfCentralDirectory,
    ]);
}

function buildInstructionsRows(monthValue: string): CellValue[][] {
    return [
        ["Campo", "Como usar"],
        ["operacao", "Usa atualizar para linhas existentes, criar para novas marcações e apagar para remover numa importação futura."],
        ["appointment_id", "Não alterar nas linhas existentes. Deixa vazio para novas marcações."],
        ["data", `Data da marcação no formato YYYY-MM-DD. Este export é do mês ${monthValue}.`],
        ["estado", "Valores aceites: planned, completed, canceled."],
        ["*_id", "IDs técnicos usados para importação. Mantém estes valores quando existirem."],
        ["nomes", "Os nomes são para leitura humana. No import futuro, o ID terá prioridade sobre o nome."],
        ["novas linhas", "Usa as linhas em branco no fim da folha Agendamentos com operacao=criar."],
        ["colunas", "Não alterar nomes nem ordem das colunas."],
    ];
}

export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return new Response("Sessão expirada. Faz login novamente.", {
            status: 401,
        });
    }

    const url = new URL(request.url);
    const rawDate = url.searchParams.get("date") ?? formatDateInput(new Date());
    const selectedDate = datePattern.test(rawDate)
        ? rawDate
        : formatDateInput(new Date());
    const { endValue, monthValue, startValue } = monthRange(selectedDate);

    const [
        { data: locations, error: locationsError },
        { data: patients, error: patientsError },
        { data: services, error: servicesError },
        { data: employees, error: employeesError },
    ] = await Promise.all([
        supabase.from("locations").select("id, name, active").order("name"),
        supabase
            .from("patients")
            .select("id, name, location_id, patient_number, active")
            .eq("active", true)
            .order("name"),
        supabase
            .from("services")
            .select("id, name, measurement_type, active")
            .eq("active", true)
            .order("name"),
        supabase
            .from("employees")
            .select("id, name, role, active")
            .eq("active", true)
            .order("name"),
    ]);
    const loadError = locationsError ?? patientsError ?? servicesError ?? employeesError;

    if (loadError) {
        return new Response(`Erro ao preparar export: ${loadError.message}`, {
            status: 500,
        });
    }

    const locationRows = (locations ?? []) as Location[];
    const patientRows = (patients ?? []) as Patient[];
    const serviceRows = (services ?? []) as Service[];
    const employeeRows = (employees ?? []) as Employee[];
    const locationNameById = new Map(
        locationRows.map((location) => [location.id, location.name] as const)
    );
    const requestedLocationId = url.searchParams.get("locationId") ?? "";
    const requestedEmployeeId = url.searchParams.get("employeeId") ?? "";
    const requestedPatientId = url.searchParams.get("patientId") ?? "";
    const requestedServiceId = url.searchParams.get("serviceId") ?? "";
    const selectedLocationId =
        uuidPattern.test(requestedLocationId) &&
        locationRows.some((location) => location.id === requestedLocationId)
            ? requestedLocationId
            : locationRows[0]?.id ?? "";
    const selectedEmployeeId =
        uuidPattern.test(requestedEmployeeId) &&
        employeeRows.some((employee) => employee.id === requestedEmployeeId)
            ? requestedEmployeeId
            : "";
    const selectedPatientId =
        uuidPattern.test(requestedPatientId) &&
        patientRows.some((patient) => patient.id === requestedPatientId)
            ? requestedPatientId
            : "";
    const selectedServiceId =
        uuidPattern.test(requestedServiceId) &&
        serviceRows.some((service) => service.id === requestedServiceId)
            ? requestedServiceId
            : "";

    let appointmentsQuery = supabase
        .from("appointments")
        .select(
            `
          id,
          scheduled_date,
          status,
          notes,
          employee_id,
          patient_id,
          service_id,
          employees (
            id,
            name
          ),
          patients!inner (
            id,
            name,
            location_id,
            patient_number
          ),
          services (
            id,
            name
          )
        `
        )
        .gte("scheduled_date", startValue)
        .lte("scheduled_date", endValue)
        .order("scheduled_date")
        .order("created_at");

    if (selectedLocationId) {
        appointmentsQuery = appointmentsQuery.eq(
            "patients.location_id",
            selectedLocationId
        );
    }

    if (selectedEmployeeId) {
        appointmentsQuery = appointmentsQuery.eq("employee_id", selectedEmployeeId);
    }

    if (selectedPatientId) {
        appointmentsQuery = appointmentsQuery.eq("patient_id", selectedPatientId);
    }

    if (selectedServiceId) {
        appointmentsQuery = appointmentsQuery.eq("service_id", selectedServiceId);
    }

    const { data: appointments, error: appointmentsError } = await appointmentsQuery;

    if (appointmentsError) {
        return new Response(`Erro ao exportar calendário: ${appointmentsError.message}`, {
            status: 500,
        });
    }

    const appointmentRows: CellValue[][] = [
        [
            "operacao",
            "appointment_id",
            "data",
            "estado",
            "local_nome",
            "local_id",
            "utente_nome",
            "utente_id",
            "n_utente",
            "servico_nome",
            "servico_id",
            "funcionario_nome",
            "funcionario_id",
            "notas",
            "erro_importacao",
        ],
    ];

    for (const appointment of (appointments ?? []) as Appointment[]) {
        const patient = firstRelation(appointment.patients);
        const service = firstRelation(appointment.services);
        const employee = firstRelation(appointment.employees);
        const locationId = patient?.location_id ?? "";

        appointmentRows.push([
            "atualizar",
            appointment.id,
            appointment.scheduled_date,
            appointment.status,
            locationId ? locationNameById.get(locationId) ?? "" : "",
            locationId,
            patient?.name ?? "",
            patient?.id ?? appointment.patient_id ?? "",
            patient?.patient_number ?? "",
            service?.name ?? "",
            service?.id ?? appointment.service_id ?? "",
            employee?.name ?? "",
            employee?.id ?? appointment.employee_id ?? "",
            appointment.notes ?? "",
            "",
        ]);
    }

    const defaultLocationName = selectedLocationId
        ? locationNameById.get(selectedLocationId) ?? ""
        : "";

    for (let index = 0; index < emptyTemplateRows; index += 1) {
        appointmentRows.push([
            "criar",
            "",
            "",
            "planned",
            defaultLocationName,
            selectedLocationId,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
        ]);
    }

    const worksheets: Worksheet[] = [
        {
            name: "Agendamentos",
            rows: appointmentRows,
            widths: [14, 38, 14, 14, 22, 38, 34, 38, 16, 28, 38, 28, 38, 36, 28],
            autoFilter: true,
            freezeHeader: true,
        },
        {
            name: "Utentes",
            rows: [
                ["utente_id", "utente_nome", "n_utente", "local_nome", "local_id", "ativo"],
                ...patientRows.map((patient) => [
                    patient.id,
                    patient.name,
                    patient.patient_number ?? "",
                    patient.location_id
                        ? locationNameById.get(patient.location_id) ?? ""
                        : "",
                    patient.location_id ?? "",
                    patient.active ? "sim" : "nao",
                ]),
            ],
            widths: [38, 34, 16, 22, 38, 10],
            autoFilter: true,
            freezeHeader: true,
        },
        {
            name: "Servicos",
            rows: [
                ["servico_id", "servico_nome", "tipo_medicao", "ativo"],
                ...serviceRows.map((service) => [
                    service.id,
                    service.name,
                    measurementLabel(service.measurement_type),
                    service.active ? "sim" : "nao",
                ]),
            ],
            widths: [38, 28, 16, 10],
            autoFilter: true,
            freezeHeader: true,
        },
        {
            name: "Funcionarios",
            rows: [
                ["funcionario_id", "funcionario_nome", "categoria", "ativo"],
                ...employeeRows.map((employee) => [
                    employee.id,
                    employee.name,
                    roleLabel(employee.role),
                    employee.active ? "sim" : "nao",
                ]),
            ],
            widths: [38, 28, 24, 10],
            autoFilter: true,
            freezeHeader: true,
        },
        {
            name: "Locais",
            rows: [
                ["local_id", "local_nome", "ativo"],
                ...locationRows.map((location) => [
                    location.id,
                    location.name,
                    location.active ? "sim" : "nao",
                ]),
            ],
            widths: [38, 24, 10],
            autoFilter: true,
            freezeHeader: true,
        },
        {
            name: "Instrucoes",
            rows: buildInstructionsRows(monthValue),
            widths: [22, 110],
            autoFilter: false,
            freezeHeader: true,
        },
    ];
    const workbook = createXlsx(worksheets);
    const filename = `calendario-${monthValue}.xlsx`;

    return new Response(workbook, {
        headers: {
            "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
            "Content-Type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
    });
}
