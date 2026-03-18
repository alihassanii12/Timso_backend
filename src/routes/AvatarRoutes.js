import express       from 'express';
import multer        from 'multer';
import path          from 'path';
import fs            from 'fs';
import sharp         from 'sharp';
import { authenticate } from '../middleware/authMiddleware.js';
import pool          from '../config/db.js';

const router = express.Router();
router.use(authenticate);

/* ── upload dir ── */
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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
      const oldFile = old.rows[0].profile_picture.replace('/uploads/avatars/', '');
      const oldPath = path.join(UPLOAD_DIR, oldFile);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const avatarUrl = `/uploads/avatars/${fileName}`;
    await pool.query('UPDATE users SET profile_picture=$1, updated_at=NOW() WHERE id=$2', [avatarUrl, userId]);

    return res.json({ success:true, message:'Avatar updated', data:{ avatar_url: avatarUrl } });
  } catch (err) {
    console.error('avatar upload error:', err);
    return res.status(500).json({ success:false, message: err.message || 'Upload failed' });
  }
});

// DELETE /api/avatar
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query('SELECT profile_picture FROM users WHERE id=$1', [userId]);
    const pic    = result.rows[0]?.profile_picture;

    if (pic) {
      const file = path.join(UPLOAD_DIR, pic.replace('/uploads/avatars/',''));
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }

    await pool.query('UPDATE users SET profile_picture=NULL, updated_at=NOW() WHERE id=$1', [userId]);
    return res.json({ success:true, message:'Avatar removed' });
  } catch (err) {
    console.error('avatar delete error:', err);
    return res.status(500).json({ success:false, message:'Delete failed' });
  }
});

export default router;