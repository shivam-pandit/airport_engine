import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import Database from 'better-sqlite3';

const SCRATCH_DIR = path.join(__dirname, '..', 'scratch');
const DB_FILE = path.join(__dirname, '..', 'airports.db');

const COUNTRIES_CSV = path.join(SCRATCH_DIR, 'countries.csv');
const REGIONS_CSV = path.join(SCRATCH_DIR, 'regions.csv');
const AIRPORTS_CSV = path.join(SCRATCH_DIR, 'airports.csv');

// Corrections for municipality naming discrepancies in raw dataset
const CITY_CORRECTIONS: Record<string, string> = {
  "BRU": "Brussels",
  "CRL": "Brussels",
  "CDG": "Paris",
  "ORY": "Paris",
  "BVA": "Paris",
  "NRT": "Tokyo",
  "HND": "Tokyo",
  "ICN": "Seoul",
  "GMP": "Seoul",
  "PEK": "Beijing",
  "PKX": "Beijing",
  "DXB": "Dubai",
  "DWC": "Dubai",
  "GRU": "São Paulo",
  "CGH": "São Paulo",
  "VCP": "São Paulo",
  "MUC": "Munich",
  "FCO": "Rome",
  "CIA": "Rome",
  "NTE": "Nantes",
};

// Maps airport IATA to its parent multi-airport city code
const CITY_GROUPS: Record<string, string> = {
  "LHR": "LON", "LGW": "LON", "STN": "LON", "LCY": "LON", "LTN": "LON", "SEN": "LON", "BQH": "LON",
  "JFK": "NYC", "EWR": "NYC", "LGA": "NYC",
  "HND": "TYO", "NRT": "TYO",
  "CDG": "PAR", "ORY": "PAR", "BVA": "PAR",
  "KIX": "OSA", "ITM": "OSA",
  "ICN": "SEL", "GMP": "SEL",
  "PEK": "BJS", "PKX": "BJS",
  "GRU": "SAO", "CGH": "SAO", "VCP": "SAO",
};

// Translations and aliases for major cities/regions
const CITY_ALIASES: Record<string, string[]> = {
  "LON": ["london", "londn", "england", "united kingdom", "uk"],
  "TYO": ["tokyo", "東京", "とうきょう", "japan", "nihon", "nippon"],
  "SEL": ["seoul", "서울", "korea"],
  "BJS": ["beijing", "北京", "china"],
  "DXB": ["dubai", "دبي", "uae", "united arab emirates"],
  "SAO": ["sao paulo", "são paulo", "brazil", "brasil"],
  "PAR": ["paris", "france"],
  "DPS": ["bali", "denpasar", "indonesia"],
  "MUC": ["munich", "münchen", "germany"],
  "FCO": ["rome", "roma", "italy"],
};

interface CsvRow {
  [key: string]: string;
}

