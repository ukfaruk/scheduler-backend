const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Google Auth ───────────────────────────────────────────────────────────────
function getOAuthClient() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return oAuth2Client;
}

// ─── Nodemailer via Gmail ──────────────────────────────────────────────────────
async function getMailTransporter() {
  const oAuth2Client = getOAuthClient();
  const accessTokenObj = await oAuth2Client.getAccessToken();
  const accessToken = accessTokenObj.token;

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GOOGLE_EMAIL,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      accessToken,
    },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAYS_FULL = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];

function humanDate(isoDate, slot) {
  const d = new Date(isoDate + 'T00:00:00');
  const gg = DAYS_FULL[d.getDay()];
  return `${gg.charAt(0).toUpperCase()}${gg.slice(1)} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ore ${slot}`;
}

function buildStartEnd(dateStr, slot) {
  const [h, m] = slot.split(':').map(Number);
  const endM = m + 30;
  const endH = endM >= 60 ? h + 1 : h;
  const endMin = endM >= 60 ? endM - 60 : endM;
  const pad = n => String(n).padStart(2, '0');
  const startISO = `${dateStr}T${pad(h)}:${pad(m)}:00`;
  const endISO   = `${dateStr}T${pad(endH)}:${pad(endMin)}:00`;
  return { startISO, endISO };
}

// ─── Email templates ──────────────────────────────────────────────────────────
function emailUser(nome, humanDT, type, sede, sedeAddr, meetLink, note) {
  const modeRow = type === 'meet'
    ? `<tr><td style="padding:8px 0;color:#666;font-size:13px;">Modalità</td><td style="font-weight:500;">Videochiamata Google Meet</td></tr>`
    : `<tr><td style="padding:8px 0;color:#666;font-size:13px;">Sede</td><td style="font-weight:500;">${sede} — ${sedeAddr}</td></tr>`;
  const meetSection = type === 'meet' && meetLink
    ? `<div style="background:#E1F5EE;border-left:4px solid #1D9E75;padding:14px 16px;border-radius:6px;margin:16px 0;">
        <strong style="color:#0F6E56;">Link videochiamata:</strong><br>
        <a href="${meetLink}" style="color:#1D9E75;font-size:15px;">${meetLink}</a>
       </div>`
    : `<div style="background:#FAEEDA;border-left:4px solid #BA7517;padding:14px 16px;border-radius:6px;margin:16px 0;">
        <strong style="color:#854F0B;">Luogo:</strong> ${sede}<br>
        <span style="color:#854F0B;font-size:13px;">${sedeAddr}</span>
       </div>`;
  const noteSection = note ? `<p><em>Le tue note:</em> ${note}</p>` : '';
  return `<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:28px;background:#fff;border-radius:8px;">
    <div style="background:#1D9E75;padding:18px 24px;border-radius:6px;margin-bottom:24px;">
      <h2 style="color:#fff;margin:0;font-size:20px;">✓ Appuntamento confermato</h2>
    </div>
    <p>Ciao <strong>${nome}</strong>,</p>
    <p>Il tuo appuntamento è stato confermato con successo.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9f9f9;border-radius:6px;padding:4px;">
      <tr><td style="padding:8px 12px;color:#666;font-size:13px;">Data e ora</td><td style="padding:8px 12px;font-weight:500;">${humanDT}</td></tr>
      ${modeRow}
    </table>
    ${meetSection}
    ${noteSection}
    <div style="background:#E6F1FB;border-radius:6px;padding:12px 16px;font-size:13px;color:#185FA5;margin-top:16px;">
      🔔 Riceverai promemoria <strong>24 ore</strong> e <strong>1 ora</strong> prima dell'appuntamento.
    </div>
    <p style="font-size:12px;color:#999;margin-top:24px;border-top:1px solid #eee;padding-top:16px;">
      Per modifiche o cancellazioni rispondi a questa email.<br>
      Dati trattati ai sensi del GDPR.
    </p>
  </div>`;
}

