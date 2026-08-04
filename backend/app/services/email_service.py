import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from backend.app.core.config import settings

def is_smtp_configured() -> bool:
    """Checks if all required SMTP variables are present in the environment."""
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD and settings.SENDER_EMAIL)

def _dispatch_email(to_email: str, subject: str, html_content: str):
    """Helper to send an email via SMTP or print to log in local dev."""
    if not is_smtp_configured():
        print("=" * 60)
        print(f"[Sprint AI Local Dev Email] SMTP not configured.")
        print(f"To: {to_email}")
        print(f"Subject: {subject}")
        print("Body preview / links included in HTML content.")
        print("=" * 60)
        return

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f"{settings.SENDER_NAME} <{settings.SENDER_EMAIL}>"
    msg['To'] = to_email
    msg.attach(MIMEText(html_content, 'html'))

    try:
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()

        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SENDER_EMAIL, to_email, msg.as_string())
        server.quit()
        print(f"[Sprint AI] Successfully sent email '{subject}' to {to_email}")
    except Exception as e:
        print(f"[Sprint AI] Failed to send email via SMTP: {str(e)}")
        raise e

def send_verification_email(email: str, full_name: str, verify_url: str):
    """Sends account email verification link to self-registered user with bulletproof inline styles."""
    subject = "Verify your Sprint AI Account"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0; padding:0; background-color:#f4f7fa; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f7fa; padding: 40px 10px;">
          <tr>
            <td align="center">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.08); overflow:hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background-color:#1e40af; padding:30px 40px; text-align:center;">
                    <h1 style="color:#ffffff; margin:0; font-size:26px; font-weight:700; letter-spacing:-0.5px;">Sprint AI</h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding:40px; color:#374151; font-size:16px; line-height:1.6;">
                    <p style="margin-top:0; font-size:18px; font-weight:600; color:#111827;">Hi {full_name},</p>
                    <p style="margin-bottom:24px; color:#4b5563;">Welcome to Sprint AI! Please confirm your email address by clicking the button below to activate your account and start collaborating.</p>

                    <!-- Button Container -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:30px 0;">
                      <tr>
                        <td align="center">
                          <a href="{verify_url}" target="_blank" style="background-color:#2563eb; color:#ffffff !important; text-decoration:none !important; padding:14px 32px; border-radius:8px; font-weight:bold; font-size:16px; display:inline-block; box-shadow:0 4px 6px rgba(37,99,235,0.25);">
                            <span style="color:#ffffff !important; text-decoration:none !important;">Verify Email Address</span>
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="font-size:13px; color:#6b7280; margin-top:30px; border-top:1px solid #f3f4f6; padding-top:20px;">
                      If the button above does not work, copy and paste this URL into your browser:<br>
                      <a href="{verify_url}" style="color:#2563eb; word-break:break-all;">{verify_url}</a>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color:#f9fafb; padding:20px 40px; text-align:center; border-top:1px solid #f3f4f6;">
                    <p style="margin:0; font-size:12px; color:#9ca3af;">If you did not register for a Sprint AI account, you can safely ignore this email.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """
    
    if not is_smtp_configured():
        print(f"[Sprint AI Local Dev] Verification URL for {email}: {verify_url}")
    _dispatch_email(email, subject, html_content)

def send_invite_email(email: str, full_name: str, password: str, confirm_url: str):
    """Sends invitation email with temporary credentials and bulletproof inline button styles."""
    subject = "You've been invited to Sprint AI!"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0; padding:0; background-color:#f4f7fa; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f7fa; padding: 40px 10px;">
          <tr>
            <td align="center">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.08); overflow:hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background-color:#1e40af; padding:30px 40px; text-align:center;">
                    <h1 style="color:#ffffff; margin:0; font-size:26px; font-weight:700; letter-spacing:-0.5px;">Sprint AI</h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding:40px; color:#374151; font-size:16px; line-height:1.6;">
                    <p style="margin-top:0; font-size:18px; font-weight:600; color:#111827;">Hi {full_name},</p>
                    <p style="margin-bottom:20px; color:#4b5563;">You have been invited to collaborate on a workspace in Sprint AI!</p>
                    <p style="margin-bottom:20px; color:#4b5563;">An account has been created for you with temporary credentials below:</p>

                    <!-- Credentials Box -->
                    <div style="background-color:#f8fafc; padding:20px; border-radius:8px; border:1px solid #e2e8f0; margin:24px 0;">
                      <p style="margin:0 0 8px 0; font-family:monospace; font-size:15px; color:#1e293b;"><strong>Email:</strong> {email}</p>
                      <p style="margin:0; font-family:monospace; font-size:15px; color:#1e293b;"><strong>Temporary Password:</strong> {password}</p>
                    </div>
                    
                    <!-- Button Container -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:30px 0;">
                      <tr>
                        <td align="center">
                          <a href="{confirm_url}" target="_blank" style="background-color:#2563eb; color:#ffffff !important; text-decoration:none !important; padding:14px 32px; border-radius:8px; font-weight:bold; font-size:16px; display:inline-block; box-shadow:0 4px 6px rgba(37,99,235,0.25);">
                            <span style="color:#ffffff !important; text-decoration:none !important;">Confirm Invitation & Log In</span>
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="font-size:13px; color:#6b7280; margin-top:30px; border-top:1px solid #f3f4f6; padding-top:20px;">
                      Or copy and paste this URL into your browser:<br>
                      <a href="{confirm_url}" style="color:#2563eb; word-break:break-all;">{confirm_url}</a>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color:#f9fafb; padding:20px 40px; text-align:center; border-top:1px solid #f3f4f6;">
                    <p style="margin:0; font-size:12px; color:#9ca3af;">If you were not expecting this invitation, you can safely ignore this email.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """

    if not is_smtp_configured():
        print(f"[Sprint AI Local Dev] Invitation Confirmation URL for {email}: {confirm_url}")
    _dispatch_email(email, subject, html_content)

