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
} from '../controllers/dashboard/jobController.js';

const router = express.Router();
router.use(authenticate);

// User routes
router.get('/',                              getJobs);              // all active jobs
router.get('/my-applications',               getMyApplications);    // user's applications
router.post('/:id/apply',                    applyToJob);           // apply to a job

// Admin routes
router.get('/my-company',                    adminOnly, getMyCompanyJobs);          // admin's own jobs
router.post('/',                             adminOnly, createJob);                 // post a job
router.patch('/:id',                         adminOnly, updateJob);                 // edit a job
router.delete('/:id',                        adminOnly, deleteJob);                 // delete a job
router.get('/:id/applications',              adminOnly, getJobApplications);        // applicants list
router.patch('/applications/:appId/status',  adminOnly, updateApplicationStatus);   // update applicant status

export default router;
