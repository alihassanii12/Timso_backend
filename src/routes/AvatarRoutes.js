import express       from 'express';
import multer        from 'multer';
import path          from 'path';
import fs            from 'fs';
import sharp         from 'sharp';
import { authenticate } from '../middleware/authMiddleware.js';
import pool          from '../config/db.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();
router.use(authenticate);

/* ── Vercel detection ── */
const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

/* ── upload dir ── Vercel mein /tmp use karo, locally uploads folder ── */
const UPLOAD_DIR = isVercel 
  ? '/tmp/uploads/avatars'  // Vercel writable directory
  : path.join(process.cwd(), 'uploads', 'avatars');

// Create directory if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`📁 Created upload directory: ${UPLOAD_DIR}`);
}

/* ── multer — memory storage so sharp can process ── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },   // 5 MB max
  fileFilter: (_, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Only jpg/png/webp/gif allowed'), ok);
  },
});

// POST /api/avatar/upload
router.post('/upload', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:'No file uploaded' });

    const userId   = req.user.id;
    const fileName = `user_${userId}_${Date.now()}.webp`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Resize + convert to webp (150x150)
    await sharp(req.file.buffer)
      .resize(150, 150, { fit:'cover', position:'centre' })
      .webp({ quality: 85 })
      .toFile(filePath);

    // Delete old avatar file if exists
    const old = await pool.query('SELECT profile_picture FROM users WHERE id=$1', [userId]);
    if (old.rows[0]?.profile_picture) {
      // Extract filename from URL
      const oldFile = old.rows[0].profile_picture.split('/').pop();
      const oldPath = path.join(UPLOAD_DIR, oldFile);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // Generate URL based on environment
    const avatarUrl = isVercel 
      ? `/api/avatar/file/${fileName}`  // Vercel mein alag route se serve karo
      : `/uploads/avatars/${fileName}`;  // Local mein direct

    await pool.query('UPDATE users SET profile_picture=$1, updated_at=NOW() WHERE id=$2', [avatarUrl, userId]);

    return res.json({ success:true, message:'Avatar updated', data:{ avatar_url: avatarUrl } });
  } catch (err) {
    console.error('avatar upload error:', err);
    return res.status(500).json({ success:false, message: err.message || 'Upload failed' });
  }
});

// GET /api/avatar/file/:filename - Serve avatar files (for Vercel)
router.get('/file/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(UPLOAD_DIR, filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    
    res.sendFile(filepath);
  } catch (err) {
    console.error('Error serving file:', err);
    res.status(500).json({ success: false, message: 'Error serving file' });
  }
});

// DELETE /api/avatar
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query('SELECT profile_picture FROM users WHERE id=$1', [userId]);
    const pic    = result.rows[0]?.profile_picture;

    if (pic) {
      const filename = pic.split('/').pop();
      const filepath = path.join(UPLOAD_DIR, filename);
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }

    await pool.query('UPDATE users SET profile_picture=NULL, updated_at=NOW() WHERE id=$1', [userId]);
    return res.json({ success:true, message:'Avatar removed' });
  } catch (err) {
    console.error('avatar delete error:', err);
    return res.status(500).json({ success:false, message:'Delete failed' });
  }
});

export default router;