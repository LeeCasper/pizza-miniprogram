/**
 * Audit Service — fire-and-forget audit log recording.
 *
 * record() NEVER throws — it catches errors internally and logs them.
 * This ensures audit logging never breaks business logic.
 */

const pool = require('../config/database');
const { createLogger } = require('../utils/logger');

const log = createLogger('Audit');

const auditService = {
  /**
   * Record an audit event. Safe to call inside or outside transactions.
   *
   * @param {object} event
   * @param {string} event.actorType   - 'user' | 'admin' | 'system'
   * @param {number} [event.actorId]   - user/admin ID
   * @param {string} [event.actorName] - display name
   * @param {string} event.action      - e.g. 'order.status_change'
   * @param {string} event.entityType  - e.g. 'order', 'user'
   * @param {string} event.entityId    - entity identifier
   * @param {object} [event.before]    - state before change
   * @param {object} [event.after]     - state after change
   * @param {object} [event.metadata]  - extra context (requestId, etc.)
   * @param {object} [conn]            - optional DB connection (for use inside transactions)
   */
  async record({ actorType = 'system', actorId, actorName, action, entityType, entityId, before, after, metadata }, conn) {
    try {
      const db = conn || pool;
      await db.query(
        `INSERT INTO audit_logs (actor_type, actor_id, actor_name, action, entity_type, entity_id, before_value, after_value, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          actorType,
          actorId || null,
          actorName || null,
          action,
          entityType,
          String(entityId),
          before ? JSON.stringify(before) : null,
          after ? JSON.stringify(after) : null,
          metadata ? JSON.stringify(metadata) : null,
        ]
      );
    } catch (err) {
      // Never propagate — audit failure must not break business logic
      log.error({ err, action, entityType, entityId }, 'Audit record failed');
    }
  },

  /**
   * Query audit logs with pagination and optional filters.
   */
  async query({ entityType, entityId, action, actorType, page = 1, limit = 20 }) {
    const conditions = [];
    const params = [];

    if (entityType) {
      conditions.push('entity_type = ?');
      params.push(entityType);
    }
    if (entityId) {
      conditions.push('entity_id = ?');
      params.push(String(entityId));
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (actorType) {
      conditions.push('actor_type = ?');
      params.push(actorType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT id, actor_type, actor_id, actor_name, action, entity_type, entity_id,
              before_value, after_value, metadata, created_at
       FROM audit_logs ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      total,
      page,
      limit,
      items: rows.map(r => ({
        id: r.id,
        actorType: r.actor_type,
        actorId: r.actor_id,
        actorName: r.actor_name,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        before: r.before_value,
        after: r.after_value,
        metadata: r.metadata,
        createdAt: r.created_at,
      })),
    };
  },
};

module.exports = auditService;
