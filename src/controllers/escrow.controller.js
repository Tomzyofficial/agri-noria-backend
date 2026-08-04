import { z } from 'zod';
import {
  createEscrowRelease,
  getEscrowReleaseById,
  getEscrowReleasesByPaymentId,
  getEscrowReleasesByOrderId,
  updateEscrowReleaseStatus,
  releaseEscrowFunds,
  autoReleaseEscrow,
  getPendingEscrowReleases,
  getEscrowReleasesByTriggerType,
  getEscrowStats,
  getSellerEscrowStats,
  createDeliveryConfirmation,
  getDeliveryConfirmationByOrderId,
  verifyDeliveryOTP,
  confirmDeliveryWithPhoto,
  autoConfirmDelivery,
  getDeliveryConfirmationStats
} from '../db/escrow.db.js';

// Zod schema for escrow release creation
const escrowReleaseSchema = z.object({
  payment_id: z.string().uuid('Invalid payment ID'),
  order_id: z.string().uuid('Invalid order ID'),
  status: z.string().default('pending'),
  trigger_type: z.enum(['buyer_confirmed', 'auto_release', 'admin_override', 'dispute_resolved']),
  released_by: z.string().uuid('Invalid released by ID').optional(),
  release_amount: z.number().nonnegative('Release amount must be nonnegative'),
  reason: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional().default({})
});

// Create escrow release record
export async function createEscrowReleaseController(req, res) {
  try {
    const validatedData = escrowReleaseSchema.parse(req.body);

    const release = await createEscrowRelease(validatedData);

    res.status(201).json({
      success: true,
      message: 'Escrow release created successfully',
      data: release
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }

    console.error('Error creating escrow release:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create escrow release',
      error: error.message
    });
  }
}

// Get escrow release by ID
export async function getEscrowReleaseByIdController(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Release ID is required'
      });
    }

    const release = await getEscrowReleaseById(id);

    if (!release) {
      return res.status(404).json({
        success: false,
        message: 'Escrow release not found'
      });
    }

    res.status(200).json({
      success: true,
      data: release
    });
  } catch (error) {
    console.error('Error getting escrow release:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get escrow release',
      error: error.message
    });
  }
}

// Get escrow releases by payment ID
export async function getEscrowReleasesByPaymentIdController(req, res) {
  try {
    const { payment_id } = req.params;

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }

    const releases = await getEscrowReleasesByPaymentId(payment_id);

    res.status(200).json({
      success: true,
      data: releases,
      count: releases.length
    });
  } catch (error) {
    console.error('Error getting escrow releases by payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get escrow releases',
      error: error.message
    });
  }
}

// Get escrow releases by order ID
export async function getEscrowReleasesByOrderIdController(req, res) {
  try {
    const { order_id } = req.params;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    const releases = await getEscrowReleasesByOrderId(order_id);

    res.status(200).json({
      success: true,
      data: releases,
      count: releases.length
    });
  } catch (error) {
    console.error('Error getting escrow releases by order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get escrow releases',
      error: error.message
    });
  }
}

// Release escrow funds
export async function releaseEscrowFundsController(req, res) {
  try {
    const { payment_id, trigger_type, released_by, reason } = req.body;

    if (!payment_id || !trigger_type) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID and trigger type are required'
      });
    }

    const validTriggerTypes = ['buyer_confirmed', 'auto_release', 'admin_override', 'dispute_resolved'];
    if (!validTriggerTypes.includes(trigger_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trigger type'
      });
    }

    const success = await releaseEscrowFunds(payment_id, trigger_type, released_by, reason);

    if (!success) {
      return res.status(400).json({
        success: false,
        message: 'Failed to release escrow funds. Payment may not be in held state or order not found.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Escrow funds released successfully'
    });
  } catch (error) {
    console.error('Error releasing escrow funds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to release escrow funds',
      error: error.message
    });
  }
}

// Auto-release escrow (cron job endpoint)
export async function autoReleaseEscrowController(req, res) {
  try {
    const count = await autoReleaseEscrow();

    res.status(200).json({
      success: true,
      message: `Auto-released ${count} escrow payments`,
      count
    });
  } catch (error) {
    console.error('Error auto-releasing escrow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-release escrow',
      error: error.message
    });
  }
}

// Get pending escrow releases
export async function getPendingEscrowReleasesController(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const releases = await getPendingEscrowReleases(limit, offset);

    res.status(200).json({
      success: true,
      data: releases,
      pagination: {
        limit,
        offset,
        count: releases.length
      }
    });
  } catch (error) {
    console.error('Error getting pending escrow releases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get pending escrow releases',
      error: error.message
    });
  }
}

