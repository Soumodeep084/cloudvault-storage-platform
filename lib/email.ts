import nodemailer from "nodemailer";

type SendVerificationEmailInput = {
  to: string;
  name?: string | null;
  verifyUrl: string;
  expiresInMinutes: number;
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
