import akiraBlade from "@/assets/characters/akira-blade.jpg";
import lunaStarfire from "@/assets/characters/luna-starfire.jpg";
import professorEnigma from "@/assets/characters/professor-enigma.jpg";
import shadowRex from "@/assets/characters/shadow-rex.jpg";
import valentinaRose from "@/assets/characters/valentina-rose.jpg";

const NAMED_CHARACTER_AVATARS: Record<string, string> = {
  "akira blade": akiraBlade,
  "luna starfire": lunaStarfire,
  "professor enigma": professorEnigma,
  "shadow rex": shadowRex,
  "valentina rose": valentinaRose,
};

const ADULT_FALLBACK_AVATARS = [
  akiraBlade,
  lunaStarfire,
  professorEnigma,
  shadowRex,
  valentinaRose,
];

const normalizeCharacterName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const hashCharacterName = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export const resolveCharacterAvatar = (name?: string | null, avatarUrl?: string | null) => {
  const trimmedAvatarUrl = avatarUrl?.trim();
  if (trimmedAvatarUrl) return trimmedAvatarUrl;

  const normalizedName = name ? normalizeCharacterName(name) : "";
  if (normalizedName && NAMED_CHARACTER_AVATARS[normalizedName]) {
    return NAMED_CHARACTER_AVATARS[normalizedName];
  }

  const fallbackIndex = normalizedName
    ? hashCharacterName(normalizedName) % ADULT_FALLBACK_AVATARS.length
    : 0;

  return ADULT_FALLBACK_AVATARS[fallbackIndex];
};
