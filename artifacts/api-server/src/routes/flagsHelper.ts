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
  nigeria: "ng", ghana: "gh", cameroun: "cm", cameroon: "cm",
  tunisie: "tn", egypte: "eg", egypt: "eg", iran: "ir",
  "corée du sud": "kr", "south korea": "kr", "arabie saoudite": "sa",
  qatar: "qa", écosse: "gb-sct", scotland: "gb-sct",
  irlande: "ie", ireland: "ie", grèce: "gr", greece: "gr",
  autriche: "at", austria: "at", suède: "se", sweden: "se",
  norvège: "no", norway: "no", finlande: "fi", finland: "fi",
  islande: "is", iceland: "is", chili: "cl", chile: "cl",
  colombie: "co", colombia: "co", pérou: "pe", peru: "pe",
  uruguay: "uy", venezuela: "ve", équateur: "ec", ecuador: "ec",
  paraguay: "py", bolivie: "bo", bolivia: "bo",
};

export function getCountryCode(teamName: string): string | null {
  const lower = teamName.toLowerCase().trim();
  if (COUNTRY_CODES[lower]) return COUNTRY_CODES[lower];
  for (const [key, code] of Object.entries(COUNTRY_CODES)) {
    if (lower.includes(key) || key.includes(lower)) return code;
  }
  return null;
}

export async function fetchFlagBuffer(countryCode: string): Promise<Buffer | null> {
  try {
    const url = `https://flagcdn.com/96x72/${countryCode}.png`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}
