export function generateFarmerCredentialsTemplate({ name, email, phone, tempPassword, organizationName, organizationRole }) {
  const baseUrl = process.env.FRONTEND_APP_URL || "http://localhost:3000";
  const loginUrl = `${baseUrl}/auth/signin?redirect=/ecosystem/farmer`;
  const farmerRouteUrl = `${baseUrl}/ecosystem/farmer`;

  const orgDisplay = organizationName 
    ? (organizationRole ? `${organizationName} (${organizationRole})` : organizationName)
    : "Institutional Partner";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Agri-Noria Farmer Account Credentials</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f4f4f4;
        }
        .container {
          background-color: #ffffff;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .header {
          text-align: center;
          margin-bottom: 25px;
        }
        .logo {
          color: #059669;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .banner {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          color: white;
          padding: 25px;
          text-align: center;
          border-radius: 10px;
          margin: 20px 0;
        }
        .card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .cred-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px dashed #cbd5e1;
          font-size: 14px;
        }
        .cred-item:last-child {
          border-bottom: none;
        }
        .cred-label {
          font-weight: 600;
          color: #64748b;
        }
        .cred-value {
          font-weight: 700;
          color: #0f172a;
          font-family: monospace;
          font-size: 14px;
          word-break: break-all;
        }
        .btn {
          display: block;
          width: fit-content;
          margin: 25px auto 10px;
          background-color: #059669;
          color: #ffffff !important;
          padding: 14px 36px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 700;
          text-align: center;
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
        }
        .footer {
          margin-top: 30px;
          font-size: 12px;
          color: #94a3b8;
          text-align: center;
        }
        .highlight-box {
          background-color: #ecfdf5;
          border-left: 4px solid #059669;
          padding: 12px 16px;
          border-radius: 4px;
          margin: 20px 0;
          font-size: 13px;
          color: #065f46;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">AGRI-NORIA ECOSYSTEM</div>
        </div>

        <div class="banner">
          <h2 style="margin: 0; font-size: 22px; color: white;">Welcome to Agri-Noria, ${name}!</h2>
          <p style="margin: 8px 0 0; opacity: 0.95; font-size: 14px;">
            Registered under <strong>${orgDisplay}</strong>
          </p>
        </div>

        <p>Hello ${name},</p>
        <p>A digital farmer account has been registered for you on the Agri-Noria Platform. You can use the temporary credentials below to log into your account:</p>

        <div class="card">
          <div class="cred-item">
            <span class="cred-label">Login Email:</span>
            <span class="cred-value">${email}</span>
          </div>
          ${phone ? `
          <div class="cred-item">
            <span class="cred-label">Registered Phone:</span>
            <span class="cred-value">${phone}</span>
          </div>` : ''}
          <div class="cred-item">
            <span class="cred-label">Temporary Password:</span>
            <span class="cred-value" style="color: #059669; font-size: 16px;">${tempPassword}</span>
          </div>
          <div class="cred-item">
            <span class="cred-label">Ecosystem Farmer Route:</span>
            <span class="cred-value" style="color: #2563eb;">${farmerRouteUrl}</span>
          </div>
        </div>

        <div class="highlight-box">
          <strong>Access & Verification Note:</strong> When you log in with these credentials, your verification status (<code>isVerified</code>) will be automatically set to active, unlocking full platform access including your Farmer Dashboard, input programs, harvest management, and digital wallet.
        </div>

        <a href="${loginUrl}" class="btn">Log In to Ecosystem Farmer Dashboard</a>

        <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 15px;">
          Direct dashboard link: <a href="${farmerRouteUrl}" style="color: #059669; word-break: break-all;">${farmerRouteUrl}</a>
        </p>

        <div class="footer">
          <p>Agri-Noria Agricultural Ecosystem &copy; ${new Date().getFullYear()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
