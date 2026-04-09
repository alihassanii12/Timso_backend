import db from '../config/db.js';

class JobModel {

  static async create({ companyId, postedBy, title, description, location, type, salary, tags }) {
    const result = await db.raw(
      `INSERT INTO jobs (company_id, posted_by, title, description, location, type, salary, tags, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
      [companyId, postedBy, title, description || null, location || 'Remote', type || 'Full-time', salary || null, tags || []]
    );
    return result.rows[0];
  }

  static async getAll(companyId = null) {
    const params = [];
    let where = 'WHERE j.is_active = true';
    if (companyId) {
      params.push(companyId);
      where += ' AND j.company_id = $1';
    }
    const result = await db.raw(
      `SELECT j.*,
              c.name AS company_name,
              u.full_name AS posted_by_name,
              COUNT(ja.id)::int AS applicant_count
       FROM jobs j
       JOIN companies c ON c.id = j.company_id
       JOIN users u ON u.id = j.posted_by
       LEFT JOIN job_applications ja ON ja.job_id = j.id
       ${where}
       GROUP BY j.id, c.name, u.full_name
       ORDER BY j.created_at DESC`,
      params
    );
    return result.rows;
  }

  static async getById(id) {
    const result = await db.raw(
      `SELECT j.*, c.name AS company_name, c.id AS company_id, u.full_name AS posted_by_name
       FROM jobs j
       JOIN companies c ON c.id = j.company_id
       JOIN users u ON u.id = j.posted_by
       WHERE j.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async update(id, { title, description, location, type, salary, tags, isActive }) {
    const sets = [];
    const vals = [];
    let idx = 1;
    if (title       !== undefined) { sets.push('title=$' + idx++);       vals.push(title); }
    if (description !== undefined) { sets.push('description=$' + idx++); vals.push(description); }
    if (location    !== undefined) { sets.push('location=$' + idx++);    vals.push(location); }
    if (type        !== undefined) { sets.push('type=$' + idx++);        vals.push(type); }
    if (salary      !== undefined) { sets.push('salary=$' + idx++);      vals.push(salary); }
    if (tags        !== undefined) { sets.push('tags=$' + idx++);        vals.push(tags); }
    if (isActive    !== undefined) { sets.push('is_active=$' + idx++);   vals.push(isActive); }
    if (!sets.length) return null;
    sets.push('updated_at=NOW()');
    vals.push(id);
    const result = await db.raw(
      `UPDATE jobs SET ${sets.join(',')} WHERE id=$${idx} RETURNING *`,
      vals
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await db.raw('DELETE FROM jobs WHERE id=$1 RETURNING id', [id]);
    return result.rows[0];
  }

  static async apply(jobId, userId) {
    const result = await db.raw(
      `INSERT INTO job_applications (job_id, user_id, status, created_at)
       VALUES ($1,$2,'applied',NOW())
       ON CONFLICT (job_id, user_id) DO NOTHING
       RETURNING *`,
      [jobId, userId]
    );
    return result.rows[0];
  }

  static async getApplications(jobId) {
    const result = await db.raw(
      `SELECT ja.*, u.full_name, u.email, u.username, u.profile_picture
       FROM job_applications ja
       JOIN users u ON u.id = ja.user_id
       WHERE ja.job_id = $1
       ORDER BY ja.created_at DESC`,
      [jobId]
    );
    return result.rows;
  }

  static async getMyApplications(userId) {
    const result = await db.raw(
      `SELECT ja.*, j.title AS job_title, j.location, j.type, j.salary, c.name AS company_name, c.id AS company_id
       FROM job_applications ja
       JOIN jobs j ON j.id = ja.job_id
       JOIN companies c ON c.id = j.company_id
       WHERE ja.user_id = $1
       ORDER BY ja.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  static async updateApplicationStatus(applicationId, status) {
    const result = await db.raw(
      `UPDATE job_applications SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, applicationId]
    );
    return result.rows[0];
  }

  static async hasApplied(jobId, userId) {
    const result = await db.raw(
      'SELECT id FROM job_applications WHERE job_id=$1 AND user_id=$2',
      [jobId, userId]
    );
    return result.rows.length > 0;
  }
}

export default JobModel;
