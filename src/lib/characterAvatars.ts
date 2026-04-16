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

const fallbackAvatarFor = (name: string) => {
  const seed = encodeURIComponent(normalizeCharacterName(name) || name);
  // DiceBear "adventurer" – consistent, colorful, no API key, served via CDN
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundType=gradientLinear&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
};

export const resolveCharacterAvatar = (name?: string | null, avatarUrl?: string | null) => {
  const trimmedAvatarUrl = avatarUrl?.trim();
  if (trimmedAvatarUrl) return trimmedAvatarUrl;
  if (!name) return null;
  return DEFAULT_CHARACTER_AVATARS[normalizeCharacterName(name)] ?? fallbackAvatarFor(name);
};