async function parseCsv(filePath: string): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const results: CsvRow[] = [];
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function runPipeline() {
  console.log('--- STARTING AIRPORT DATA INGESTION ---');

  if (fs.existsSync(DB_FILE)) {
    console.log('Removing old database...');
    fs.unlinkSync(DB_FILE);
  }

  const db = new Database(DB_FILE);

  // Set up schema
  console.log('Creating database schema...');
  db.exec(`
    CREATE TABLE airports (
      id TEXT PRIMARY KEY,
      iata TEXT NOT NULL,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      city_code TEXT,
      region TEXT NOT NULL,
      region_code TEXT NOT NULL,
      country TEXT NOT NULL,
      country_code TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      type TEXT NOT NULL,
      importance_score INTEGER NOT NULL,
      aliases TEXT NOT NULL
    );
    CREATE INDEX idx_airports_iata ON airports(iata);
    CREATE INDEX idx_airports_city_code ON airports(city_code);
    CREATE INDEX idx_airports_city ON airports(city);
    CREATE INDEX idx_airports_region ON airports(region);
  `);

  console.log('Loading countries...');
  const countriesData = await parseCsv(COUNTRIES_CSV);
  const countriesMap: Record<string, string> = {};
  for (const country of countriesData) {
    countriesMap[country.code] = country.name;
  }

  console.log('Loading regions...');
  const regionsData = await parseCsv(REGIONS_CSV);
  const regionsMap: Record<string, string> = {};
  for (const region of regionsData) {
    regionsMap[region.code] = region.name;
  }

  console.log('Loading and processing airports...');
  const airportsData = await parseCsv(AIRPORTS_CSV);
  
  const insertStmt = db.prepare(`
    INSERT INTO airports (
      id, iata, name, city, city_code, region, region_code, country, country_code,
      latitude, longitude, type, importance_score, aliases
    ) VALUES (
      @id, @iata, @name, @city, @city_code, @region, @region_code, @country, @country_code,
      @latitude, @longitude, @type, @importance_score, @aliases
    )
  `);

  const allowedTypes = ['large_airport', 'medium_airport', 'small_airport'];
  let prunedCount = 0;
  let savedCount = 0;

  // Transaction for batch insertions
  const insertMany = db.transaction((airportsList: any[]) => {
    for (const apt of airportsList) {
      insertStmt.run(apt);
    }
  });

  const processedAirports = [];

  for (const airport of airportsData) {
    const iata = airport.iata_code ? airport.iata_code.trim().toUpperCase() : '';
    const type = airport.type ? airport.type.trim() : '';
    
    // Strict Pruning: Must have active IATA code, cannot be closed, and must be medium/large/small commercial airport.
    // Also filter out heliports, seaplanes, and military bases.
    const isClosed = type === 'closed';
    const isCommercialType = allowedTypes.includes(type);
    const hasIata = iata !== '' && iata.length === 3;
    const nameLower = (airport.name || '').toLowerCase();
    
    const isMilitary = nameLower.includes('military') || 
                       nameLower.includes('air force base') || 
                       nameLower.includes('army airfield') || 
                       nameLower.includes('naval air station') || 
                       nameLower.includes('afb') ||
                       (airport.keywords && airport.keywords.toLowerCase().includes('military'));

    const isHeliportOrSeaplane = type.includes('heliport') || type.includes('seaplane') || nameLower.includes('heliport') || nameLower.includes('seaplane');

    if (!hasIata || isClosed || !isCommercialType || isMilitary || isHeliportOrSeaplane) {
      prunedCount++;
      continue;
    }

    // Determine importance score based on type and scheduled commercial service
    let score = 10;
    const isScheduled = airport.scheduled_service === 'yes';
    
    if (type === 'large_airport') {
      score = 100;
    } else if (type === 'medium_airport') {
      score = isScheduled ? 75 : 30;
    } else if (type === 'small_airport') {
      score = isScheduled ? 25 : 5;
    }

    // International airport name boost (+15) to prioritize customs/commercial hubs over regional fields
    if (nameLower.includes('international') || nameLower.includes('intl')) {
      score += 15;
    }

    // Resolve Friendly City Name Corrections
    let city = airport.municipality ? airport.municipality.trim() : '';
    if (CITY_CORRECTIONS[iata]) {
      city = CITY_CORRECTIONS[iata];
    }

    // Resolve multi-airport city codes
    const city_code = CITY_GROUPS[iata] || null;

    const country = countriesMap[airport.iso_country] || '';
    const region = regionsMap[airport.iso_region] || '';

    // Build alias list for foreign scripts, diacritics, and regional synonyms
    const aliasSet = new Set<string>();
    aliasSet.add(normalizeText(city));
    aliasSet.add(normalizeText(region));
    aliasSet.add(normalizeText(country));
    aliasSet.add(normalizeText(airport.name));
    aliasSet.add(normalizeText(iata));
    
    // Inject pre-defined foreign script translations or synonyms
    if (city_code && CITY_ALIASES[city_code]) {
      CITY_ALIASES[city_code].forEach(alias => aliasSet.add(normalizeText(alias)));
    }
    if (CITY_ALIASES[iata]) {
      CITY_ALIASES[iata].forEach(alias => aliasSet.add(normalizeText(alias)));
    }

    // Special cases: Bali (Denpasar) -> add "bali" alias
    if (region.toLowerCase().includes('bali') || city.toLowerCase().includes('bali')) {
      aliasSet.add('bali');
    }

    const processed = {
      id: airport.ident,
      iata: iata,
      name: airport.name ? airport.name.trim() : '',
      city: city,
      city_code: city_code,
      region: region,
      region_code: airport.iso_region,
      country: country,
      country_code: airport.iso_country,
      latitude: parseFloat(airport.latitude_deg) || 0.0,
      longitude: parseFloat(airport.longitude_deg) || 0.0,
      type: type,
      importance_score: score,
      aliases: JSON.stringify(Array.from(aliasSet))
    };

    processedAirports.push(processed);
    savedCount++;
  }

  console.log(`Inserting ${processedAirports.length} commercial airports into SQLite database...`);
  insertMany(processedAirports);

  console.log(`--- INGESTION COMPLETED ---`);
  console.log(`Pruned/Filtered Out: ${prunedCount} records.`);
  console.log(`Commercial Airports Ingested: ${savedCount} records.`);
  console.log(`Database saved successfully at: ${DB_FILE}`);

  db.close();
}

runPipeline().catch(console.error);
