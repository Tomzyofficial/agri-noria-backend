import crypto from 'crypto';

/**
 * Generate a unique tracking number
 * Format: AGR-TRK-XXXXXXXX (where X is alphanumeric)
 * Example: AGR-TRK-8F29KX91
 */
export function generateTrackingNumber() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `AGR-TRK-${result}`;
}

/**
 * Generate a secure 4-6 digit OTP for delivery confirmation
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} OTP as string
 */
export function generateDeliveryOTP(length = 6) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

/**
 * Hash OTP for secure storage
 * @param {string} otp - Plain text OTP
 * @returns {string} Hashed OTP
 */
export function hashOTP(otp) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

/**
 * Verify OTP against hashed value
 * @param {string} plainOTP - Plain text OTP to verify
 * @param {string} hashedOTP - Stored hashed OTP
 * @returns {boolean} True if OTP matches
 */
export function verifyOTP(plainOTP, hashedOTP) {
  const hashedPlain = hashOTP(plainOTP);
  return hashedPlain === hashedOTP;
}

/**
 * Generate OTP expiry timestamp (default: 24 hours from now)
 * @param {number} hours - Hours until expiry (default: 24)
 * @returns {Date} Expiry timestamp
 */
export function generateOTPExpiry(hours = 24) {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export function validatePhoneNumber(phone) {
  const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Validate vehicle plate number format
 * @param {string} plateNumber - Plate number to validate
 * @returns {boolean} True if valid
 */
export function validatePlateNumber(plateNumber) {
  // Basic validation - adjust based on local requirements
  const plateRegex = /^[A-Z0-9-]{3,15}$/i;
  return plateRegex.test(plateNumber.replace(/\s/g, ''));
}

/**
 * Validate delivery date/time
 * @param {Date|string} deliveryDateTime - Delivery date/time to validate
 * @returns {boolean} True if valid and in the future
 */
export function validateDeliveryDateTime(deliveryDateTime) {
  const deliveryDate = new Date(deliveryDateTime);
  const now = new Date();
  
  if (isNaN(deliveryDate.getTime())) {
    return false;
  }
  
  // Delivery must be at least 1 hour in the future
  const minDeliveryTime = new Date(now.getTime() + 60 * 60 * 1000);
  return deliveryDate >= minDeliveryTime;
}

/**
 * Format tracking number for display
 * @param {string} trackingNumber - Tracking number to format
 * @returns {string} Formatted tracking number
 */
export function formatTrackingNumber(trackingNumber) {
  if (!trackingNumber) return '';
  return trackingNumber.toUpperCase();
}

/**
 * Validate image file type
 * @param {string} mimeType - MIME type of image
 * @returns {boolean} True if valid image type
 */
export function validateImageType(mimeType) {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return validTypes.includes(mimeType);
}

/**
 * Validate image file size (max 5MB)
 * @param {number} fileSize - File size in bytes
 * @returns {boolean} True if valid size
 */
export function validateImageSize(fileSize) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  return fileSize <= maxSize;
}
