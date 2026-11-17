export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/**
 * Náhradný mailer na vývoj: správu len vypíše. Služba na odosielanie e-mailov
 * ešte nie je vybraná; skutočný mailer bude druhá implementácia tohto rozhrania.
 */
export const logMailer: Mailer = {
  async send(mail) {
    console.log(`\n--- E-mail pre ${mail.to} ---\nPredmet: ${mail.subject}\n\n${mail.text}\n---`);
  },
};
