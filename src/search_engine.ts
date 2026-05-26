import Database from 'better-sqlite3';
import * as path from 'path';

const DB_FILE = path.join(__dirname, '..', 'airports.db');

export interface AirportRecord {
  id: string;
  iata: string;
  name: string;
  city: string;
  city_code: string | null;
  region: string;
  region_code: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  type: string;
  importance_score: number;
  aliases: string; // JSON array of string keywords
}

export interface SearchResult {
  iata: string;
  name: string;
  city: string;
  city_code: string | null;
  region: string;
  country: string;
  type: string;
  importance_score: number;
  score: number; // final match ranking score
}

let dbInstance: any = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(DB_FILE, { readonly: true });
  }
  return dbInstance;
}

export function normalizeText(text: string): string {
  if (!text) return '';
  return text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1, // deletion
        tmp[i][j - 1] + 1, // insertion
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1) // substitution
      );
    }
  }
  return tmp[a.length][b.length];
}

export function search(query: string, limit = 10): SearchResult[] {
  if (!query || query.trim() === '') return [];

  const qNorm = normalizeText(query);
  const db = getDb();

  // 1. Fetch potential candidates from the SQLite database.
  // We use indexes to pull overlapping rows extremely quickly.
  let candidates: AirportRecord[] = [];

  const isNonLatin = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af\u0600-\u06ff]/.test(query);

  if (qNorm.length < 3 && !isNonLatin) {
    // For short queries, match IATA prefix, City Code, or City prefix to avoid massive scans
    const stmt = db.prepare(`
      SELECT * FROM airports
      WHERE iata LIKE ?
         OR city_code = ?
         OR city LIKE ?
         OR name LIKE ?
    `);
    candidates = stmt.all(`${qNorm}%`, qNorm.toUpperCase(), `${qNorm}%`, `${qNorm}%`) as AirportRecord[];
  } else {
    // For normal queries, scan prefixes and aliases
    const stmt = db.prepare(`
      SELECT * FROM airports
      WHERE iata LIKE ?
         OR city_code = ?
         OR city LIKE ?
         OR region LIKE ?
         OR country LIKE ?
         OR name LIKE ?
         OR aliases LIKE ?
    `);
    const likeParam = `%${qNorm}%`;
    candidates = stmt.all(
      `${qNorm}%`, 
      qNorm.toUpperCase(), 
      likeParam, 
      likeParam, 
      likeParam, 
      likeParam, 
      likeParam
    ) as AirportRecord[];
  }

  // 2. Score and Rank the candidates using the 5-Tier Algorithm in TypeScript memory.
  const scoredResults: SearchResult[] = [];

  for (const apt of candidates) {
    const iataNorm = normalizeText(apt.iata);
    const cityNorm = normalizeText(apt.city);
    const cityCodeNorm = normalizeText(apt.city_code || '');
    const regionNorm = normalizeText(apt.region);
    const countryNorm = normalizeText(apt.country);
    const nameNorm = normalizeText(apt.name);
    const parsedAliases: string[] = JSON.parse(apt.aliases);

    let matchScore = 0;

    // --- Tier 1: Exact IATA match ---
    if (qNorm === iataNorm) {
      matchScore = 10000;
    }
    // --- Tier 2: Exact City-Level IATA Code Match ---
    else if (qNorm === cityCodeNorm) {
      matchScore = 8000;
    }
    // --- Tier 3: Exact City Name Match ---
    else if (qNorm === cityNorm) {
      matchScore = 5000;
    }
    // --- Tier 4: Exact Region Name Match ---
    else if (qNorm === regionNorm) {
      matchScore = 2000;
    }
    // --- Tier 5: Exact Country Name Match ---
    else if (qNorm === countryNorm) {
      matchScore = 1500;
    }
    // --- Tier 6: Substring / Prefix / Alias Matches ---
    else if (iataNorm.startsWith(qNorm)) {
      matchScore = 1200; // prefix on IATA code
    } 
    else if (cityNorm.startsWith(qNorm)) {
      matchScore = 1000; // prefix on City
    }
    else if (nameNorm.startsWith(qNorm)) {
      matchScore = 800; // prefix on Airport Name
    }
    else if (parsedAliases.includes(qNorm)) {
      matchScore = 700; // exact alias match (e.g. "東京")
    }
    else if (cityNorm.includes(qNorm)) {
      matchScore = 600; // substring on City
    }
    else if (nameNorm.includes(qNorm)) {
      matchScore = 400; // substring on Airport Name
    }
    else if (regionNorm.includes(qNorm)) {
      matchScore = 300; // substring on Region
    }
    else if (countryNorm.includes(qNorm)) {
      matchScore = 200; // substring on Country
    }
    else {
      // --- Tier 7: Typo Tolerance (Levenshtein Distance) ---
      // We calculate typo tolerance between query and City Name or IATA.
      // Must be strict (edit distance <= 2) to avoid cross-continental noise.
      const distCity = getLevenshteinDistance(qNorm, cityNorm);
      if (distCity <= 2) {
        matchScore = Math.round(3500 / (1 + distCity));
      } else {
        const distName = getLevenshteinDistance(qNorm, nameNorm);
        if (distName <= 2) {
          matchScore = Math.round(1500 / (1 + distName));
        }
      }
    }

    // If there is no score overlap, skip this candidate
    if (matchScore === 0) {
      continue;
    }

    // Apply the Importance Score multiplier (boost large hubs significantly)
    // large_airport (100) -> 1.5x multiplier
    // medium_airport (50) -> 1.0x multiplier
    // small_airport (10) -> 0.6x multiplier
    const sizeMultiplier = 0.5 + (apt.importance_score / 100);
    const finalScore = matchScore * sizeMultiplier;

    scoredResults.push({
      iata: apt.iata,
      name: apt.name,
      city: apt.city,
      city_code: apt.city_code,
      region: apt.region,
      country: apt.country,
      type: apt.type,
      importance_score: apt.importance_score,
      score: finalScore
    });
  }

  // 3. Sort by final score descending and slice to the requested limit.
  // Tie breakers: sort by importance score descending, then by city name alphabetically.
  scoredResults.sort((a, b) => {
    if (Math.abs(b.score - a.score) < 0.01) {
      if (b.importance_score !== a.importance_score) {
        return b.importance_score - a.importance_score;
      }
      return a.city.localeCompare(b.city);
    }
    return b.score - a.score;
  });

  // If a multi-airport city query was entered (e.g. LON), we want to return the individual 
  // airports. We also can return a special virtual group result if desired, but returning 
  // the sorted list of children is the standard API contract.
  
  return scoredResults.slice(0, limit);
}

export function getAirportsByIata(iataCodes: string[]): SearchResult[] {
  const db = getDb();
  const results: SearchResult[] = [];
  const stmt = db.prepare('SELECT * FROM airports WHERE iata = ?');
  
  for (const code of iataCodes) {
    const apt = stmt.get(code.toUpperCase()) as AirportRecord | undefined;
    if (apt) {
      results.push({
        iata: apt.iata,
        name: apt.name,
        city: apt.city,
        city_code: apt.city_code,
        region: apt.region,
        country: apt.country,
        type: apt.type,
        importance_score: apt.importance_score,
        score: 10000 // exact IATA retrieve
      });
    }
  }
  return results;
}
