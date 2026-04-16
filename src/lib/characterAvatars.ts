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
  // High-quality stylized portrait fallback (DiceBear "lorelei" + "notionists" rotation by hash)
  const styles = ["lorelei", "notionists", "adventurer"];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const style = styles[hash % styles.length];
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&backgroundType=gradientLinear&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,ffd93d,6bcf7f`;
};

export const resolveCharacterAvatar = (name?: string | null, avatarUrl?: string | null) => {
  const trimmedAvatarUrl = avatarUrl?.trim();
  if (trimmedAvatarUrl) return trimmedAvatarUrl;
  if (!name) return null;
  return DEFAULT_CHARACTER_AVATARS[normalizeCharacterName(name)] ?? fallbackAvatarFor(name);
};
