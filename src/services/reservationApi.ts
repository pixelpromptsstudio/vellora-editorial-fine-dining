export type SeatingArea = "Main Dining Room" | "Chef's Counter" | "Garden Terrace" | "Private Dining Room";

export type ReservationStatus = "confirmed" | "cancelled";

export interface Reservation {
  id: string;
  name: string;
  email: string;
  phone: string;
  guests: number;
  date: string;
  time: string;
  seatingArea: SeatingArea;
  notes?: string;
  createdAt: string;
  status: ReservationStatus;
}

export interface TimeSlot {
  time: string;
  availableTables: number;
  status: "available" | "limited" | "booked";
}

export type CreateReservationInput = Omit<Reservation, "id" | "createdAt" | "status">;

const STORAGE_KEY = "vellora_reservations_v1";
const API_BASE_URL = (import.meta.env.VITE_RESERVATION_API_URL ?? "").trim().replace(/\/+$/, "");

/** Format a local calendar date as YYYY-MM-DD without UTC timezone drift. */
export function getLocalDateString(offsetDays = 0): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitialReservations(): Reservation[] {
  return [
    {
      id: "VEL-8921",
      name: "Elena Rostova",
      email: "elena@example.com",
      phone: "+1 (555) 234-5678",
      guests: 2,
      date: getLocalDateString(1),
      time: "7:00 PM",
      seatingArea: "Chef's Counter",
      notes: "Anniversary celebration.",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      status: "confirmed",
    },
    {
      id: "VEL-4412",
      name: "Marcus Vance",
      email: "marcus@example.com",
      phone: "+1 (555) 876-5432",
      guests: 4,
      date: getLocalDateString(2),
      time: "8:30 PM",
      seatingArea: "Garden Terrace",
      notes: "Dietary restriction: Gluten-free.",
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      status: "confirmed",
    },
  ];
}

const DEFAULT_TIME_SLOTS: { time: string; baseCapacity: number }[] = [
  { time: "5:00 PM", baseCapacity: 4 },
  { time: "5:30 PM", baseCapacity: 3 },
  { time: "6:00 PM", baseCapacity: 5 },
  { time: "6:30 PM", baseCapacity: 2 },
  { time: "7:00 PM", baseCapacity: 1 },
  { time: "7:30 PM", baseCapacity: 0 }, // Fully booked sample
  { time: "8:00 PM", baseCapacity: 3 },
  { time: "8:30 PM", baseCapacity: 2 },
  { time: "9:00 PM", baseCapacity: 4 },
];

function isValidReservation(value: unknown): value is Reservation {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Reservation>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.email === "string" &&
    typeof item.phone === "string" &&
    typeof item.guests === "number" &&
    typeof item.date === "string" &&
    typeof item.time === "string" &&
    typeof item.seatingArea === "string" &&
    (item.status === "confirmed" || item.status === "cancelled")
  );
}

function getStoredReservations(): Reservation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = getInitialReservations();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      const seed = getInitialReservations();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return parsed.filter(isValidReservation);
  } catch (err) {
    console.error("Failed to load reservations from localStorage", err);
    return getInitialReservations();
  }
}

function saveStoredReservations(reservations: Reservation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
  } catch (err) {
    console.error("Failed to save reservations to localStorage", err);
  }
}

function computeSlotsForDate(date: string, reservations: Reservation[]): TimeSlot[] {
  const activeForDate = reservations.filter(
    (r) => r.date === date && r.status === "confirmed"
  );

  return DEFAULT_TIME_SLOTS.map((slot) => {
    const bookedCount = activeForDate.filter((r) => r.time === slot.time).length;
    const remaining = Math.max(0, slot.baseCapacity - bookedCount);

    let status: TimeSlot["status"] = "available";
    if (remaining === 0) status = "booked";
    else if (remaining <= 2) status = "limited";

    return {
      time: slot.time,
      availableTables: remaining,
      status,
    };
  });
}

function normalizeAndValidateInput(data: CreateReservationInput): CreateReservationInput {
  const name = data.name.trim();
  const email = data.email.trim();
  const phone = data.phone.trim();
  const date = data.date.trim();
  const time = data.time.trim();
  const notes = data.notes?.trim() || undefined;

  if (!name) throw new Error("Please enter your full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Please enter a valid email address.");
  }
  if (phone.replace(/\D/g, "").length < 7) {
    throw new Error("Please enter a valid phone number.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < getLocalDateString(0)) {
    throw new Error("Please choose today or an upcoming dining date.");
  }
  if (!time) {
    throw new Error("Please select an available dining time slot.");
  }
  if (!Number.isFinite(data.guests) || data.guests < 1 || data.guests > 20) {
    throw new Error("Please choose a valid party size.");
  }

  return {
    ...data,
    name,
    email,
    phone,
    date,
    time,
    notes,
  };
}

function generateReservationCode(existing: Reservation[]): string {
  const existingIds = new Set(existing.map((r) => r.id));
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = `VEL-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!existingIds.has(candidate)) return candidate;
  }
  return `VEL-${Date.now().toString().slice(-6)}`;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { message?: string; error?: string };
      message = payload.message || payload.error || message;
    } catch {
      // Keep default status message when body is not JSON
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const reservationApi = {
  /** Whether a real backend REST endpoint is configured via VITE_RESERVATION_API_URL. */
  isRemoteBackend: Boolean(API_BASE_URL),

  /** Fetch all user reservations. */
  async getReservations(): Promise<Reservation[]> {
    if (API_BASE_URL) {
      return fetchJson<Reservation[]>("/reservations");
    }
    await new Promise((res) => setTimeout(res, 250));
    return getStoredReservations();
  },

  /** Fetch real-time available slots for a given YYYY-MM-DD date. */
  async getAvailableSlots(date: string): Promise<TimeSlot[]> {
    if (API_BASE_URL) {
      return fetchJson<TimeSlot[]>(`/slots?date=${encodeURIComponent(date)}`);
    }
    await new Promise((res) => setTimeout(res, 200));
    return computeSlotsForDate(date, getStoredReservations());
  },

  /** Create a new reservation after validating inputs and live slot capacity. */
  async createReservation(data: CreateReservationInput): Promise<Reservation> {
    const normalized = normalizeAndValidateInput(data);

    if (API_BASE_URL) {
      return fetchJson<Reservation>("/reservations", {
        method: "POST",
        body: JSON.stringify(normalized),
      });
    }

    await new Promise((res) => setTimeout(res, 500));
    const current = getStoredReservations();
    const slot = computeSlotsForDate(normalized.date, current).find(
      (item) => item.time === normalized.time
    );

    if (!slot || slot.status === "booked") {
      throw new Error("This time slot is no longer available. Please choose another time.");
    }

    const newReservation: Reservation = {
      ...normalized,
      id: generateReservationCode(current),
      createdAt: new Date().toISOString(),
      status: "confirmed",
    };

    const updated = [newReservation, ...current];
    saveStoredReservations(updated);
    return newReservation;
  },

  /** Cancel an existing reservation by reference ID. */
  async cancelReservation(id: string): Promise<Reservation[]> {
    if (API_BASE_URL) {
      return fetchJson<Reservation[]>(`/reservations/${encodeURIComponent(id)}/cancel`, {
        method: "PATCH",
      });
    }

    await new Promise((res) => setTimeout(res, 350));
    const current = getStoredReservations();
    const updated = current.map((resItem) =>
      resItem.id === id ? { ...resItem, status: "cancelled" as const } : resItem
    );
    saveStoredReservations(updated);
    return updated;
  },
};
