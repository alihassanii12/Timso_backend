import express  from 'express';
import multer   from 'multer';
import sharp    from 'sharp';
import { authenticate } from '../middleware/authMiddleware.js';
import db       from '../config/db.js';

const router = express.Router();
router.use(authenticate);

/* ── multer — memory only, no disk ── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('Only jpg/png/webp/gif allowed'), ok);
  },
});

// POST /api/avatar/upload
router.post('/upload', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const userId = req.user.id;

    // Resize to 150x150 webp aur base64 mein convert karo
    const webpBuffer = await sharp(req.file.buffer)
      .resize(150, 150, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toBuffer();

    const base64Image = `data:image/webp;base64,${webpBuffer.toString('base64')}`;

    // ✅ DB mein directly store karo
    await db.raw(
      'UPDATE users SET profile_picture=$1, updated_at=NOW() WHERE id=$2',
      [base64Image, userId]
    );

    return res.json({
      success: true,
      message: 'Avatar updated',
      data: { avatar_url: base64Image }
    });

  } catch (err) {
    console.error('avatar upload error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  }
});

// GET /api/avatar/file/:userId
router.get('/file/:userId', async (req, res) => {
  try {
    const result = await db.raw(
      'SELECT profile_picture FROM users WHERE id=$1',
      [req.params.userId]
    );
    const pic = result.rows[0]?.profile_picture;
    if (!pic) {
      return res.status(404).json({ success: false, message: 'No avatar found' });
    }
    return res.json({ success: true, data: { avatar_url: pic } });
  } catch (err) {
    console.error('Error fetching avatar:', err);
    res.status(500).json({ success: false, message: 'Error fetching avatar' });
  }
});

// DELETE /api/avatar
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    await db.raw(
      'UPDATE users SET profile_picture=NULL, updated_at=NOW() WHERE id=$1',
      [userId]
    );
    return res.json({ success: true, message: 'Avatar removed' });
  } catch (err) {
    console.error('avatar delete error:', err);
    return res.status(500).json({ success: false, message: 'Delete failed' });
  }
});

export default router;