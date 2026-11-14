import { FormEvent, useEffect, useState } from "react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  ChefHat,
  Clock,
  Info,
  Leaf,
  Loader2,
  Mail,
  MapPin,
  Menu as MenuIcon,
  Moon,
  Phone,
  Star,
  Sun,
  Trash2,
  Users,
  Wine,
  X,
} from "lucide-react";
import {
  getLocalDateString,
  reservationApi,
  type Reservation,
  type SeatingArea,
  type TimeSlot,
} from "./services/reservationApi";
import { siteConfig } from "./config/siteConfig";

const navLinks = [
  { label: "Menu", href: "#menu" },
  { label: "Experience", href: "#experience" },
  { label: "Reservations", href: "#reservations" },
  { label: "Contact", href: "#contact" },
];

const categories = ["Starters", "Mains", "Desserts", "Drinks"] as const;
type Category = (typeof categories)[number];

type MenuItem = {
  name: string;
  description: string;
  price: string;
  image: string;
  tags?: string[];
};

const menuItems: Record<Category, MenuItem[]> = {
  Starters: [
    {
      name: "Burrata Caprese",
      description: "Heirloom tomatoes, basil oil, cracked black pepper, aged balsamic.",
      price: "$16",
      image: "./images/burrata-caprese.jpg",
      tags: ["Vegetarian"],
    },
    {
      name: "Crispy Calamari",
      description: "Lemon, parsley, sea salt, warm garlic aioli.",
      price: "$15",
      image: "./images/crispy-calamari.jpg",
    },
  ],
  Mains: [
    {
      name: "Grilled Ribeye",
      description: "Herb butter, roasted carrots, asparagus, cherry tomatoes.",
      price: "$38",
      image: "./images/grilled-ribeye.jpg",
    },
    {
      name: "Pan-Seared Salmon",
      description: "Lemon butter, sauteed spinach, herbs, coastal greens.",
      price: "$28",
      image: "./images/pan-seared-salmon.jpg",
    },
    {
      name: "Truffle Mushroom Risotto",
      description: "Wild mushrooms, parmesan, thyme, shaved black truffle.",
      price: "$30",
      image: "./images/truffle-mushroom-risotto.jpg",
      tags: ["Vegetarian"],
    },
    {
      name: "Vellora Cheeseburger",
      description: "Brioche, aged cheddar, tomato, lettuce, hand-cut fries.",
      price: "$22",
      image: "./images/gourmet-burger.jpg",
    },
  ],
  Desserts: [
    {
      name: "Chocolate Lava Cake",
      description: "Molten chocolate, vanilla bean ice cream, cocoa, berries.",
      price: "$13",
      image: "./images/chocolate-lava-cake.jpg",
    },
  ],
  Drinks: [
    {
      name: "Signature Citrus Spritz",
      description: "Sparkling citrus, orange, mint, chilled glass, bright finish.",
      price: "$14",
      image: "./images/citrus-spritz.jpg",
    },
    {
      name: "Curated Red Wine",
      description: "A rotating selection of elegant reds from small producers.",
      price: "$16",
      image: "./images/wine-glass.jpg",
    },
  ],
};

const seatingAreas: { id: SeatingArea; label: string; desc: string }[] = [
  { id: "Main Dining Room", label: "Main Dining Room", desc: "Ambient warmth & soft lighting" },
  { id: "Chef's Counter", label: "Chef's Counter", desc: "Front row kitchen experience" },
  { id: "Garden Terrace", label: "Garden Terrace", desc: "Open-air dining under coastal breeze" },
  { id: "Private Dining Room", label: "Private Dining Room", desc: "Exclusive intimate setting" },
];

const premiumEase = [0.22, 1, 0.36, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: premiumEase } },
};

function BrandMark() {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-full border border-[#c8ad72]/50 bg-[#191714] text-[#fdf8ed] shadow-[0_0_0_6px_rgba(200,173,114,0.08)]">
        <ChefHat size={20} strokeWidth={1.35} aria-hidden="true" />
      </span>
      <span>
        <span className="block font-serif text-2xl font-semibold tracking-[0.18em] text-current">
          VELLORA
        </span>
        <span className="block text-[10px] font-medium uppercase tracking-[0.34em] text-current/75">
          Fine Dining
        </span>
      </span>
    </span>
  );
}

const THEME_STORAGE_KEY = "vellora_theme";

function getInitialTheme(): "evening" | "daylight" {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "daylight" ? "daylight" : "evening";
  } catch {
    return "evening";
  }
}

function saveThemePreference(nextTheme: "evening" | "daylight"): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Ignore storage errors in restricted browsing contexts
  }
}

