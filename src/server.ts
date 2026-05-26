import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { search } from './search_engine';

const app = express();

app.use(cors());
app.use(express.json());

// Serve static assets from our compiled React frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Ranked Search API Endpoint
app.get('/api/search', (req, res) => {
  const query = req.query.q as string | undefined;
  
  if (!query || query.trim() === '') {
    return res.json({ results: [], source: 'none' });
  }

  try {
    const startTime = process.hrtime();
    const results = search(query, 12);
    const diff = process.hrtime(startTime);
    const latencyMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

    console.log(`[API Search] "${query}" returned ${results.length} results in ${latencyMs}ms`);

    return res.json({
      results,
      source: 'sqlite_local_index',
      latency: `${latencyMs}ms`
    });
  } catch (error: any) {
    console.error(`[API Error] Search failed for query "${query}":`, error.message);
    return res.status(500).json({
      error: 'Failed to execute search query',
      details: error.message
    });
  }
});

// Fallback all other GET requests to our Single Page Application index.html
app.get(/^(?!\/api\/search).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Fly Fairly Search API Server listening on port ${PORT}`);
  console.log(`Endpoint available at http://localhost:${PORT}/api/search`);
  console.log(`==================================================`);
});
