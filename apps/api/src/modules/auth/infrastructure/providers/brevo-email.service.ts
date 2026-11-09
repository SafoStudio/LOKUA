import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailService } from '../../application/index.js';
import { env } from '../../../../config/env.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class BrevoEmailService implements EmailService {
  private readonly transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: env.BREVO_SMTP_USER,
        pass: env.BREVO_SMTP_KEY
      }
    });
  }

  async sendVerificationEmail(params: { to: string; name: string; token: string }): Promise<void> {
    const verifyUrl = `${env.APP_URL}/api/v1/auth/verify-email?token=${encodeURIComponent(params.token)}`;

    await this.transporter.sendMail({
      from: `"LOKUA" <${env.BREVO_SENDER_EMAIL}>`,
      to: params.to,
      subject: 'Confirm your email',
      html: `
        <p>Hello, ${escapeHtml(params.name)}!</p>
        <p>Confirm your email by following the link:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>The link is valid for 24 hours. If you did not register, simply ignore this email.</p>
      `
    });
  }

  async sendPasswordResetEmail(params: { to: string; name: string; token: string }): Promise<void> {
    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(params.token)}`;

    await this.transporter.sendMail({
      from: `"LOKUA" <${env.BREVO_SENDER_EMAIL}>`,
      to: params.to,
      subject: 'Reset your password',
      html: `
        <p>Hello, ${escapeHtml(params.name)}!</p>
        <p>To reset your password, follow the link:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>The link is valid for 1 hour. If you did not request a password reset, simply ignore this email.</p>
      `
    });
  }
}