// Get escrow releases by trigger type
export async function getEscrowReleasesByTriggerTypeController(req, res) {
  try {
    const { trigger_type } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    if (!trigger_type) {
      return res.status(400).json({
        success: false,
        message: 'Trigger type is required'
      });
    }

    const validTriggerTypes = ['buyer_confirmed', 'auto_release', 'admin_override', 'dispute_resolved'];
    if (!validTriggerTypes.includes(trigger_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid trigger type'
      });
    }

    const releases = await getEscrowReleasesByTriggerType(trigger_type, limit, offset);

    res.status(200).json({
      success: true,
      data: releases,
      pagination: {
        limit,
        offset,
        count: releases.length
      }
    });
  } catch (error) {
    console.error('Error getting escrow releases by trigger type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get escrow releases',
      error: error.message
    });
  }
}

// Get escrow statistics
export async function getEscrowStatsController(req, res) {
  try {
    const stats = await getEscrowStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting escrow stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get escrow statistics',
      error: error.message
    });
  }
}

// Get seller escrow statistics
export async function getSellerEscrowStatsController(req, res) {
  try {
    const { seller_id } = req.params;

    if (!seller_id) {
      return res.status(400).json({
        success: false,
        message: 'Seller ID is required'
      });
    }

    const stats = await getSellerEscrowStats(seller_id);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting seller escrow stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get seller escrow statistics',
      error: error.message
    });
  }
}

// Create delivery confirmation with OTP
export async function createDeliveryConfirmationController(req, res) {
  try {
    const { order_id, buyer_id } = req.body;

    if (!order_id || !buyer_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and buyer ID are required'
      });
    }

    const confirmation = await createDeliveryConfirmation(order_id, buyer_id);

    if (!confirmation) {
      return res.status(400).json({
        success: false,
        message: 'Failed to create delivery confirmation. OTP may already exist and be valid.'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Delivery confirmation created successfully',
      data: {
        confirmation_id: confirmation.id,
        otp_code: confirmation.otp_code,
        expires_at: confirmation.otp_expires_at
      }
    });
  } catch (error) {
    console.error('Error creating delivery confirmation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create delivery confirmation',
      error: error.message
    });
  }
}

// Get delivery confirmation by order ID
export async function getDeliveryConfirmationByOrderIdController(req, res) {
  try {
    const { order_id } = req.params;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    const confirmation = await getDeliveryConfirmationByOrderId(order_id);

    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: 'Delivery confirmation not found'
      });
    }

    // Don't return OTP code in response
    const { otp_code, ...confirmationWithoutOtp } = confirmation;

    res.status(200).json({
      success: true,
      data: confirmationWithoutOtp
    });
  } catch (error) {
    console.error('Error getting delivery confirmation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get delivery confirmation',
      error: error.message
    });
  }
}

// Verify delivery OTP
export async function verifyDeliveryOTPController(req, res) {
  try {
    const { order_id, otp_code } = req.body;

    if (!order_id || !otp_code) {
      return res.status(400).json({
        success: false,
        message: 'Order ID and OTP code are required'
      });
    }

    const confirmation = await verifyDeliveryOTP(order_id, otp_code);

    if (!confirmation) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code or OTP has expired'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Delivery confirmed successfully',
      data: confirmation
    });
  } catch (error) {
    console.error('Error verifying delivery OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify delivery OTP',
      error: error.message
    });
  }
}

// Confirm delivery with photo proof
export async function confirmDeliveryWithPhotoController(req, res) {
  try {
    const { order_id, buyer_id, proof_image, notes, condition_rating } = req.body;

    if (!order_id || !buyer_id || !proof_image) {
      return res.status(400).json({
        success: false,
        message: 'Order ID, buyer ID, and proof image are required'
      });
    }

    const confirmation = await confirmDeliveryWithPhoto(order_id, buyer_id, proof_image, notes, condition_rating);

    res.status(200).json({
      success: true,
      message: 'Delivery confirmed with photo successfully',
      data: confirmation
    });
  } catch (error) {
    console.error('Error confirming delivery with photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm delivery with photo',
      error: error.message
    });
  }
}

// Auto-confirm delivery (timeout)
export async function autoConfirmDeliveryController(req, res) {
  try {
    const { order_id } = req.params;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    const confirmation = await autoConfirmDelivery(order_id);

    if (!confirmation) {
      return res.status(400).json({
        success: false,
        message: 'Failed to auto-confirm delivery. Order may already be confirmed.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Delivery auto-confirmed successfully',
      data: confirmation
    });
  } catch (error) {
    console.error('Error auto-confirming delivery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to auto-confirm delivery',
      error: error.message
    });
  }
}

// Get delivery confirmation statistics
export async function getDeliveryConfirmationStatsController(req, res) {
  try {
    const stats = await getDeliveryConfirmationStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting delivery confirmation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get delivery confirmation statistics',
      error: error.message
    });
  }
}
