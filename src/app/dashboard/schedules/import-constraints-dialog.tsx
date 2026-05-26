"use client";

import { FileTextIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
    importScheduleConstraints,
    parseScheduleConstraintsWithAi,
    type ImportScheduleConstraintsState,
    type ParseScheduleConstraintsWithAiSuggestion,
} from "@/app/dashboard/schedules/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionDialog } from "@/lib/use-action-dialog";
import { cn } from "@/lib/utils";

type ImportConstraintEmployee = {
    id: string;
    name: string;
};

type ImportConstraintShiftType = {
    id: string;
    code: string;
    name: string;
    active: boolean | null;
};

type ConstraintType =
    | "vacation"
    | "preferred_day_off"
    | "unavailable_shift"
    | "avoid_shift"
    | "preferred_shift"
    | "only_shift"
    | "exception_allowed_shift";

type ConstraintSuggestion = {
    id: string;
    employee_id: string;
    constraint_type: ConstraintType;
    shift_type_id: string;
    specific_date: string;
    start_date: string;
    end_date: string;
    notes: string;
    source_text: string;
};

type EmployeeMatch = {
    employee_id: string;
    matched?: boolean;
};

type ImportTextBlock = {
    employeeMatch: EmployeeMatch;
    label: string;
    sourceText: string;
    text: string;
};

type ImportTextParseResult = {
    blockResults: Array<{
        block: ImportTextBlock;
        suggestions: ConstraintSuggestion[];
        unparsedText: string;
    }>;
    contextText: string;
    suggestions: ConstraintSuggestion[];
    unparsedBlocks: Array<{
        label: string;
        text: string;
    }>;
    warnings: ParseWarning[];
    blocks: ImportTextBlock[];
};

type ParsedBy = "rules" | "ai" | "mixed";

type ParseWarning = {
    message: string;
    sourceText: string;
};

type ImportConstraintsDialogProps = {
    employees: ImportConstraintEmployee[];
    monthEnd: string;
    monthStart: string;
    scheduleId: string;
    shiftTypes: ImportConstraintShiftType[];
};

const initialState: ImportScheduleConstraintsState = {
    status: "idle",
};

const constraintTypeOptions: Array<{ value: ConstraintType; label: string }> = [
    { value: "vacation", label: "Férias" },
    { value: "preferred_day_off", label: "Folga pedida" },
    { value: "unavailable_shift", label: "Não pode fazer turno" },
    { value: "avoid_shift", label: "Evitar turno" },
    { value: "preferred_shift", label: "Prefere turno" },
    { value: "only_shift", label: "Só pode fazer turno" },
    { value: "exception_allowed_shift", label: "Turno permitido por exceção" },
];

const constraintTypes = new Set<ConstraintType>(
    constraintTypeOptions.map((option) => option.value)
);
const shiftRequiredConstraintTypes = new Set<ConstraintType>([
    "unavailable_shift",
    "avoid_shift",
    "preferred_shift",
    "only_shift",
    "exception_allowed_shift",
]);
const selectClassName =
    "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function isConstraintType(value: string): value is ConstraintType {
    return constraintTypes.has(value as ConstraintType);
}

