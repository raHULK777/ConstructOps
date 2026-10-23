import type { Logger } from '../utils/logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export type MailTransport = 'console' | 'none';

/**
 * Transactional email is out of scope for v1 (SRS.md), so this template ships a
 * console transport: the message — including the reset link — is written to the
 * service log. Replace this with a real provider before exposing password reset
 * to real customers, and set MAIL_TRANSPORT=none (or a new transport) in
 * production so tokens never land in production logs.
 */
export function createMailer(transport: MailTransport, logger: Logger): Mailer {
  return {
    async send(message: MailMessage): Promise<void> {
      if (transport === 'none') {
        logger.warn('Email transport disabled; message dropped', {
          to: message.to,
          subject: message.subject,
        });
        return;
      }
      logger.info('Outbound email (console transport)', {
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
    },
  };
}
