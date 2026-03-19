import express from 'express';
import pool from '../../config/db.js';

const router = express.Router();

router.get('/health/db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as time, version() as version');
    res.json({
      success: true,
      message: 'Database connected successfully!',
      database: {
        time: result.rows[0].time,
        version: result.rows[0].version
      },
      env: process.env.NODE_ENV
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
      code: error.code
    });
  }
});

export default router;