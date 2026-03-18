import pool from '../config/db.js';

class DaySwapModel {
  
  // Create a new swap request
  static async create(requesterId, fromDate, toDate, reason = '') {
    try {
      const query = `
        INSERT INTO day_swaps (requester_id, from_date, to_date, reason, status, created_at)
        VALUES ($1, $2, $3, $4, 'pending', NOW())
        RETURNING *
      `;
      const result = await pool.query(query, [requesterId, fromDate, toDate, reason]);
      return result.rows[0];
    } catch (error) {
      console.error('Error in DaySwapModel.create:', error);
      throw error;
    }
  }

  // Get swap requests by user
  static async getByUser(userId) {
    try {
      const query = `
        SELECT * FROM day_swaps 
        WHERE requester_id = $1 
        ORDER BY created_at DESC
      `;
      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error in DaySwapModel.getByUser:', error);
      throw error;
    }
  }

  // Get pending swap requests
  static async getPending() {
    try {
      const query = `
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
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error in DaySwapModel.getPending:', error);
      throw error;
    }
  }

  // Get swap request by ID
  static async getById(swapId) {
    try {
      const query = `
        SELECT 
          ds.*,
          u.full_name as requester_name,
          u.email as requester_email
        FROM day_swaps ds
        JOIN users u ON ds.requester_id = u.id
        WHERE ds.id = $1
      `;
      const result = await pool.query(query, [swapId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error in DaySwapModel.getById:', error);
      throw error;
    }
  }

  // Approve swap request
  static async approve(swapId, reviewerId) {
    try {
      const query = `
        UPDATE day_swaps 
        SET status = 'approved', reviewed_by = $2, reviewed_at = NOW()
        WHERE id = $1 AND status = 'pending'
        RETURNING *
      `;
      const result = await pool.query(query, [swapId, reviewerId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error in DaySwapModel.approve:', error);
      throw error;
    }
  }

  // Decline swap request
  static async decline(swapId, reviewerId) {
    try {
      const query = `
        UPDATE day_swaps 
        SET status = 'declined', reviewed_by = $2, reviewed_at = NOW()
        WHERE id = $1 AND status = 'pending'
        RETURNING *
      `;
      const result = await pool.query(query, [swapId, reviewerId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error in DaySwapModel.decline:', error);
      throw error;
    }
  }

  // Get all swap requests (admin)
  static async getAll(limit = 50) {
    try {
      const query = `
        SELECT 
          ds.*,
          u.full_name as requester_name,
          u.email as requester_email
        FROM day_swaps ds
        JOIN users u ON ds.requester_id = u.id
        ORDER BY ds.created_at DESC
        LIMIT $1
      `;
      const result = await pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error('Error in DaySwapModel.getAll:', error);
      throw error;
    }
  }

  // Get swap statistics for analytics
  static async getStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
          COUNT(CASE WHEN status = 'declined' THEN 1 END) as declined_requests,
          COUNT(DISTINCT requester_id) as unique_requesters
        FROM day_swaps
      `;
      const result = await pool.query(query);
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
      const query = `
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved
        FROM day_swaps
        WHERE EXTRACT(YEAR FROM created_at) = $1 
          AND EXTRACT(MONTH FROM created_at) = $2
        GROUP BY DATE_TRUNC('month', created_at)
      `;
      const result = await pool.query(query, [year, month]);
      return result.rows[0] || { total: 0, approved: 0 };
    } catch (error) {
      console.error('Error in DaySwapModel.getMonthlyStats:', error);
      throw error;
    }
  }

  // Check if dates are available for swap
  static async checkAvailability(userId, fromDate, toDate) {
    try {
      const query = `
        SELECT * FROM day_swaps 
        WHERE requester_id = $1 
          AND (
            (from_date <= $2 AND to_date >= $2) OR
            (from_date <= $3 AND to_date >= $3)
          )
          AND status IN ('pending', 'approved')
      `;
      const result = await pool.query(query, [userId, fromDate, toDate]);
      return result.rows.length === 0; // true if available
    } catch (error) {
      console.error('Error in DaySwapModel.checkAvailability:', error);
      throw error;
    }
  }
}

export default DaySwapModel;