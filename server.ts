import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';

interface StatsData {
  visits: number;
  likes: Record<string, number>;
}

const app = express();
const PORT = 3000;
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const PROJECTS_FILE = path.join(ROOT_DIR, 'projects.json');

app.use(express.json());

function readProjectsIds(): string[] {
  try {
    if (!fs.existsSync(PROJECTS_FILE)) return [];
    const raw = fs.readFileSync(PROJECTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p: { id?: unknown }) => (typeof p?.id === 'string' ? p.id : ''))
      .filter((id: string) => id.length > 0);
  } catch {
    return [];
  }
}

function ensureStatsFile(): StatsData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STATS_FILE)) {
    const initialLikes: Record<string, number> = {};
    for (const id of readProjectsIds()) {
      initialLikes[id] = 0;
    }
    const initial: StatsData = { visits: 0, likes: initialLikes };
    fs.writeFileSync(STATS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STATS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StatsData>;
    return {
      visits: typeof parsed.visits === 'number' && parsed.visits >= 0 ? parsed.visits : 0,
      likes: parsed.likes && typeof parsed.likes === 'object' ? parsed.likes : {},
    };
  } catch {
    return { visits: 0, likes: {} };
  }
}

let statsState: StatsData = ensureStatsFile();
let writeQueue: Promise<void> = Promise.resolve();

function persistStats(): Promise<void> {
  const snapshot = JSON.stringify(statsState, null, 2);
  writeQueue = writeQueue.then(async () => {
    if (!fs.existsSync(DATA_DIR)) {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
    }
    await fs.promises.writeFile(STATS_FILE, snapshot, 'utf-8');
  });
  return writeQueue;
}

function sanitizeCounterId(rawId: string): string {
  return rawId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
}

app.get('/api/counters/summary', (_req: Request, res: Response) => {
  const projectIds = readProjectsIds();
  const likesByProject: Record<string, number> = {};
  let totalLikes = 0;

  if (projectIds.length > 0) {
    for (const id of projectIds) {
      const count = statsState.likes[id] ?? 0;
      likesByProject[id] = count;
      totalLikes += count;
    }
  } else {
    for (const [id, count] of Object.entries(statsState.likes)) {
      likesByProject[id] = count;
      totalLikes += count;
    }
  }

  res.json({
    visits: statsState.visits,
    totalLikes,
    likes: likesByProject,
  });
});

app.get('/api/counters/visits', (_req: Request, res: Response) => {
  res.json({ count: statsState.visits });
});

const handleVisitUp = async (_req: Request, res: Response) => {
  statsState.visits += 1;
  await persistStats();
  res.json({ count: statsState.visits });
};

app.post('/api/counters/visits/up', handleVisitUp);
app.get('/api/counters/visits/up', handleVisitUp);

app.get('/api/counters/likes/:id', (req: Request, res: Response) => {
  const id = sanitizeCounterId(String(req.params.id || ''));
  if (!id) {
    res.status(400).json({ error: 'Invalid project id' });
    return;
  }
  const count = statsState.likes[id] ?? 0;
  res.json({ id, count });
});

const handleLikeUp = async (req: Request, res: Response) => {
  const id = sanitizeCounterId(String(req.params.id || ''));
  if (!id) {
    res.status(400).json({ error: 'Invalid project id' });
    return;
  }
  statsState.likes[id] = (statsState.likes[id] ?? 0) + 1;
  await persistStats();
  res.json({ id, count: statsState.likes[id] });
};

app.post('/api/counters/likes/:id/up', handleLikeUp);
app.get('/api/counters/likes/:id/up', handleLikeUp);

const handleLikeDown = async (req: Request, res: Response) => {
  const id = sanitizeCounterId(String(req.params.id || ''));
  if (!id) {
    res.status(400).json({ error: 'Invalid project id' });
    return;
  }
  const current = statsState.likes[id] ?? 0;
  statsState.likes[id] = Math.max(0, current - 1);
  await persistStats();
  res.json({ id, count: statsState.likes[id] });
};

app.post('/api/counters/likes/:id/down', handleLikeDown);
app.get('/api/counters/likes/:id/down', handleLikeDown);

const BLOCKED_PATH_RE = /^\/(server\.ts|package\.json|package-lock\.json|tsconfig\.json|vite\.config\.ts|metadata\.json|\.env($|\.|\/)|\.git|data(\/|$)|src(\/|$)|node_modules(\/|$)|dist(\/|$))/i;

app.use((req: Request, res: Response, next: NextFunction) => {
  if (BLOCKED_PATH_RE.test(req.path)) {
    const notFoundPage = path.join(ROOT_DIR, '404.html');
    if (fs.existsSync(notFoundPage)) {
      res.status(404).sendFile(notFoundPage);
    } else {
      res.status(404).send('404 Not Found');
    }
    return;
  }
  next();
});

app.use(express.static(ROOT_DIR, { extensions: ['html'] }));

app.use((req: Request, res: Response) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API route not found' });
    return;
  }
  const notFoundPage = path.join(ROOT_DIR, '404.html');
  if (fs.existsSync(notFoundPage)) {
    res.status(404).sendFile(notFoundPage);
  } else {
    res.status(404).send('404 Not Found');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Portfolio server running at http://0.0.0.0:${PORT}`);
});
