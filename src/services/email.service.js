import nodemailer from "nodemailer";
import crypto from "crypto";

class EmailService {
   constructor() {
      // Configure nodemailer transporter
      this.transporter = nodemailer.createTransport({
         service: process.env.EMAIL_HOST || "smtp.gmail.com",
         // port: process.env.EMAIL_PORT || 587,
         // secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
         // family: 4,
         auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
         },
      });

      // Verify transporter configuration
      this.transporter.verify((error, success) => {
         if (error) {
            console.error("Email service configuration error:", error);
         } else {
            console.log("Email service is ready to send messages");
         }
      });
   }

   // Generate 6-digit verification code
   generateVerificationCode() {
      return Math.floor(100000 + Math.random() * 900000).toString();
   }

   // Hash verification code for secure storage
   hashVerificationCode(code) {
      return crypto.createHash("sha256").update(code).digest("hex");
   }

   // Verify hashed code
   verifyHashedCode(plainCode, hashedCode) {
      const hashedPlain = this.hashVerificationCode(plainCode);
      return hashedPlain === hashedCode;
   }

   // Send verification email
   async sendVerificationEmail(email, verificationCode) {
      try {
         const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || "Agri-Noria"}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Verify Your Email Address - Agri-Connect",
            html: this.generateVerificationEmailTemplate(verificationCode),
         };

         const result = await this.transporter.sendMail(mailOptions);
         console.log("Verification email sent successfully:", result.messageId);
         return { success: true, messageId: result.messageId };
      } catch (error) {
         console.error("Error sending verification email from email service file:", error.message);
         return { success: false, error: error.message };
      }
   }

   // Send welcome email after successful verification
   async sendWelcomeEmail(email, name, userType) {
      try {
         const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || "Agri-Noria"}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Welcome to Agri-Noria! 🎉",
            html: this.generateWelcomeEmailTemplate(name, userType),
         };

         const result = await this.transporter.sendMail(mailOptions);
         console.log("Welcome email sent successfully:", result.messageId);
         return { success: true, messageId: result.messageId };
      } catch (error) {
         console.error("Error sending welcome email:", error);
         return { success: false, error: error.message };
      }
   }

   // Generate verification email template
   generateVerificationEmailTemplate(verificationCode) {
      // const userTypeName = userType === "vendor" ? "Vendor" : "Buyer";

      return `
         <!DOCTYPE html>
         <html lang="en">
         <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification - Agri-Connect</title>
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
                  border-radius: 10px;
                  box-shadow: 0 0 20px rgba(0,0,0,0.1);
               }
               .header {
                  text-align: center;
                  margin-bottom: 30px;
               }
               .logo {
                  color: #10b981;
                  font-size: 28px;
                  font-weight: bold;
                  margin-bottom: 10px;
               }
               .verification-code {
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  font-size: 32px;
                  font-weight: bold;
                  letter-spacing: 8px;
                  padding: 20px;
                  text-align: center;
                  border-radius: 10px;
                  margin: 30px 0;
                  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
               }
               .info {
                  background-color: #f0fdf4;
                  border-left: 4px solid #10b981;
                  padding: 15px;
                  margin: 20px 0;
                  border-radius: 0 5px 5px 0;
               }
               .footer {
                  text-align: center;
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  color: #6b7280;
                  font-size: 14px;
               }
               .btn {
                  display: inline-block;
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  padding: 12px 30px;
                  text-decoration: none;
                  border-radius: 25px;
                  font-weight: 600;
                  margin: 20px 0;
                  transition: transform 0.2s;
               }
               .btn:hover {
                  transform: translateY(-2px);
               }
            </style>
         </head>
         <body>
            <div class="container">
               <div class="header">
                  <div class="logo">🌱 Agri-Connect</div>
                  <h2>Email Verification Required</h2>
               </div>

               <p>Hello!</p>
               
               <p>Thank you for your interest in our platform! To complete your registration and secure your account, please verify your email address.</p>

               <div class="verification-code">
                  ${verificationCode}
               </div>

               <div class="info">
                  <strong>Important:</strong> This verification code will expire in <strong>15 minutes</strong>. Please use it promptly to complete your registration.
               </div>

               <p><strong>Steps to verify:</strong></p>
               <ol>
                  <li>Copy the verification code above</li>
                  <li>Return to the registration page</li>
                  <li>Click on the Next button</li>
                  <li>Enter the code in the verification field</li>
                  <li>Click "Verify Email" to complete registration</li>
               </ol>

               <p>If you didn't request this verification, please ignore this email. Your account will not be created without email verification.</p>

               <div class="footer">
                  <p>Best regards,<br>The Agri-Noria Team</p>
                  <p style="font-size: 12px; margin-top: 20px;">
                     This is an automated message. Please do not reply to this email.
                  </p>
               </div>
            </div>
         </body>
         </html>
      `;
   }

   // Generate welcome email template
   generateWelcomeEmailTemplate(name, userType) {
      const userTypeName = userType ? userType : "Buyer";
      const dashboardUrl = userType
         ? `${process.env.FRONTEND_APP_URL || "http://localhost:3000"}/dashboard`
         : `${process.env.FRONTEND_APP_URL || "http://localhost:3000"}/dashboard/buyer`;

      return `
         <!DOCTYPE html>
         <html lang="en">
         <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Agri-Connect!</title>
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
                  border-radius: 10px;
                  box-shadow: 0 0 20px rgba(0,0,0,0.1);
               }
               .header {
                  text-align: center;
                  margin-bottom: 30px;
               }
               .logo {
                  color: #10b981;
                  font-size: 28px;
                  font-weight: bold;
                  margin-bottom: 10px;
               }
               .welcome {
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  padding: 30px;
                  text-align: center;
                  border-radius: 10px;
                  margin: 30px 0;
               }
               .btn {
                  display: inline-block;
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  color: white;
                  padding: 15px 35px;
                  text-decoration: none;
                  border-radius: 25px;
                  font-weight: 600;
                  margin: 20px 0;
                  transition: transform 0.2s;
               }
               .btn:hover {
                  transform: translateY(-2px);
               }
               .features {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 20px;
                  margin: 30px 0;
               }
               .feature {
                  background-color: #f0fdf4;
                  padding: 20px;
                  border-radius: 8px;
                  border-left: 4px solid #10b981;
               }
               .footer {
                  text-align: center;
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #e5e7eb;
                  color: #6b7280;
                  font-size: 14px;
               }
            </style>
         </head>
         <body>
            <div class="container">
               <div class="header">
                  <div class="logo">🌱 Agri-Noria</div>
               </div>

               <div class="welcome">
                  <h2>🎉 Welcome to Agri-Noria!</h2>
                  <p>Your email has been verified successfully</p>
               </div>

               <p>Hello <strong>${name}</strong>,</p>
               
               <p>Congratulations! Your ${userTypeName} account has been successfully created and verified. You're now ready to join our thriving agricultural community.</p>

               <div class="features">
                  <div class="feature">
                     <h4>🛍️ Marketplace</h4>
                     <p>Buy and sell agricultural products directly</p>
                  </div>
                  <div class="feature">
                     <h4>🚚 Logistics</h4>
                     <p>Connect with reliable transport services</p>
                  </div>
                  <div class="feature">
                     <h4>🏪 Storage</h4>
                     <p>Find secure storage facilities</p>
                  </div>
                  <div class="feature">
                     <h4>📚 Training</h4>
                     <p>Learn from agricultural experts</p>
                  </div>
               </div>

               <div style="text-align: center;">
                  <a href="${dashboardUrl}" class="btn">Go to Dashboard</a>
               </div>

               <p>Need help? Our support team is here to assist you at <a href="mailto:support@agri-noria.com">support@agri-noria.com</a></p>

               <div class="footer">
                  <p>Best regards,<br>The Agri-Noria Team</p>
                  <p style="font-size: 12px; margin-top: 20px;">
                     This is an automated message. Please do not reply to this email.
                  </p>
               </div>
            </div>
         </body>
         </html>
      `;
   }

   // Test email configuration
   async testConfiguration() {
      try {
         const testEmail = process.env.EMAIL_TEST_ADDRESS || process.env.EMAIL_USER;
         const result = await this.transporter.sendMail({
            from: `"Test" <${process.env.EMAIL_USER}>`,
            to: testEmail,
            subject: "Email Service Test - Agri-Connect",
            html: "<p>This is a test email to verify the email service configuration.</p>",
         });
         return { success: true, messageId: result.messageId };
      } catch (error) {
         return { success: false, error: error.message };
      }
   }
}

export default new EmailService();
