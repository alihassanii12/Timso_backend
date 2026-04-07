import CompanyModel from '../models/companyModel.js';
import { emitToCompany, emitToUser } from '../utils/socket.js';

class CompanyController {
  static async register(req, res) {
    try {
      const { name, description } = req.body;
      const adminId = req.user.id;

      if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admins can register companies' });
      }

      const company = await CompanyModel.create({ name, adminId, description });
      res.status(201).json({ success: true, company });
    } catch (error) {
      console.error('Register Company Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async listCompanies(req, res) {
    try {
      const companies = await CompanyModel.findAll();
      res.json({ success: true, companies });
    } catch (error) {
      console.error('List Companies Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async apply(req, res) {
    try {
      const { companyId } = req.body;
      const userId = req.user.id;

      if (req.user.role !== 'user') {
        return res.status(403).json({ success: false, message: 'Only users can apply to companies' });
      }

      const application = await CompanyModel.apply({ userId, companyId });
      
      // Notify company admin
      const company = await CompanyModel.findById(companyId);
      if (company) {
        emitToCompany(companyId, 'new-application', { 
          application, 
          user: { 
            id: req.user.id, 
            full_name: req.user.full_name,
            email: req.user.email
          } 
        });
        
        // Also emit to the specific admin user room if needed
        emitToUser(company.admin_id, 'notification', {
          type: 'new-application',
          title: 'New Company Application',
          message: `${req.user.full_name} has applied to join your company.`
        });
      }

      res.json({ success: true, application });
    } catch (error) {
      console.error('Apply to Company Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getApplications(req, res) {
    try {
      const company = await CompanyModel.findByAdminId(req.user.id);
      if (!company) {
        return res.status(404).json({ success: false, message: 'No company found for this admin' });
      }

      const applications = await CompanyModel.getApplications(company.id);
      res.json({ success: true, applications });
    } catch (error) {
      console.error('Get Applications Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async handleApplication(req, res) {
    try {
      const { applicationId, status } = req.body; // 'accepted' or 'rejected'
      
      const company = await CompanyModel.findByAdminId(req.user.id);
      if (!company) {
        return res.status(404).json({ success: false, message: 'No company found for this admin' });
      }

      const application = await CompanyModel.updateApplicationStatus({ applicationId, status });
      
      // Notify the user
      emitToUser(application.user_id, 'application-update', { 
        status, 
        companyName: company.name 
      });

      res.json({ success: true, application });
    } catch (error) {
      console.error('Handle Application Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default CompanyController;
