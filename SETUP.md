# 📅 Scheduler Appuntamenti — Guida al Deploy

Questo scheduler funziona con **Google Calendar** (slot reali) e **Gmail** (email di conferma + promemoria).
L'intero setup richiede circa **20 minuti**.

---

## Struttura del progetto

```
scheduler-app/
├── backend/
│   ├── server.js              ← Server Node.js (API)
│   ├── package.json
│   ├── .env.example           ← Template variabili d'ambiente
│   └── get-refresh-token.js   ← Script per ottenere il refresh token
└── frontend/
    └── index.html             ← Form da caricare ovunque
```

---

## PASSO 1 — Crea il progetto su Google Cloud

1. Vai su **https://console.cloud.google.com**
2. Crea un nuovo progetto (es. "Scheduler Appuntamenti")
3. Dal menu laterale → **API e servizi** → **Libreria**
4. Abilita queste due API (cercale per nome):
   - ✅ **Google Calendar API**
   - ✅ **Gmail API**

---

## PASSO 2 — Crea le credenziali OAuth2

1. Vai su **API e servizi** → **Credenziali**
2. Clicca **Crea credenziali** → **ID client OAuth**
3. Tipo applicazione: **Applicazione web**
4. Nome: `Scheduler App`
5. In **URI di reindirizzamento autorizzati** aggiungi:
   ```
   https://developers.google.com/oauthplayground
   ```
6. Clicca **Crea**
7. Copia e salva:
   - `Client ID` → sarà `GOOGLE_CLIENT_ID`
   - `Client Secret` → sarà `GOOGLE_CLIENT_SECRET`

> ⚠️ Se vedi "App non verificata" durante i test, clicca "Avanzate" → "Vai a Scheduler App (non sicuro)". È normale per app in sviluppo.

---

## PASSO 3 — Ottieni il Refresh Token

1. Vai su **https://developers.google.com/oauthplayground**
2. In alto a destra clicca l'**icona ⚙️** (impostazioni OAuth)
3. Spunta **"Use your own OAuth credentials"**
4. Inserisci il tuo `Client ID` e `Client Secret`
5. Nel pannello sinistro, trova e seleziona:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/gmail.send`
6. Clicca **Authorize APIs** → autorizza con l'account `ugofaraguna@gmail.com`
7. Clicca **Exchange authorization code for tokens**
8. Copia il valore di **Refresh token** → sarà `GOOGLE_REFRESH_TOKEN`

---

## PASSO 4 — Deploy del Backend su Railway (gratuito)

Railway è il modo più semplice per mettere online il backend. Piano gratuito sufficiente.

### 4a. Prepara il repository

```bash
cd scheduler-app/backend
git init
git add .
git commit -m "first commit"
```

Poi crea un repository su **https://github.com/new** e carica il codice:

```bash
git remote add origin https://github.com/TUO-USERNAME/scheduler-backend.git
git push -u origin main
```

### 4b. Crea il servizio su Railway

1. Vai su **https://railway.app** → Sign up con GitHub
2. **New Project** → **Deploy from GitHub repo**
3. Seleziona il tuo repository `scheduler-backend`
4. Railway rileva automaticamente Node.js e fa il deploy

### 4c. Aggiungi le variabili d'ambiente

1. Nel progetto Railway, vai su **Variables**
2. Aggiungi una per una:

| Variabile | Valore |
|-----------|--------|
| `GOOGLE_CLIENT_ID` | Il tuo client ID |
| `GOOGLE_CLIENT_SECRET` | Il tuo client secret |
| `GOOGLE_REDIRECT_URI` | `https://developers.google.com/oauthplayground` |
| `GOOGLE_REFRESH_TOKEN` | Il refresh token ottenuto al passo 3 |
| `GOOGLE_EMAIL` | `ugofaraguna@gmail.com` |
| `ADMIN_EMAIL` | `ugofaraguna@gmail.com` |

3. Il server si riavvia automaticamente
4. Vai su **Settings** → copia il tuo URL pubblico, es: `https://scheduler-backend-production.up.railway.app`

---

## PASSO 5 — Configura il Frontend

Apri `frontend/index.html` e trova questa riga (vicino alla fine, nello script):

```javascript
const API_BASE = '...' || 'https://IL-TUO-BACKEND.railway.app';
```

Sostituisci con il tuo URL Railway:

```javascript
const API_BASE = 'https://scheduler-backend-production.up.railway.app';
```

---

## PASSO 6 — Pubblica il Frontend

Il frontend è un semplice file HTML — puoi pubblicarlo ovunque:

### Opzione A — Netlify Drop (più veloce, 1 minuto)
1. Vai su **https://app.netlify.com/drop**
2. Trascina la cartella `frontend/` nella pagina
3. Ottieni subito un URL pubblico tipo `https://mio-scheduler.netlify.app`

### Opzione B — Aggiungi a un sito esistente
Carica `index.html` nella cartella del tuo sito. Funziona su qualsiasi hosting (WordPress, Squarespace, server FTP, ecc.)

### Opzione C — GitHub Pages
1. Sposta `index.html` nella root di un repo GitHub
2. Vai su Settings → Pages → Branch: main
3. URL: `https://TUO-USERNAME.github.io/NOME-REPO/`

---

## PASSO 7 — Configura CORS (se necessario)

Se il frontend è su un dominio diverso dal backend, aggiungi il tuo dominio in `server.js`:

```javascript
// Riga attuale (accetta tutto):
app.use(cors());

// Sostituisci con (più sicuro):
app.use(cors({ origin: ['https://tuo-sito.com', 'https://mio-scheduler.netlify.app'] }));
```

Poi fai git push — Railway aggiornerà automaticamente.

---

## Come funziona il sistema

```
Utente compila il form
        │
        ▼
GET /busy → legge Google Calendar → mostra slot liberi
        │
        ▼ (conferma)
POST /book
  ├── Crea evento Google Calendar (con Meet se videochiamata)
  ├── Invia email conferma → utente
  ├── Invia email notifica → ugofaraguna@gmail.com
  ├── setTimeout(24h) → email promemoria a entrambi
  └── setTimeout(1h)  → email promemoria a entrambi
```

> **Nota sui promemoria:** I `setTimeout` funzionano finché il server è attivo.
> Per un sistema più robusto in produzione, considera Google Cloud Tasks o un cron job.
> Railway mantiene il server sempre attivo anche sul piano gratuito.

---

## Test rapido

Dopo il deploy, verifica che il backend risponda:

```
https://IL-TUO-URL.railway.app/
→ {"status":"ok","service":"scheduler-api"}

https://IL-TUO-URL.railway.app/busy?year=2025&month=5
→ {"busy":[...eventi del calendario...]}
```

---

## Problemi comuni

| Problema | Soluzione |
|----------|-----------|
| `invalid_grant` | Il refresh token è scaduto — ripeti il Passo 3 |
| CORS error nel browser | Aggiungi il dominio del frontend alla config CORS |
| Email non arrivano | Verifica che l'API Gmail sia abilitata e che `GOOGLE_EMAIL` sia corretto |
| Slot sempre tutti liberi | Controlla i log Railway — probabile errore di autenticazione |
| `Cannot find module` | Esegui `npm install` nella cartella backend |

---

## Supporto

Per qualsiasi problema, controlla i log in Railway → **Deployments** → **View logs**.
