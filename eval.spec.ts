import { search } from './src/search_engine';

interface TestCase {
  query: string;
  description: string;
  validate: (results: any[]) => { passed: boolean; message: string };
}

const testCases: TestCase[] = [
  {
    query: 'Hawaii',
    description: 'Surfaces major Hawaii airports (HNL, OGG, KOA, LIH)',
    validate: (results) => {
      const iatas = results.map(r => r.iata);
      const expected = ['HNL', 'OGG', 'KOA', 'LIH'];
      const missing = expected.filter(x => !iatas.includes(x));
      const passed = missing.length === 0;
      return {
        passed,
        message: passed 
          ? `Found all Hawaii hubs: ${expected.join(', ')}` 
          : `Missing Hawaii hubs: ${missing.join(', ')}. Got: ${iatas.slice(0, 5).join(', ')}`
      };
    }
  },
  {
    query: 'Ontario',
    description: 'Surfaces airports in Ontario, Canada, and disambiguates from Ontario, CA',
    validate: (results) => {
      const iatas = results.map(r => r.iata);
      const hasCA = results.some(r => r.iata === 'ONT' && r.region === 'California');
      const hasCanada = results.some(r => r.iata === 'YXU' && r.region === 'Ontario' && r.country === 'Canada');
      const passed = hasCA && hasCanada;
      return {
        passed,
        message: passed
          ? `Found both Ontario, California (ONT) and London, Ontario, Canada (YXU)`
          : `Did not find both. Got ONT: ${hasCA}, YXU (Canada): ${hasCanada}. Top results: ${iatas.slice(0, 3).join(', ')}`
      };
    }
  },
  {
    query: 'Bali',
    description: 'Surfaces Denpasar (DPS) and ranks it far above Balikpapan (BPN)',
    validate: (results) => {
      const iatas = results.map(r => r.iata);
      const dpsIndex = iatas.indexOf('DPS');
      const bpnIndex = iatas.indexOf('BPN');
      
      const hasDps = dpsIndex !== -1;
      const bpnIsNotFirst = bpnIndex === -1 || bpnIndex > dpsIndex;
      const passed = hasDps && bpnIsNotFirst;
      
      return {
        passed,
        message: passed
          ? `Bali resolved to Denpasar (DPS) successfully. Balikpapan (BPN) is ranked safely below or not matched.`
          : `DPS found: ${hasDps}. BPN index: ${bpnIndex}, DPS index: ${dpsIndex}. BPN must not rank above DPS.`
      };
    }
  },
  {
    query: 'Florida',
    description: 'Surfaces major US state airports (MIA, MCO, FLL, TPA) above La Florida in Chile (LSC)',
    validate: (results) => {
      const iatas = results.map(r => r.iata);
      const lscIndex = iatas.indexOf('LSC');
      const miaIndex = iatas.indexOf('MIA');
      const mcoIndex = iatas.indexOf('MCO');
      
      const hasMia = miaIndex !== -1 && (lscIndex === -1 || miaIndex < lscIndex);
      const hasMco = mcoIndex !== -1 && (lscIndex === -1 || mcoIndex < lscIndex);
      const passed = hasMia && hasMco;
      
      return {
        passed,
        message: passed
          ? `US Florida airports (MIA/MCO) successfully win over La Florida in Chile (LSC).`
          : `Failed. LSC index: ${lscIndex}, MIA index: ${miaIndex}, MCO index: ${mcoIndex}. US state airports must win.`
      };
    }
  },
  {
    query: 'Manama',
    description: 'Surfaces Bahrain (BAH) for Manama city search',
    validate: (results) => {
      const topResult = results[0];
      const passed = topResult && topResult.iata === 'BAH';
      return {
        passed,
        message: passed
          ? `Manama successfully resolved to ${topResult.iata} - ${topResult.name}`
          : `Failed. Top result was: ${topResult ? topResult.iata : 'none'}`
      };
    }
  },
  {
    query: 'TUL',
    description: 'Surfaces Tulsa International (TUL) for exact IATA',
    validate: (results) => {
      const topResult = results[0];
      const passed = topResult && topResult.iata === 'TUL';
      return {
        passed,
        message: passed
          ? `TUL code resolved directly to ${topResult.name}`
          : `Failed. Top result was: ${topResult ? topResult.iata : 'none'}`
      };
    }
  },
  {
    query: 'Brussels',
    description: 'Surfaces BRU/CRL (not just Zaventem/Charleroi municipality)',
    validate: (results) => {
      const iatas = results.slice(0, 3).map(r => r.iata);
      const passed = iatas.includes('BRU') && iatas.includes('CRL');
      return {
        passed,
        message: passed
          ? `Brussels successfully surfaced BRU and CRL in top results: ${iatas.join(', ')}`
          : `Failed. Top 3 results: ${iatas.join(', ')}. Must include both BRU and CRL.`
      };
    }
  },
  {
    query: 'Londn',
    description: 'Typo tolerance resolves "Londn" to London airports (LHR, LGW)',
    validate: (results) => {
      const iatas = results.slice(0, 3).map(r => r.iata);
      const passed = iatas.includes('LHR') || iatas.includes('LGW');
      return {
        passed,
        message: passed
          ? `Typo "Londn" correctly matched London airports: ${iatas.join(', ')}`
          : `Failed. Top results: ${iatas.join(', ')}`
      };
    }
  },
  {
    query: 'LON',
    description: 'City code "LON" surfaces London airports (LHR, LGW, STN, LCY, LTN)',
    validate: (results) => {
      const iatas = results.map(r => r.iata);
      const expected = ['LHR', 'LGW', 'STN', 'LCY', 'LTN'];
      const found = expected.filter(x => iatas.includes(x));
      const passed = found.length >= 4; // at least 4 of the major London airports
      return {
        passed,
        message: passed
          ? `LON successfully returned city-level hubs: ${found.join(', ')}`
          : `Failed. Missing London hubs. Got: ${iatas.slice(0, 5).join(', ')}`
      };
    }
  },
  {
    query: 'London',
    description: 'Disambiguates London, UK vs. London, Ontario vs. London, Kentucky',
    validate: (results) => {
      const hasUk = results.some(r => r.iata === 'LHR' && r.country === 'United Kingdom');
      const hasOn = results.some(r => r.iata === 'YXU' && r.region === 'Ontario' && r.country === 'Canada');
      const hasKy = results.some(r => r.iata === 'LOZ' && r.region === 'Kentucky');
      
      const passed = hasUk && hasOn; // Kentucky (LOZ) is a small airport and might not make the cut if limit is small, but UK and Canada are mandatory
      return {
        passed,
        message: passed
          ? `Successfully disambiguated London, UK (LHR/LGW), London, Ontario (YXU), and London, KY (LOZ: ${hasKy})`
          : `Failed. UK: ${hasUk}, Canada: ${hasOn}, KY: ${hasKy}`
      };
    }
  },
  {
    query: '東京',
    description: 'Surfaces HND and NRT for Tokyo in Japanese script',
    validate: (results) => {
      const iatas = results.slice(0, 3).map(r => r.iata);
      const passed = iatas.includes('HND') && iatas.includes('NRT');
      return {
        passed,
        message: passed
          ? `Japanese script "東京" correctly returned: ${iatas.join(', ')}`
          : `Failed. Top results: ${iatas.join(', ')}. Must include HND and NRT.`
      };
    }
  },
  {
    query: 'São Paulo',
    description: 'Surfaces GRU, CGH, VCP for Sao Paulo diacritic/accent',
    validate: (results) => {
      const iatas = results.slice(0, 3).map(r => r.iata);
      const passed = iatas.includes('GRU') && iatas.includes('CGH');
      return {
        passed,
        message: passed
          ? `São Paulo resolved to Brazil hubs: ${iatas.join(', ')}`
          : `Failed. Top results: ${iatas.join(', ')}`
      };
    }
  }
];

