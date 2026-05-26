# Fly Fairly: Code Flow Guide

This guide explains how the **Fly Fairly** autocomplete search engine works under the hood in a simple, visual, and high-level way.

---

## 1. System Overview
The application runs in two separate phases:
1.  **Offline Data Ingestion** (Runs once to build a clean local database).
2.  **Runtime Search Flow** (Runs every time a user types in the search bar).

```
[OurAirports CSVs] ---> Ingestion Pipeline (data_pipeline.ts) ---> [Local SQLite (airports.db)]
                                                                           |
                                                                           v
[User Types in UI] ---> Express Server API (server.ts) <---> Search Engine (search_engine.ts)
```

---

## 2. Phase 1: Building the Database (Offline Pipeline)
File: `src/data_pipeline.ts`

When the ingestion pipeline runs, it transforms dirty raw data into a fast, relational database:

```
[Raw CSVs] 
   │
   ├──> 1. Filter out Closed Airports, Heliports, Seaplanes, & Military Fields (Prune 85k down to 8k)
   ├──> 2. Relational Join: Map iso_country & iso_region codes to full readable names
   ├──> 3. City Corrections: Remap municipality naming discrepancies (e.g. Zaventem -> Brussels)
   ├──> 4. Inject Aliases & Foreign Scripts (e.g. "東京" for Tokyo, "LON" for London Hubs)
   ├──> 5. Calculate Hub Importance Score (Boost commercial flights and "International" fields)
   │
   v
[airports.db SQLite Database with performance indexes on IATA, City, Region]
```

---

## 3. Phase 2: Autocomplete Query (Runtime Flow)
Files: `frontend/src/components/AirportSearch.tsx` ──> `src/server.ts` ──> `src/search_engine.ts`

Here is exactly what happens when you type a query like `"Londn"` or `"LON"` in the search bar:

### Step 1: Frontend Debouncing (UI)
*   You type in the search bar.
*   The UI waits for **200ms of silence** (debouncing) to prevent spamming the server with every single keystroke.
*   An API request is sent to: `http://localhost:3000/api/search?q=Londn`.

### Step 2: API Request handling (Server)
*   `server.ts` receives the query.
*   It tracks the start time in microseconds, calls `search("Londn")`, processes the ranked results, logs the latency, and returns a JSON payload to the user in **~2-4 milliseconds**.

### Step 3: Candidate Matching & Scoring (Search Engine)
Inside `search_engine.ts`, your query is processed:
1.  **Text Normalization**: Strips accents (e.g. `São Paulo` -> `sao paulo`) and converts to lowercase.
2.  **Fast SQLite Lookup**: Runs a indexed prefix query to retrieve a small candidate pool matching your query terms (takes `<1ms`).
3.  **7-Tier Sorting**: Computes matched scores based on strict rules:
    *   *Tier 1*: Exact IATA code (Tulsa `TUL`) -> **Score 10,000**
    *   *Tier 2*: Exact City code (London `LON`) -> **Score 8,000**
    *   *Tier 3*: Exact City name (e.g. `Brussels`) -> **Score 5,000**
    *   *Tier 4*: Exact Region name (e.g. `Hawaii`) -> **Score 2,000**
    *   *Tier 5*: Exact Country name (e.g. `Bahrain`) -> **Score 1,500**
    *   *Tier 6*: Alias / Substring / Multilingual translations -> **Score 700 - 1200**
    *   *Tier 7*: Typo Tolerance (Levenshtein edit distance <= 2 on city names) -> **Score 500 - 1750**
4.  **Size & Relevance Boost**: Multiplies the candidate's matched score by its physical hub size (`large_airport` gets a bigger multiplier than `small_airport`), scheduled commercial flag, and name-based international boosts. This ensures **London, UK (LHR)** ranks above **London, Canada (YXU)**.

---

## 4. Key Files Directory

*   📂 **`src/data_pipeline.ts`**: Cleans, parses, enriches, and stores the OurAirports CSV data into SQLite.
*   📂 **`src/search_engine.ts`**: Normalizes search text, queries the DB, ranks results, and implements Levenshtein typo distance.
*   📂 **`src/server.ts`**: Exposes the search endpoint and hosts static files for the React UI.
*   📂 **`eval.spec.ts`**: Run automated assertions for all 12 mandatory search edge cases.
*   📂 **`frontend/src/components/AirportSearch.tsx`**: Renders autocomplete search inputs, badges, special City banners, and mock booking cards.