function normalizeForMatch(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[.:,;]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function hasDayNumber(value: string) {
    return /\b([12]?\d|3[01])\b/.test(value);
}

function isSocialText(value: string) {
    const normalizedValue = normalizeForMatch(value);

    if (!normalizedValue) {
        return true;
    }

    if (!/[a-z0-9]/.test(normalizedValue)) {
        return true;
    }

    const socialSnippets = [
        "espero que",
        "nao te complique",
        "coragem",
        "beijinhos",
        "beijinho",
        "beijo",
        "obrigada",
        "obrigado",
        "boa sorte",
        "bom trabalho",
        "bom dia",
        "boa tarde",
        "boa noite",
        "ola",
        "bjs",
        "haha",
        "lol",
    ];

    if (socialSnippets.some((snippet) => normalizedValue.includes(snippet))) {
        return true;
    }

    return false;
}

function hasStrongConstraintSignals(value: string) {
    const normalizedValue = normalizeForMatch(value);

    if (!normalizedValue) {
        return false;
    }

    const hasRestrictionKeyword =
        /\bnao\s+(?:posso|pode|fazer)\b/.test(normalizedValue) ||
        /\bferias?\b/.test(normalizedValue) ||
        /\bfolgas?\b/.test(normalizedValue) ||
        /\bprefir[oa]\b/.test(normalizedValue) ||
        /\bpreferenc(?:ia|ias)\b/.test(normalizedValue) ||
        /\bmanhas?\b/.test(normalizedValue) ||
        /\btardes?\b/.test(normalizedValue) ||
        /\b(?:primeira|segunda|terceira|quarta)\s+seman+a\b/.test(normalizedValue) ||
        /\b\d+\s+turnos?\b/.test(normalizedValue) ||
        /\b(?:m\*|e\*|mt)\b/.test(normalizedValue) ||
        /\b(?:segundas?|tercas?|quartas?|quintas?|sextas?|sabados?|domingos?)\b/.test(
            normalizedValue
        );

    if (hasRestrictionKeyword) {
        return true;
    }

    if (
        /\b(sao joao|s joao|sao pedro|saint jonas)\b/.test(normalizedValue) &&
        /\bdia\b/.test(normalizedValue)
    ) {
        return false;
    }

    return hasDayNumber(normalizedValue);
}

function hasAiActionableSignal(value: string) {
    const normalizedValue = normalizeForMatch(value);

    if (!normalizedValue) {
        return false;
    }

    if (
        /\bnao\s+(?:posso|pode)\s+fazer\b/.test(normalizedValue) ||
        /\bnao\s+fazer\s+(?:manhas?|tardes?)\b/.test(normalizedValue) ||
        /\bso\s+fazer\s+(?:m\*|e\*|mt|manhas?|tardes?)\b/.test(normalizedValue)
    ) {
        return true;
    }

    if (
        /\bferias?.*?\bde\s+\d{1,2}\s+a\s+\d{1,2}\b/.test(normalizedValue) ||
        /\bferias?.*?\bdia\s+\d{1,2}\b/.test(normalizedValue)
    ) {
        return true;
    }

    if (/\bfolgas?.*?\b\d{1,2}\b/.test(normalizedValue)) {
        return true;
    }

    if (
        /\bprefere?\s+(?:manhas?|tardes?)\b/.test(normalizedValue) ||
        /\bprefiro\s+(?:manhas?|tardes?)\b/.test(normalizedValue)
    ) {
        return true;
    }

    if (
        /\b(?:primeira|segunda|terceira|quarta)\s+seman+a\b/.test(normalizedValue) &&
        /\b\d+\s+turnos?\b/.test(normalizedValue)
    ) {
        return true;
    }

    if (
        /\b\d+\s+turnos?\b/.test(normalizedValue) &&
        /\b(?:m\*|e\*|mt|manha|manha|tarde)\b/.test(normalizedValue)
    ) {
        return true;
    }

    if (
        /\b(?:segundas?|tercas?|quartas?|quintas?|sextas?|sabados?|domingos?)\b/.test(
            normalizedValue
        ) &&
        /\b(?:ignorar|excepto|exceto|nao|preferenc(?:ia|ias)|prefere|prefiro)\b/.test(
            normalizedValue
        )
    ) {
        return true;
    }

    if (
        /\b(saint jonas|sao joao|s joao)\b/.test(normalizedValue) &&
        /\b(?:prefir[oa]?|prefere|prefiro|folga|nao fazer|nao posso|nao pode)\b/.test(
            normalizedValue
        )
    ) {
        return true;
    }

    return false;
}

function isContextSectionHeader(line: string) {
    const normalizedLine = normalizeForMatch(line);

    return /^(notas?(?:\s+de\s+contexto)?|contexto)\s*:/.test(normalizedLine);
}

function isLikelyIgnorableClause(value: string) {
    const normalizedValue = normalizeForMatch(value);

    if (!normalizedValue) {
        return true;
    }

    if (!/[a-z0-9]/.test(normalizedValue)) {
        return true;
    }

    if (isSocialText(value) && !hasStrongConstraintSignals(value)) {
        return true;
    }

    return false;
}

function firstName(value: string) {
    return normalizeForMatch(value).split(" ")[0] ?? "";
}

function matchEmployeeName(
    nameText: string,
    employees: ImportConstraintEmployee[]
): EmployeeMatch {
    const normalizedName = normalizeForMatch(
        nameText
            .replace(/\(.*?\)/g, " ")
            .replace(/[-–—_]/g, " ")
            .trim()
    );

    if (!normalizedName) {
        return { employee_id: "", matched: false };
    }

    const fullMatches = employees.filter(
        (employee) => normalizeForMatch(employee.name) === normalizedName
    );

    if (fullMatches.length === 1) {
        return { employee_id: fullMatches[0].id, matched: true };
    }

    if (fullMatches.length > 1) {
        return { employee_id: "", matched: true };
    }

    const firstNameMatches = employees.filter(
        (employee) => firstName(employee.name) === firstName(normalizedName)
    );

    if (firstNameMatches.length === 1) {
        return { employee_id: firstNameMatches[0].id, matched: true };
    }

    if (firstNameMatches.length > 1) {
        return { employee_id: "", matched: true };
    }

    return { employee_id: "", matched: false };
}

function matchEmployeeAtStart(
    rawClause: string,
    employees: ImportConstraintEmployee[]
) {
    const rawWords = rawClause.trim().split(/\s+/);
    const normalizedClause = normalizeForMatch(rawClause);
    const employeesByLongestName = [...employees].sort(
        (first, second) => second.name.length - first.name.length
    );

    for (const employee of employeesByLongestName) {
        const normalizedEmployeeName = normalizeForMatch(employee.name);

        if (
            normalizedClause === normalizedEmployeeName ||
            normalizedClause.startsWith(`${normalizedEmployeeName} `)
        ) {
            const wordCount = normalizedEmployeeName.split(" ").length;

            return {
                body: rawWords.slice(wordCount).join(" "),
                match: { employee_id: employee.id, matched: true },
            };
        }
    }

    const firstWord = rawWords[0];

    if (!firstWord) {
        return null;
    }

    const firstWordMatches = employees.filter(
        (employee) => firstName(employee.name) === normalizeForMatch(firstWord)
    );

    if (firstWordMatches.length === 1) {
        return {
            body: rawWords.slice(1).join(" "),
            match: { employee_id: firstWordMatches[0].id, matched: true },
        };
    }

    if (firstWordMatches.length > 1) {
        return {
            body: rawWords.slice(1).join(" "),
            match: { employee_id: "", matched: true },
        };
    }

    return null;
}

function splitClauses(text: string) {
    return text
        .split(/[\n.;]+/)
        .map((clause) => clause.trim())
        .filter(Boolean);
}

function buildDateFromDay(day: number, monthStart: string, monthEnd: string) {
    const lastDay = Number(monthEnd.slice(8, 10));

    if (!Number.isInteger(day) || day < 1 || day > lastDay) {
        return "";
    }

    return `${monthStart.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

function buildDateFromHoliday(value: string, monthStart: string) {
    const normalizedValue = normalizeForMatch(value);

    if (
        normalizedValue.includes("saint jonas") ||
        normalizedValue.includes("sao joao") ||
        normalizedValue.includes("s joao")
    ) {
        return `${monthStart.slice(0, 8)}24`;
    }

    return "";
}

function parseDayList(value: string) {
    const days = (value.match(/\d{1,2}/g) ?? []).map(Number);

    return [...new Set(days)];
}

function parseWeekIndexes(value: string) {
    const normalizedValue = normalizeForMatch(value);
    const indexes = new Set<number>();

    if (/\bprimeira\b/.test(normalizedValue)) indexes.add(1);
    if (/\bsegunda\b/.test(normalizedValue)) indexes.add(2);
    if (/\bterceira\b/.test(normalizedValue)) indexes.add(3);
    if (/\bquarta\b/.test(normalizedValue)) indexes.add(4);
    if (/\bquinta\b/.test(normalizedValue)) indexes.add(5);

    return [...indexes].sort((first, second) => first - second);
}

function weekDateRange(
    weekIndex: number,
    monthStart: string,
    monthEnd: string
): { startDate: string; endDate: string } | null {
    const lastDay = Number(monthEnd.slice(8, 10));
    const startDay = (weekIndex - 1) * 7 + 1;
    const endDay = Math.min(startDay + 6, lastDay);

    if (startDay > lastDay || startDay < 1) {
        return null;
    }

    return {
        startDate: buildDateFromDay(startDay, monthStart, monthEnd),
        endDate: buildDateFromDay(endDay, monthStart, monthEnd),
    };
}

function parseTurnCount(value: string) {
    const normalizedValue = normalizeForMatch(value);
    const explicitNumber = normalizedValue.match(/\b(\d+)\b/);

    if (explicitNumber) {
        return Number(explicitNumber[1]);
    }

    if (/\b(um|uma)\b/.test(normalizedValue)) return 1;
    if (/\b(dois|duas)\b/.test(normalizedValue)) return 2;
    if (/\b(tres|três)\b/.test(normalizedValue)) return 3;
    if (/\bquatro\b/.test(normalizedValue)) return 4;

    return null;
}

function datesForWeekday(monthStart: string, monthEnd: string, weekday: number) {
    const [year, month] = monthStart.slice(0, 7).split("-").map(Number);
    const lastDay = Number(monthEnd.slice(8, 10));
    const dates: string[] = [];

    for (let day = 1; day <= lastDay; day += 1) {
        const date = new Date(year, month - 1, day);
        if (date.getDay() !== weekday) {
            continue;
        }
        dates.push(buildDateFromDay(day, monthStart, monthEnd));
    }

    return dates.filter(Boolean);
}

function shiftByCode(
    shiftTypes: ImportConstraintShiftType[],
    code: "M" | "T"
) {
    return shiftTypes.find(
        (shiftType) => shiftType.code.toLowerCase() === code.toLowerCase()
    );
}

function shiftByAnyCode(
    shiftTypes: ImportConstraintShiftType[],
    code: string | null
) {
    if (!code) {
        return undefined;
    }

    return shiftTypes.find(
        (shiftType) =>
            normalizeForMatch(shiftType.code) === normalizeForMatch(code)
    );
}

function buildSuggestionKey(suggestion: ConstraintSuggestion) {
    return [
        suggestion.employee_id,
        suggestion.constraint_type,
        suggestion.shift_type_id,
        suggestion.specific_date,
        suggestion.start_date,
        suggestion.end_date,
    ].join("|");
}

function mergeSuggestions(
    baseSuggestions: ConstraintSuggestion[],
    extraSuggestions: ConstraintSuggestion[]
) {
    const seenSuggestionKeys = new Set(
        baseSuggestions.map((suggestion) => buildSuggestionKey(suggestion))
    );
    const mergedSuggestions = [...baseSuggestions];

    for (const suggestion of extraSuggestions) {
        const suggestionKey = buildSuggestionKey(suggestion);

        if (seenSuggestionKeys.has(suggestionKey)) {
            continue;
        }

        seenSuggestionKeys.add(suggestionKey);
        mergedSuggestions.push(suggestion);
    }

    return mergedSuggestions;
}

function compactDateSuggestions(suggestions: ConstraintSuggestion[]) {
    const rangeEligibleConstraintTypes = new Set<ConstraintType>([
        "preferred_day_off",
        "unavailable_shift",
    ]);
    const groupedByRangeKey = new Map<string, ConstraintSuggestion[]>();
    const passthroughSuggestions: ConstraintSuggestion[] = [];

    for (const suggestion of suggestions) {
        const isRangeEligible =
            rangeEligibleConstraintTypes.has(suggestion.constraint_type) &&
            Boolean(suggestion.specific_date) &&
            !suggestion.start_date &&
            !suggestion.end_date;

        if (!isRangeEligible) {
            passthroughSuggestions.push(suggestion);
            continue;
        }

        const rangeKey = [
            suggestion.employee_id,
            suggestion.constraint_type,
            suggestion.shift_type_id,
            suggestion.source_text,
            suggestion.notes,
        ].join("|");
        const current = groupedByRangeKey.get(rangeKey) ?? [];
        current.push(suggestion);
        groupedByRangeKey.set(rangeKey, current);
    }

    const compactedSuggestions: ConstraintSuggestion[] = [...passthroughSuggestions];

    for (const rangeSuggestions of groupedByRangeKey.values()) {
        const sorted = [...rangeSuggestions]
            .filter((suggestion) => Boolean(suggestion.specific_date))
            .sort((first, second) =>
                first.specific_date.localeCompare(second.specific_date)
            );

        let currentRangeStart: ConstraintSuggestion | null = null;
        let previousSuggestion: ConstraintSuggestion | null = null;

        function flushCurrentRange() {
            if (!currentRangeStart) {
                return;
            }

            const endSuggestion = previousSuggestion ?? currentRangeStart;

            if (currentRangeStart.id === endSuggestion.id) {
                compactedSuggestions.push(currentRangeStart);
            } else {
                compactedSuggestions.push({
                    ...currentRangeStart,
                    id: crypto.randomUUID(),
                    specific_date: "",
                    start_date: currentRangeStart.specific_date,
                    end_date: endSuggestion.specific_date,
                });
            }

            currentRangeStart = null;
            previousSuggestion = null;
        }

        for (const suggestion of sorted) {
            if (!currentRangeStart) {
                currentRangeStart = suggestion;
                previousSuggestion = suggestion;
                continue;
            }

            const previousDate = new Date(`${previousSuggestion?.specific_date}T00:00:00`);
            const nextDate = new Date(`${suggestion.specific_date}T00:00:00`);
            const diffInDays =
                (nextDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24);

            if (diffInDays === 1) {
                previousSuggestion = suggestion;
                continue;
            }

            flushCurrentRange();
            currentRangeStart = suggestion;
            previousSuggestion = suggestion;
        }

        flushCurrentRange();
    }

    return compactedSuggestions;
}

function createSuggestion(
    employeeMatch: EmployeeMatch,
    constraintType: ConstraintType,
    sourceText: string,
    values: Partial<Omit<ConstraintSuggestion, "id" | "constraint_type">> = {}
): ConstraintSuggestion {
    return {
        id: crypto.randomUUID(),
        employee_id: employeeMatch.employee_id,
        constraint_type: constraintType,
        shift_type_id: values.shift_type_id ?? "",
        specific_date: values.specific_date ?? "",
        start_date: values.start_date ?? "",
        end_date: values.end_date ?? "",
        notes: values.notes ?? "",
        source_text: sourceText,
    };
}

function parseClause(
    clauseBody: string,
    sourceText: string,
    employeeMatch: EmployeeMatch,
    monthStart: string,
    monthEnd: string,
    shiftTypes: ImportConstraintShiftType[]
) {
    const normalizedClause = normalizeForMatch(clauseBody);
    const suggestions: ConstraintSuggestion[] = [];
    const morningShift = shiftByCode(shiftTypes, "M");
    const afternoonShift = shiftByCode(shiftTypes, "T");
    const unavailableShiftMatch =
        /\bdias?\s+(.+?)\s+nao\s+(?:pode\s+)?fazer\s+(manhas?|tardes?)\b/.exec(
            normalizedClause
        );
    const unavailableBeforeShiftMatch =
        /\b((?:\d{1,2}\s*(?:e\s*)?)+)\s+nao\s+(?:posso\s+|pode\s+)?fazer\s+(manhas?|tardes?)\b/.exec(
            normalizedClause
        );
    const unavailableAfterShiftMatch =
        /\bnao\s+(?:posso\s+|pode\s+)?fazer\s+(manhas?|tardes?)\s+(?:nos?\s+)?dias?\s+(.+)\b/.exec(
            normalizedClause
        );

    if (unavailableShiftMatch) {
        const shiftType = unavailableShiftMatch[2].startsWith("manha")
            ? morningShift
            : afternoonShift;
        const days = parseDayList(unavailableShiftMatch[1]);

        for (const day of days) {
            suggestions.push(
                createSuggestion(employeeMatch, "unavailable_shift", sourceText, {
                    shift_type_id: shiftType?.id ?? "",
                    specific_date: buildDateFromDay(day, monthStart, monthEnd),
                })
            );
        }

        return suggestions;
    }

    if (unavailableBeforeShiftMatch) {
        const shiftType = unavailableBeforeShiftMatch[2].startsWith("manha")
            ? morningShift
            : afternoonShift;
        const days = parseDayList(unavailableBeforeShiftMatch[1]);

        for (const day of days) {
            suggestions.push(
                createSuggestion(employeeMatch, "unavailable_shift", sourceText, {
                    shift_type_id: shiftType?.id ?? "",
                    specific_date: buildDateFromDay(day, monthStart, monthEnd),
                })
            );
        }

        return suggestions;
    }

    if (unavailableAfterShiftMatch) {
        const shiftType = unavailableAfterShiftMatch[1].startsWith("manha")
            ? morningShift
            : afternoonShift;
        const days = parseDayList(unavailableAfterShiftMatch[2]);

        for (const day of days) {
            suggestions.push(
                createSuggestion(employeeMatch, "unavailable_shift", sourceText, {
                    shift_type_id: shiftType?.id ?? "",
                    specific_date: buildDateFromDay(day, monthStart, monthEnd),
                })
            );
        }

        return suggestions;
    }

    const vacationMatch = /\bferias?.*?\bde\s+(\d{1,2})\s+a\s+(\d{1,2})\b/.exec(
        normalizedClause
    );

    if (vacationMatch) {
        suggestions.push(
            createSuggestion(employeeMatch, "vacation", sourceText, {
                start_date: buildDateFromDay(
                    Number(vacationMatch[1]),
                    monthStart,
                    monthEnd
                ),
                end_date: buildDateFromDay(
                    Number(vacationMatch[2]),
                    monthStart,
                    monthEnd
                ),
            })
        );

        return suggestions;
    }

    const weeklyShiftCountFirstPattern =
        /\b(.+?)\s+turnos?\s+de\s+([a-z]\*?)\s+na\s+(.+?)\s+seman+a\b/.exec(
            normalizedClause
        );
    const weeklyShiftCountSecondPattern =
        /\bna\s+(.+?)\s+seman+a\s+(.+?)\s+turnos?\s+de\s+([a-z]\*?)\b/.exec(
            normalizedClause
        );

    if (weeklyShiftCountFirstPattern || weeklyShiftCountSecondPattern) {
        const turnCountText = weeklyShiftCountFirstPattern
            ? weeklyShiftCountFirstPattern[1]
            : (weeklyShiftCountSecondPattern?.[2] ?? "");
        const shiftCode = weeklyShiftCountFirstPattern
            ? weeklyShiftCountFirstPattern[2]
            : (weeklyShiftCountSecondPattern?.[3] ?? "");
        const weekText = weeklyShiftCountFirstPattern
            ? weeklyShiftCountFirstPattern[3]
            : (weeklyShiftCountSecondPattern?.[1] ?? "");
        const turnCount = parseTurnCount(turnCountText);
        const shiftType = shiftByAnyCode(shiftTypes, shiftCode);
        const weekIndexes = parseWeekIndexes(weekText);

        if (shiftType && weekIndexes.length > 0) {
            for (const weekIndex of weekIndexes) {
                const range = weekDateRange(weekIndex, monthStart, monthEnd);
                if (!range) {
                    continue;
                }

                suggestions.push(
                    createSuggestion(employeeMatch, "preferred_shift", sourceText, {
                        shift_type_id: shiftType.id,
                        start_date: range.startDate,
                        end_date: range.endDate,
                        notes: turnCount
                            ? `Objetivo: ${turnCount} turno(s) de ${shiftType.code} nesta semana.`
                            : `Objetivo semanal de ${shiftType.code}.`,
                    })
                );
            }
        }

        if (suggestions.length > 0) {
            return suggestions;
        }
    }

    const tuesdayIgnoreAfternoonMatch =
        /\b(?:as\s+)?tercas?\b.*\bignorar\b.*\bpreferenc(?:ia|ias)\b.*\btardes?\b/.exec(
            normalizedClause
        );

    if (tuesdayIgnoreAfternoonMatch && afternoonShift) {
        for (const dateValue of datesForWeekday(monthStart, monthEnd, 2)) {
            suggestions.push(
                createSuggestion(employeeMatch, "avoid_shift", sourceText, {
                    shift_type_id: afternoonShift.id,
                    specific_date: dateValue,
                    notes: "Ignorar preferência de tarde às terças.",
                })
            );
        }

        return suggestions;
    }

    const dayOffSingleMatch = /\bfolga\s+dia\s+(\d{1,2})\b/.exec(
        normalizedClause
    );

    if (dayOffSingleMatch) {
        suggestions.push(
            createSuggestion(employeeMatch, "preferred_day_off", sourceText, {
                specific_date: buildDateFromDay(
                    Number(dayOffSingleMatch[1]),
                    monthStart,
                    monthEnd
                ),
            })
        );

        return suggestions;
    }

    const dayOffListMatch = /\bfolgas?\s+(.+)$/.exec(normalizedClause);

    if (dayOffListMatch) {
        const days = parseDayList(dayOffListMatch[1]);

        for (const day of days) {
            suggestions.push(
                createSuggestion(employeeMatch, "preferred_day_off", sourceText, {
                    specific_date: buildDateFromDay(day, monthStart, monthEnd),
                })
            );
        }

        return suggestions;
    }

    const holidayDate = buildDateFromHoliday(normalizedClause, monthStart);

    if (holidayDate) {
        suggestions.push(
            createSuggestion(employeeMatch, "preferred_day_off", sourceText, {
                specific_date: holidayDate,
            })
        );

        return suggestions;
    }

    if (/\bprefere\s+tardes?\b/.test(normalizedClause)) {
        suggestions.push(
            createSuggestion(employeeMatch, "preferred_shift", sourceText, {
                shift_type_id: afternoonShift?.id ?? "",
            })
        );

        return suggestions;
    }

    if (/\bprefere\s+manhas?\b/.test(normalizedClause)) {
        suggestions.push(
            createSuggestion(employeeMatch, "preferred_shift", sourceText, {
                shift_type_id: morningShift?.id ?? "",
            })
        );
    }

    return suggestions;
}

function splitImportTextBlocks(
    text: string,
    employees: ImportConstraintEmployee[]
) {
    const blocks: ImportTextBlock[] = [];
    const contextLines: string[] = [];
    const orphanLines: string[] = [];
    let currentBlock: ImportTextBlock | null = null;
    let lastKnownEmployeeMatch: EmployeeMatch | null = null;
    let hasSeenMatchedEmployee = false;
    let isInsideContextSection = false;

    function pushCurrentBlock() {
        if (!currentBlock) {
            return;
        }

        blocks.push({
            ...currentBlock,
            sourceText: `${currentBlock.label}:\n${currentBlock.text}`.trim(),
            text: currentBlock.text.trim(),
        });
        currentBlock = null;
    }

    for (const line of text.split(/\r?\n/)) {
        const trimmedLine = line.trim();

        if (isInsideContextSection) {
            contextLines.push(line);
            continue;
        }

        if (isContextSectionHeader(trimmedLine)) {
            pushCurrentBlock();
            isInsideContextSection = true;
            const colonIndex = line.indexOf(":");
            const inlineContextText =
                colonIndex >= 0 ? line.slice(colonIndex + 1).trim() : "";

            if (inlineContextText) {
                contextLines.push(inlineContextText);
            }
            continue;
        }

        const headerMatch =
            /^(.{1,60}):$/.exec(trimmedLine) ??
            /^([a-zà-ÿ][a-zà-ÿ' -]{1,59})$/i.exec(trimmedLine);

        if (headerMatch) {
            const employeeMatch = matchEmployeeName(headerMatch[1], employees);

            if (employeeMatch.matched) {
                pushCurrentBlock();
                currentBlock = {
                    employeeMatch,
                    label: headerMatch[1].trim(),
                    sourceText: "",
                    text: "",
                };
                if (employeeMatch.employee_id) {
                    lastKnownEmployeeMatch = employeeMatch;
                    hasSeenMatchedEmployee = true;
                }
                continue;
            }
        }

        if (!currentBlock && lastKnownEmployeeMatch?.employee_id) {
            currentBlock = {
                employeeMatch: lastKnownEmployeeMatch,
                label: "Continuação",
                sourceText: "",
                text: "",
            };
        }

        if (currentBlock) {
            currentBlock.text = `${currentBlock.text}${line}\n`;
            if (currentBlock.employeeMatch.employee_id) {
                lastKnownEmployeeMatch = currentBlock.employeeMatch;
                hasSeenMatchedEmployee = true;
            }
        } else {
            if (hasSeenMatchedEmployee && trimmedLine) {
                currentBlock = {
                    employeeMatch:
                        lastKnownEmployeeMatch ?? { employee_id: "", matched: false },
                    label: "Continuação",
                    sourceText: "",
                    text: `${line}\n`,
                };
            } else {
                orphanLines.push(line);
            }
        }
    }

    pushCurrentBlock();

    const relevantOrphanLines = orphanLines.filter((line) =>
        hasStrongConstraintSignals(line)
    );
    const contextualOrphanLines = orphanLines.filter(
        (line) => !hasStrongConstraintSignals(line)
    );

    if (relevantOrphanLines.length > 0) {
        blocks.push({
            employeeMatch: { employee_id: "", matched: false },
            label: "Texto sem funcionário identificado",
            sourceText: relevantOrphanLines.join("\n").trim(),
            text: relevantOrphanLines.join("\n").trim(),
        });
    }

    return {
        blocks,
        contextText: [...contextLines, ...contextualOrphanLines].join("\n").trim(),
    };
}

function clauseLooksLikeDayList(value: string) {
    const normalizedValue = normalizeForMatch(value);

    return /^\d{1,2}(?:\s+(?:e\s+)?\d{1,2})*$/.test(normalizedValue);
}

function parseImportBlockByRules(
    block: ImportTextBlock,
    employees: ImportConstraintEmployee[],
    monthStart: string,
    monthEnd: string,
    shiftTypes: ImportConstraintShiftType[]
) {
    const suggestions: ConstraintSuggestion[] = [];
    const unparsedClauses: string[] = [];
    const warnings: ParseWarning[] = [];
    let expectsDayOffList = false;
    let currentEmployeeMatch: EmployeeMatch | null = block.employeeMatch
        .employee_id
        ? block.employeeMatch
        : null;

    for (const rawClause of splitClauses(block.text)) {
        if (isLikelyIgnorableClause(rawClause)) {
            continue;
        }

        const colonIndex = rawClause.indexOf(":");
        let employeeMatch: EmployeeMatch =
            block.employeeMatch.employee_id || block.employeeMatch.matched
                ? block.employeeMatch
                : currentEmployeeMatch ?? block.employeeMatch;
        let clauseBody = rawClause;

        if (!employeeMatch.employee_id && colonIndex > 0 && colonIndex <= 60) {
            employeeMatch = matchEmployeeName(
                rawClause.slice(0, colonIndex),
                employees
            );
            clauseBody = rawClause.slice(colonIndex + 1).trim();
            currentEmployeeMatch = employeeMatch.employee_id
                ? employeeMatch
                : currentEmployeeMatch;
        } else if (!employeeMatch.employee_id) {
            const matchedAtStart = matchEmployeeAtStart(rawClause, employees);

            if (matchedAtStart) {
                employeeMatch = matchedAtStart.match;
                clauseBody = matchedAtStart.body.trim();
                currentEmployeeMatch = employeeMatch.employee_id
                    ? employeeMatch
                    : currentEmployeeMatch;
            }
        }

        const parsedClauseSuggestions = parseClause(
            clauseBody || rawClause,
            rawClause,
            employeeMatch,
            monthStart,
            monthEnd,
            shiftTypes
        );

        if (parsedClauseSuggestions.length > 0) {
            suggestions.push(...parsedClauseSuggestions);
            if (
                normalizeForMatch(rawClause).includes("saint jonas") &&
                parsedClauseSuggestions.some(
                    (suggestion) => suggestion.constraint_type === "preferred_day_off"
                )
            ) {
                warnings.push({
                    message:
                        "Data inferida de \"Saint Jonas\" para dia 24. Confirma se está correta.",
                    sourceText: rawClause,
                });
            }
            expectsDayOffList = false;
            continue;
        }

        const normalizedClause = normalizeForMatch(clauseBody || rawClause);

        if (normalizedClause.includes("folga")) {
            const days = parseDayList(normalizedClause);

            if (days.length > 0) {
                for (const day of days) {
                    suggestions.push(
                        createSuggestion(
                            employeeMatch,
                            "preferred_day_off",
                            rawClause,
                            {
                                specific_date: buildDateFromDay(
                                    day,
                                    monthStart,
                                    monthEnd
                                ),
                            }
                        )
                    );
                }
                expectsDayOffList = false;
            } else {
                expectsDayOffList = true;
            }

            continue;
        }

        if (expectsDayOffList && clauseLooksLikeDayList(rawClause)) {
            for (const day of parseDayList(rawClause)) {
                suggestions.push(
                    createSuggestion(employeeMatch, "preferred_day_off", rawClause, {
                        specific_date: buildDateFromDay(day, monthStart, monthEnd),
                    })
                );
            }
            expectsDayOffList = false;
            continue;
        }

        if (hasAiActionableSignal(rawClause) || hasAiActionableSignal(clauseBody)) {
            unparsedClauses.push(rawClause);
        }
    }

    return {
        suggestions,
        unparsedText: unparsedClauses.join("\n"),
        warnings,
    };
}

function findEmployeeMentionInText(
    value: string,
    employees: ImportConstraintEmployee[]
) {
    const normalizedValue = normalizeForMatch(value);

    return (
        employees.find((employee) =>
            normalizedValue.includes(normalizeForMatch(employee.name))
        ) ??
        employees.find((employee) =>
            normalizedValue.includes(firstName(employee.name))
        )
    );
}

function analyzeContextText(
    contextText: string,
    employees: ImportConstraintEmployee[]
) {
    const warnings: ParseWarning[] = [];
    const linesForAi: string[] = [];

    for (const line of contextText.split(/\r?\n/)) {
        const trimmedLine = line.trim();
        const normalizedLine = normalizeForMatch(trimmedLine);

        if (!trimmedLine) {
            continue;
        }

        if (isLikelyIgnorableClause(trimmedLine)) {
            continue;
        }

        const mentionedEmployee = findEmployeeMentionInText(trimmedLine, employees);
        const looksLikePermanentPreference =
            (/\bpermanent(?:e|emente)?\b/.test(normalizedLine) ||
                /\bsempre\b/.test(normalizedLine)) &&
            /\bprefer(?:e|encia|encias)\b/.test(normalizedLine) &&
            /\b(manhas?|tardes?)\b/.test(normalizedLine);

        if (looksLikePermanentPreference && mentionedEmployee) {
            warnings.push({
                message: `Preferência permanente do ${mentionedEmployee.name.split(" ")[0]} ignorada nesta importação mensal.`,
                sourceText: trimmedLine,
            });
            continue;
        }

        linesForAi.push(trimmedLine);
    }

    return {
        contextTextForAi: linesForAi.join("\n").trim(),
        warnings,
    };
}

function parseImportTextDetailed(
    text: string,
    employees: ImportConstraintEmployee[],
    monthStart: string,
    monthEnd: string,
    shiftTypes: ImportConstraintShiftType[]
): ImportTextParseResult {
    const { blocks, contextText } = splitImportTextBlocks(text, employees);
    const contextAnalysis = analyzeContextText(contextText, employees);
    const blockResults: ImportTextParseResult["blockResults"] = [];
    const suggestions: ConstraintSuggestion[] = [];
    const unparsedBlocks: ImportTextParseResult["unparsedBlocks"] = [];
    const warnings: ParseWarning[] = [...contextAnalysis.warnings];

    for (const block of blocks) {
        const blockResult = parseImportBlockByRules(
            block,
            employees,
            monthStart,
            monthEnd,
            shiftTypes
        );

        suggestions.push(...blockResult.suggestions);
        warnings.push(...blockResult.warnings);
        blockResults.push({
            block,
            suggestions: blockResult.suggestions,
            unparsedText: blockResult.unparsedText,
        });

        if (blockResult.unparsedText) {
            unparsedBlocks.push({
                label: block.label,
                text: blockResult.unparsedText,
            });
        }
    }

    return {
        blockResults,
        blocks,
        contextText: contextAnalysis.contextTextForAi,
        suggestions,
        unparsedBlocks,
        warnings,
    };
}

function buildSuggestionsFromAi(
    aiSuggestions: ParseScheduleConstraintsWithAiSuggestion[],
    shiftTypes: ImportConstraintShiftType[]
) {
    return aiSuggestions.map((suggestion) =>
        createSuggestion(
            {
                employee_id: suggestion.matchedEmployeeId ?? "",
            },
            suggestion.constraintType,
            suggestion.sourceText,
            {
                shift_type_id:
                    shiftByAnyCode(shiftTypes, suggestion.shiftCode)?.id ?? "",
                specific_date: suggestion.specificDate ?? "",
                start_date: suggestion.startDate ?? "",
                end_date: suggestion.endDate ?? "",
            }
        )
    );
}

function buildAiBlockInput(contextText: string, block: ImportTextBlock) {
    return [
        contextText ? `Contexto adicional:\n${contextText}` : "",
        `${block.label}:\n${block.text}`,
    ]
        .filter(Boolean)
        .join("\n\n");
}

function isDateInMonth(dateValue: string, monthStart: string, monthEnd: string) {
    if (!dateValue) {
        return true;
    }

    return dateValue >= monthStart && dateValue <= monthEnd;
}

function getSuggestionIssue(
    suggestion: ConstraintSuggestion,
    monthStart: string,
    monthEnd: string
) {
    if (!suggestion.employee_id) {
        return "Escolhe o funcionário.";
    }

    if (!isConstraintType(suggestion.constraint_type)) {
        return "Escolhe o tipo.";
    }

    if (
        shiftRequiredConstraintTypes.has(suggestion.constraint_type) &&
        !suggestion.shift_type_id
    ) {
        return "Escolhe o turno.";
    }

    if (
        suggestion.constraint_type === "vacation" &&
        (!suggestion.start_date || !suggestion.end_date)
    ) {
        return "Confirma o intervalo de férias.";
    }

    if (
        (suggestion.constraint_type === "preferred_day_off" ||
            suggestion.constraint_type === "unavailable_shift") &&
        !suggestion.specific_date &&
        !suggestion.start_date &&
        !suggestion.end_date
    ) {
        return "Escolhe a data.";
    }

    if (
        !isDateInMonth(suggestion.specific_date, monthStart, monthEnd) ||
        !isDateInMonth(suggestion.start_date, monthStart, monthEnd) ||
        !isDateInMonth(suggestion.end_date, monthStart, monthEnd)
    ) {
        return "Confirma as datas.";
    }

    if (
        suggestion.start_date &&
        suggestion.end_date &&
        suggestion.end_date < suggestion.start_date
    ) {
        return "A data fim não pode ser anterior ao início.";
    }

    return null;
}

function ConfirmImportButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={disabled || pending}>
            {pending ? "A importar..." : "Confirmar importação"}
        </Button>
    );
}

export function ImportConstraintsDialog({
    employees,
    monthEnd,
    monthStart,
    scheduleId,
    shiftTypes,
}: ImportConstraintsDialogProps) {
    const [rawText, setRawText] = useState("");
    const [parseMessage, setParseMessage] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<ConstraintSuggestion[]>([]);
    const [parseWarnings, setParseWarnings] = useState<ParseWarning[]>([]);
    const [parsedBy, setParsedBy] = useState<ParsedBy | null>(null);
    const [unparsedBlocks, setUnparsedBlocks] = useState<
        ImportTextParseResult["unparsedBlocks"]
    >([]);
    const [isAiPending, setIsAiPending] = useState(false);
    const cancelParsingRef = useRef(false);
    const [state, formAction] = useActionState(
        importScheduleConstraints,
        initialState
    );
    const { closeDialog, open, setOpen, showFormAgain, visibleState } =
        useActionDialog(state, initialState);
    const suggestionIssues = useMemo(
        () =>
            suggestions.map((suggestion) =>
                getSuggestionIssue(suggestion, monthStart, monthEnd)
            ),
        [monthEnd, monthStart, suggestions]
    );
    const hasInvalidSuggestions = suggestionIssues.some(Boolean);
    const importPayload = useMemo(
        () =>
            JSON.stringify(
                suggestions.map((suggestion) => ({
                    employee_id: suggestion.employee_id,
                    constraint_type: suggestion.constraint_type,
                    shift_type_id: suggestion.shift_type_id,
                    specific_date: suggestion.specific_date,
                    start_date: suggestion.start_date,
                    end_date: suggestion.end_date,
                    notes: suggestion.notes,
                    source_text: suggestion.source_text,
                }))
            ),
        [suggestions]
    );

    function resetDraft() {
        setRawText("");
        setParseMessage(null);
        setSuggestions([]);
        setParseWarnings([]);
        setParsedBy(null);
        setUnparsedBlocks([]);
    }

    function handleOpenChange(nextOpen: boolean) {
        if (!nextOpen && isAiPending) {
            return;
        }

        if (!nextOpen) {
            resetDraft();
        }

        setOpen(nextOpen);
    }

    function handleCloseDialog() {
        resetDraft();
        closeDialog();
    }

    function updateSuggestion(
        suggestionId: string,
        values: Partial<ConstraintSuggestion>
    ) {
        setSuggestions((currentSuggestions) =>
            currentSuggestions.map((suggestion) =>
                suggestion.id === suggestionId
                    ? { ...suggestion, ...values }
                    : suggestion
            )
        );
    }

    function removeSuggestion(suggestionId: string) {
        setSuggestions((currentSuggestions) =>
            currentSuggestions.filter((suggestion) => suggestion.id !== suggestionId)
        );
    }

    function clearGeneratedSuggestions() {
        setSuggestions([]);
        setParseWarnings([]);
        setParsedBy(null);
        setUnparsedBlocks([]);
        setParseMessage(
            "Sugestões limpas. O texto original ficou guardado para poderes gerar novamente."
        );
    }

    function handleCancelParsing() {
        cancelParsingRef.current = true;
        setParseMessage("A interromper a interpretação...");
    }

    async function handleParseText() {
        cancelParsingRef.current = false;
        setParseWarnings([]);
        setParsedBy(null);
        setUnparsedBlocks([]);
        const rulesResult = parseImportTextDetailed(
            rawText,
            employees,
            monthStart,
            monthEnd,
            shiftTypes
        );

        let nextSuggestions = compactDateSuggestions(rulesResult.suggestions);
        const nextWarnings: ParseWarning[] = [...rulesResult.warnings];
        const nextUnparsedBlocks: ImportTextParseResult["unparsedBlocks"] = [];
        const blocksNeedingAi = rulesResult.blockResults.filter(
            (blockResult) =>
                blockResult.suggestions.length === 0 ||
                Boolean(blockResult.unparsedText) ||
                blockResult.suggestions.some((suggestion) =>
                    getSuggestionIssue(suggestion, monthStart, monthEnd)
                )
        );

        setSuggestions(compactDateSuggestions(nextSuggestions));

        if (blocksNeedingAi.length === 0) {
            setParsedBy("rules");
            setParseWarnings(nextWarnings);
            setUnparsedBlocks(rulesResult.unparsedBlocks);
            setParseMessage(
                nextSuggestions.length > 0
                    ? `${nextSuggestions.length} ${
                          nextSuggestions.length === 1
                              ? "sugestão encontrada pelo parser por regras"
                              : "sugestões encontradas pelo parser por regras"
                      }. OpenRouter não foi chamado porque o parser por regras já interpretou todos os blocos.`
                    : "Não encontrei pedidos mensais claros para interpretar nem blocos pendentes para enviar ao OpenRouter."
            );

            return;
        }

        setParseMessage(
            nextSuggestions.length > 0
                ? "O parser por regras encontrou parte do texto. Vou tentar completar os blocos em falta com OpenRouter."
                : "O parser por regras não encontrou sugestões. Vou tentar interpretar os blocos com OpenRouter."
        );
        setIsAiPending(true);
        let usedAi = false;

        try {
            for (const blockResult of blocksNeedingAi) {
                if (cancelParsingRef.current) {
                    break;
                }

                const result = await parseScheduleConstraintsWithAi({
                    inputText: buildAiBlockInput(
                        rulesResult.contextText,
                        blockResult.block
                    ),
                    scheduleId,
                });

                if (cancelParsingRef.current) {
                    break;
                }

                if (result.status === "error") {
                    nextWarnings.push({
                        message: `A IA falhou para o bloco da/o ${blockResult.block.label}, mas podes inserir manualmente.`,
                        sourceText:
                            result.message ??
                            blockResult.unparsedText ??
                            blockResult.block.sourceText,
                    });

                    if (blockResult.unparsedText) {
                        nextUnparsedBlocks.push({
                            label: blockResult.block.label,
                            text: blockResult.unparsedText,
                        });
                    }

                    continue;
                }

                const aiSuggestions = buildSuggestionsFromAi(
                    result.suggestions ?? [],
                    shiftTypes
                );

                nextWarnings.push(
                    ...(result.warnings ?? []).map((warning) => ({
                        message: `${blockResult.block.label}: ${warning.message}`,
                        sourceText: warning.sourceText,
                    }))
                );

                if (aiSuggestions.length === 0) {
                    nextWarnings.push({
                        message: `OpenRouter não encontrou sugestões para o bloco da/o ${blockResult.block.label}.`,
                        sourceText: blockResult.block.sourceText,
                    });

                    if (blockResult.unparsedText) {
                        nextUnparsedBlocks.push({
                            label: blockResult.block.label,
                            text: blockResult.unparsedText,
                        });
                    }

                    continue;
                }

                usedAi = true;
                nextSuggestions = mergeSuggestions(nextSuggestions, aiSuggestions);
            }

            if (cancelParsingRef.current) {
                setSuggestions(compactDateSuggestions(nextSuggestions));
                setParseWarnings(nextWarnings);
                setUnparsedBlocks(nextUnparsedBlocks);
                setParsedBy(
                    usedAi && rulesResult.suggestions.length > 0
                        ? "mixed"
                        : usedAi
                          ? "ai"
                          : "rules"
                );
                setParseMessage(
                    "Interpretação interrompida. Podes retomar ao clicar novamente em gerar sugestões."
                );
                return;
            }

            setSuggestions(compactDateSuggestions(nextSuggestions));
            setParseWarnings(nextWarnings);
            setUnparsedBlocks(nextUnparsedBlocks);
            setParsedBy(
                usedAi && rulesResult.suggestions.length > 0
                    ? "mixed"
                    : usedAi
                      ? "ai"
                      : "rules"
            );
            setParseMessage(
                nextSuggestions.length === 0
                    ? "Não consegui criar sugestões automáticas. Podes ajustar o texto ou inserir manualmente."
                    : `${nextSuggestions.length} ${
                          nextSuggestions.length === 1
                              ? "sugestão pronta"
                              : "sugestões prontas"
                      } para rever. ${
                          nextWarnings.length > 0 || nextUnparsedBlocks.length > 0
                              ? "Alguns blocos ficaram com avisos."
                              : "Todos os blocos foram processados."
                      }`
            );
        } finally {
            setIsAiPending(false);
        }
    }

    function handleImportAnother() {
        resetDraft();
        showFormAgain();
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" disabled={employees.length === 0}>
                    <FileTextIcon />
                    Importar de texto
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Importar pedidos/restrições</DialogTitle>
                    <DialogDescription>
                        Gera sugestões por regras simples e confirma manualmente antes
                        de gravar.
                    </DialogDescription>
                </DialogHeader>

                {visibleState.status === "success" ? (
                    <div className="grid gap-4">
                        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
                            {visibleState.message}
                        </p>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleImportAnother}
                            >
                                Importar outro texto
                            </Button>
                            <Button type="button" onClick={handleCloseDialog}>
                                Fechar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="relative grid gap-5">
                        <div className="grid gap-2">
                            <Label htmlFor="schedule-constraints-import-text">
                                Texto original
                            </Label>
                            <Textarea
                                id="schedule-constraints-import-text"
                                value={rawText}
                                onChange={(event) => setRawText(event.target.value)}
                                disabled={isAiPending}
                                placeholder="Ex: Ana: férias de 8 a 12. Dia 16 não pode fazer tarde. Tiago prefere tardes."
                                className="min-h-24 max-h-48"
                            />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            {parseMessage ? (
                                <p className="text-sm text-muted-foreground">
                                    {parseMessage}
                                </p>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Nada é gravado até confirmares a importação.
                                </p>
                            )}
                            <div className="flex flex-col gap-3 sm:items-end">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleParseText}
                                    disabled={
                                        rawText.trim().length === 0 || isAiPending
                                    }
                                >
                                    {isAiPending ? "A interpretar..." : "Gerar sugestões"}
                                </Button>
                            </div>
                        </div>

                        {parsedBy ? (
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <span>Origem da interpretação:</span>
                                <Badge variant="outline">
                                    {parsedBy === "rules"
                                        ? "Regras"
                                        : parsedBy === "ai"
                                          ? "OpenRouter"
                                          : "Regras + OpenRouter"}
                                </Badge>
                            </div>
                        ) : null}

                        {parseWarnings.length > 0 ? (
                            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                                <p className="font-medium">Avisos da interpretação</p>
                                <ul className="mt-2 list-disc space-y-1 pl-5">
                                    {parseWarnings.map((warning, index) => (
                                        <li key={`${warning.sourceText}-${index}`}>
                                            {warning.message}
                                            <span className="block text-xs opacity-80">
                                                {warning.sourceText}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}

                        {unparsedBlocks.length > 0 ? (
                            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                                <p className="font-medium text-foreground">
                                    Texto ainda não interpretado
                                </p>
                                <div className="mt-2 grid gap-2">
                                    {unparsedBlocks.map((block, index) => (
                                        <div
                                            key={`${block.label}-${index}`}
                                            className="rounded-md bg-background p-2"
                                        >
                                            <p className="text-xs font-medium text-foreground">
                                                {block.label}
                                            </p>
                                            <p className="mt-1 whitespace-pre-wrap text-xs">
                                                {block.text}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {suggestions.length > 0 ? (
                            <form action={formAction} className="grid gap-4">
                                <input
                                    type="hidden"
                                    name="schedule_id"
                                    value={scheduleId}
                                />
                                <input
                                    type="hidden"
                                    name="suggestions_json"
                                    value={importPayload}
                                />

                                <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        {suggestions.length}{" "}
                                        {suggestions.length === 1
                                            ? "pedido gerado"
                                            : "pedidos gerados"}{" "}
                                        para rever.
                                    </p>
                                    <div className="sm:ml-auto">
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={clearGeneratedSuggestions}
                                        >
                                            <Trash2Icon />
                                            Limpar tudo
                                        </Button>
                                    </div>
                                </div>

                                <div className="max-h-[42vh] overflow-auto rounded-md border">
                                    <table className="w-full min-w-[1080px] text-sm">
                                        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">
                                                    Funcionário
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Tipo
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Turno
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Data específica
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Data início
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Data fim
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Texto original
                                                </th>
                                                <th className="px-3 py-2 font-medium">
                                                    Estado
                                                </th>
                                                <th className="px-3 py-2" />
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {suggestions.map((suggestion, index) => {
                                                const issue = suggestionIssues[index];

                                                return (
                                                    <tr key={suggestion.id}>
                                                        <td className="px-3 py-2 align-top">
                                                            <select
                                                                value={suggestion.employee_id}
                                                                onChange={(event) =>
                                                                    updateSuggestion(
                                                                        suggestion.id,
                                                                        {
                                                                            employee_id:
                                                                                event.target.value,
                                                                        }
                                                                    )
                                                                }
                                                                className={cn(
                                                                    selectClassName,
                                                                    !suggestion.employee_id &&
                                                                        "border-amber-300 ring-3 ring-amber-100"
                                                                )}
                                                            >
                                                                <option value="">
                                                                    Escolher funcionário
                                                                </option>
                                                                {employees.map(
                                                                    (employee) => (
                                                                        <option
                                                                            key={employee.id}
                                                                            value={employee.id}
                                                                        >
                                                                            {employee.name}
                                                                        </option>
                                                                    )
                                                                )}
                                                            </select>
                                                        </td>
                                                        <td className="px-3 py-2 align-top">
                                                            <select
                                                                value={suggestion.constraint_type}
                                                                onChange={(event) => {
                                                                    const nextValue =
                                                                        event.target.value;

                                                                    if (
                                                                        isConstraintType(
                                                                            nextValue
                                                                        )
                                                                    ) {
                                                                        updateSuggestion(
                                                                            suggestion.id,
                                                                            {
                                                                                constraint_type:
                                                                                    nextValue,
                                                                            }
                                                                        );
                                                                    }
                                                                }}
                                                                className={selectClassName}
                                                            >
                                                                {constraintTypeOptions.map(
                                                                    (option) => (
                                                                        <option
                                                                            key={option.value}
                                                                            value={option.value}
                                                                        >
                                                                            {option.label}
                                                                        </option>
                                                                    )
                                                                )}
                                                            </select>
                                                        </td>
                                                        <td className="px-3 py-2 align-top">
                                                            <select
                                                                value={suggestion.shift_type_id}
                                                                onChange={(event) =>
                                                                    updateSuggestion(
                                                                        suggestion.id,
                                                                        {
                                                                            shift_type_id:
                                                                                event.target.value,
                                                                        }
                                                                    )
                                                                }
                                                                className={selectClassName}
                                                            >
                                                                <option value="">
                                                                    Sem turno
                                                                </option>
                                                                {shiftTypes.map((shiftType) => (
                                                                    <option
                                                                        key={shiftType.id}
                                                                        value={shiftType.id}
                                                                    >
                                                                        {shiftType.code} -{" "}
                                                                        {shiftType.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td className="px-3 py-2 align-top">
                                                            <Input
                                                                type="date"
                                                                min={monthStart}
                                                                max={monthEnd}
                                                                value={
                                                                    suggestion.specific_date
                                                                }
                                                                onChange={(event) =>
                                                                    updateSuggestion(
                                                                        suggestion.id,
                                                                        {
                                                                            specific_date:
                                                                                event.target.value,
                                                                        }
                                                                    )
                                                                }
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 align-top">
                                                            <Input
                                                                type="date"
                                                                min={monthStart}
                                                                max={monthEnd}
                                                                value={suggestion.start_date}
                                                                onChange={(event) =>
                                                                    updateSuggestion(
                                                                        suggestion.id,
                                                                        {
                                                                            start_date:
                                                                                event.target.value,
                                                                        }
                                                                    )
                                                                }
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 align-top">
                                                            <Input
                                                                type="date"
                                                                min={monthStart}
                                                                max={monthEnd}
                                                                value={suggestion.end_date}
                                                                onChange={(event) =>
                                                                    updateSuggestion(
                                                                        suggestion.id,
                                                                        {
                                                                            end_date:
                                                                                event.target.value,
                                                                        }
                                                                    )
                                                                }
                                                            />
                                                        </td>
                                                        <td className="min-w-56 px-3 py-2 align-top">
                                                            <Textarea
                                                                value={suggestion.source_text}
                                                                onChange={(event) =>
                                                                    updateSuggestion(
                                                                        suggestion.id,
                                                                        {
                                                                            source_text:
                                                                                event.target.value,
                                                                        }
                                                                    )
                                                                }
                                                                className="min-h-9"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 align-top">
                                                            {issue ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
                                                                >
                                                                    Precisa confirmação
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="secondary">
                                                                    Válido
                                                                </Badge>
                                                            )}
                                                            {issue ? (
                                                                <p className="mt-1 max-w-36 text-xs text-muted-foreground">
                                                                    {issue}
                                                                </p>
                                                            ) : null}
                                                        </td>
                                                        <td className="px-3 py-2 align-top">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                aria-label="Remover sugestão"
                                                                onClick={() =>
                                                                    removeSuggestion(
                                                                        suggestion.id
                                                                    )
                                                                }
                                                            >
                                                                <Trash2Icon />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {visibleState.status === "error" &&
                                visibleState.message ? (
                                    <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                        {visibleState.message}
                                    </p>
                                ) : null}

                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCloseDialog}
                                    >
                                        Cancelar
                                    </Button>
                                    <ConfirmImportButton
                                        disabled={
                                            suggestions.length === 0 ||
                                            hasInvalidSuggestions
                                        }
                                    />
                                </DialogFooter>
                            </form>
                        ) : null}

                        {isAiPending ? (
                            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-background/85">
                                <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-md border bg-card p-6 text-center shadow-sm">
                                    <Loader2Icon
                                        className="size-8 animate-spin text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        A IA está a interpretar o texto. Durante este processo a
                                        edição fica bloqueada.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCancelParsing}
                                    >
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