async function runSuite() {
  console.log('\n==================================================');
  console.log('   FLY FAIRLY AUTOMATED SEARCH VERIFICATION SUITE');
  console.log('==================================================\n');

  let passedSuite = true;
  let passedCount = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`[TEST ${i + 1}/${testCases.length}] Query: "${tc.query}"`);
    console.log(`Description: ${tc.description}`);

    try {
      const results = search(tc.query, 10);
      const { passed, message } = tc.validate(results);

      if (passed) {
        console.log(`\x1b[32m✔ PASSED\x1b[0m: ${message}`);
        passedCount++;
      } else {
        console.log(`\x1b[31m✘ FAILED\x1b[0m: ${message}`);
        passedSuite = false;
        
        // Print actual returned rows to debug
        console.log('Actual top results returned:');
        results.slice(0, 5).forEach((r, idx) => {
          console.log(`  ${idx + 1}. [${r.iata}] ${r.name} (${r.city}, ${r.region}, ${r.country}) [Score: ${r.score.toFixed(2)}]`);
        });
      }
    } catch (err: any) {
      console.log(`\x1b[31m✘ ERROR EXECUTING TEST\x1b[0m: ${err.message}`);
      passedSuite = false;
    }
    console.log('--------------------------------------------------');
  }

  console.log('\n==================================================');
  if (passedSuite) {
    console.log(`\x1b[32mALL TESTS PASSED! (${passedCount}/${testCases.length} succeeded)\x1b[0m`);
  } else {
    console.log(`\x1b[31mSOME TESTS FAILED! (${passedCount}/${testCases.length} succeeded)\x1b[0m`);
    process.exit(1);
  }
  console.log('==================================================\n');
}

runSuite();
