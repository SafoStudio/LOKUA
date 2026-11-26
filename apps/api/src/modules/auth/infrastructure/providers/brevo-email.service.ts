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
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      auth: {
        user: env.BREVO_SMTP_USER,
        pass: env.BREVO_SMTP_KEY
      }
    });
  }

  async sendNotificationEmail(params: {
    to: string;
    title: string;
    message: string;
  }): Promise<void> {
    await this.transporter.sendMail({
      from: `"LOKUA" <${env.BREVO_SENDER_EMAIL}>`,
      to: params.to,
      subject: params.title,
      text: params.message
    });
  }

  async sendVerificationEmail(params: { to: string; name: string; token: string }): Promise<void> {
    const verifyUrl = `${env.APP_URL}/api/v1/auth/verify-email?token=${encodeURIComponent(params.token)}`;

    await this.transporter.sendMail({
      from: `"LOKUA" <${env.BREVO_SENDER_EMAIL}>`,
      to: params.to,
      subject: 'Підтвердьте електронну пошту',
      html: `
        <p>Вітаємо, ${escapeHtml(params.name)}!</p>
        <p>Підтвердьте електронну пошту за посиланням:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>Посилання дійсне 24 години. Якщо ви не реєструвалися, проігноруйте цей лист.</p>
      `
    });
  }

  async sendPasswordResetEmail(params: { to: string; name: string; token: string }): Promise<void> {
    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(params.token)}`;

    await this.transporter.sendMail({
      from: `"LOKUA" <${env.BREVO_SENDER_EMAIL}>`,
      to: params.to,
      subject: 'Скиньте пароль',
      html: `
        <p>Вітаємо, ${escapeHtml(params.name)}!</p>
        <p>Щоб скинути пароль, перейдіть за посиланням:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Посилання дійсне 1 годину. Якщо ви не просили скинути пароль, проігноруйте цей лист.</p>
      `
    });
  }
}
