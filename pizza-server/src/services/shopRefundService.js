/**
 * Shop Refund Service
 *
 * Handles refunds for cancelled shop orders:
 * - Balance-paid: synchronous balance credit-back + stock restore
 * - WeChat-paid: async WeChat Pay refund API + callback
 *
 * WeChat refund callbacks are routed by "SR" prefix on out_refund_no
 * (separate from pizza-order "R" prefix handled by refundService.js).
 */
const pool = require("../config/database");
const config = require("../config");
const { payRequest, decryptNotify } = require("../utils/wechatPay");
const { getTierLevel } = require("../utils/memberTier");
const { createLogger } = require("../utils/logger");
const auditService = require("./auditService");
const log = createLogger("ShopRefund");

const shopRefundService = {
  async refund(orderId, reason = "用户申请退款", actor = { id: "system", role: "system" }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [[order]] = await conn.query("SELECT * FROM shop_orders WHERE id = ? FOR UPDATE", [orderId]);
      if (!order) { await conn.rollback(); throw Object.assign(new Error("订单不存在"), { statusCode: 404 }); }
      if (!order.payment_method) { await conn.rollback(); throw Object.assign(new Error("订单未支付，无需退款"), { statusCode: 400 }); }
      if (order.refund_status === "processing" || order.refund_status === "success") {
        await conn.rollback();
        return { success: true, alreadyRefunded: true, message: "已退款或退款处理中" };
      }
      await conn.query("UPDATE shop_orders SET refund_status = 'processing', refund_reason = ?, updated_at = NOW() WHERE id = ?", [reason, orderId]);
      await auditService.record({
        actorType: actor.role || "system", actorId: String(actor.id || "system"),
        action: "shop_order.refund.initiated", entityType: "shop_order", entityId: orderId,
        before: { status: order.status, paymentMethod: order.payment_method, paidAmount: parseFloat(order.paid_amount) },
        after: { reason },
      }, conn);
      if (order.payment_method === "balance") { const result = await this._refundBalance(conn, order, reason); await conn.commit(); return result; }
      else if (order.payment_method === "wechat") { const result = await this._initiateWechatRefund(conn, order, reason); return result; }
      else { throw Object.assign(new Error("未知支付方式"), { statusCode: 400 }); }
    } catch (err) { await conn.rollback().catch(() => {}); throw err; }
    finally { conn.release(); }
  },

  async _refundBalance(conn, order, reason) {
    const userId = order.user_id; const refundAmount = parseFloat(order.paid_amount); const orderId = order.id;
    const [[user]] = await conn.query("SELECT balance FROM users WHERE id = ? FOR UPDATE", [userId]);
    if (!user) throw Object.assign(new Error("用户不存在"), { statusCode: 404 });
    const newBalance = parseFloat(user.balance) + refundAmount;
    await conn.query("UPDATE users SET balance = ? WHERE id = ?", [newBalance.toFixed(2), userId]);
    await conn.query("INSERT INTO balance_history (user_id, amount, balance_after, type, remark) VALUES (?, ?, ?, ?, ?)", [userId, refundAmount, newBalance.toFixed(2), "refund", "商城订单退款 " + orderId]);
    const outRefundNo = "SR" + orderId;
    await conn.query("INSERT INTO shop_refund_records (order_id, user_id, out_refund_no, payment_method, refund_amount, reason, status) VALUES (?, ?, ?, 'balance', ?, ?, 'success')", [orderId, userId, outRefundNo, refundAmount, reason]);
    const [items] = await conn.query("SELECT shop_product_id, quantity FROM shop_order_items WHERE order_id = ?", [orderId]);
    for (const item of items) {
      if (!item.shop_product_id) continue;
      await conn.query("UPDATE shop_products SET stock = stock + ?, sales = GREATEST(0, sales - ?) WHERE id = ? AND stock >= 0", [item.quantity, item.quantity, item.shop_product_id]);
    }
    await conn.query("UPDATE shop_orders SET refund_status = 'success', refund_amount = ?, refunded_at = NOW(), updated_at = NOW() WHERE id = ?", [refundAmount, orderId]);
    await auditService.record({ actorType: "system", action: "shop_order.refund.completed", entityType: "shop_order", entityId: orderId, after: { method: "balance", refundAmount } }, conn);
    log.info({ orderId, refundAmount }, "Shop balance refund SUCCESS");
    return { success: true, method: "balance", refundAmount, message: "余额退款已到账" };
  },

  async _initiateWechatRefund(conn, order, reason) {
    const userId = order.user_id; const refundAmount = parseFloat(order.paid_amount); const orderId = order.id;
    const outRefundNo = "SR" + orderId;
    const [[payRecord]] = await conn.query("SELECT transaction_id FROM payment_records WHERE reference_id = ? AND type = 'shop_order' AND status = 'success'", [orderId]);
    if (!payRecord || !payRecord.transaction_id) { throw Object.assign(new Error("未找到微信支付交易号，无法发起退款"), { statusCode: 400 }); }
    await conn.query("INSERT INTO shop_refund_records (order_id, user_id, out_refund_no, transaction_id, payment_method, refund_amount, reason, status) VALUES (?, ?, ?, ?, 'wechat', ?, ?, 'pending')", [orderId, userId, outRefundNo, payRecord.transaction_id, refundAmount, reason]);
    await conn.commit();
    const amountCents = Math.round(refundAmount * 100);
    const notifyUrl = config.wxPay.refundNotifyUrl;
    try {
      const wxRes = await payRequest("POST", "/v3/refund/domestic/refunds", { transaction_id: payRecord.transaction_id, out_refund_no: outRefundNo, reason, amount: { refund: amountCents, total: amountCents, currency: "CNY" }, notify_url: notifyUrl });
      await pool.query("UPDATE shop_refund_records SET status = 'processing', refund_id = ?, updated_at = NOW() WHERE out_refund_no = ?", [wxRes.refund_id || null, outRefundNo]);
      log.info({ orderId, refundId: wxRes.refund_id }, "Shop WeChat refund INITIATED");
      return { success: true, method: "wechat", refundAmount, status: "processing", message: "微信退款处理中，1-5个工作日到账" };
    } catch (err) {
      log.error({ err, orderId }, "Shop WeChat refund API FAILED");
      await pool.query("UPDATE shop_refund_records SET status = 'failed', updated_at = NOW() WHERE out_refund_no = ?", [outRefundNo]).catch(() => {});
      await pool.query("UPDATE shop_orders SET refund_status = 'failed', updated_at = NOW() WHERE id = ?", [orderId]).catch(() => {});
      throw Object.assign(new Error("微信退款请求失败，请稍后重试"), { statusCode: 502 });
    }
  },

  async handleRefundNotify(rawBody) {
    let parsed; try { parsed = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody; } catch (e) { return { success: false, reason: "Invalid JSON" }; }
    const resource = parsed.resource; if (!resource) return { success: false, reason: "Missing resource" };
    let decrypted; try { decrypted = decryptNotify(resource.ciphertext, resource.associated_data, resource.nonce); } catch (e) { log.error({ err: e }, "Shop refund decrypt failed"); return { success: false, reason: "Decrypt failed" }; }
    const outRefundNo = decrypted.out_refund_no; const refundStatus = decrypted.refund_status; const refundId = decrypted.refund_id;
    log.info({ outRefundNo, refundStatus }, "Shop refund notify received");
    const [[record]] = await pool.query("SELECT * FROM shop_refund_records WHERE out_refund_no = ?", [outRefundNo]);
    if (!record) return { success: false, reason: "Shop refund record not found" };
    if (record.status === "success") return { success: true, detail: "Already processed" };
    if (refundStatus !== "SUCCESS") {
      await pool.query("UPDATE shop_refund_records SET status = 'failed', refund_id = ?, raw_notify = ?, updated_at = NOW() WHERE out_refund_no = ?", [refundId, JSON.stringify(decrypted), outRefundNo]);
      return { success: true, detail: "Shop refund " + refundStatus };
    }
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [upd] = await conn.query("UPDATE shop_refund_records SET status = 'success', refund_id = ?, raw_notify = ?, updated_at = NOW() WHERE out_refund_no = ? AND status IN ('pending','processing')", [refundId, JSON.stringify(decrypted), outRefundNo]);
      if (upd.affectedRows === 0) { await conn.rollback(); return { success: true, detail: "Already processed (race)" }; }
      const userId = record.user_id; const orderId = record.order_id; const refundAmount = parseFloat(record.refund_amount);
      const pointsReversed = await this._reverseShopPoints(conn, userId, orderId);
      const [[user]] = await conn.query("SELECT total_spent FROM users WHERE id = ? FOR UPDATE", [userId]);
      if (user) {
        const newTotalSpent = Math.max(0, parseFloat(user.total_spent) - refundAmount);
        const newLevel = await getTierLevel(newTotalSpent);
        await conn.query("UPDATE users SET total_spent = ?, member_level = ? WHERE id = ?", [newTotalSpent.toFixed(2), newLevel, userId]);
        await conn.query("UPDATE shop_refund_records SET points_reversed = ?, total_spent_reversed = ? WHERE out_refund_no = ?", [pointsReversed, refundAmount, outRefundNo]);
      }
      const [items] = await conn.query("SELECT shop_product_id, quantity FROM shop_order_items WHERE order_id = ?", [orderId]);
      for (const item of items) { if (!item.shop_product_id) continue; await conn.query("UPDATE shop_products SET stock = stock + ?, sales = GREATEST(0, sales - ?) WHERE id = ? AND stock >= 0", [item.quantity, item.quantity, item.shop_product_id]); }
      await conn.query("UPDATE shop_orders SET refund_status = 'success', refund_amount = ?, refunded_at = NOW(), updated_at = NOW() WHERE id = ?", [refundAmount, orderId]);
      await auditService.record({ actorType: "system", action: "shop_order.refund.completed", entityType: "shop_order", entityId: orderId, after: { method: "wechat", refundAmount, pointsReversed, refundId } }, conn);
      await conn.commit();
      log.info({ orderId, refundAmount, pointsReversed }, "Shop WeChat notify SUCCESS");
      return { success: true, detail: "Shop refund completed for order " + orderId };
    } catch (err) { await conn.rollback().catch(() => {}); log.error({ err }, "Shop refund notify processing error"); throw err; }
    finally { conn.release(); }
  },

  async _reverseShopPoints(conn, userId, orderId) {
    const [[phRow]] = await conn.query("SELECT SUM(points_change) AS earned FROM points_history WHERE user_id = ? AND reference_id = ? AND points_change > 0", [userId, orderId]);
    const earned = (phRow && phRow.earned) ? phRow.earned : 0;
    if (earned <= 0) return 0;
    await conn.query("UPDATE users SET points = GREATEST(0, CAST(points AS SIGNED) - ?) WHERE id = ?", [earned, userId]);
    const [[uRow]] = await conn.query("SELECT points FROM users WHERE id = ?", [userId]);
    const pointsAfter = (uRow && uRow.points) ? uRow.points : 0;
    await conn.query("INSERT INTO points_history (user_id, points_change, balance_after, reason, reference_id) VALUES (?, ?, ?, ?, ?)", [userId, -earned, pointsAfter, "商城订单退款", orderId]);
    return earned;
  },
};

module.exports = shopRefundService;
