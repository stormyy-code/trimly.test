
/**
 * EmailService.ts
 * Upravlja slanjem obavijesti. 
 * Budući da klijent nema domenu, primarni sustav za Auth je Supabase SMTP (Gmail).
 * Ovaj servis služi za dodatne obavijesti brijačima.
 */

export const EmailService = {
  /**
   * Šalje email obavijest.
   * Ako Resend API nije dostupan/verificiran, ispisuje u konzolu (MVP simulacija).
   */
  sendNotification: async (toEmail: string, subject: string, htmlContent: string): Promise<boolean> => {
    const apiKey = process.env.RESEND_API_KEY;
    
    // Ako nema API ključa ili domene, u MVP fazi logiramo obavijest.
    // Prave verifikacijske mailove šalje Supabase putem tvog Gmail SMTP-a.
    if (!apiKey || apiKey.includes('re_123')) {
      console.log('--- EMAIL NOTIFICATION SIMULATION ---');
      console.log(`TO: ${toEmail}`);
      console.log(`SUBJECT: ${subject}`);
      console.log('------------------------------------');
      return true;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: 'Trimly Zagreb <onboarding@resend.dev>', // Resend dopušta samo ovo bez domene
          to: [toEmail],
          subject: subject,
          html: htmlContent,
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('[EmailService Error]:', error);
      return false;
    }
  },

  /**
   * Obavijest brijaču o novom zahtjevu.
   */
  notifyBarberNewBooking: async (barberEmail: string, clientName: string, time: string, date: string) => {
    const html = `
      <div style="font-family: sans-serif; padding: 20px; background: #000; color: #fff; border-radius: 10px;">
        <h2 style="color: #D4AF37;">Novi zahtjev: ${clientName}</h2>
        <p>Vrijeme: <strong>${date} u ${time}h</strong></p>
        <p>Provjerite Trimly aplikaciju za potvrdu.</p>
      </div>
    `;
    return EmailService.sendNotification(barberEmail, 'Trimly | Novi zahtjev', html);
  }
};
