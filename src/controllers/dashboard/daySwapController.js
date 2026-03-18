import DaySwapModel from '../../models/daySwapModel.js';
import pool         from '../../config/db.js';

const tryLog = async (userId, action, icon = '📋') => {
  try { await pool.query(`INSERT INTO activity_log (user_id, action, icon, created_at) VALUES ($1, $2, $3, NOW())`, [userId, action, icon]); } catch {}
};

export const createSwap = async (req, res) => {
  try {
    const { from_date, to_date, reason = '' } = req.body;
    if (!from_date || !to_date) return res.status(400).json({ success: false, message: 'from_date and to_date are required' });
    if (from_date === to_date) return res.status(400).json({ success: false, message: 'Dates cannot be same' });
    const swap = await DaySwapModel.create(req.user.id, from_date, to_date, reason);
    await tryLog(req.user.id, `requested a day swap (${from_date} to ${to_date})`, '🔄');
    return res.status(201).json({ success: true, message: 'Swap request submitted', data: { swap } });
  } catch (err) { console.error('createSwap error:', err); return res.status(500).json({ success: false, message: err.message }); }
};

export const getSwaps = async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const result = await DaySwapModel.getAll();
      return res.json({ success: true, data: { swaps: result } });
    }
    const swaps = await DaySwapModel.getByUser(req.user.id);
    return res.json({ success: true, data: { swaps } });
  } catch (err) { console.error('getSwaps error:', err); return res.status(500).json({ success: false, message: err.message }); }
};

export const approveSwap = async (req, res) => {
  try {
    const swap = await DaySwapModel.getById(req.params.id);
    if (!swap) return res.status(404).json({ success: false, message: 'Swap not found' });
    if (swap.status !== 'pending') return res.status(400).json({ success: false, message: `Swap is already ${swap.status}` });
    const updated = await DaySwapModel.approve(swap.id, req.user.id);
    try { await pool.query(`INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, 'swap_approved', 'Day Swap Approved', $2, $3::jsonb)`, [swap.requester_id, `Your swap (${swap.from_date} to ${swap.to_date}) approved`, JSON.stringify({ swap_id: swap.id })]); } catch {}
    await tryLog(req.user.id, `approved swap #${swap.id}`, '✅');
    return res.json({ success: true, message: 'Swap approved', data: { swap: updated } });
  } catch (err) { console.error('approveSwap error:', err); return res.status(500).json({ success: false, message: err.message }); }
};

export const declineSwap = async (req, res) => {
  try {
    const swap = await DaySwapModel.getById(req.params.id);
    if (!swap) return res.status(404).json({ success: false, message: 'Swap not found' });
    if (swap.status !== 'pending') return res.status(400).json({ success: false, message: `Swap is already ${swap.status}` });
    const updated = await DaySwapModel.decline(swap.id, req.user.id);
    try { await pool.query(`INSERT INTO notifications (user_id, type, title, message, data) VALUES ($1, 'swap_declined', 'Day Swap Declined', $2, $3::jsonb)`, [swap.requester_id, `Your swap (${swap.from_date} to ${swap.to_date}) declined`, JSON.stringify({ swap_id: swap.id })]); } catch {}
    await tryLog(req.user.id, `declined swap #${swap.id}`, '❌');
    return res.json({ success: true, message: 'Swap declined', data: { swap: updated } });
  } catch (err) { console.error('declineSwap error:', err); return res.status(500).json({ success: false, message: err.message }); }
};

export const deleteSwap = async (req, res) => {
  try {
    const swap = await DaySwapModel.getById(req.params.id);
    if (!swap) return res.status(404).json({ success: false, message: 'Swap not found' });
    if (swap.requester_id !== req.user.id) return res.status(403).json({ success: false, message: 'Not your request' });
    if (swap.status !== 'pending') return res.status(400).json({ success: false, message: 'Cannot cancel reviewed swap' });
    await pool.query('DELETE FROM day_swaps WHERE id = $1', [req.params.id]);
    return res.json({ success: true, message: 'Swap cancelled' });
  } catch (err) { console.error('deleteSwap error:', err); return res.status(500).json({ success: false, message: err.message }); }
};
