import express from 'express';
import CompanyController from '../controllers/companyController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Publicly list companies (or you can keep it behind auth)
router.get('/', authenticateToken, CompanyController.listCompanies);

// Register a company (for admin)
router.post('/register', authenticateToken, CompanyController.register);

// Apply to a company (for user)
router.post('/apply', authenticateToken, CompanyController.apply);

// Get applications (for company admin)
router.get('/applications', authenticateToken, CompanyController.getApplications);

// Accept/Reject application (for company admin)
router.post('/handle-application', authenticateToken, CompanyController.handleApplication);

export default router;
