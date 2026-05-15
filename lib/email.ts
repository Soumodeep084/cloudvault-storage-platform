import nodemailer from "nodemailer";

type SendVerificationEmailInput = {
  to: string;
  name?: string | null;
  verifyUrl: string;
  expiresInMinutes: number;
};

type SendDeletionOtpEmailInput = {
  to: string;
  name?: string | null;
  otp: string | undefined;
  expiresInMinutes: number;
};

type SendRestoreOtpEmailInput = {
  to: string;
  name?: string | null;
  otp: string | undefined;
  expiresInMinutes: number;
};

type SendDeletionScheduledEmailInput = {
  to: string;
  name?: string | null;
  scheduledFor: Date;
};

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function getTransporter() {
  const user = getRequiredEnv("GMAIL_USER");
  const pass = getRequiredEnv("GMAIL_APP_PASSWORD");

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

function buildVerificationEmailHtml(name: string | null | undefined, verifyUrl: string, expiresInMinutes: number) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const signature = process.env.EMAIL_SIGNATURE || "- CloudVault Team";
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <p>${greeting}</p>
      <p>Thanks for creating a CloudVault account. Please verify your email address to activate your account.</p>
      <p>
        <a href="${verifyUrl}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 6px;">
          Verify Email
        </a>
      </p>
      <p>This verification link expires in ${expiresInMinutes} minutes.</p>
      <p>If you did not create this account, you can safely ignore this message.</p>
      <p style="color: #b91c1c; font-weight: 600;">This is a system-generated email. Please do not reply.</p>
      <p>${signature}</p>
    </div>
  `;
}

function buildVerificationEmailText(verifyUrl: string, expiresInMinutes: number) {
  const signature = process.env.EMAIL_SIGNATURE || "- CloudVault Team";
  return [
    "Thanks for creating a CloudVault account.",
    "",
    `Verify your email using this link (expires in ${expiresInMinutes} minutes):`,
    verifyUrl,
    "",
    "If you did not create this account, you can safely ignore this message.",
    signature,
  ].join("\n");
}

function buildDeletionOtpEmailHtml(name: string | null | undefined, otp: string | undefined, expiresInMinutes: number) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const signature = process.env.EMAIL_SIGNATURE || "- CloudVault Team";
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <p>${greeting}</p>
      <p>We received a request to delete your CloudVault account.</p>
      <p>
        Use this one-time code to confirm the deletion request:
        <strong style="display: inline-block; margin-left: 6px; font-size: 18px; letter-spacing: 2px;">${otp}</strong>
      </p>
      <p>This code expires in ${expiresInMinutes} minutes.</p>
      <p>If you did not request this, you can ignore this email and your account will remain active.</p>
      <p style="color: #b91c1c; font-weight: 600;">This is a system-generated email. Please do not reply.</p>
      <p>${signature}</p>
    </div>
  `;
}

function buildDeletionOtpEmailText(otp: string | undefined, expiresInMinutes: number) {
  const signature = process.env.EMAIL_SIGNATURE || "- CloudVault Team";
  return [
    "We received a request to delete your CloudVault account.",
    "",
    `Use this one-time code to confirm the deletion request (expires in ${expiresInMinutes} minutes):`,
    otp,
    "",
    "If you did not request this, you can ignore this email and your account will remain active.",
    signature,
  ].join("\n");
}

