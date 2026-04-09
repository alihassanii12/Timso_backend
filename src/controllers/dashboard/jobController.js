import JobModel from '../../models/jobModel.js';
import CompanyModel from '../../models/companyModel.js';
import db from '../../config/db.js';

// GET /api/jobs — all active jobs (authenticated users)
export const getJobs = async (req, res) => {
  try {
    const jobs = await JobModel.getAll();
    return res.json({ success: true, data: { jobs } });
  } catch (err) {
    console.error('getJobs error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/jobs/my-company — admin: jobs posted by their company
export const getMyCompanyJobs = async (req, res) => {
  try {
    let company = await CompanyModel.findByAdminId(req.user.id);
    if (!company && req.user.company_id) {
      company = await CompanyModel.findById(req.user.company_id);
    }
    if (!company) return res.json({ success: true, data: { jobs: [] } });
    const jobs = await JobModel.getAll(company.id);
    return res.json({ success: true, data: { jobs } });
  } catch (err) {
    console.error('getMyCompanyJobs error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/jobs — admin: post a new job
export const createJob = async (req, res) => {
  try {
    const { title, description, location, type, salary, tags } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    // Find company by admin_id OR by user's company_id
    let company = await CompanyModel.findByAdminId(req.user.id);
    if (!company && req.user.company_id) {
      company = await CompanyModel.findById(req.user.company_id);
    }
    if (!company) {
      return res.status(404).json({ 
        success: false, 
        message: 'No company found. Please register a company first from the register page.' 
      });
    }

    const parsedTags = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);

    const job = await JobModel.create({
      companyId: company.id,
      postedBy: req.user.id,
      title, description, location, type, salary,
      tags: parsedTags,
    });

    try {
      await db.raw(
        `INSERT INTO activity_log (user_id, action, icon, created_at) VALUES ($1, $2, '💼', NOW())`,
        [req.user.id, `posted a new job: "${title}"`]
      );
    } catch {}

    return res.status(201).json({ success: true, message: 'Job posted', data: { job } });
  } catch (err) {
    console.error('createJob error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
};

// PATCH /api/jobs/:id — admin: update job
export const updateJob = async (req, res) => {
  try {
    const { title, description, location, type, salary, tags, is_active } = req.body;
    const parsedTags = tags
      ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean))
      : undefined;

    const updated = await JobModel.update(req.params.id, {
      title, description, location, type, salary,
      tags: parsedTags,
      isActive: is_active,
    });
    if (!updated) return res.status(404).json({ success: false, message: 'Job not found' });
    return res.json({ success: true, message: 'Job updated', data: { job: updated } });
  } catch (err) {
    console.error('updateJob error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/jobs/:id — admin: delete job
export const deleteJob = async (req, res) => {
  try {
    const deleted = await JobModel.delete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Job not found' });
    return res.json({ success: true, message: 'Job deleted' });
  } catch (err) {
    console.error('deleteJob error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/jobs/:id/apply — user: apply to a job
export const applyToJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.id;

    const job = await JobModel.getById(jobId);
    if (!job || !job.is_active) return res.status(404).json({ success: false, message: 'Job not found or closed' });

    const alreadyApplied = await JobModel.hasApplied(jobId, userId);
    if (alreadyApplied) return res.status(400).json({ success: false, message: 'Already applied to this job' });

    const application = await JobModel.apply(jobId, userId);

    // Notify the admin who posted the job
    try {
      await db.raw(
        `INSERT INTO notifications (user_id, type, title, message, data)
         VALUES ($1, 'job_application', 'New Job Application', $2, $3::jsonb)`,
        [job.posted_by, `${req.user.full_name || req.user.username} applied for "${job.title}"`, JSON.stringify({ job_id: jobId, application_id: application?.id })]
      );
      await db.raw(
        `INSERT INTO activity_log (user_id, action, icon, created_at) VALUES ($1, $2, '💼', NOW())`,
        [userId, `applied for "${job.title}" at ${job.company_name}`]
      );
    } catch {}

    return res.status(201).json({ success: true, message: 'Application submitted', data: { application } });
  } catch (err) {
    console.error('applyToJob error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/jobs/company/:companyId — jobs for a specific company (for find-company page)
export const getJobsByCompany = async (req, res) => {
  try {
    const jobs = await JobModel.getAll(req.params.companyId);
    return res.json({ success: true, data: { jobs } });
  } catch (err) {
    console.error('getJobsByCompany error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/jobs/my-applications — user: their applications
export const getMyApplications = async (req, res) => {
  try {
    const applications = await JobModel.getMyApplications(req.user.id);
    return res.json({ success: true, data: { applications } });
  } catch (err) {
    console.error('getMyApplications error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/jobs/:id/applications — admin: applicants for a job
export const getJobApplications = async (req, res) => {
  try {
    const applications = await JobModel.getApplications(req.params.id);
    return res.json({ success: true, data: { applications } });
  } catch (err) {
    console.error('getJobApplications error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PATCH /api/jobs/applications/:appId — admin: update application status
export const updateApplicationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['applied', 'reviewing', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updated = await JobModel.updateApplicationStatus(req.params.appId, status);
    if (!updated) return res.status(404).json({ success: false, message: 'Application not found' });

    // When accepted → set user's company_id to the job's company
    if (status === 'accepted') {
      try {
        const job = await JobModel.getById(updated.job_id);
        if (job?.company_id) {
          await db.raw(
            'UPDATE users SET company_id = $1 WHERE id = $2',
            [job.company_id, updated.user_id]
          );
          // Notify user
          await db.raw(
            `INSERT INTO notifications (user_id, type, title, message, data)
             VALUES ($1, 'job_accepted', 'Application Accepted! 🎉', $2, $3::jsonb)`,
            [
              updated.user_id,
              `Congratulations! Your application for "${job.title}" has been accepted. Welcome to ${job.company_name}!`,
              JSON.stringify({ job_id: updated.job_id, company_id: job.company_id })
            ]
          );
          // Activity log
          await db.raw(
            `INSERT INTO activity_log (user_id, action, icon, created_at) VALUES ($1, $2, '🎉', NOW())`,
            [updated.user_id, `joined ${job.company_name}`]
          );
        }
      } catch (err) {
        console.error('Error setting company_id on acceptance:', err);
      }
    }

    return res.json({ success: true, message: 'Status updated', data: { application: updated } });
  } catch (err) {
    console.error('updateApplicationStatus error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
