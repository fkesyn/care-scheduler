import { z } from "zod";

const constraintTypes = [
    "vacation",
    "preferred_day_off",
    "unavailable_shift",
    "avoid_shift",
    "preferred_shift",
    "only_shift",
    "exception_allowed_shift",
] as const;

const confidenceLevels = ["high", "medium", "low"] as const;
const suggestionStatuses = ["valid", "needs_confirmation"] as const;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export type AiScheduleConstraintEmployee = {
    id: string;
    name: string;
};

export type AiScheduleConstraintShiftType = {
    code: string;
    description: string | null;
    name: string;
};

export type ParseScheduleConstraintsWithAiInput = {
    employees: AiScheduleConstraintEmployee[];
    inputText: string;
    scheduleMonth: string;
    shiftTypes: AiScheduleConstraintShiftType[];
};

const aiWarningSchema = z
    .object({
        message: z.string().trim().min(1).max(500),
        sourceText: z.string().trim().min(1).max(500),
    })
    .strict();

const aiSuggestionBaseSchema = z
    .object({
        employeeName: z.string().trim().min(1).max(120),
        matchedEmployeeId: z.string().uuid().nullable(),
        constraintType: z.enum(constraintTypes),
        shiftCode: z.string().trim().min(1).max(20).nullable(),
        specificDate: z.string().regex(datePattern).nullable(),
        startDate: z.string().regex(datePattern).nullable(),
        endDate: z.string().regex(datePattern).nullable(),
        sourceText: z.string().trim().min(1).max(500),
        confidence: z.enum(confidenceLevels),
        status: z.enum(suggestionStatuses),
    })
    .strict();

export type AiScheduleConstraintSuggestion = z.infer<
    typeof aiSuggestionBaseSchema
>;

export type AiScheduleConstraintWarning = z.infer<typeof aiWarningSchema>;

export type AiScheduleConstraintsResult = {
    suggestions: AiScheduleConstraintSuggestion[];
    warnings: AiScheduleConstraintWarning[];
};

function dateBelongsToMonth(dateValue: string, scheduleMonth: string) {
    return dateValue.startsWith(scheduleMonth.slice(0, 7));
}

function buildAiResultSchema({
    employeeIds,
    scheduleMonth,
    shiftCodes,
}: {
    employeeIds: Set<string>;
    scheduleMonth: string;
    shiftCodes: Set<string>;
}) {
    return z
        .object({
            suggestions: z.array(aiSuggestionBaseSchema).max(100),
            warnings: z.array(aiWarningSchema).max(100),
        })
        .strict()
        .superRefine((value, context) => {
            for (const [index, suggestion] of value.suggestions.entries()) {
                if (
                    suggestion.matchedEmployeeId &&
                    !employeeIds.has(suggestion.matchedEmployeeId)
                ) {
                    context.addIssue({
                        code: "custom",
                        message: "matchedEmployeeId must match an active employee",
                        path: ["suggestions", index, "matchedEmployeeId"],
                    });
                }

                if (suggestion.shiftCode && !shiftCodes.has(suggestion.shiftCode)) {
                    context.addIssue({
                        code: "custom",
                        message: "shiftCode must match an active shift code",
                        path: ["suggestions", index, "shiftCode"],
                    });
                }

                for (const fieldName of [
                    "specificDate",
                    "startDate",
                    "endDate",
                ] as const) {
                    const dateValue = suggestion[fieldName];

                    if (dateValue && !dateBelongsToMonth(dateValue, scheduleMonth)) {
                        context.addIssue({
                            code: "custom",
                            message: "date must belong to schedule month",
                            path: ["suggestions", index, fieldName],
                        });
                    }
                }

                if (
                    suggestion.startDate &&
                    suggestion.endDate &&
                    suggestion.endDate < suggestion.startDate
                ) {
                    context.addIssue({
                        code: "custom",
                        message: "endDate must be after startDate",
                        path: ["suggestions", index, "endDate"],
                    });
                }
            }
        });
}

