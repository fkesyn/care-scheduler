"use client";

import { useRouter } from "next/navigation";

type Location = {
    id: string;
    name: string;
};

type Employee = {
    id: string;
    name: string;
};

type PatientOption = {
    id: string;
    name: string;
    location_id: string | null;
};

type ServiceOption = {
    id: string;
    name: string;
};

type MonthFiltersProps = {
    selectedDate: string;
    selectedLocationId: string;
    selectedEmployeeId: string;
    selectedPatientId: string;
    selectedServiceId: string;
    locations: Location[];
    employees: Employee[];
    patients: PatientOption[];
    services: ServiceOption[];
};

export function MonthFilters({
                                 selectedDate,
                                 selectedLocationId,
                                 selectedEmployeeId,
                                 selectedPatientId,
                                 selectedServiceId,
                                 locations,
                                 employees,
                                 patients,
                                 services,
                             }: MonthFiltersProps) {
    const router = useRouter();

    function updateFilters(overrides: {
        locationId?: string;
        employeeId?: string;
        patientId?: string;
        serviceId?: string;
    }) {
        const query = new URLSearchParams();

        query.set("date", selectedDate);

        const locationId = overrides.locationId ?? selectedLocationId;
        const employeeId = overrides.employeeId ?? selectedEmployeeId;
        const patientId = overrides.patientId ?? selectedPatientId;
        const serviceId = overrides.serviceId ?? selectedServiceId;

        if (locationId) query.set("locationId", locationId);
        if (employeeId) query.set("employeeId", employeeId);
        if (patientId) query.set("patientId", patientId);
        if (serviceId) query.set("serviceId", serviceId);

        router.push(`/dashboard/calendar/month?${query.toString()}`);
    }

    const filteredPatients = patients.filter(
        (patient) => !selectedLocationId || patient.location_id === selectedLocationId
    );

    return (
        <section className="rounded-lg border bg-card p-4 shadow-xs">
            <div className="grid gap-4 md:grid-cols-4">
                <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="location-filter">
                        Localização
                    </label>
                    <select
                        id="location-filter"
                        value={selectedLocationId}
                        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
                        onChange={(event) => {
                            updateFilters({
                                locationId: event.target.value,
                                patientId: "",
                            });
                        }}
                    >
                        {locations.map((location) => (
                            <option key={location.id} value={location.id}>
                                {location.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="employee-filter">
                        Funcionário
                    </label>
                    <select
                        id="employee-filter"
                        value={selectedEmployeeId}
                        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
                        onChange={(event) => {
                            updateFilters({
                                employeeId: event.target.value,
                            });
                        }}
                    >
                        <option value="">Todos</option>
                        {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                                {employee.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="patient-filter">
                        Utente
                    </label>
                    <select
                        id="patient-filter"
                        value={selectedPatientId}
                        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
                        onChange={(event) => {
                            updateFilters({
                                patientId: event.target.value,
                            });
                        }}
                    >
                        <option value="">Todos</option>
                        {filteredPatients.map((patient) => (
                            <option key={patient.id} value={patient.id}>
                                {patient.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="service-filter">
                        Serviço
                    </label>
                    <select
                        id="service-filter"
                        value={selectedServiceId}
                        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
                        onChange={(event) => {
                            updateFilters({
                                serviceId: event.target.value,
                            });
                        }}
                    >
                        <option value="">Todos</option>
                        {services.map((service) => (
                            <option key={service.id} value={service.id}>
                                {service.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </section>
    );
}