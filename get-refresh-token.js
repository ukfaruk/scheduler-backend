/**
 * get-refresh-token.js
 * Esegui questo script UNA SOLA VOLTA per ottenere il refresh_token.
 * 
 * Uso: node get-refresh-token.js
 */

const { google } = require('googleapis');
const readline = require('readline');
require('dotenv').config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.send',
];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

console.log('\n=== PASSO 1 ===');
console.log('Apri questo URL nel browser e autorizza l\'app:\n');
console.log(authUrl);
console.log('\n=== PASSO 2 ===');
console.log('Dopo l\'autorizzazione, copia il codice dalla barra degli indirizzi');
console.log('(il parametro "code=..." nell\'URL di redirect)\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Incolla qui il codice di autorizzazione: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oAuth2Client.getToken(decodeURIComponent(code));
    console.log('\n=== PASSO 3 ===');
    console.log('✅ Copia queste variabili nel tuo file .env:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    if (tokens.access_token) {
      console.log(`\n(Access token — non serve nel .env, si rigenera automaticamente)`);
    }
  } catch (err) {
    console.error('Errore nel recupero del token:', err.message);
  }
});
