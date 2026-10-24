# Radio DTK — apps Windows / Mac / Android / iOS + bouton « Mettre à jour »

## Le principe
Les apps sont des « coquilles » qui ouvrent ton site (radio-dtk.vercel.app).
Donc : **même code que le site**. Quand le site est mis à jour, toutes les apps le sont aussi
(et se rechargent toutes seules grâce à `auto-update.js`). Pas besoin de refaire les apps à chaque changement.

Le bouton « Mettre à jour » du panel admin lance un redéploiement du site depuis GitHub.

## Étape 1 — Copier les fichiers dans ton projet (VS Code)
Copie dans le dossier du projet `radio-dtk` :
- `app/api/update/route.js`
- `app/api/version/route.js`
- `public/auto-update.js`
- `desktop/`, `mobile/`, `.github/`

Dans `admin.html` : colle le contenu de `admin-update-button.html` (bouton + script).
Ajoute `<script src="/auto-update.js"></script>` avant `</body>` dans `index.html` et `admin.html`.

## Étape 2 — Variables sur Vercel (Settings > Environment Variables)
- `ADMIN_PASSWORD` : ton mot de passe admin (si tu en as déjà un, mets le même)
- `VERCEL_DEPLOY_HOOK_URL` : Vercel > Settings > Git > Deploy Hooks > créer un hook (branche `main`) > copier l'URL

Puis `git add . && git commit -m "apps + bouton maj" && git push`.

## Étape 3 — Windows + Mac
GitHub > onglet Actions > « Build apps bureau » > Run workflow.
Au bout de quelques minutes, télécharge le `.exe` (Windows) et le `.dmg` (Mac) dans « Artifacts ».
(Ou en local sur ton PC : `cd desktop && npm install && npm run build:win`.)

## Étape 4 — Android
Installe Android Studio, puis :
```
cd mobile
npm install
npx cap add android
npx cap sync
npx cap open android
```
Dans Android Studio : Build > Build APK. Envoie l'APK sur ton téléphone.

## Étape 5 — iOS
⚠️ Il faut un Mac avec Xcode, et un compte Apple Developer (99 $/an) pour installer ailleurs que sur ton propre iPhone.
```
cd mobile
npx cap add ios
npx cap sync
npx cap open ios
```
Astuce sans Mac : sur iPhone, ouvre le site dans Safari > Partager > « Sur l'écran d'accueil ».
Note : Apple refuse parfois les apps qui sont juste un site dans une coquille (règle 4.2) si tu veux la publier sur l'App Store.

## Limites honnêtes
- Les apps ont besoin d'internet (elles affichent le site).
- Windows : un avertissement « SmartScreen » peut apparaître (app non signée). Mac : clic droit > Ouvrir.
