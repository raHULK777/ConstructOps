import type { Mailer, MailMessage } from '../../src/services/mailer';

/** Captures outbound mail so tests can assert delivery and extract reset links. */
export class CapturingMailer implements Mailer {
  readonly messages: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.messages.push(message);
  }

  get last(): MailMessage | undefined {
    return this.messages[this.messages.length - 1];
  }

  clear(): void {
    this.messages.length = 0;
  }

  /** Extracts the raw reset token from the most recent message. */
  lastResetToken(): string | null {
    const text = this.last?.text ?? '';
    const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(text);
    return match?.[1] ?? null;
  }
}
