import express from 'express';
import CompanyController from '../controllers/companyController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Publicly list companies (or you can keep it behind auth)
router.get('/', authenticate, CompanyController.listCompanies);

// Register a company (for admin)
router.post('/register', authenticate, CompanyController.register);

// Apply to a company (for user)
router.post('/apply', authenticate, CompanyController.apply);

// Get applications (for company admin)
router.get('/applications', authenticate, CompanyController.getApplications);

// Accept/Reject application (for company admin)
router.post('/handle-application', authenticate, CompanyController.handleApplication);

export default router;
