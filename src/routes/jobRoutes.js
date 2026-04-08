import express from 'express';
import { authenticate, adminOnly } from '../middleware/authMiddleware.js';
import {
  getJobs,
  getMyCompanyJobs,
  createJob,
  updateJob,
  deleteJob,
  applyToJob,
  getMyApplications,
  getJobApplications,
  updateApplicationStatus,
  getJobsByCompany,
} from '../controllers/dashboard/jobController.js';

const router = express.Router();
router.use(authenticate);

// User routes
router.get('/',                              getJobs);
router.get('/my-applications',               getMyApplications);
router.get('/company/:companyId',            getJobsByCompany);   // jobs for a specific company
router.post('/:id/apply',                    applyToJob);

// Admin routes
router.get('/my-company',                    adminOnly, getMyCompanyJobs);
router.post('/',                             adminOnly, createJob);
router.patch('/:id',                         adminOnly, updateJob);
router.delete('/:id',                        adminOnly, deleteJob);
router.get('/:id/applications',              adminOnly, getJobApplications);
router.patch('/applications/:appId/status',  adminOnly, updateApplicationStatus);

export default router;
