import { Router } from 'express';
import { z } from 'zod';
import { sendEmail } from '../utils/email';
import { ENV } from '../config/env';

const router = Router();

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  subject: z.string().min(1).max(300),
  message: z.string().min(1).max(5000),
});

router.post('/', async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  const { name, email, subject, message } = parsed.data;

  // Best-effort: sendEmail no-ops when SMTP isn't configured (same fallback as
  // password reset / verification emails), so this never blocks the submission.
  await sendEmail(
    ENV.CONTACT_EMAIL,
    `[Contact] ${subject}`,
    `<p><strong>From:</strong> ${name} (${email})</p><p>${message.replace(/\n/g, '<br>')}</p>`
  ).catch((error) => console.error('Failed to send contact email:', error));

  return res.json({ success: true, data: null, message: 'Message sent' });
});

export default router;