export default function App() {
  // Theme state: evening (dark ambient) vs daylight (light warm editorial)
  const [theme, setTheme] = useState<"evening" | "daylight">(getInitialTheme);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [myBookingsOpen, setMyBookingsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("Mains");
  const [activeDish, setActiveDish] = useState(0);

  // Persistence Mock API State
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Reservation Form State
  const tomorrowStr = getLocalDateString(1);
  const [resName, setResName] = useState("");
  const [resEmail, setResEmail] = useState("");
  const [resPhone, setResPhone] = useState("");
  const [resGuests, setResGuests] = useState(2);
  const [resDate, setResDate] = useState(tomorrowStr);
  const [resSeating, setResSeating] = useState<SeatingArea>("Main Dining Room");
  const [selectedTime, setSelectedTime] = useState("");
  const [resNotes, setResNotes] = useState("");

  // Slots & Loading state
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Reservation | null>(null);
  const [formError, setFormError] = useState("");

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, 90]);
  const heroScale = useTransform(scrollY, [0, 600], [1, 1.08]);

  const currentItems = menuItems[activeCategory];
  const featuredDish = currentItems[Math.min(activeDish, currentItems.length - 1)];

  // Persist Theme Selection
  const toggleTheme = () => {
    const nextTheme = theme === "evening" ? "daylight" : "evening";
    setTheme(nextTheme);
    saveThemePreference(nextTheme);
  };

  // Load existing reservations on mount
  useEffect(() => {
    let active = true;
    reservationApi
      .getReservations()
      .then((items) => {
        if (active) setReservations(items);
      })
      .catch((err) => {
        console.error("Failed to load reservations", err);
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch dynamic available slots whenever date or reservations change
  useEffect(() => {
    let isMounted = true;
    setLoadingSlots(true);
    reservationApi
      .getAvailableSlots(resDate)
      .then((slots) => {
        if (!isMounted) return;
        setTimeSlots(slots);
        setSelectedTime((prevTime) => {
          const isStillValid = slots.some((s) => s.time === prevTime && s.status !== "booked");
          if (isStillValid) return prevTime;
          const firstAvailable = slots.find((s) => s.status !== "booked");
          return firstAvailable ? firstAvailable.time : "";
        });
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load available time slots", err);
          setFormError("Unable to load available time slots. Please refresh and try again.");
        }
      })
      .finally(() => {
        if (isMounted) setLoadingSlots(false);
      });
    return () => {
      isMounted = false;
    };
  }, [resDate, reservations]);

  useEffect(() => {
    setActiveDish(0);
  }, [activeCategory]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen || myBookingsOpen ? "hidden" : "";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setMyBookingsOpen(false);
      }
    };
    if (mobileOpen || myBookingsOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen, myBookingsOpen]);

  const handleReservationSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (!selectedTime) {
      setFormError("Please select an available dining time slot.");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await reservationApi.createReservation({
        name: resName,
        email: resEmail,
        phone: resPhone,
        guests: Number(resGuests),
        date: resDate,
        time: selectedTime,
        seatingArea: resSeating,
        notes: resNotes,
      });

      setConfirmedBooking(created);
      setReservations((prev) => [created, ...prev]);

      // Reset Form fields
      setResName("");
      setResEmail("");
      setResPhone("");
      setResNotes("");
    } catch (err) {
      setFormError(
        err instanceof Error && err.message
          ? err.message
          : "Unable to process reservation. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelReservation = async (id: string) => {
    setCancellingId(id);
    try {
      const updated = await reservationApi.cancelReservation(id);
      setReservations(updated);
    } catch (err) {
      setFormError(
        err instanceof Error && err.message
          ? err.message
          : "Unable to cancel reservation. Please try again."
      );
    } finally {
      setCancellingId(null);
    }
  };

  const isDaylight = theme === "daylight";

  // Harmonized Theme Color Tokens (WCAG AA compliant in both modes)
  const bgMain = isDaylight ? "bg-[#faf7f0] text-[#2c2720]" : "bg-[#191714] text-[#fdf8ed]";
  const headerBg = isDaylight
    ? "bg-[#faf7f0]/90 border-black/10 text-[#2c2720]"
    : "bg-[#191714]/80 border-white/10 text-[#fdf8ed]";
  const heroSectionBg = isDaylight ? "bg-[#2c2720] text-[#faf7f0]" : "bg-[#191714] text-[#fdf8ed]";
  const experienceBg = isDaylight ? "bg-[#f2ece1] text-[#2c2720]" : "bg-[#191714] text-[#fdf8ed]";
  const menuBg = isDaylight ? "bg-[#faf7f0] text-[#2c2720]" : "bg-[#191714] text-[#fdf8ed]";
  const resSectionBg = isDaylight ? "bg-[#f2ece1] text-[#2c2720]" : "bg-[#141210] text-[#fdf8ed]";
  const resCardBg = isDaylight
    ? "bg-white text-[#2c2720] border border-black/10 shadow-xl"
    : "bg-[#1f1d19] text-[#fdf8ed] border border-white/10 shadow-2xl";
  const footerBg = isDaylight ? "bg-[#23201b] text-[#fdf8ed]" : "bg-[#12100e] text-[#fdf8ed]";
  const accentGold = isDaylight ? "text-[#735824]" : "text-[#c8ad72]";
  const accentSage = isDaylight ? "text-[#4b5e43]" : "text-[#8ea384]";
  const btnGold = isDaylight
    ? "bg-[#785c23] text-white hover:bg-[#634b1b]"
    : "bg-[#c8ad72] text-[#191714] hover:bg-[#ecd28e]";

  const formInputStyle = isDaylight
    ? "border-black/20 bg-black/[0.03] text-[#2c2720] placeholder:text-[#2c2720]/60 focus:border-[#785c23]"
    : "border-white/15 bg-white/[0.05] text-white placeholder:text-white/50 focus:border-[#c8ad72]";
  const selectStyle = isDaylight
    ? "bg-white border-black/20 text-[#2c2720] focus:border-[#785c23]"
    : "bg-[#191714] border-white/15 text-white focus:border-[#c8ad72]";

  const confirmedCount = reservations.filter((r) => r.status === "confirmed").length;

  return (
    <div className={`min-h-screen overflow-hidden transition-colors duration-500 ${bgMain}`}>
      {/* Dynamic Header */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl transition-colors duration-500 ${headerBg}`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#" aria-label="Vellora home">
            <BrandMark />
          </a>

          <nav aria-label="Primary navigation" className="hidden items-center gap-8 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[11px] font-semibold uppercase tracking-[0.25em] opacity-80 transition hover:opacity-100 hover:text-[#c8ad72]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            {/* Atmosphere Theme Switcher Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-pressed={isDaylight}
              aria-label="Toggle atmosphere theme"
              className={`flex items-center gap-2 rounded-full border px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] transition ${
                isDaylight
                  ? "border-[#785c23]/40 bg-[#785c23]/10 text-[#735824] hover:bg-[#785c23]/20"
                  : "border-[#c8ad72]/45 bg-[#c8ad72]/10 text-[#f8e8bf] hover:bg-[#c8ad72]/20"
              }`}
              title="Toggle Atmosphere Theme"
            >
              {isDaylight ? <Sun size={15} aria-hidden="true" className="text-[#735824]" /> : <Moon size={15} aria-hidden="true" className="text-[#c8ad72]" />}
              <span>{isDaylight ? "Daylight" : "Evening"}</span>
            </button>

            {/* My Bookings Button */}
            <button
              type="button"
              onClick={() => setMyBookingsOpen(true)}
              aria-expanded={myBookingsOpen}
              aria-haspopup="dialog"
              className="relative flex items-center gap-2 rounded-full border border-current/20 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.2em] transition hover:bg-current/10"
            >
              <Calendar size={15} aria-hidden="true" />
              <span>Bookings</span>
              {confirmedCount > 0 && (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#c8ad72] text-[10px] font-extrabold text-[#191714]">
                  {confirmedCount}
                </span>
              )}
            </button>

            <a
              href="#reservations"
              className={`rounded-full px-6 py-3 text-[11px] font-bold uppercase tracking-[0.24em] transition ${btnGold}`}
            >
              Reserve
            </a>
          </div>

          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              aria-pressed={isDaylight}
              className="p-2 text-current opacity-80 hover:opacity-100"
              aria-label="Toggle theme"
            >
              {isDaylight ? <Sun size={22} aria-hidden="true" /> : <Moon size={22} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="p-1"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-haspopup="dialog"
              aria-label="Open menu"
            >
              <MenuIcon size={28} strokeWidth={1.4} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      {mobileOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-[#191714] px-6 py-5 text-[#fdf8ed] lg:hidden"
        >
          <div className="flex items-center justify-between">
            <BrandMark />
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X size={28} strokeWidth={1.4} aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Mobile navigation" className="mt-12 flex flex-col gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="font-serif text-3xl text-white/90"
              >
                {link.label}
              </a>
            ))}

            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                setMyBookingsOpen(true);
              }}
              className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-5 py-4 text-left font-serif text-xl"
            >
              <span>My Reservations</span>
              <span className="rounded-full bg-[#c8ad72] px-3 py-1 text-xs font-sans font-bold text-[#191714]">
                {confirmedCount} Active
              </span>
            </button>

            <a
              href="#reservations"
              onClick={() => setMobileOpen(false)}
              className="mt-2 rounded-full bg-[#c8ad72] px-7 py-4 text-center text-xs font-bold uppercase tracking-[0.24em] text-[#191714]"
            >
              Reserve a Table
            </a>
          </nav>
        </motion.div>
      )}

      {/* "My Bookings" Slide-over Modal / Drawer */}
      {myBookingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bookings-drawer-title"
          className="fixed inset-0 z-[80] flex justify-end bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="flex h-full w-full max-w-lg flex-col bg-[#191714] p-6 text-[#fdf8ed] shadow-2xl sm:p-8"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <Calendar className="text-[#c8ad72]" size={24} aria-hidden="true" />
                <h3 id="bookings-drawer-title" className="font-serif text-2xl font-medium">Your Reservations</h3>
              </div>
              <button
                type="button"
                onClick={() => setMyBookingsOpen(false)}
                aria-label="Close reservations"
                className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X size={22} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 flex-1 overflow-y-auto space-y-4 pr-1">
              {reservations.length === 0 ? (
                <div className="grid min-h-[300px] place-items-center text-center">
                  <div>
                    <Calendar size={48} className="mx-auto text-white/20" />
                    <p className="mt-4 font-serif text-xl text-white/80">No reservations yet</p>
                    <p className="mt-2 text-sm text-white/50">
                      Reserve a table below to view your confirmation details here.
                    </p>
                  </div>
                </div>
              ) : (
                reservations.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-5 transition ${
                      item.status === "confirmed"
                        ? "border-[#c8ad72]/30 bg-white/[0.04]"
                        : "border-white/10 bg-white/[0.01] opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs tracking-wider text-[#c8ad72]">
                        REF: {item.id}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          item.status === "confirmed"
                            ? "bg-[#7a8e70]/20 text-[#8fa892]"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <h4 className="mt-3 font-serif text-xl text-white">{item.name}</h4>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-white/75">
                      <div>
                        <span className="block text-white/65 uppercase tracking-wider text-[10px]">
                          Date & Time
                        </span>
                        <span className="font-medium text-white">
                          {item.date} @ {item.time}
                        </span>
                      </div>
                      <div>
                        <span className="block text-white/65 uppercase tracking-wider text-[10px]">
                          Party Size
                        </span>
                        <span className="font-medium text-white">{item.guests} Guests</span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-white/65 uppercase tracking-wider text-[10px]">
                          Seating Area
                        </span>
                        <span className="font-medium text-[#c8ad72]">{item.seatingArea}</span>
                      </div>
                      {item.notes && (
                        <div className="col-span-2 text-white/70 italic">"{item.notes}"</div>
                      )}
                    </div>

                    {item.status === "confirmed" && (
                      <div className="mt-5 flex justify-end border-t border-white/10 pt-4">
                        <button
                          type="button"
                          disabled={cancellingId === item.id}
                          onClick={() => handleCancelReservation(item.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          {cancellingId === item.id ? (
                            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
                          ) : (
                            <Trash2 size={14} aria-hidden="true" />
                          )}
                          <span>Cancel Reservation</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <a
                href="#reservations"
                onClick={() => setMyBookingsOpen(false)}
                className="block rounded-full bg-[#c8ad72] py-3.5 text-center text-xs font-bold uppercase tracking-[0.2em] text-[#191714] hover:bg-[#ecd28e]"
              >
                Book New Table
              </a>
            </div>
          </motion.div>
        </div>
      )}

      <main>
        {/* Hero Section */}
        <section
          className={`relative flex min-h-screen items-end overflow-hidden pb-20 pt-36 lg:items-center lg:pb-0 transition-colors duration-500 ${heroSectionBg}`}
        >
          <motion.img
            style={{ y: heroY, scale: heroScale }}
            src="./images/hero.jpg"
            alt="Beautifully plated gourmet dish in a modern fine dining setting"
            width={1024}
            height={1536}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_30%,rgba(200,173,114,0.16),transparent_32%),linear-gradient(90deg,rgba(25,23,20,0.92),rgba(25,23,20,0.58)_43%,rgba(25,23,20,0.15))]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#191714] to-transparent" />

          <motion.div
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.14 } } }}
            className="relative z-10 mx-auto w-full max-w-7xl px-5 lg:px-8"
          >
            <motion.p variants={fadeUp} className="mb-7 text-xs font-bold uppercase tracking-[0.42em] text-[#c8ad72]">
              Seasonal tasting room • {isDaylight ? "Daylight Service" : "Evening Service"}
            </motion.p>
            <motion.h1
              variants={fadeUp}
              className="max-w-4xl font-serif text-[clamp(4rem,12vw,10.5rem)] font-medium leading-[0.86] tracking-[-0.06em]"
            >
              Vellora
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-8 max-w-xl text-lg font-light leading-8 text-white/85 lg:text-xl"
            >
              A composed fine dining experience where local ingredients, quiet luxury, and artful
              service meet beneath soft ambient lighting.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-11 flex flex-wrap gap-4">
              <a
                href="#reservations"
                className={`rounded-full px-8 py-4 text-xs font-bold uppercase tracking-[0.24em] transition ${btnGold}`}
              >
                Reserve Table
              </a>
              <a
                href="#menu"
                className="rounded-full border border-white/30 px-8 py-4 text-xs font-bold uppercase tracking-[0.24em] text-white transition hover:border-white hover:bg-white/10"
              >
                View Menu
              </a>
            </motion.div>
          </motion.div>
        </section>

        {/* Experience Section */}
        <section id="experience" className={`relative scroll-mt-20 py-24 lg:py-32 transition-colors duration-500 ${experienceBg}`}>
          <div className="mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20 lg:px-8">
            <motion.div
              initial={{ opacity: 0, x: -42 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.9, ease: premiumEase }}
              className="self-end"
            >
              <p className={`text-xs font-bold uppercase tracking-[0.34em] ${accentGold}`}>
                The room
              </p>
              <h2 className="mt-5 max-w-xl font-serif text-5xl font-medium leading-[1.02] tracking-[-0.04em] lg:text-7xl">
                Calm service, precise cooking, lasting atmosphere.
              </h2>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 42 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.9, ease: premiumEase }}
              className="grid gap-10 md:grid-cols-[1fr_0.72fr]"
            >
              <div className="overflow-hidden rounded-2xl shadow-xl">
                <img
                  src="./images/wine-glass.jpg"
                  alt="Red wine near window light"
                  width={1536}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/5] h-full w-full object-cover transition duration-700 hover:scale-105"
                />
              </div>
              <div className="flex flex-col justify-between gap-10 border-l border-current/15 pl-8">
                <p className="text-lg font-light leading-8 opacity-85">
                  Every plate is edited with restraint: refined technique, seasonal produce, and a
                  dining room designed for unhurried conversation.
                </p>
                <div>
                  <div className={`flex gap-1 ${accentGold}`} role="img" aria-label="5 out of 5 stars">
                    {[...Array(5)].map((_, index) => (
                      <Star key={index} size={18} fill="currentColor" strokeWidth={0} aria-hidden="true" />
                    ))}
                  </div>
                  <p className="mt-4 font-serif text-4xl">4.9 guest rating</p>
                  <p className="mt-2 text-sm opacity-75">From private dinners and weekend service.</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Menu Section */}
        <section id="menu" className={`scroll-mt-20 py-24 lg:py-32 transition-colors duration-500 ${menuBg}`}>
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              variants={{ show: { transition: { staggerChildren: 0.12 } } }}
              className="max-w-3xl"
            >
              <motion.p variants={fadeUp} className={`text-xs font-bold uppercase tracking-[0.34em] ${accentSage}`}>
                Chef's edit
              </motion.p>
              <motion.h2 variants={fadeUp} className="mt-5 font-serif text-5xl font-medium leading-none tracking-[-0.04em] lg:text-7xl">
                A tighter, brighter menu.
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-6 max-w-2xl text-lg font-light leading-8 opacity-80">
                Seasonal dishes served with clarity. Select a course to preview the plate and browse
                the current offering.
              </motion.p>
            </motion.div>

            <div className="mt-14 flex flex-wrap gap-3 border-b border-current/10 pb-6" role="group" aria-label="Menu categories">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  aria-pressed={activeCategory === category}
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full px-6 py-3 text-xs font-bold uppercase tracking-[0.22em] transition ${
                    activeCategory === category
                      ? isDaylight
                        ? "bg-[#785c23] text-white shadow-md font-bold"
                        : "bg-[#c8ad72] text-[#191714] shadow-md font-bold"
                      : isDaylight
                      ? "bg-[#2c2720]/10 text-[#2c2720]/85 hover:bg-[#2c2720]/15 hover:text-[#2c2720]"
                      : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="mt-12 grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
              <motion.div
                key={featuredDish.image}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, ease: premiumEase }}
                className="relative overflow-hidden rounded-2xl bg-[#ede5d8] shadow-lg"
              >
                <img
                  src={featuredDish.image}
                  alt={featuredDish.name}
                  width={1536}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/5] w-full object-cover lg:aspect-[5/6]"
                />
              </motion.div>

              <div className="divide-y divide-current/12">
                {currentItems.map((item, index) => (
                  <button
                    key={item.name}
                    type="button"
                    aria-pressed={activeDish === index}
                    onMouseEnter={() => setActiveDish(index)}
                    onFocus={() => setActiveDish(index)}
                    onClick={() => setActiveDish(index)}
                    className={`group grid w-full grid-cols-[1fr_auto] gap-8 py-7 px-4 rounded-xl text-left transition duration-300 ${
                      activeDish === index
                        ? isDaylight
                          ? "bg-[#785c23]/10 border-l-4 border-[#785c23]"
                          : "bg-[#c8ad72]/15 border-l-4 border-[#c8ad72]"
                        : "hover:bg-current/5 border-l-4 border-transparent"
                    }`}
                  >
                    <span>
                      <span className="flex flex-wrap items-center gap-3">
                        <span className={`font-serif text-3xl font-medium tracking-[-0.03em] transition ${
                          activeDish === index ? (isDaylight ? "text-[#735824]" : "text-[#c8ad72]") : ""
                        }`}>
                          {item.name}
                        </span>
                        {item.tags?.map((tag) => (
                          <span key={tag} className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] ${accentSage}`}>
                            <Leaf size={13} aria-hidden="true" />
                            {tag}
                          </span>
                        ))}
                      </span>
                      <span className="mt-3 block max-w-xl text-base font-light leading-7 opacity-80">
                        {item.description}
                      </span>
                    </span>
                    <span className={`font-serif text-2xl ${activeDish === index ? (isDaylight ? "text-[#735824]" : "text-[#c8ad72]") : accentSage}`}>{item.price}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Reservations Section with Real-Time Slots */}
        <section id="reservations" className={`scroll-mt-20 py-24 lg:py-32 transition-colors duration-500 ${resSectionBg}`}>
          <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:px-8">
            <div>
              <p className={`text-xs font-bold uppercase tracking-[0.34em] ${accentSage}`}>
                Reservations & Live Slots
              </p>
              <h2 className="mt-5 font-serif text-5xl font-medium leading-none tracking-[-0.04em] lg:text-7xl">
                An evening worth planning.
              </h2>
              <p className="mt-7 max-w-md text-lg font-light leading-8 opacity-80">
                Select your preferred date, party size, and seating area. Real-time availability for
                tables is updated instantly below.
              </p>
              <div className="mt-10 space-y-4 text-sm opacity-90">
                <p className="flex items-center gap-3">
                  <Clock size={18} aria-hidden="true" className={accentSage} /> Mon-Thu 5pm-10pm | Fri-Sat 5pm-11pm
                </p>
                <p className="flex items-center gap-3">
                  <Wine size={18} aria-hidden="true" className={accentSage} /> Wine pairing & Sommelier service available
                </p>
                <p className="flex items-center gap-3">
                  <Info size={18} aria-hidden="true" className={accentSage} /> Instant confirmation & local booking code
                </p>
              </div>
            </div>

            {/* Interactive Booking Card */}
            <motion.div
              initial={{ opacity: 0, y: 34 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.75, ease: premiumEase }}
              className={`rounded-3xl p-6 shadow-2xl transition-colors duration-500 sm:p-9 lg:p-12 ${resCardBg}`}
            >
              {confirmedBooking ? (
                <div className="grid min-h-[480px] place-items-center text-center">
                  <div className="max-w-md">
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#4b5e43] text-white">
                      <CheckCircle2 size={32} aria-hidden="true" />
                    </div>
                    <h3 className="mt-6 font-serif text-4xl">Reservation Confirmed</h3>
                    <p className={`mt-2 text-xs uppercase tracking-widest ${accentGold}`}>
                      BOOKING REF: {confirmedBooking.id}
                    </p>

                    <div className="mt-6 rounded-2xl border border-current/10 bg-current/5 p-5 text-left text-sm opacity-90 space-y-2">
                      <div className="flex justify-between border-b border-current/10 pb-2">
                        <span>Guest Name:</span>
                        <span className="font-semibold">{confirmedBooking.name}</span>
                      </div>
                      <div className="flex justify-between border-b border-current/10 pb-2">
                        <span>Date & Time:</span>
                        <span className={`font-semibold ${accentGold}`}>
                          {confirmedBooking.date} @ {confirmedBooking.time}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-current/10 pb-2">
                        <span>Seating Area:</span>
                        <span className="font-semibold">{confirmedBooking.seatingArea}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Party Size:</span>
                        <span className="font-semibold">{confirmedBooking.guests} Guests</span>
                      </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setConfirmedBooking(null)}
                        className="flex-1 rounded-full border border-current/20 py-3.5 text-xs font-bold uppercase tracking-wider transition hover:bg-current/10"
                      >
                        Book Another
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmedBooking(null);
                          setMyBookingsOpen(true);
                        }}
                        className={`flex-1 rounded-full py-3.5 text-xs font-bold uppercase tracking-wider transition ${btnGold}`}
                      >
                        View All
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReservationSubmit} className="grid gap-6">
                  {formError && (
                    <div
                      role="alert"
                      className={`rounded-xl border p-4 text-xs font-medium ${
                        isDaylight
                          ? "border-red-700/30 bg-red-500/10 text-red-700"
                          : "border-red-500/30 bg-red-500/10 text-red-400"
                      }`}
                    >
                      {formError}
                    </div>
                  )}

                  {/* Date & Guests Picker */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="reservation-date" className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${accentGold}`}>
                        <Calendar size={14} aria-hidden="true" /> Dining Date
                      </label>
                      <input
                        id="reservation-date"
                        name="date"
                        required
                        type="date"
                        value={resDate}
                        min={getLocalDateString(0)}
                        onChange={(e) => setResDate(e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3.5 text-sm outline-none transition ${
                          isDaylight ? "[color-scheme:light]" : "[color-scheme:dark]"
                        } ${formInputStyle}`}
                      />
                    </div>
                    <div>
                      <label htmlFor="reservation-guests" className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${accentGold}`}>
                        <Users size={14} aria-hidden="true" /> Guests
                      </label>
                      <select
                        id="reservation-guests"
                        name="guests"
                        value={resGuests}
                        onChange={(e) => setResGuests(Number(e.target.value))}
                        className={`w-full rounded-xl border px-4 py-3.5 text-sm outline-none transition ${selectStyle}`}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((num) => (
                          <option key={num} value={num}>
                            {num} {num === 1 ? "Guest" : "Guests"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Seating Area Selection */}
                  <div>
                    <span id="seating-area-label" className={`mb-2.5 block text-xs font-bold uppercase tracking-wider ${accentGold}`}>
                      Seating Atmosphere
                    </span>
                    <div role="group" aria-labelledby="seating-area-label" className="grid gap-2.5 sm:grid-cols-2">
                      {seatingAreas.map((area) => (
                        <button
                          key={area.id}
                          type="button"
                          aria-pressed={resSeating === area.id}
                          onClick={() => setResSeating(area.id)}
                          className={`rounded-xl border p-3.5 text-left transition ${
                            resSeating === area.id
                              ? isDaylight
                                ? "border-[#785c23] bg-[#785c23]/12 text-[#2c2720] ring-1 ring-[#785c23] font-bold"
                                : "border-[#c8ad72] bg-[#c8ad72]/20 text-white ring-1 ring-[#c8ad72] font-bold"
                              : isDaylight
                              ? "border-black/15 bg-black/[0.02] text-[#2c2720] hover:border-black/30"
                              : "border-white/10 bg-white/[0.03] text-white/85 hover:border-white/25"
                          }`}
                        >
                          <div className="text-xs font-bold">{area.label}</div>
                          <div className={`mt-1 text-[11px] font-normal ${isDaylight ? "text-[#2c2720]/75" : "text-white/70"}`}>
                            {area.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Real-time Time Slots Selector */}
                  <div>
                    <div className="mb-2.5 flex items-center justify-between">
                      <span id="time-slots-label" className={`text-xs font-bold uppercase tracking-wider ${accentGold}`}>
                        Real-Time Time Slots
                      </span>
                      {loadingSlots && (
                        <span className="flex items-center gap-1 text-[11px] opacity-75">
                          <Loader2 size={12} aria-hidden="true" className="animate-spin" /> Fetching slots...
                        </span>
                      )}
                    </div>

                    <div role="group" aria-labelledby="time-slots-label" className="grid grid-cols-3 gap-2 sm:grid-cols-3">
                      {timeSlots.map((slot) => {
                        const isSelected = selectedTime === slot.time;
                        const isBooked = slot.status === "booked";

                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={isBooked}
                            aria-pressed={isSelected}
                            onClick={() => setSelectedTime(slot.time)}
                            className={`relative rounded-xl border p-3 text-center transition ${
                              isBooked
                                ? isDaylight
                                  ? "cursor-not-allowed border-black/10 bg-black/[0.04] line-through text-[#2c2720]/65"
                                  : "cursor-not-allowed border-white/10 bg-white/[0.02] line-through text-white/50"
                                : isSelected
                                ? isDaylight
                                  ? "border-[#785c23] bg-[#785c23] font-bold text-white shadow-md"
                                  : "border-[#c8ad72] bg-[#c8ad72] font-bold text-[#191714] shadow-lg"
                                : isDaylight
                                ? "border-black/20 bg-white text-[#2c2720] hover:border-[#785c23]"
                                : "border-white/15 bg-white/[0.04] text-white hover:border-[#c8ad72]/60"
                            }`}
                          >
                            <div className="text-xs">{slot.time}</div>
                            <div
                              className={`mt-1 text-[9px] uppercase tracking-wider font-semibold ${
                                isSelected
                                  ? isDaylight
                                    ? "text-white"
                                    : "text-[#191714]"
                                  : slot.status === "limited"
                                  ? isDaylight
                                    ? "text-amber-700"
                                    : "text-amber-400"
                                  : slot.status === "booked"
                                  ? isDaylight
                                    ? "text-red-700"
                                    : "text-red-400"
                                  : isDaylight
                                  ? "text-[#4b5e43]"
                                  : "text-[#8fa892]"
                              }`}
                            >
                              {slot.status === "booked"
                                ? "Sold Out"
                                : slot.status === "limited"
                                ? `${slot.availableTables} left`
                                : "Available"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Personal Contact Details */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor="reservation-name" className="sr-only">
                        Full Name
                      </label>
                      <input
                        id="reservation-name"
                        name="name"
                        autoComplete="name"
                        required
                        type="text"
                        placeholder="Full Name"
                        value={resName}
                        onChange={(e) => setResName(e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3.5 text-sm outline-none transition ${formInputStyle}`}
                      />
                    </div>
                    <div>
                      <label htmlFor="reservation-email" className="sr-only">
                        Email Address
                      </label>
                      <input
                        id="reservation-email"
                        name="email"
                        autoComplete="email"
                        required
                        type="email"
                        placeholder="Email Address"
                        value={resEmail}
                        onChange={(e) => setResEmail(e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3.5 text-sm outline-none transition ${formInputStyle}`}
                      />
                    </div>
                    <div>
                      <label htmlFor="reservation-phone" className="sr-only">
                        Phone Number
                      </label>
                      <input
                        id="reservation-phone"
                        name="phone"
                        autoComplete="tel"
                        required
                        type="tel"
                        placeholder="Phone Number"
                        value={resPhone}
                        onChange={(e) => setResPhone(e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3.5 text-sm outline-none transition ${formInputStyle}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reservation-notes" className="sr-only">
                      Special requests, dietary preferences, or occasion
                    </label>
                    <textarea
                      id="reservation-notes"
                      name="notes"
                      rows={3}
                      placeholder="Special requests, dietary preferences, or occasion (optional)"
                      value={resNotes}
                      onChange={(e) => setResNotes(e.target.value)}
                      className={`w-full rounded-xl border px-4 py-3.5 text-sm outline-none transition ${formInputStyle}`}
                    />
                  </div>

                  <button
                    disabled={isSubmitting || !selectedTime}
                    type="submit"
                    className={`flex items-center justify-center gap-2 rounded-full py-4 text-xs font-bold uppercase tracking-[0.24em] transition disabled:opacity-50 ${btnGold}`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} aria-hidden="true" className="animate-spin" /> Confirming Reservation...
                      </>
                    ) : (
                      "Confirm & Reserve Table"
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="contact" className={`scroll-mt-20 py-16 transition-colors duration-500 ${footerBg}`}>
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-12 border-b border-white/10 pb-12 lg:grid-cols-[1.1fr_0.8fr_0.8fr_0.7fr]">
            <div>
              <BrandMark />
              <p className="mt-6 max-w-sm text-sm font-light leading-7 text-white/75">
                Modern fine dining shaped by seasonal produce, quiet luxury, and thoughtful service.
              </p>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.26em] text-[#c8ad72]">Visit</h3>
              <div className="mt-5 space-y-4 text-sm text-white/75">
                <p className="flex gap-3">
                  <MapPin size={18} aria-hidden="true" className="shrink-0 text-[#c8ad72]" /> {siteConfig.address}
                </p>
                <p className="flex gap-3">
                  <Phone size={18} aria-hidden="true" className="shrink-0 text-[#c8ad72]" />
                  <a href={siteConfig.phoneHref} className="transition hover:text-[#c8ad72]">
                    {siteConfig.phoneDisplay}
                  </a>
                </p>
                <p className="flex gap-3">
                  <Mail size={18} aria-hidden="true" className="shrink-0 text-[#c8ad72]" />
                  <a href={siteConfig.emailHref} className="transition hover:text-[#c8ad72]">
                    {siteConfig.email}
                  </a>
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.26em] text-[#c8ad72]">Hours</h3>
              <div className="mt-5 space-y-3 text-sm text-white/75">
                {siteConfig.hours.map((entry) => (
                  <p key={entry}>{entry}</p>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.26em] text-[#c8ad72]">Social</h3>
              <div className="mt-5 flex gap-3">
                {siteConfig.socialLinks.map((social) => (
                  <a
                    key={social.shortLabel}
                    href={social.href}
                    aria-label={social.name}
                    title={social.name}
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/15 text-xs font-bold text-white/80 transition hover:border-[#c8ad72] hover:text-[#c8ad72]"
                  >
                    {social.shortLabel}
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-4 pt-8 text-xs text-white/65 sm:flex-row">
            <p>Copyright {new Date().getFullYear()} {siteConfig.brandName}. All rights reserved.</p>
            <p>Private dining and custom menus available on request.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}