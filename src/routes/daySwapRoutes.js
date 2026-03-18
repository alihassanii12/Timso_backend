import express from 'express';
import { authenticate, adminOnly } from '../middleware/authMiddleware.js';
import {
  createSwap,
  getSwaps,
  approveSwap,
  declineSwap,
  deleteSwap,
} from '../controllers/dashboard/daySwapController.js';

const router = express.Router();

router.use(authenticate);

// POST /api/swaps           — user: new request
router.post('/', createSwap);

// GET  /api/swaps           — admin: all | user: own
router.get('/', getSwaps);

// POST /api/swaps/:id/approve  — admin only
router.post('/:id/approve', adminOnly, approveSwap);

// POST /api/swaps/:id/decline  — admin only
router.post('/:id/decline', adminOnly, declineSwap);

// DELETE /api/swaps/:id     — user: cancel own pending
router.delete('/:id', deleteSwap);

export default router;
