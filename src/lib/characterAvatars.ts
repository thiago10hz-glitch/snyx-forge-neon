import akiraBlade from "@/assets/characters/akira-blade.jpg";
import lunaStarfire from "@/assets/characters/luna-starfire.jpg";
import mikuChan from "@/assets/characters/miku-chan.jpg";
import professorEnigma from "@/assets/characters/professor-enigma.jpg";
import shadowRex from "@/assets/characters/shadow-rex.jpg";
import valentinaRose from "@/assets/characters/valentina-rose.jpg";

const DEFAULT_CHARACTER_AVATARS: Record<string, string> = {
  "akira blade": akiraBlade,
  "luna starfire": lunaStarfire,
  "miku chan": mikuChan,
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

export const resolveCharacterAvatar = (name?: string | null, avatarUrl?: string | null) => {
  const trimmedAvatarUrl = avatarUrl?.trim();
  if (trimmedAvatarUrl) return trimmedAvatarUrl;
  if (!name) return null;
  // Only return preset portrait if name matches one of our hand-crafted characters.
  // Otherwise return null so the UI shows its themed initial-fallback (epic gradient).
  return DEFAULT_CHARACTER_AVATARS[normalizeCharacterName(name)] ?? null;
};
