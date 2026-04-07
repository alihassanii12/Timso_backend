import { query } from '../config/db.js';

class CompanyModel {
  static async create({ name, adminId, description }) {
    const result = await query`
      INSERT INTO companies (name, admin_id, description)
      VALUES (${name}, ${adminId}, ${description})
      RETURNING *
    `;
    
    // Also update the admin user with the company_id
    const company = result.rows[0];
    await query`
      UPDATE users SET company_id = ${company.id} WHERE id = ${adminId}
    `;
    
    return company;
  }

  static async findAll() {
    const result = await query`SELECT * FROM companies ORDER BY name ASC`;
    return result.rows;
  }

  static async findById(id) {
    const result = await query`SELECT * FROM companies WHERE id = ${id}`;
    return result.rows[0];
  }

  static async findByAdminId(adminId) {
    const result = await query`SELECT * FROM companies WHERE admin_id = ${adminId}`;
    return result.rows[0];
  }

  static async apply({ userId, companyId }) {
    const result = await query`
      INSERT INTO company_applications (user_id, company_id, status)
      VALUES (${userId}, ${companyId}, 'pending')
      ON CONFLICT (user_id, company_id) DO UPDATE 
      SET status = 'pending', updated_at = NOW()
      RETURNING *
    `;
    return result.rows[0];
  }

  static async getApplications(companyId) {
    const result = await query`
      SELECT ca.*, u.full_name, u.email, u.username
      FROM company_applications ca
      JOIN users u ON ca.user_id = u.id
      WHERE ca.company_id = ${companyId} AND ca.status = 'pending'
    `;
    return result.rows;
  }

  static async updateApplicationStatus({ applicationId, status }) {
    const result = await query`
      UPDATE company_applications 
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${applicationId}
      RETURNING *
    `;
    
    const application = result.rows[0];
    
    if (status === 'accepted') {
      await query`
        UPDATE users SET company_id = ${application.company_id} WHERE id = ${application.user_id}
      `;
    } else if (status === 'rejected') {
        // Optionally handle rejection cleanup if needed
    }
    
    return application;
  }
}

export default CompanyModel;
