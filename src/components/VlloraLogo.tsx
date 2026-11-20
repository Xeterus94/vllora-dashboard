import { useId } from "react";
import { cn } from "../utils/cn";

/**
 * Geometric vector reproduction of the Vllora Studio monogram:
 * parallel 61° ribbons with concentric circular U-bend & cradle arcs and
 * the upper-right botanical leaf flourish.
 */
export function VlloraEmblem({
  className = "h-10 w-auto",
  variant = "gold",
}: {
  className?: string;
  /** "gold" for dark/burgundy surfaces; "richGold" has deeper bronze contrast for light surfaces */
  variant?: "gold" | "richGold";
}) {
  const uid = useId().replace(/:/g, "");
  const gradMain = `vllora-gold-${uid}`;
  const gradShade = `vllora-shade-${uid}`;
  const gradRim = `vllora-rim-${uid}`;
  const shadowId = `vllora-shadow-${uid}`;

  // Exact parallel-grid coordinates (slope m = 1.80, ribbon W = 7.4, gap G = 3.3, arc center = (53.82, 66.13))
  const mainRibbon = [
    // Top-left sharp tip -> rounded shoulder -> inner-left parallel bar
    "M 12 10",
    "L 23.6 10",
    "C 31.2 10 36.8 13.6 40.9 21.0",
    "L 58.11 55.32",
    // Chisel point at bottom of inner-left bar (parallel to rising center stem, gap G = 3.3)
    "L 53.82 63.04",
    "L 32.8 25.2",
    // Arched interior notch at top-left (width G = 3.3 between inner-left bar and outer-left ribbon)
    "C 29.8 19.8 26.8 17.4 24.47 17.0",
    // Inner edge of outer-left leg -> concentric inner U-bend arc (r = 1.8) -> left edge of rising center stem
    "L 52.25 67.01",
    "A 1.8 1.8 0 0 0 55.39 67.01",
    "L 72.4 36.4",
    // S-curve sweep into the lower rim of the top-right leaf
    "C 76.6 28.8 82.8 26.0 91.2 24.8",
    "C 94.8 24.3 97.4 22.0 99.6 17.2",
    // Almond hollow inside the leaf -> back out to the sharp left petal tip
    "C 92.6 16.8 86.2 19.4 81.2 25.4",
    "L 71.8 28.0",
    // Upper convex arch of the leaf up to the sharp top-right tip
    "C 76.4 16.8 84.4 10 95.8 10",
    "L 108 10",
    // Outer-right triangle line down to the leaf/cradle split
    "L 96.3 31.06",
    "C 93.8 33.0 90.2 33.6 86.2 34.4",
    "C 82.4 35.2 79.8 37.8 77.4 42.16",
    // Right edge of rising center stem -> concentric outer U-bend arc (r = 9.2) -> outer-left triangle line
    "L 61.86 70.60",
    "A 9.2 9.2 0 0 1 45.78 70.60",
    "L 12 10",
    "Z",
  ].join(" ");

  // Lower-right parallel leg + concentric J-cradle arc (r_in = 12.5, r_out = 19.9)
  const cradleRibbon = [
    "M 94.3 34.66",
    "L 71.22 75.80",
    "A 19.9 19.9 0 0 1 41.8 81.9",
    // Tapered upward hook tip cradling the U-bend
    "C 44.8 81.4 47.4 79.8 49.4 77.8",
    "A 12.5 12.5 0 0 0 64.75 72.20",
    "L 84.7 36.29",
    // Top bevel contoured parallel to the S-curve above it
    "C 87.8 35.6 91.2 35.2 94.3 34.66",
    "Z",
  ].join(" ");

  const isRich = variant === "richGold";

  return (
    <svg
      viewBox="0 0 120 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("select-none", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradMain} x1="12" y1="8" x2="106" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isRich ? "#E2C583" : "#F6E6BC"} />
          <stop offset="28%" stopColor={isRich ? "#C19A4E" : "#D6B46C"} />
          <stop offset="52%" stopColor={isRich ? "#EAD198" : "#F3E0B3"} />
          <stop offset="78%" stopColor={isRich ? "#9B752E" : "#B38B42"} />
          <stop offset="100%" stopColor={isRich ? "#CEA85C" : "#DFC07D"} />
        </linearGradient>
        <linearGradient id={gradShade} x1="42" y1="34" x2="95" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={isRich ? "#D5B166" : "#E8CB8A"} />
          <stop offset="55%" stopColor={isRich ? "#A47D36" : "#BA9348"} />
          <stop offset="100%" stopColor={isRich ? "#DEC07B" : "#F0DCAC"} />
        </linearGradient>
        <linearGradient id={gradRim} x1="12" y1="10" x2="108" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF7DF" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#C8A256" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#6B4C16" stopOpacity="0.55" />
        </linearGradient>
        <filter id={shadowId} x="-12%" y="-10%" width="124%" height="128%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#1A060B" floodOpacity={isRich ? "0.22" : "0.45"} />
        </filter>
      </defs>

      <g filter={`url(#${shadowId})`}>
        <path d={mainRibbon} fill={`url(#${gradMain})`} stroke={`url(#${gradRim})`} strokeWidth="0.55" strokeLinejoin="round" />
        <path d={cradleRibbon} fill={`url(#${gradShade})`} stroke={`url(#${gradRim})`} strokeWidth="0.55" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/**
 * Burgundy-velvet & brushed-gold square badge used in the sidebar and headers.
 */
export function VlloraBadge({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#6B1C2E] via-[#4F1220] to-[#320913] p-1.5 shadow-lg shadow-[#4F1220]/30 ring-1 ring-[#D6B46C]/40",
        className
      )}
    >
      <VlloraEmblem className="h-full w-full" variant="gold" />
    </div>
  );
}

