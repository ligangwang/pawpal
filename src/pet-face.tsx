/** A flat drawing of a pet's face, for cards, the egg picker and mini-games. */
import type { Species } from "./pet-core";

const COLORS: Record<Species, { body: string; accent: string; belly: string }> = {
  puppy: { body: "#e3a866", accent: "#8c5a33", belly: "#fff1dc" },
  kitten: { body: "#b8bdd6", accent: "#ffa8b8", belly: "#f5f3fb" },
  fox: { body: "#ed7a33", accent: "#3b2b24", belly: "#fff6ec" },
  dragon: { body: "#6fd29f", accent: "#ffcf5a", belly: "#fff0b8" },
};

export function PetFace({
  species,
  size = 64,
  happy = false,
  sad = false,
}: {
  species: Species;
  size?: number;
  happy?: boolean;
  sad?: boolean;
}) {
  const c = COLORS[species];
  const ears =
    species === "puppy" ? (
      <>
        <ellipse cx="14" cy="38" rx="9" ry="17" fill={c.accent} transform="rotate(20 14 38)" />
        <ellipse cx="86" cy="38" rx="9" ry="17" fill={c.accent} transform="rotate(-20 86 38)" />
      </>
    ) : species === "dragon" ? (
      <>
        <polygon points="30,26 36,4 42,24" fill={c.accent} />
        <polygon points="58,24 64,4 70,26" fill={c.accent} />
      </>
    ) : (
      <>
        <polygon points="16,34 22,4 42,22" fill={c.body} />
        <polygon points="22,28 25,13 35,22" fill={c.accent} />
        <polygon points="84,34 78,4 58,22" fill={c.body} />
        <polygon points="78,28 75,13 65,22" fill={c.accent} />
      </>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      {ears}
      <circle cx="50" cy="55" r="38" fill={c.body} />
      <ellipse cx="50" cy="70" rx="18" ry="13" fill={c.belly} />
      {happy ? (
        <>
          <path d="M31 52 q6 -8 12 0" stroke="#251f2b" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M57 52 q6 -8 12 0" stroke="#251f2b" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="37" cy="50" rx="5" ry={sad ? 4 : 6.5} fill="#251f2b" />
          <ellipse cx="63" cy="50" rx="5" ry={sad ? 4 : 6.5} fill="#251f2b" />
          <circle cx="39" cy="47" r="1.8" fill="#fff" />
          <circle cx="65" cy="47" r="1.8" fill="#fff" />
        </>
      )}
      <ellipse cx="50" cy="63" rx="4.5" ry="3.2" fill={species === "kitten" ? "#ffa8b8" : "#2b2026"} />
      <path
        d={sad ? "M43 75 q7 -6 14 0" : "M43 70 q7 7 14 0"}
        stroke="#3a1f26"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="26" cy="64" r="5" fill="#ff9fb0" opacity="0.7" />
      <circle cx="74" cy="64" r="5" fill="#ff9fb0" opacity="0.7" />
    </svg>
  );
}
