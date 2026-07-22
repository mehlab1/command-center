export interface CountryCode {
  name: string;
  code: string; // dial code digits, no "+"
  flag: string;
}

// Curated common set, not the full ITU list — Pakistan pinned first since
// that's this app's single-tenant default audience, rest alphabetical.
export const COUNTRY_CODES: CountryCode[] = [
  { name: "Pakistan", code: "92", flag: "🇵🇰" },
  { name: "United States", code: "1", flag: "🇺🇸" },
  { name: "United Kingdom", code: "44", flag: "🇬🇧" },
  { name: "United Arab Emirates", code: "971", flag: "🇦🇪" },
  { name: "Saudi Arabia", code: "966", flag: "🇸🇦" },
  { name: "India", code: "91", flag: "🇮🇳" },
  { name: "Canada", code: "1", flag: "🇨🇦" },
  { name: "Australia", code: "61", flag: "🇦🇺" },
  { name: "Germany", code: "49", flag: "🇩🇪" },
  { name: "France", code: "33", flag: "🇫🇷" },
  { name: "China", code: "86", flag: "🇨🇳" },
  { name: "Bangladesh", code: "880", flag: "🇧🇩" },
  { name: "Turkey", code: "90", flag: "🇹🇷" },
  { name: "Qatar", code: "974", flag: "🇶🇦" },
  { name: "Kuwait", code: "965", flag: "🇰🇼" },
  { name: "Bahrain", code: "973", flag: "🇧🇭" },
  { name: "Oman", code: "968", flag: "🇴🇲" },
  { name: "Malaysia", code: "60", flag: "🇲🇾" },
  { name: "Singapore", code: "65", flag: "🇸🇬" },
  { name: "Indonesia", code: "62", flag: "🇮🇩" },
  { name: "Egypt", code: "20", flag: "🇪🇬" },
  { name: "South Africa", code: "27", flag: "🇿🇦" },
  { name: "Nigeria", code: "234", flag: "🇳🇬" },
  { name: "Netherlands", code: "31", flag: "🇳🇱" },
  { name: "Spain", code: "34", flag: "🇪🇸" },
  { name: "Italy", code: "39", flag: "🇮🇹" },
  { name: "Japan", code: "81", flag: "🇯🇵" },
  { name: "South Korea", code: "82", flag: "🇰🇷" },
  { name: "Brazil", code: "55", flag: "🇧🇷" },
  { name: "Sri Lanka", code: "94", flag: "🇱🇰" },
  { name: "Afghanistan", code: "93", flag: "🇦🇫" },
  { name: "Philippines", code: "63", flag: "🇵🇭" },
];

export function findCountryByCode(code: string): CountryCode | undefined {
  return COUNTRY_CODES.find((c) => c.code === code);
}