function buildSystemPrompt() {
    return [
        "You extract employee monthly schedule constraint requests from Portuguese WhatsApp-style text.",
        "Return JSON only. Do not wrap it in markdown.",
        "Never create schedule entries and never decide the final roster.",
        "Use only the provided active employees and shift codes.",
        "If an employee name, date, shift, or meaning is ambiguous, set status to needs_confirmation and use null for the ambiguous ID/code/date.",
        "Convert day numbers to ISO dates inside the provided schedule month.",
        "Common mappings: ferias/ferias de X a Y = vacation; folga/folgas = preferred_day_off; prefere manhas/tardes = preferred_shift M/T; nao pode fazer/nao fazer manha/tarde = unavailable_shift M/T.",
        "The JSON shape must be exactly: {\"suggestions\":[{\"employeeName\":\"string\",\"matchedEmployeeId\":\"uuid-or-null\",\"constraintType\":\"vacation|preferred_day_off|unavailable_shift|avoid_shift|preferred_shift|only_shift|exception_allowed_shift\",\"shiftCode\":\"shift-code-or-null\",\"specificDate\":\"YYYY-MM-DD-or-null\",\"startDate\":\"YYYY-MM-DD-or-null\",\"endDate\":\"YYYY-MM-DD-or-null\",\"sourceText\":\"string\",\"confidence\":\"high|medium|low\",\"status\":\"valid|needs_confirmation\"}],\"warnings\":[{\"message\":\"string\",\"sourceText\":\"string\"}]}",
    ].join("\n");
}

function buildUserPrompt({
    employees,
    inputText,
    scheduleMonth,
    shiftTypes,
}: ParseScheduleConstraintsWithAiInput) {
    return [
        `Schedule month: ${scheduleMonth}`,
        "",
        "Active employees:",
        JSON.stringify(employees, null, 2),
        "",
        "Available shift codes:",
        JSON.stringify(shiftTypes, null, 2),
        "",
        "Original text:",
        inputText,
    ].join("\n");
}

function extractAssistantContent(payload: unknown) {
    if (
        typeof payload !== "object" ||
        payload === null ||
        !("choices" in payload) ||
        !Array.isArray(payload.choices)
    ) {
        return "";
    }

    const firstChoice = payload.choices[0] as unknown;

    if (
        typeof firstChoice !== "object" ||
        firstChoice === null ||
        !("message" in firstChoice) ||
        typeof firstChoice.message !== "object" ||
        firstChoice.message === null ||
        !("content" in firstChoice.message)
    ) {
        return "";
    }

    const { content } = firstChoice.message;

    if (typeof content === "string") {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map((item) => {
                if (
                    typeof item === "object" &&
                    item !== null &&
                    "text" in item &&
                    typeof item.text === "string"
                ) {
                    return item.text;
                }

                return "";
            })
            .join("");
    }

    return "";
}

function openRouterErrorMessage(payload: unknown) {
    if (
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "object" &&
        payload.error !== null &&
        "message" in payload.error &&
        typeof payload.error.message === "string"
    ) {
        return payload.error.message;
    }

    return null;
}

function payloadText(payload: unknown) {
    if (typeof payload === "string") {
        return payload;
    }

    if (
        typeof payload === "object" &&
        payload !== null &&
        "raw" in payload &&
        typeof payload.raw === "string"
    ) {
        return payload.raw;
    }

    try {
        return JSON.stringify(payload);
    } catch {
        return "";
    }
}

function isProviderReturnedError(payload: unknown) {
    return /provider returned error/i.test(
        `${openRouterErrorMessage(payload) ?? ""} ${payloadText(payload)}`
    );
}

async function readOpenRouterPayload(response: Response) {
    const responseText = await response.text();

    if (!responseText) {
        return null;
    }

    try {
        return JSON.parse(responseText) as unknown;
    } catch {
        return {
            raw: responseText,
        };
    }
}