function emailAdmin(nome, email, tel, humanDT, type, sede, sedeAddr, meetLink, note) {
  const meetSection = type === 'meet' && meetLink
    ? `<tr><td style="padding:6px 12px;color:#666;font-size:13px;">Meet</td><td style="padding:6px 12px;"><a href="${meetLink}">${meetLink}</a></td></tr>`
    : `<tr><td style="padding:6px 12px;color:#666;font-size:13px;">Sede</td><td style="padding:6px 12px;font-weight:500;">${sede}</td></tr>`;
  return `<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:28px;">
    <div style="background:#185FA5;padding:16px 22px;border-radius:6px;margin-bottom:20px;">
      <h2 style="color:#fff;margin:0;font-size:18px;">📅 Nuovo appuntamento prenotato</h2>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#f9f9f9;border-radius:6px;">
      <tr><td style="padding:8px 12px;color:#666;font-size:13px;">Paziente</td><td style="padding:8px 12px;font-weight:500;">${nome}</td></tr>
      <tr><td style="padding:8px 12px;color:#666;font-size:13px;">Email</td><td style="padding:8px 12px;">${email}</td></tr>
      ${tel ? `<tr><td style="padding:8px 12px;color:#666;font-size:13px;">Telefono</td><td style="padding:8px 12px;">${tel}</td></tr>` : ''}
      <tr><td style="padding:8px 12px;color:#666;font-size:13px;">Data e ora</td><td style="padding:8px 12px;font-weight:500;">${humanDT}</td></tr>
      <tr><td style="padding:8px 12px;color:#666;font-size:13px;">Modalità</td><td style="padding:8px 12px;">${type === 'meet' ? 'Videochiamata' : 'In presenza'}</td></tr>
      ${meetSection}
      ${note ? `<tr><td style="padding:8px 12px;color:#666;font-size:13px;">Note</td><td style="padding:8px 12px;font-style:italic;">${note}</td></tr>` : ''}
    </table>
  </div>`;
}

function emailReminder(nome, humanDT, type, sede, sedeAddr, meetLink, when) {
  const whenLabel = when === '24h' ? '24 ore' : '1 ora';
  const locationBlock = type === 'meet' && meetLink
    ? `<p>🎥 <strong>Link Meet:</strong> <a href="${meetLink}">${meetLink}</a></p>`
    : `<p>📍 <strong>Luogo:</strong> ${sede} — ${sedeAddr}</p>`;
  return `<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;padding:28px;">
    <div style="background:#854F0B;padding:16px 22px;border-radius:6px;margin-bottom:20px;">
      <h2 style="color:#fff;margin:0;font-size:18px;">⏰ Promemoria — tra ${whenLabel}</h2>
    </div>
    <p>Ciao <strong>${nome}</strong>,</p>
    <p>Ti ricordiamo che hai un appuntamento <strong>tra ${whenLabel}</strong>:</p>
    <div style="background:#f9f9f9;border-radius:6px;padding:14px 18px;margin:16px 0;">
      <p style="margin:0;font-size:16px;font-weight:600;">${humanDT}</p>
    </div>
    ${locationBlock}
    <p style="font-size:12px;color:#999;margin-top:24px;">Per cancellare o spostare l'appuntamento, rispondi a questa email.</p>
  </div>`;
}

