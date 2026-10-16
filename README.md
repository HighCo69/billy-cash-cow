# Billy's Stables

Erstelle eine vollständige, mobile-first Web-App für Gruppenkassen, WG-Konten und Urlaubsausgaben mit dem Namen "BILLY – The Friendly Cash Cow".

---

### 1. BRANDING, DESIGN & TONALITÄT (Basierend auf den Design-Spezifikationen)

- **App-Name:** BILLY – The Friendly Cash Cow

- **Farbpalette:** Warmes Sonnengelb (#FFD043 / Gelb-Töne), Schwarz, Weiß und dezentes Hellgrau.

- **Tonalität & Wortschatz:**

  - Login-Button: "Hinein in den Stall"

  - Registrierungs-Aufforderung: "Wie soll dein Name sein, Pursche/Magd?"

  - Gruppen / Projekte: Heißen durchgehend "Kostenställe" (z. B. "Ballermanntrip", "WG", "Wacken").

  - Dashboard-Überschrift: "Deine Kontoställe"

  - Bestätigungs-Buttons: Rundes Gelb-Schwarzes Icon mit "(¥€$)" und dem Text "Alles korrekt?".

  - Passworteingabe: "Damit nicht du gemolken wirst, wähle ein sicheres Passwort."

---

### 2. CORE USER FLOWS & SCREEN-STRUKTUR

#### Screen A: Landing & Authentifizierung ("Hinein in den Stall")

- Slogan: "Lieber Geld wie Heu als dumm wie Stroh."

- Subline: "Ausgaben unter Freunden. EINFACH. FAIR. VERWALTEN."

- Formular für Login ("Zu deinen Kontoställen?") & Registrierung für neue Nutzer (Name, E-Mail/Mobilnummer, Passwort).

- Profil-Felder für PayPal.Me-Handle oder wero-ID hinterlegen.

#### Screen B: Das Dashboard ("Deine Kontoställe")

- Raster / Liste aller aktiven "Kostenställe" des Nutzers (z. B. WG, Ballermanntrip, Wacken, Alex' Geburtstag).

- Buttons: "Neuen Kostenstall anlegen" & "Neuem Kostenstall beitreten".

#### Screen C: Kostenstall anlegen / beitreten

- **Anlegen:** Name des Kostenstalls, optionales Foto (max. 200x200 px), Teilnehmer hinzufügen (bis zu 12 Personen).

- **Beitreten:** Eingabe der E-Mail des Einladenden + Name des Kostenstalls.

#### Screen D: Ausgabe erfassen

- **Eingabefelder:**

  - Betrag (€)

  - Grund / Kategorie-Buttons mit Details-Feld:

    - [Einkauf] (Details: z. B. Ort)

    - [Taxi / Uber] (Details: z. B. Strecke)

    - [Eintritt] (Details: z. B. Location)

    - [Essen] (Details: z. B. Location)

    - [Kneipe] (Details: z. B. Location)

    - Button: "Weiteren Kostenpunkt ergänzen"

  - Bezahlt für: Radio-Buttons für "alle" ODER Checkboxen für spezifische User ("User 1", "User 2", etc.).

  - Datum: Voreingestellt auf das heutige Tagesdatum.

---

### 3. LOGIK: VALIDIERUNGS-WORKFLOW & ORDNER "UNKLAR"

1. Wenn Nutzer A eine Ausgabe für Nutzer B einträgt, erhält B eine Benachrichtigung.

2. **Akzeptieren:** Die Forderung fließt fest in das Konto und die Saldoberechnung ein.

3. **Widerspruch:** Die Forderung wird nicht verrechnet, sondern landet im Ordner **"Unklar"**.

4. **Im Ordner "Unklar":** 

   - Der Gläubiger kann die Forderung zurücknehmen (Eintrag verschwindet).

   - Der Schuldner kann sie nachträglich doch akzeptieren (wandert ins "Konto").

---

### 4. TILGUNG & SCHULDENMINIMIERUNG ("SCHULDEN BEGLEICHEN")

- **Schuldenminimierung (Simplify Debts):** Berechne stets das Nettosaldo aller Mitglieder im Kostenstall. Reduziere die Zahlungen auf das mathematische Minimum (z. B. wenn A an B und B an C schuldet, zahlt A direkt an C).

- **Salden-Übersicht:** Zeige klar an: "Wer muss wem wie viel überweisen?".

- **Zahlung per Klick:**

  - Button "Jetzt begleichen": Öffnet direkt einen dynamischen `paypal.me/Username/Betrag`-Link oder wero-Zahlungslink.

  - Alternativ: "Manuell gezahlt" (Bar / Überweisung).

- **Tilgungs-Bestätigung:** Auch Tilgungen müssen vom Empfänger per Klick auf "(¥€$) Alles korrekt?" bestätigt werden.

---

### 5. DATENBANK-ARCHITEKTUR (Supabase / PostgreSQL)

Verwende für das Backend das folgende PostgreSQL-Schema:

```sql

CREATE TABLE public.profiles (

    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    full_name TEXT NOT NULL,

    phone_number TEXT UNIQUE,

    paypal_me_handle TEXT,

    wero_id TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()

);

CREATE TABLE public.groups (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,

    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()

);

CREATE TABLE public.group_members (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,

    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

    role TEXT NOT NULL DEFAULT 'member',

    joined_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(group_id, user_id)

);

CREATE TABLE public.expenses (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,

    paid_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),

    title TEXT NOT NULL,

    category TEXT NOT NULL,

    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,

    created_at TIMESTAMPTZ DEFAULT NOW()

);

CREATE TABLE public.expense_splits (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,

    debtor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

    amount DECIMAL(10, 2) NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'disputed')),

    created_at TIMESTAMPTZ DEFAULT NOW()

);

CREATE TABLE public.settlements (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,

    payer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

    payee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,

    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),

    payment_method TEXT CHECK (payment_method IN ('paypal', 'wero', 'cash', 'bank_transfer')),

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'disputed')),

    created_at TIMESTAMPTZ DEFAULT NOW()

);

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://billy-cash-cow.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/80ac4b9c-3d49-42b3-9791-6498ca30025b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
