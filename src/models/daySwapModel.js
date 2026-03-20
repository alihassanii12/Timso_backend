// ✅ CORRECT import - use db instead of pool
import db from '../config/db.js';

class DaySwapModel {
  
  // Create a new swap request
  static async create(requesterId, fromDate, toDate, reason = '') {
    try {
      // ✅ Use tagged template syntax with db.query
      const result = await db.query`
        INSERT INTO day_swaps (requester_id, from_date, to_date, reason, status, created_at)
        VALUES (${requesterId}, ${fromDate}, ${toDate}, ${reason}, 'pending', NOW())
        RETURNING *
      `;
      return result.rows[0];
    } catch (error) {
      console.error('Error in DaySwapModel.create:', error);
      throw error;
    }
  }

  // Get swap requests by user
  static async getByUser(userId) {
    try {
      // ✅ Use tagged template syntax
      const result = await db.query`
        SELECT * FROM day_swaps 
        WHERE requester_id = ${userId} 
        ORDER BY created_at DESC
      `;
      return result.rows;
    } catch (error) {
      console.error('Error in DaySwapModel.getByUser:', error);
      throw error;
    }
  }

  // Get pending swap requests
  static async getPending() {
    try {
      // ✅ No parameters needed, just a simple query
      const result = await db.query`
        SELECT 
          ds.*,
          u.full_name as requester_name,
          u.email as requester_email,
          u.username
        FROM day_swaps ds
        JOIN users u ON ds.requester_id = u.id
        WHERE ds.status = 'pending'
        ORDER BY ds.created_at ASC
      `;
      return result.rows;
    } catch (error) {
      console.error('Error in DaySwapModel.getPending:', error);
      throw error;
    }
  }

  // Get swap request by ID
  static async getById(swapId) {
    try {
      // ✅ Use tagged template syntax
      const result = await db.query`
        SELECT 
          ds.*,
          u.full_name as requester_name,
          u.email as requester_email
        FROM day_swaps ds
        JOIN users u ON ds.requester_id = u.id
        WHERE ds.id = ${swapId}
      `;
      return result.rows[0];
    } catch (error) {
      console.error('Error in DaySwapModel.getById:', error);
      throw error;
    }
  }

  // Approve swap request
  static async approve(swapId, reviewerId) {
    try {
      // ✅ Use tagged template syntax
      const result = await db.query`
        UPDATE day_swaps 
        SET status = 'approved', reviewed_by = ${reviewerId}, reviewed_at = NOW()
        WHERE id = ${swapId} AND status = 'pending'
        RETURNING *
      `;
      return result.rows[0];
    } catch (error) {
      console.error('Error in DaySwapModel.approve:', error);
      throw error;
    }
  }

  // Decline swap request
  static async decline(swapId, reviewerId) {
    try {
      // ✅ Use tagged template syntax
      const result = await db.query`
        UPDATE day_swaps 
        SET status = 'declined', reviewed_by = ${reviewerId}, reviewed_at = NOW()
        WHERE id = ${swapId} AND status = 'pending'
        RETURNING *
      `;
      return result.rows[0];
    } catch (error) {
      console.error('Error in DaySwapModel.decline:', error);
      throw error;
    }
  }

  // Get all swap requests (admin)
  static async getAll(limit = 50) {
    try {
      // ✅ Use tagged template syntax
      const result = await db.query`
        SELECT 
          ds.*,
          u.full_name as requester_name,
          u.email as requester_email
        FROM day_swaps ds
        JOIN users u ON ds.requester_id = u.id
        ORDER BY ds.created_at DESC
        LIMIT ${limit}
      `;
      return result.rows;
    } catch (error) {
      console.error('Error in DaySwapModel.getAll:', error);
      throw error;
    }
  }

  // Get swap statistics for analytics
  static async getStats() {
    try {
      // ✅ Use tagged template syntax
      const result = await db.query`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
          COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined_requests,
          COUNT(DISTINCT requester_id) as unique_requesters
        FROM day_swaps
      `;
      return result.rows[0];
    } catch (error) {
      console.error('Error in DaySwapModel.getStats:', error);
      // Return default stats if table is empty
      return {
        total_requests: 0,
        pending_requests: 0,
        approved_requests: 0,
        declined_requests: 0,
        unique_requesters: 0
      };
    }
  }

  // Get monthly swap statistics
  static async getMonthlyStats(year, month) {
    try {
      // ✅ Use tagged template syntax
      const result = await db.query`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved
        FROM day_swaps
        WHERE EXTRACT(YEAR FROM created_at) = ${year} 
          AND EXTRACT(MONTH FROM created_at) = ${month}
        GROUP BY DATE_TRUNC('month', created_at)
      `;
      return result.rows[0] || { total: 0, approved: 0 };
    } catch (error) {
      console.error('Error in DaySwapModel.getMonthlyStats:', error);
      throw error;
    }
  }

  // Check if dates are available for swap
  static async checkAvailability(userId, fromDate, toDate) {
    try {
      // ✅ Use tagged template syntax
      const result = await db.query`
        SELECT * FROM day_swaps 
        WHERE requester_id = ${userId} 
          AND (
            (from_date <= ${fromDate} AND to_date >= ${fromDate}) OR
            (from_date <= ${toDate} AND to_date >= ${toDate})
          )
          AND status IN ('pending', 'approved')
      `;
      return result.rows.length === 0; // true if available
    } catch (error) {
      console.error('Error in DaySwapModel.checkAvailability:', error);
      throw error;
    }
  }
}

export default DaySwapModel;