/**
 * Order State Machine — enforces valid status transitions.
 *
 * States: waiting → completed | cancelled (terminal)
 *
 * Guards:
 *   waiting → preparing  requires payment_method IS NOT NULL  (legacy, admin only)
 */

const TRANSITIONS = {
  waiting:   ['preparing', 'completed', 'cancelled'],
  preparing: ['completed', 'cancelled'],
  completed: [],   // terminal
  cancelled: [],   // terminal
};

/**
 * Guard functions keyed by "from->to".
 * Each receives the full order row and returns { ok, reason }.
 */
const GUARDS = {
  'waiting->preparing': (order) => {
    if (!order.payment_method) {
      return { ok: false, reason: '订单未支付，无法开始制作' };
    }
    return { ok: true };
  },
};

/**
 * Validate whether a status transition is allowed.
 * @param {string} currentStatus - current order status
 * @param {string} newStatus     - desired new status
 * @param {object} order         - full order row (must include payment_method)
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateTransition(currentStatus, newStatus, order) {
  const allowed = TRANSITIONS[currentStatus];
  if (!allowed) {
    return { valid: false, reason: `未知状态: ${currentStatus}` };
  }
  if (!allowed.includes(newStatus)) {
    return { valid: false, reason: `不允许从 "${currentStatus}" 变更为 "${newStatus}"` };
  }

  const guard = GUARDS[`${currentStatus}->${newStatus}`];
  if (guard) {
    const result = guard(order);
    if (!result.ok) {
      return { valid: false, reason: result.reason };
    }
  }

  return { valid: true };
}

module.exports = { TRANSITIONS, validateTransition };