/**
 * Full stacked Vllora Studio lockup (emblem + VLLORA + STUDIO) matching both
 * the burgundy velvet and warm alabaster brand boards.
 */
export function VlloraFullLogo({
  surface = "auto",
  className,
}: {
  /** "burgundy" renders on the signature deep wine plaque; "light" on ivory; "auto" switches with dark mode */
  surface?: "burgundy" | "light" | "auto";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl px-8 py-6 text-center transition-colors duration-300",
        surface === "burgundy" &&
          "border border-[#D6B46C]/35 bg-gradient-to-br from-[#6B1C2E] via-[#4F1321] to-[#340A14] shadow-2xl shadow-[#3B0C17]/35",
        surface === "light" &&
          "border border-[#D6B46C]/35 bg-gradient-to-b from-[#FFFFFF] to-[#F8F5EF] shadow-xl shadow-slate-200/70",
        surface === "auto" &&
          "border border-[#D6B46C]/35 bg-gradient-to-b from-[#FFFFFF] to-[#F8F5EF] shadow-xl shadow-slate-200/70 dark:from-[#6B1C2E] dark:via-[#4F1321] dark:to-[#340A14] dark:shadow-2xl dark:shadow-black/50",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 50% 20%, rgba(242,223,178,0.26), transparent 64%)",
        }}
      />
      <VlloraEmblem className="relative h-20 w-auto sm:h-24" variant={surface === "light" ? "richGold" : "gold"} />
      <div
        className={cn(
          "relative mt-2.5 bg-clip-text font-serif text-2xl font-semibold tracking-[0.14em] text-transparent sm:text-[28px]",
          surface === "burgundy" && "bg-gradient-to-b from-[#F6E6BC] via-[#D6B46C] to-[#AB843B]",
          surface === "light" && "bg-gradient-to-b from-[#CFA95E] via-[#AE873D] to-[#876423]",
          surface === "auto" &&
            "bg-gradient-to-b from-[#CFA95E] via-[#AE873D] to-[#876423] dark:from-[#F6E6BC] dark:via-[#D6B46C] dark:to-[#AB843B]"
        )}
        style={{ fontFamily: '"Cinzel", "Cormorant Garamond", Georgia, serif' }}
      >
        VLLORA
      </div>
      <div
        className={cn(
          "relative mt-0.5 pl-[0.46em] text-[10px] font-semibold tracking-[0.46em]",
          surface === "burgundy" && "text-[#E2C687]/90",
          surface === "light" && "text-[#9A7632]",
          surface === "auto" && "text-[#9A7632] dark:text-[#E2C687]/90"
        )}
      >
        STUDIO
      </div>
    </div>
  );
}
