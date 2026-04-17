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

const normalizeCharacterName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const resolveCharacterAvatar = (name?: string | null, avatarUrl?: string | null): string | null => {
  const trimmedAvatarUrl = avatarUrl?.trim();
  if (trimmedAvatarUrl) return trimmedAvatarUrl;

  const normalizedName = name ? normalizeCharacterName(name) : "";
  if (normalizedName && NAMED_CHARACTER_AVATARS[normalizedName]) {
    return NAMED_CHARACTER_AVATARS[normalizedName];
  }

  return null;
};