def send_project_added_email(email: str, full_name: str, project_name: str, role: str):
    """Sends an email notification when an existing user is added to a project team."""
    subject = f"You've been added to project '{project_name}' on Sprint AI"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0; padding:0; background-color:#f4f7fa; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f7fa; padding: 40px 10px;">
          <tr>
            <td align="center">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.08); overflow:hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background-color:#1e40af; padding:30px 40px; text-align:center;">
                    <h1 style="color:#ffffff; margin:0; font-size:26px; font-weight:700; letter-spacing:-0.5px;">Sprint AI</h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding:40px; color:#374151; font-size:16px; line-height:1.6;">
                    <p style="margin-top:0; font-size:18px; font-weight:600; color:#111827;">Hi {full_name},</p>
                    <p style="margin-bottom:20px; color:#4b5563;">Great news! You have been added to the project <strong>{project_name}</strong> as a <strong>{role}</strong> team member.</p>

                    <!-- Button Container -->
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:30px 0;">
                      <tr>
                        <td align="center">
                          <a href="{settings.APP_URL.rstrip('/')}" target="_blank" style="background-color:#2563eb; color:#ffffff !important; text-decoration:none !important; padding:14px 32px; border-radius:8px; font-weight:bold; font-size:16px; display:inline-block; box-shadow:0 4px 6px rgba(37,99,235,0.25);">
                            <span style="color:#ffffff !important; text-decoration:none !important;">Open Workspace</span>
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color:#f9fafb; padding:20px 40px; text-align:center; border-top:1px solid #f3f4f6;">
                    <p style="margin:0; font-size:12px; color:#9ca3af;">Sprint AI Team Collaboration</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """

    if not is_smtp_configured():
        print(f"[Sprint AI Local Dev] Project Added email for {email} in project '{project_name}'")
    _dispatch_email(email, subject, html_content)

def send_password_reset_email(email: str, full_name: str, reset_url: str):
    """Sends password reset email with recovery link."""
    subject = "Reset your Sprint AI password"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0; padding:0; background-color:#f4f7fa; font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f7fa; padding: 40px 10px;">
          <tr>
            <td align="center">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.08); overflow:hidden;">
                
                <tr>
                  <td style="background-color:#1e40af; padding:30px 40px; text-align:center;">
                    <h1 style="color:#ffffff; margin:0; font-size:26px; font-weight:700;">Sprint AI</h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:40px; color:#374151; font-size:16px; line-height:1.6;">
                    <p style="margin-top:0; font-size:18px; font-weight:600; color:#111827;">Hi {full_name},</p>
                    <p style="margin-bottom:20px; color:#4b5563;">You requested a password reset for your Sprint AI account. Click the button below to reset your password:</p>

                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:30px 0;">
                      <tr>
                        <td align="center">
                          <a href="{reset_url}" target="_blank" style="background-color:#2563eb; color:#ffffff !important; text-decoration:none !important; padding:14px 32px; border-radius:8px; font-weight:bold; font-size:16px; display:inline-block;">
                            <span style="color:#ffffff !important; text-decoration:none !important;">Reset Password</span>
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="font-size:13px; color:#6b7280; margin-top:30px; border-top:1px solid #f3f4f6; padding-top:20px;">
                      If the button does not work, copy and paste this URL into your browser:<br>
                      <a href="{reset_url}" style="color:#2563eb; word-break:break-all;">{reset_url}</a>
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="background-color:#f9fafb; padding:20px 40px; text-align:center; border-top:1px solid #f3f4f6;">
                    <p style="margin:0; font-size:12px; color:#9ca3af;">If you did not request a password reset, you can safely ignore this email.</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """

    if not is_smtp_configured():
        print(f"[Sprint AI Local Dev] Password Reset URL for {email}: {reset_url}")
    _dispatch_email(email, subject, html_content)