function parseJsonObjectOutput(outputText: string) {
    try {
        return JSON.parse(outputText) as unknown;
    } catch {
        const firstBraceIndex = outputText.indexOf("{");
        const lastBraceIndex = outputText.lastIndexOf("}");

        if (
            firstBraceIndex === -1 ||
            lastBraceIndex === -1 ||
            lastBraceIndex <= firstBraceIndex
        ) {
            throw new Error("A IA devolveu JSON inválido.");
        }

        return JSON.parse(outputText.slice(firstBraceIndex, lastBraceIndex + 1)) as unknown;
    }
}

function logOpenRouterFailure({
    payload,
    status,
    usedResponseFormat,
}: {
    payload: unknown;
    status: number;
    usedResponseFormat: boolean;
}) {
    console.error("OpenRouter schedule parser failed", {
        payload,
        status,
        usedResponseFormat,
    });
}

export async function parseScheduleConstraintsWithAi({
    employees,
    inputText,
    scheduleMonth,
    shiftTypes,
}: ParseScheduleConstraintsWithAiInput): Promise<AiScheduleConstraintsResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        throw new Error(
            "Falta configurar OPENROUTER_API_KEY no ambiente do servidor."
        );
    }

    const model = process.env.OPENROUTER_SCHEDULE_PARSER_MODEL ?? "openrouter/free";
    const employeeIds = employees.map((employee) => employee.id);
    const shiftCodes = shiftTypes.map((shiftType) => shiftType.code);

    async function requestOpenRouter(usedResponseFormat: boolean) {
        const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer":
                        process.env.NEXT_PUBLIC_SITE_URL ??
                        "http://localhost:3000",
                    "X-Title": "Care Scheduler",
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        {
                            role: "system",
                            content: buildSystemPrompt(),
                        },
                        {
                            role: "user",
                            content: buildUserPrompt({
                                employees,
                                inputText,
                                scheduleMonth,
                                shiftTypes,
                            }),
                        },
                    ],
                    plugins: [{ id: "response-healing" }],
                    provider: {
                        require_parameters: true,
                    },
                    temperature: 0,
                    ...(usedResponseFormat
                        ? { response_format: { type: "json_object" } }
                        : {}),
                }),
            }
        );
        const payload = await readOpenRouterPayload(response);

        return {
            payload,
            response,
            usedResponseFormat,
        };
    }

    let openRouterResult = await requestOpenRouter(true);

    if (
        !openRouterResult.response.ok &&
        isProviderReturnedError(openRouterResult.payload)
    ) {
        logOpenRouterFailure({
            payload: openRouterResult.payload,
            status: openRouterResult.response.status,
            usedResponseFormat: true,
        });

        openRouterResult = await requestOpenRouter(false);
    }

    if (!openRouterResult.response.ok) {
        logOpenRouterFailure({
            payload: openRouterResult.payload,
            status: openRouterResult.response.status,
            usedResponseFormat: openRouterResult.usedResponseFormat,
        });

        throw new Error(
            `OpenRouter falhou (${openRouterResult.response.status}): ${
                openRouterErrorMessage(openRouterResult.payload) ??
                openRouterResult.response.statusText
            }`
        );
    }

    const payload = openRouterResult.payload;
    const outputText = extractAssistantContent(payload);

    if (!outputText) {
        throw new Error("A IA não devolveu texto estruturado.");
    }

    let parsedJson: unknown;

    try {
        parsedJson = parseJsonObjectOutput(outputText);
    } catch {
        throw new Error("A IA devolveu JSON inválido.");
    }

    const validation = buildAiResultSchema({
        employeeIds: new Set(employeeIds),
        scheduleMonth,
        shiftCodes: new Set(shiftCodes),
    }).safeParse(parsedJson);

    if (!validation.success) {
        throw new Error(
            "A IA devolveu sugestões fora do formato esperado. Podes usar as sugestões por regras ou introduzir manualmente."
        );
    }

    return validation.data;
}
