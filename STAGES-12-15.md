# Pipeline Stages 12-15 Implementation

## Overview

Stages 12-15 implement the complete buyer/offtaker matching, sales settlement, repayment reconciliation, and reporting/intelligence components of the AgroConnect platform.

## Stage 12: Buyer/Offtaker Matching

### Purpose

Aggregators list available commodities on the marketplace for buyers to discover and make offers.

### Key Entities

- **buyer_marketplace_listings**: Aggregators list commodities with quantity, quality, availability
- **buyer_offers**: Buyers submit price offers for listed commodities
- **buyer_contracts**: Finalized contracts between aggregators and buyers

### API Endpoints

#### Create Marketplace Listing

```
POST /api/stage12/listing
Header: Authorization: Bearer <token>
Body: {
  "commodity": "Maize",
  "quantity": 1000,
  "unit": "bags",
  "estimatedQuality": "Grade A",
  "harvestDate": "2024-05-15",
  "location": "Lagos",
  "availableFrom": "2024-05-20",
  "availableUntil": "2024-06-30"
}
```

#### Get Marketplace Listings

```
GET /api/stage12/listings?status=active&commodity=Maize&aggregator_id=<id>
```

#### Submit Buyer Offer

```
POST /api/stage12/offer
Header: Authorization: Bearer <token>
Body: {
  "listing_id": "<uuid>",
  "offered_price": 50000,
  "quantity_offered": 500,
  "terms": "Payment after delivery"
}
```

#### Get Listing Offers

```
GET /api/stage12/listing/<listing_id>/offers
```

### Workflow

1. Aggregator creates commodity listing
2. Buyer views available listings
3. Buyer submits price offer
4. Aggregator reviews offers and selects best fit
5. Contract created between parties

---

## Stage 13: Sales & Settlement

### Purpose

Manage actual sales transactions and financial settlement between aggregators, buyers, farmers, and financing bodies.

### Key Entities

- **sales**: Records completed sales transactions
- **sales_settlements**: Breaks down payment distribution (farmer cut, financing recovery, fees, commission)
- **payment_breakdowns**: Tracks individual payouts to each recipient

### API Endpoints

#### Create Sales Contract

```
POST /api/stage13/contract
Header: Authorization: Bearer <token>
Body: {
  "listing_id": "<uuid>",
  "buyer_id": "<uuid>",
  "contract_terms": "FOB Lagos Port",
  "contract_price": 50000,
  "quantity_contracted": 500,
  "delivery_date": "2024-06-15"
}
```

#### Record Sale

```
POST /api/stage13/sale
Header: Authorization: Bearer <token>
Body: {
  "contract_id": "<uuid>",
  "buyer_id": "<uuid>",
  "sale_amount": 25000000,
  "quantity_sold": 500
}
```

#### Settle Sale (Finance/Super Admin Only)

```
POST /api/stage13/settle
Header: Authorization: Bearer <token>
Body: {
  "sale_id": "<uuid>",
  "total_sales_value": 25000000,
  "farmer_payout": 15000000,
  "financing_recovery": 2000000,
  "logistics_fees": 1000000,
  "insurance_fees": 500000,
  "commission": 1000000
}
```

#### Get Sales for Aggregator

```
GET /api/stage13/sales
Header: Authorization: Bearer <token>
```

### Settlement Breakdown

When a sale is settled, the system:

1. Calculates farmer's share based on agreement
2. Deducts financing loan recovery
3. Deducts logistics and insurance fees
4. Credits aggregator commission
5. Distributes payments to respective wallets

---

## Stage 14: Repayment & Reconciliation

### Purpose

Track input financing repayment and maintain credit scores for all vendors.

### Key Entities

- **financing_repayments**: Tracks financing agreements and repayment progress
- **repayment_transactions**: Individual repayment events
- **credit_scores**: Vendor creditworthiness metrics

### API Endpoints

#### Create Financing Repayment (Finance Only)

```
POST /api/stage14/repayment
Header: Authorization: Bearer <token>
Body: {
  "agreement_id": "<uuid>",
  "original_amount": 5000000,
  "interest_rate": 2.5
}
```

#### Record Repayment Payment (Finance Only)

```
POST /api/stage14/record-repayment
Header: Authorization: Bearer <token>
Body: {
  "repayment_id": "<uuid>",
  "amount_paid": 2500000,
  "payment_method": "sale_proceeds",
  "reference_id": "<sale_id or transaction_id>"
}
```

#### Update Credit Score (Super Admin Only)

```
PUT /api/stage14/credit-score
Header: Authorization: Bearer <token>
Body: {
  "vendor_id": "<uuid>",
  "repayment_score": 85,
  "yield_score": 90,
  "compliance_score": 88,
  "payment_reliability_score": 92
}
```

#### Get Credit Score

```
GET /api/stage14/credit-score/<vendor_id>
```

### Credit Score Calculation

Current Score = (repayment_score + yield_score + compliance_score + payment_reliability_score) / 4

#### Repayment Status Tracking

- **pending**: No payments recorded
- **partial**: Some payments received
- **completed**: Full amount recovered

---

## Stage 15: Reporting & Intelligence

### Purpose

Generate system-wide reports and provide AI-driven insights for institutional stakeholders.

### Key Entities

- **system_metrics**: Daily/periodic system health metrics
- **yield_forecasts**: Crop yield predictions by region
- **climate_risks**: Regional climate risk assessments
- **institutional_reports**: Government/ESG/financing reports
- **cluster_intelligence**: Cluster-level performance metrics

### API Endpoints

#### Record System Metrics (Super Admin Only)

