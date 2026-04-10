import express from 'express';
import CompanyController from '../controllers/companyController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { raw, query } from '../config/db.js';
import { sendToUser, sendToCompany } from '../utils/sse.js';

const router = express.Router();

// List all companies
router.get('/', authenticate, CompanyController.listCompanies);

// Register a company (admin)
router.post('/register', authenticate, CompanyController.register);

// Apply to a company (user)
router.post('/apply', authenticate, CompanyController.apply);

// Get my applications (user)
router.get('/my-applications', authenticate, async (req, res) => {
  try {
    const result = await raw(
      `SELECT ca.*, c.name AS company_name, c.description AS company_description
       FROM company_applications ca
       JOIN companies c ON c.id = ca.company_id
       WHERE ca.user_id = $1
       ORDER BY ca.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, applications: result.rows });
  } catch (err) {
    console.error('my-applications error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get applications for admin's company
router.get('/applications', authenticate, CompanyController.getApplications);

// Accept/Reject application (admin)
router.post('/handle-application', authenticate, CompanyController.handleApplication);

// ── RESIGN ──────────────────────────────────────────────────────────────────

// User submits resign request
router.post('/resign', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ success: false, message: 'Not in a company' });

    // Upsert resign request
    await raw(
      `INSERT INTO resign_requests (user_id, company_id, status, created_at, updated_at)
       VALUES ($1, $2, 'pending', NOW(), NOW())
       ON CONFLICT (user_id, company_id) WHERE status = 'pending'
       DO UPDATE SET updated_at = NOW()`,
      [userId, companyId]
    );

    // Get company admin
    const companyRes = await raw(`SELECT admin_id FROM companies WHERE id = $1`, [companyId]);
    const adminId = companyRes.rows[0]?.admin_id;

    // Notify admin via SSE
    if (adminId) {
      sendToUser(adminId, 'resign_request', {
        userId,
        userName: req.user.full_name || req.user.username,
        companyId,
        message: `${req.user.full_name || req.user.username} has submitted a resign request.`
      });
    }

    res.json({ success: true, message: 'Resign request submitted' });
  } catch (err) {
    console.error('resign error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin approves/rejects resign
router.post('/handle-resign', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const { userId, action } = req.body; // action: 'approve' | 'reject'
    const companyId = req.user.company_id;
    if (!companyId) return res.status(400).json({ success: false, message: 'No company' });

    if (action === 'approve') {
      // Remove user from company
      await raw(`UPDATE users SET company_id = NULL WHERE id = $1`, [userId]);
      // Update resign request
      await raw(
        `UPDATE resign_requests SET status = 'approved', updated_at = NOW() WHERE user_id = $1 AND company_id = $2`,
        [userId, companyId]
      );
      // Clear attendance
      await raw(`DELETE FROM attendance WHERE user_id = $1 AND date = CURRENT_DATE`, [userId]);

      // Notify user via SSE
      sendToUser(userId, 'resign_approved', { message: 'Your resign request has been approved.' });
      // Notify company
      sendToCompany(companyId, 'attendance_updated', { action: 'member_left', userId });
    } else {
      await raw(
        `UPDATE resign_requests SET status = 'rejected', updated_at = NOW() WHERE user_id = $1 AND company_id = $2`,
        [userId, companyId]
      );
      sendToUser(userId, 'resign_rejected', { message: 'Your resign request was rejected.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('handle-resign error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get pending resign requests for admin
router.get('/resign-requests', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const companyId = req.user.company_id;
    const result = await raw(
      `SELECT rr.*, u.full_name, u.email, u.username, u.profile_picture
       FROM resign_requests rr
       JOIN users u ON u.id = rr.user_id
       WHERE rr.company_id = $1 AND rr.status = 'pending'
       ORDER BY rr.created_at DESC`,
      [companyId]
    );
    res.json({ success: true, requests: result.rows });
  } catch (err) {
    console.error('resign-requests error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
