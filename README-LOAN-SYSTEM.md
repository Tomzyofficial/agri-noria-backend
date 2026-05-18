# Loan Disbursement and Repayment System

A production-ready loan management system with Paystack payment integration for agricultural vendors.

## Features

- **Loan Application & Approval**: Complete loan application workflow with admin approval
- **Automated Disbursement**: Admin can disburse approved loans with automatic interest calculation
- **Flexible Repayment**: Monthly installments with option for final full payment
- **Paystack Integration**: Secure payment processing via Paystack
- **Real-time Webhooks**: Automatic payment confirmation and loan completion
- **Comprehensive Dashboard**: Vendor loan summary and payment history
- **Admin Management**: Complete loan oversight and management

## Architecture

### Database Schema

#### Loans Table (Updated)
```sql
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors (id) ON DELETE CASCADE,
    org_name TEXT NOT NULL,
    years_in_operation INTEGER NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    repay_amount NUMERIC(12,2),              -- Total amount to repay (principal + interest)
    repay_period INTEGER NOT NULL, 
    monthly_revenue NUMERIC(12,2) NOT NULL,
    -- ... other existing fields
    monthly_installment NUMERIC(12,2),       -- Calculated monthly payment
    amount_paid NUMERIC(12,2) DEFAULT 0,     -- Total amount paid so far
    disbursed_at TIMESTAMP,                  -- When loan was disbursed
    approved_at TIMESTAMP
);
```

#### Loan Payments Table
```sql
CREATE TABLE loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    paystack_reference TEXT UNIQUE,
    payment_method TEXT DEFAULT 'paystack',
    paid_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Interest Calculation

- **Fixed Rate**: 10% interest on loan amount
- **Formula**: `repay_amount = amount + (amount * 0.10)`
- **Monthly Installment**: `repay_amount / repay_period`

### Payment Rules

1. **Monthly Installment**: Standard payment amount
2. **Final Payment**: Remaining balance (can be less than monthly installment)
3. **No Partial Payments**: Vendors cannot pay arbitrary amounts

## API Endpoints

### Vendor Endpoints

#### Get Loan Summary
```http
GET /api/loans/:loanId/summary
Authorization: Bearer <vendor_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "amount": 100000,
    "repay_amount": 110000,
    "monthly_installment": 11000,
    "amount_paid": 22000,
    "remaining_balance": 88000,
    "status": "active",
    "disbursed_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Initiate Payment
```http
POST /api/loans/:loanId/pay
Authorization: Bearer <vendor_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "reference": "LOAN_1642678800000_123456",
    "payment_amount": 11000,
    "remaining_balance": 88000,
    "is_final_payment": false
  }
}
```

#### Get Payment History
```http
GET /api/loans/:loanId/payments
Authorization: Bearer <vendor_token>
```

#### Get All Vendor Loans
```http
GET /api/loans
Authorization: Bearer <vendor_token>
```

### Admin Endpoints

#### Disburse Loan
```http
POST /api/admin/loans/:loanId/disburse
Authorization: Bearer <admin_token>
```

#### Get All Loans (with pagination)
```http
GET /api/admin/loans?page=1&limit=20&status=active
Authorization: Bearer <admin_token>
```

### Webhook Endpoint

#### Paystack Webhook
```http
POST /api/webhooks/paystack
Headers: x-paystack-signature
```

## Services

### Loan Repayment Service (`loanRepayment.service.js`)

Key functions:
- `prepareLoanRepayment(loanId)` - Calculate and setup loan repayment terms
- `getLoanSummary(loanId)` - Get loan details with remaining balance
- `calculatePaymentAmount(loanId)` - Determine next payment amount
- `recordLoanPayment(loanId, amount, reference)` - Atomic payment recording

### Paystack Service (`paystack.service.js`)

Key functions:
- `initializeLoanPayment(email, amount, metadata, callbackUrl)` - Start payment
- `verifyTransaction(reference)` - Verify payment status
- `verifyWebhookSignature(body, signature)` - Validate webhook

## Database Functions

### Core Functions (`loan.functions.sql`)

- `calculate_loan_repayment_amount()` - Calculate total repayment with interest
- `calculate_monthly_installment()` - Calculate monthly payment
- `disburse_loan()` - Atomic loan disbursement
- `record_loan_payment()` - Atomic payment recording with completion check
- `get_loan_summary()` - Get loan with remaining balance
- `calculate_next_payment()` - Determine next payment amount

## Security Features

1. **Webhook Signature Verification**: HMAC-SHA512 validation
2. **JWT Authentication**: Role-based access control
3. **SQL Transactions**: Atomic payment operations
4. **Reference Uniqueness**: Prevent duplicate payments
5. **Input Validation**: Comprehensive parameter checking

## Payment Flow

### 1. Admin Disbursement
```
Loan Approved → Admin Disburses → Calculate Interest → Set Active Status
```

### 2. Vendor Payment
```
Vendor Clicks Pay → Calculate Amount → Initialize Paystack → Redirect to Payment
```

### 3. Payment Confirmation
```
Paystack Webhook → Verify Signature → Record Payment → Update Loan → Check Completion
```

## Environment Variables

```bash
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_CALLBACK_URL=https://yourdomain.com/payment-success

# Frontend URL
FRONTEND_APP_URL=https://yourdomain.com

# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your-secret-key
```

## Installation

1. **Update Database Schema**
```sql
-- Run the updated schema from db-creation.sql
-- Execute loan.functions.sql for stored procedures
```

2. **Install Dependencies**
```bash
npm install
```

3. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start Server**
```bash
npm run dev
```

## Testing

### Test Payment Flow

1. **Create Test Loan** (via existing loan application)
2. **Approve Loan** (admin interface)
3. **Disburse Loan** (admin endpoint)
4. **Initiate Payment** (vendor endpoint)
5. **Complete Payment** (Paystack test mode)
6. **Verify Webhook** (automatic)

### Test Cards (Paystack Sandbox)
- **Success**: `4084084084084081`
- **Fail**: `4084084084084082`
- **3DS**: `4084084084084081` (with 3DS challenge)

## Frontend Integration

See `frontend-api-examples.md` for complete React component examples and API integration patterns.

## Monitoring & Logging

- **Webhook Events**: All webhook events logged with timestamps
- **Payment Failures**: Detailed error logging for failed payments
- **Transaction References**: Unique reference tracking for audit trails

## Production Considerations

1. **Database Indexes**: Optimized queries with proper indexes
2. **Rate Limiting**: Implement API rate limiting
3. **Monitoring**: Set up payment failure alerts
4. **Backup**: Regular database backups
5. **SSL**: HTTPS required for production
6. **Webhook URL**: Publicly accessible webhook endpoint

## Support

For issues or questions:
1. Check application logs
2. Verify Paystack webhook status
3. Test with Paystack sandbox mode
4. Review database transaction logs

---

This system provides a complete, production-ready loan management solution with secure payment processing and comprehensive tracking capabilities.