```
POST /api/stage15/metrics
Header: Authorization: Bearer <token>
Body: {
  "date": "2024-05-15",
  "totalTransactions": 1250,
  "totalValue": 1250000000,
  "totalFarmers": 5000,
  "totalProduction": 50000,
  "avgYield": 5.2,
  "repaymentRate": 95.5,
  "defaultRate": 2.1,
  "exportReady": 850,
  "clusterPerf": 88.5
}
```

#### Record Yield Forecast (Super Admin Only)

```
POST /api/stage15/yield-forecast
Header: Authorization: Bearer <token>
Body: {
  "program_id": "<uuid>",
  "crop": "Maize",
  "region": "Kaduna",
  "forecast_date": "2024-06-01",
  "expected_yield": 5.8,
  "confidence": 87.5
}
```

#### Record Climate Risk (Super Admin Only)

```
POST /api/stage15/climate-risk
Header: Authorization: Bearer <token>
Body: {
  "region": "Kaduna",
  "risk_type": "drought",
  "risk_level": "high",
  "affected_crops": "Maize, Sorghum",
  "forecast_period": "June-August 2024",
  "mitigation_recommendations": "Deploy irrigation systems, use drought-resistant varieties"
}
```

#### Generate Institutional Report (Super Admin Only)

```
POST /api/stage15/report
Header: Authorization: Bearer <token>
Body: {
  "report_type": "government",
  "period_start": "2024-01-01",
  "period_end": "2024-05-31",
  "report_data": {
    "farmers": 5000,
    "production": 50000,
    "financing": 250000000,
    "repaymentRate": 95.5
  }
}
```

#### Get System Metrics

```
GET /api/stage15/metrics?date_from=2024-05-01&date_to=2024-05-31
```

#### Get Climate Risks

```
GET /api/stage15/climate-risks?region=Kaduna
GET /api/stage15/climate-risks
```

### Report Types

- **government**: Regulatory reporting for agricultural ministries
- **esg**: Environmental, Social, Governance reporting
- **financing**: Detailed reporting for financial institutions
- **operational**: Internal performance tracking

---

## Database Schema Summary

### Stage 12 Tables

- `buyer_marketplace_listings`: 8 columns, indexed on aggregator_id and status
- `buyer_offers`: 8 columns, indexed on listing_id and buyer_id
- `buyer_contracts`: 12 columns, indexed on aggregator_id and buyer_id

### Stage 13 Tables

- `sales`: 7 columns, indexed on contract_id
- `sales_settlements`: 8 columns, indexed on sale_id
- `payment_breakdowns`: 7 columns, indexed on settlement_id

### Stage 14 Tables

- `financing_repayments`: 8 columns, indexed on agreement_id
- `repayment_transactions`: 7 columns, indexed on repayment_id
- `credit_scores`: 9 columns, indexed on vendor_id (UNIQUE)

### Stage 15 Tables

- `system_metrics`: 12 columns, indexed on metric_date
- `yield_forecasts`: 8 columns
- `climate_risks`: 7 columns
- `institutional_reports`: 9 columns
- `cluster_intelligence`: 10 columns, indexed on metric_date

---

## Integration Points

### With Escrow System

- Escrow release triggers sale settlement workflow
- Finance wallet receives escrow → distributes to sale recipients

### With Finance Wallets

- Settlement payments credited to recipient finance wallets
- Repayments deducted from finance wallets

### With Credit System

- Repayment performance updates credit scores
- Credit scores influence future financing eligibility

### With Dashboard

- Super Admin dashboard displays metrics from Stage 15
- Aggregator dashboard shows sales and settlement status
- Buyer dashboard displays accepted/pending contracts

---

## Data Migration

### Prerequisites

- Run `src/stages-12-15-schema.sql` to create all tables
- Run `src/migrate-finance-system.sql` for finance wallet setup

### Migration Steps

```bash
# Connect to database
psql -U postgres -d agriconnect -f src/stages-12-15-schema.sql
psql -U postgres -d agriconnect -f src/migrate-finance-system.sql
```

### Verification

```sql
-- Check tables created
\dt buyer_* sales* financing* system_* yield* climate* institutional* cluster*

-- Check indexes
\di buyer_* sales* financing* system_*

-- Verify finance wallets initialized
SELECT COUNT(*) FROM finance_wallets;
```

---

## Error Handling

### Common Scenarios

1. **Insufficient Quantity**: Buyer offers more than available
   - Response: `400 Bad Request - Quantity exceeds available`

2. **Unauthorized Role**: Non-Finance user attempts settlement
   - Response: `403 Forbidden - Only Finance/Super Admin can settle`

3. **Missing Agreement**: Repayment created for non-existent agreement
   - Response: `404 Not Found - Agreement not found`

4. **Duplicate Settlement**: Attempt to settle already-settled sale
   - Response: `409 Conflict - Sale already settled`

---

## Performance Considerations

### Index Strategy

- **buyer_marketplace_listings**: Index on aggregator_id (listing creation), status (filtering)
- **sales**: Index on contract_id (lookup), aggregator_id (filtering)
- **financing_repayments**: Index on agreement_id (relation), vendor_id (credit tracking)
- **system_metrics**: Index on metric_date (time-series queries)

### Query Optimization

- Listing queries filtered by status before returning
- Settlement calculations use indexed lookups
- Metric aggregations cached daily

---

## Future Enhancements

1. **ML Predictive Model**: Automatic yield forecasting
2. **Notification System**: Email/SMS alerts for contract milestones
3. **API Webhooks**: Real-time event notifications
4. **Document Management**: Store contracts and reports as PDFs
5. **Audit Logging**: Complete transaction history for compliance