function buildRestoreOtpEmailHtml(name: string | null | undefined, otp: string | undefined, expiresInMinutes: number) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const signature = process.env.EMAIL_SIGNATURE || "- CloudVault Team";
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <p>${greeting}</p>
      <p>We received a request to restore your CloudVault account.</p>
      <p>
        Use this one-time code to continue the restore process:
        <strong style="display: inline-block; margin-left: 6px; font-size: 18px; letter-spacing: 2px;">${otp}</strong>
      </p>
      <p>This code expires in ${expiresInMinutes} minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <p style="color: #b91c1c; font-weight: 600;">This is a system-generated email. Please do not reply.</p>
      <p>${signature}</p>
    </div>
  `;
}

function buildRestoreOtpEmailText(otp: string | undefined, expiresInMinutes: number) {
  const signature = process.env.EMAIL_SIGNATURE || "- CloudVault Team";
  return [
    "We received a request to restore your CloudVault account.",
    "",
    `Use this one-time code to continue the restore process (expires in ${expiresInMinutes} minutes):`,
    otp,
    "",
    "If you did not request this, you can safely ignore this email.",
    signature,
  ].join("\n");
}

function buildDeletionScheduledEmailHtml(
  name: string | null | undefined,
  scheduledFor: Date,
  supportEmail: string,
) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const signature = process.env.EMAIL_SIGNATURE || "- CloudVault Team";
  const dateText = scheduledFor.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <p>${greeting}</p>
      <p>Your CloudVault account has been scheduled for deletion.</p>
      <p><strong>Scheduled deletion:</strong> ${dateText}</p>
      <p>If this was a mistake, please contact us before the scheduled date to recover your account.</p>
      <p>Support: <a href="mailto:${supportEmail}">${supportEmail}</a></p>
      <p style="color: #b91c1c; font-weight: 600;">This is a system-generated email. Please do not reply.</p>
      <p>${signature}</p>
    </div>
  `;
}

function buildDeletionScheduledEmailText(scheduledFor: Date, supportEmail: string) {
  const signature = process.env.EMAIL_SIGNATURE || "- CloudVault Team";
  const dateText = scheduledFor.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return [
    "Your CloudVault account has been scheduled for deletion.",
    `Scheduled deletion: ${dateText}`,
    "If this was a mistake, please contact us before the scheduled date to recover your account.",
    `Support: ${supportEmail}`,
    signature,
  ].join("\n");
}

export async function sendVerificationEmail({
  to,
  name,
  verifyUrl,
  expiresInMinutes,
}: SendVerificationEmailInput) {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || process.env.GMAIL_USER || "CloudVault <no-reply@cloudvault.app>";

  await transporter.sendMail({
    from,
    to,
    subject: "Verify your CloudVault email address",
    text: buildVerificationEmailText(verifyUrl, expiresInMinutes),
    html: buildVerificationEmailHtml(name, verifyUrl, expiresInMinutes),
  });
}

export async function sendDeletionOtpEmail({
  to,
  name,
  otp,
  expiresInMinutes,
}: SendDeletionOtpEmailInput) {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || process.env.GMAIL_USER || "CloudVault <no-reply@cloudvault.app>";

  await transporter.sendMail({
    from,
    to,
    subject: "CloudVault account deletion code",
    text: buildDeletionOtpEmailText(otp, expiresInMinutes),
    html: buildDeletionOtpEmailHtml(name, otp, expiresInMinutes),
  });
}

export async function sendRestoreOtpEmail({
  to,
  name,
  otp,
  expiresInMinutes,
}: SendRestoreOtpEmailInput) {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || process.env.GMAIL_USER || "CloudVault <no-reply@cloudvault.app>";

  await transporter.sendMail({
    from,
    to,
    subject: "CloudVault account restore code",
    text: buildRestoreOtpEmailText(otp, expiresInMinutes),
    html: buildRestoreOtpEmailHtml(name, otp, expiresInMinutes),
  });
}

export async function sendDeletionScheduledEmail({
  to,
  name,
  scheduledFor,
}: SendDeletionScheduledEmailInput) {
  const transporter = getTransporter();
  const from = process.env.EMAIL_FROM || process.env.GMAIL_USER || "CloudVault <no-reply@cloudvault.app>";
  const supportEmail =
    process.env.EMAIL_SUPPORT || process.env.EMAIL_FROM || process.env.GMAIL_USER || "support@cloudvault.app";

  await transporter.sendMail({
    from,
    to,
    subject: "Your CloudVault account is scheduled for deletion",
    text: buildDeletionScheduledEmailText(scheduledFor, supportEmail),
    html: buildDeletionScheduledEmailHtml(name, scheduledFor, supportEmail),
  });
}
