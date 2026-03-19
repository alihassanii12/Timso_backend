import cors from 'cors';

/* ─────────────────────────────────────────────
   Allowed origins list
   Yahan apne sab URLs add karo
───────────────────────────────────────────── */
const ALLOWED_ORIGINS = [
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',

  // Production frontend
  'https://timso.vercel.app',

  // Preview deployments — sab *.vercel.app allow karo
  // (regex se handle hoga neeche)
];

const corsOptions = {
  origin: (origin, callback) => {
    // origin undefined = same-origin ya Postman/curl — allow karo
    if (!origin) return callback(null, true);

    // Exact match
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }

    // Sab Vercel preview deployments allow karo
    // e.g. timso-abc123-devbench0.vercel.app
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    // Block karo
    console.warn(`CORS blocked: ${origin}`);
    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },

  credentials: true,          // cookies ke liye zaroori
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200,  // IE11 compatibility
};

export default cors(corsOptions);