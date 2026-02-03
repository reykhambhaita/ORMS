// backend/controllers/paymentController.js
import fetch from 'node-fetch';
import { Payment } from '../db.js';

const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

// Get PayPal access token
async function getPayPalAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  return data.access_token;
}

/**
 * Create PayPal order
 * POST /api/payments/create-order
 * Body: { amount, mechanicId, description }
 */
export const createPayPalOrderHandler = async (req, res) => {
  try {
    const { amount, mechanicId, description } = req.body;

    if (!amount || !mechanicId) {
      return res.status(400).json({ error: 'Amount and mechanic ID are required' });
    }

    const accessToken = await getPayPalAccessToken();

    // Create PayPal order
    const orderResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD', // Change to INR if your PayPal supports it
            value: amount.toFixed(2)
          },
          description: description || 'Mechanic service payment'
        }]
      })
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error('PayPal order creation failed:', orderData);
      return res.status(500).json({ error: 'Failed to create PayPal order' });
    }

    // Save payment record
    const payment = new Payment({
      userId: req.userId,
      mechanicId,
      amount,
      paypalOrderId: orderData.id,
      status: 'pending',
      description: description || 'Mechanic service',
      createdAt: new Date()
    });

    await payment.save();

    res.json({
      success: true,
      orderId: orderData.id,
      paymentId: payment._id
    });
  } catch (error) {
    console.error('Create PayPal order error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
};

/**
 * Capture PayPal payment
 * POST /api/payments/capture
 * Body: { orderId, paymentId }
 */
export const capturePayPalPaymentHandler = async (req, res) => {
  try {
    const { orderId, paymentId } = req.body;

    if (!orderId || !paymentId) {
      return res.status(400).json({ error: 'Order ID and payment ID are required' });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const accessToken = await getPayPalAccessToken();

    // Capture the payment
    const captureResponse = await fetch(
      `${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const captureData = await captureResponse.json();

    if (captureData.status === 'COMPLETED') {
      payment.status = 'completed';
      payment.paypalCaptureId = captureData.purchase_units[0].payments.captures[0].id;
      payment.completedAt = new Date();
      await payment.save();

      res.json({
        success: true,
        status: 'completed',
        captureId: payment.paypalCaptureId
      });
    } else {
      payment.status = 'failed';
      await payment.save();

      res.status(400).json({
        error: 'Payment capture failed',
        details: captureData
      });
    }
  } catch (error) {
    console.error('Capture payment error:', error);
    res.status(500).json({ error: 'Failed to capture payment' });
  }
};

/**
 * Create UPI payment record
 * POST /api/payments/create-upi-payment
 * Body: { amount, mechanicId, description }
 */
export const createUPIPaymentHandler = async (req, res) => {
  try {
    const { amount, mechanicId, description } = req.body;

    if (!amount || !mechanicId) {
      return res.status(400).json({ error: 'Amount and mechanic ID are required' });
    }

    // Save payment record as pending
    const payment = new Payment({
      userId: req.userId,
      mechanicId,
      amount,
      status: 'pending',
      description: description || 'Mechanic service',
      createdAt: new Date()
    });

    await payment.save();

    res.json({
      success: true,
      data: {
        paymentId: payment._id
      }
    });
  } catch (error) {
    console.error('Create UPI payment error:', error);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
};

/**
 * Verify UPI payment
 * POST /api/payments/verify-upi-payment
 * Body: { paymentId, upiTransactionId, upiResponse, status }
 */
export const verifyUPIPaymentHandler = async (req, res) => {
  try {
    const { paymentId, upiTransactionId, upiResponse, status } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: 'Payment ID is required' });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    // Update payment record
    payment.upiTransactionId = upiTransactionId;
    payment.upiResponse = upiResponse;
    payment.status = status === 'SUCCESS' ? 'completed' : 'failed';

    if (payment.status === 'completed') {
      payment.completedAt = new Date();
    }

    await payment.save();

    res.json({
      success: true,
      status: payment.status
    });
  } catch (error) {
    console.error('Verify UPI payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

/**
 * Get payment history
 * GET /api/payments/history
 */
export const getPaymentHistoryHandler = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.userId })
      .populate('mechanicId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(50);

    const transformedPayments = payments.map(p => ({
      id: p._id,
      amount: p.amount,
      status: p.status,
      description: p.description,
      mechanicName: p.mechanicId?.name || 'Unknown',
      transactionId: p.upiTransactionId || p.paypalCaptureId || p.paypalOrderId,
      paymentMethod: p.upiTransactionId ? 'UPI' : (p.paypalOrderId ? 'PayPal' : 'Unknown'),
      createdAt: p.createdAt,
      completedAt: p.completedAt
    }));

    res.json({
      success: true,
      data: transformedPayments
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
};

/**
 * Create UPI Payment Order (Deep Link Approach)
 * POST /api/payments/upi/create-order
 * Body: { amount, mechanicId, description }
 */
export const createUPIPaymentOrderHandler = async (req, res) => {
  try {
    const { amount, mechanicId, description } = req.body;

    if (!amount || !mechanicId) {
      return res.status(400).json({ error: 'Amount and mechanic ID are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Generate unique transaction ID
    const transactionId = `TXN${Date.now()}${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Set expiry time (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Check for duplicate recent pending payments (idempotency)
    const recentPending = await Payment.findOne({
      userId: req.userId,
      mechanicId,
      amount,
      status: 'pending',
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
    });

    if (recentPending && recentPending.transactionId) {
      // Return existing transaction
      return res.json({
        success: true,
        data: {
          transactionId: recentPending.transactionId,
          amount: recentPending.amount,
          expiresAt: recentPending.expiresAt,
          isExisting: true
        }
      });
    }

    // Create new payment record
    const payment = new Payment({
      userId: req.userId,
      mechanicId,
      amount,
      description: description || '',
      transactionId,
      status: 'pending',
      expiresAt,
      metadata: {
        createdVia: 'upi-deeplink',
        userAgent: req.headers['user-agent'],
        ip: req.ip
      }
    });

    await payment.save();

    res.json({
      success: true,
      data: {
        transactionId,
        amount,
        expiresAt,
        isExisting: false
      }
    });
  } catch (error) {
    console.error('Create UPI payment order error:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
};

/**
 * Get Payment Status (for polling)
 * GET /api/payments/upi/status/:transactionId
 */
export const getPaymentStatusHandler = async (req, res) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    // Find payment
    const payment = await Payment.findOne({ transactionId })
      .populate('mechanicId', 'name phone upiId');

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify ownership
    if (payment.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if payment has expired
    if (payment.status === 'pending' && payment.expiresAt && new Date() > payment.expiresAt) {
      payment.status = 'expired';
      await payment.save();
    }

    // Update status check metadata
    payment.statusCheckedAt = new Date();
    payment.attempts = (payment.attempts || 0) + 1;
    await payment.save();

    // Return status
    res.json({
      success: true,
      data: {
        transactionId: payment.transactionId,
        status: payment.status,
        amount: payment.amount,
        description: payment.description,
        mechanicName: payment.mechanicId?.name,
        mechanicUpiId: payment.mechanicId?.upiId,
        createdAt: payment.createdAt,
        expiresAt: payment.expiresAt,
        completedAt: payment.completedAt,
        attempts: payment.attempts
      }
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
};

/**
 * Manual Payment Verification (for testing/admin)
 * POST /api/payments/upi/manual-verify
 * Body: { transactionId, status, upiTransactionId }
 */
export const manualVerifyPaymentHandler = async (req, res) => {
  try {
    const { transactionId, status, upiTransactionId } = req.body;

    if (!transactionId || !status) {
      return res.status(400).json({ error: 'Transaction ID and status are required' });
    }

    if (!['completed', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const payment = await Payment.findOne({ transactionId });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Verify ownership
    if (payment.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Don't allow updating already completed/failed payments
    if (['completed', 'failed', 'refunded'].includes(payment.status)) {
      return res.status(400).json({ error: 'Payment already finalized' });
    }

    // Update payment
    payment.status = status;
    if (upiTransactionId) {
      payment.upiTransactionId = upiTransactionId;
    }
    if (status === 'completed') {
      payment.completedAt = new Date();
    }

    await payment.save();

    res.json({
      success: true,
      data: {
        transactionId: payment.transactionId,
        status: payment.status
      }
    });
  } catch (error) {
    console.error('Manual verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

/**
 * Expire old pending payments (background job)
 * POST /api/payments/upi/expire-old
 */
export const expireOldPaymentsHandler = async (req, res) => {
  try {
    const result = await Payment.updateMany(
      {
        status: 'pending',
        expiresAt: { $lt: new Date() }
      },
      {
        $set: { status: 'expired' }
      }
    );

    res.json({
      success: true,
      data: {
        expiredCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Expire old payments error:', error);
    res.status(500).json({ error: 'Failed to expire old payments' });
  }
};