import express from 'express';
import CompanyController from '../controllers/companyController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { raw } from '../config/db.js';

const router = express.Router();

// List all companies
router.get('/', authenticate, CompanyController.listCompanies);

// Register a company (admin)
router.post('/register', authenticate, CompanyController.register);

// Apply to a company (user)
router.post('/apply', authenticate, CompanyController.apply);

// Get my applications (user) — used by find-company page
router.get('/my-applications', authenticate, async (req, res) => {
  try {
    const result = await raw(
      'SELECT * FROM company_applications WHERE user_id = $1 ORDER BY created_at DESC',
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

export default router;
