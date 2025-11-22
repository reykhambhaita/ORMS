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