// ─── ROUTE: GET /busy  ─────────────────────────────────────────────────────────
// Restituisce gli slot occupati per un mese dato (?year=2025&month=5)
app.get('/busy', async (req, res) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year), m = parseInt(month);
    const tMin = new Date(y, m, 1).toISOString();
    const tMax = new Date(y, m + 1, 0, 23, 59, 59).toISOString();

    const auth = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const eventsRes = await calendar.events.list({
      calendarId: 'primary',
      timeMin: tMin,
      timeMax: tMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 500,
    });

    const busy = (eventsRes.data.items || [])
      .filter(ev => ev.status !== 'cancelled')
      .map(ev => ({
        start: ev.start.dateTime || ev.start.date,
        end: ev.end.dateTime || ev.end.date,
        summary: ev.summary || '',
      }));

    res.json({ busy });
  } catch (err) {
    console.error('GET /busy error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── ROUTE: POST /book ─────────────────────────────────────────────────────────
app.post('/book', async (req, res) => {
  try {
    const { nome, email, tel, note, date, slot, type, sede, sedeAddr } = req.body;
    const ADMIN = process.env.ADMIN_EMAIL || 'ugofaraguna@gmail.com';

    if (!nome || !email || !date || !slot || !type) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti' });
    }

    const humanDT = humanDate(date, slot);
    const { startISO, endISO } = buildStartEnd(date, slot);
    const isMeet = type === 'meet';

    // 1. Crea evento Google Calendar ───────────────────────────────────────────
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const eventBody = {
      summary: `Appuntamento — ${nome}`,
      description: `Paziente: ${nome}\nEmail: ${email}${tel ? '\nTel: ' + tel : ''}${note ? '\nNote: ' + note : ''}\nModalità: ${isMeet ? 'Videochiamata' : 'In presenza — ' + sede}`,
      location: isMeet ? 'Google Meet' : (sedeAddr || sede),
      start: { dateTime: startISO, timeZone: 'Europe/Rome' },
      end:   { dateTime: endISO,   timeZone: 'Europe/Rome' },
      attendees: [{ email }, { email: ADMIN }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 1440 }, // 24h
          { method: 'email', minutes: 60 },   // 1h
          { method: 'popup', minutes: 60 },
        ],
      },
      conferenceData: isMeet ? {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      } : undefined,
    };

    const calRes = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: isMeet ? 1 : 0,
      sendUpdates: 'all',
      resource: eventBody,
    });

    const calEvent = calRes.data;
    let meetLink = null;
    if (isMeet) {
      meetLink = calEvent.hangoutLink
        || calEvent.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri
        || null;
    }

    // 2. Invia email di conferma ────────────────────────────────────────────────
    const transporter = await getMailTransporter();

    await transporter.sendMail({
      from: `"Scheduler Appuntamenti" <${process.env.GOOGLE_EMAIL}>`,
      to: email,
      subject: `Appuntamento confermato — ${humanDT}`,
      html: emailUser(nome, humanDT, type, sede, sedeAddr, meetLink, note),
    });

    await transporter.sendMail({
      from: `"Scheduler Appuntamenti" <${process.env.GOOGLE_EMAIL}>`,
      to: ADMIN,
      subject: `[Nuovo appuntamento] ${nome} — ${humanDT}`,
      html: emailAdmin(nome, email, tel, humanDT, type, sede, sedeAddr, meetLink, note),
    });

    // 3. Schedula promemoria 24h ────────────────────────────────────────────────
    const apptTime = new Date(`${date}T${slot.replace(':', ':')}:00+02:00`).getTime();
    const now = Date.now();
    const delay24 = apptTime - 24 * 60 * 60 * 1000 - now;
    const delay1  = apptTime - 60 * 60 * 1000 - now;

    async function sendReminder(when) {
      try {
        const t2 = await getMailTransporter();
        const whenLabel = when === '24h' ? '24 ore' : '1 ora';
        await t2.sendMail({
          from: `"Scheduler Appuntamenti" <${process.env.GOOGLE_EMAIL}>`,
          to: email,
          subject: `Promemoria — Il tuo appuntamento è tra ${whenLabel}`,
          html: emailReminder(nome, humanDT, type, sede, sedeAddr, meetLink, when),
        });
        await t2.sendMail({
          from: `"Scheduler Appuntamenti" <${process.env.GOOGLE_EMAIL}>`,
          to: ADMIN,
          subject: `[Promemoria] ${nome} — tra ${whenLabel}`,
          html: emailReminder(nome, humanDT, type, sede, sedeAddr, meetLink, when),
        });
        console.log(`Promemoria ${when} inviato a ${email} e ${ADMIN}`);
      } catch (e) {
        console.error(`Errore promemoria ${when}:`, e.message);
      }
    }

    if (delay24 > 0) setTimeout(() => sendReminder('24h'), delay24);
    else console.log('Appuntamento < 24h: promemoria 24h saltato');

    if (delay1 > 0) setTimeout(() => sendReminder('1h'), delay1);
    else console.log('Appuntamento < 1h: promemoria 1h saltato');

    res.json({
      success: true,
      meetLink,
      eventId: calEvent.id,
      humanDT,
      reminder24: delay24 > 0 ? new Date(now + delay24).toISOString() : null,
      reminder1:  delay1  > 0 ? new Date(now + delay1).toISOString()  : null,
    });

  } catch (err) {
    console.error('POST /book error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', service: 'scheduler-api' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Scheduler API in ascolto su porta ${PORT}`));
