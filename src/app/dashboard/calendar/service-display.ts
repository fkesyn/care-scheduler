function normalizedServiceName(serviceName: string | null | undefined) {
    const name = serviceName?.trim();

    if (!name) {
        return "";
    }

    return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-PT");
}

export function calendarServiceLabel(
    serviceName: string | null | undefined,
    fallback = "Serviço"
) {
    const name = serviceName?.trim();

    if (!name) {
        return fallback;
    }

    const normalizedName = normalizedServiceName(name);

    if (
        normalizedName === "ta" ||
        normalizedName.includes("tensao arterial") ||
        normalizedName.includes("pressao arterial")
    ) {
        return "TA";
    }

    return name;
}

export function clinicalRecordTypeForService(
    serviceName: string | null | undefined,
    measurementType: string | null | undefined
) {
    if (
        measurementType === "blood_pressure" ||
        measurementType === "glucose" ||
        measurementType === "wound_care"
    ) {
        return measurementType;
    }

    const normalizedName = normalizedServiceName(serviceName);

    if (
        normalizedName === "ta" ||
        normalizedName.includes("tensao arterial") ||
        normalizedName.includes("pressao arterial")
    ) {
        return "blood_pressure";
    }

    if (
        normalizedName.includes("glicemia") ||
        normalizedName.includes("glucose")
    ) {
        return "glucose";
    }

    if (normalizedName.includes("ferida")) {
        return "wound_care";
    }

    return null;
}
