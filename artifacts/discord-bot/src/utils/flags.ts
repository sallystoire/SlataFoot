const COUNTRY_CODES: Record<string, string> = {
  france: "fr", portugal: "pt", espagne: "es", spain: "es",
  allemagne: "de", germany: "de", angleterre: "gb-eng", england: "gb-eng",
  italie: "it", italy: "it", brésil: "br", bresil: "br", brazil: "br",
  argentine: "ar", argentina: "ar", maroc: "ma", morocco: "ma",
  belgique: "be", belgium: "be", algérie: "dz", algerie: "dz",
  sénégal: "sn", senegal: "sn", "pays-bas": "nl", netherlands: "nl",
  croatie: "hr", croatia: "hr", japon: "jp", japan: "jp",
  mexique: "mx", mexico: "mx", usa: "us", canada: "ca",
  australie: "au", australia: "au", suisse: "ch", switzerland: "ch",
  danemark: "dk", denmark: "dk", pologne: "pl", poland: "pl",
  ukraine: "ua", serbie: "rs", serbia: "rs", turquie: "tr",
  turkey: "tr", nigeria: "ng", ghana: "gh", cameroun: "cm",
  cameroon: "cm", tunisie: "tn", tunesia: "tn", côtedivoire: "ci",
  egypte: "eg", egypt: "eg", iran: "ir", corée: "kr", korea: "kr",
  arabie: "sa", qatar: "qa", écosse: "gb-sct", scotland: "gb-sct",
  irlande: "ie", ireland: "ie", grèce: "gr", greece: "gr",
  autriche: "at", austria: "at", russie: "ru", russia: "ru",
  suède: "se", sweden: "se", norvège: "no", norway: "no",
  finlande: "fi", finland: "fi", islande: "is", iceland: "is",
  psg: "fr", marseille: "fr", lyon: "fr", monaco: "mc",
  "real madrid": "es", barcelona: "es", "atlético": "es",
  "manchester city": "gb-eng", "manchester united": "gb-eng",
  liverpool: "gb-eng", chelsea: "gb-eng", arsenal: "gb-eng",
  "tottenham": "gb-eng", "inter milan": "it", "ac milan": "it",
  juventus: "it", "as roma": "it", "napoli": "it",
  "borussia dortmund": "de", "bayern munich": "de", "rb leipzig": "de",
  ajax: "nl", "porto": "pt", "benfica": "pt", "sporting": "pt",
  "galatasaray": "tr", "fenerbahce": "tr", "celtic": "gb-sct",
};

export function getCountryCode(teamName: string): string | null {
  const lower = teamName.toLowerCase().replace(/[^a-záàâäéèêëíìîïóòôöúùûüýÿñç\s-]/g, "").trim();
  if (COUNTRY_CODES[lower]) return COUNTRY_CODES[lower];
  for (const [key, code] of Object.entries(COUNTRY_CODES)) {
    if (lower.includes(key) || key.includes(lower)) return code;
  }
  return null;
}

export async function fetchFlagBuffer(countryCode: string, size = 80): Promise<Buffer | null> {
  try {
    const url = `https://flagcdn.com/96x72/${countryCode}.png`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}
