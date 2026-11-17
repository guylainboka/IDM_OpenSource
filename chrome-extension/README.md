# guymadown — Extension Chrome

Module d'intégration navigateur pour le gestionnaire de téléchargement [guymadown](https://github.com/guylainboka/IDM_OpenSource).

![guymadown](icons/icon128.png)

## Fonctionnalités

- **Interception automatique** : capture les téléchargements du navigateur et les envoie au moteur guymadown
- **Menu contextuel** : « Télécharger avec guymadown » sur les liens, images, vidéos et audio
- **Sélection de liens** : télécharge tous les liens dans une sélection de texte
- **Détection média** : panneau flottant listant les vidéos / audio / images / flux d'une page
- **Popup** : statut du moteur, liste des téléchargements récents, ajout manuel d'URL
- **Options** : domaines exclus, notifications, touches de contrôle (forcer/empêcher)
- **Surveillance réseau** : détecte les ressources média chargées par la page

## Installation (développeur)

### Étape 1 — Lancer le moteur guymadown
L'extension nécessite que le moteur guymadown tourne sur `http://localhost:3003`.
Voir [IDM_OpenSource](https://github.com/guylainboka/IDM_OpenSource) pour lancer le moteur (`guymadown-engine.exe`).

### Étape 2 — Charger l'extension dans Chrome
1. Téléchargez ou clonez ce dépôt
2. Ouvrez Chrome → `chrome://extensions/`
3. Activez le **Mode développeur** (en haut à droite)
4. Cliquez sur **Charger l'extension non empaquetée**
5. Sélectionnez le dossier de l'extension (contenant `manifest.json`)

L'icône guymadown apparaît dans la barre d'outils.

### Étape 3 — Vérifier la connexion
- Cliquez sur l'icône guymadown → le popup doit afficher **« Moteur connecté »**
- Si « Moteur hors ligne » : démarrez `guymadown-engine.exe` sur votre PC

## Utilisation

### Interception automatique
Quand vous lancez un téléchargement dans Chrome, l'extension l'intercepte et l'envoie à guymadown. Une notification confirme la capture. Le téléchargement natif du navigateur est annulé.

### Menu contextuel
Clic droit sur :
- un **lien** → « Télécharger avec guymadown »
- une **image** → « Télécharger cette image avec guymadown »
- une **vidéo** / **audio** → « Télécharger avec guymadown »
- une **sélection de texte** → « Télécharger tous les liens sélectionnés »

### Panneau média flottant
Sur les pages contenant des vidéos/audio/images, un panneau discret apparaît en bas à droite. Il liste les médias détectés avec cases à cocher. Cliquez « Tout télécharger » pour envoyer la sélection au moteur.

### Popup
Cliquez sur l'icône guymadown pour :
- Voir le statut du moteur (connecté/hors ligne)
- Ajouter une URL manuellement
- Voir les téléchargements récents et leur statut

### Options
Page d'options (clic droit sur l'icône → Options) :
- Activer/désactiver l'interception
- Activer/désactiver le menu contextuel
- Activer/désactiver la détection média
- Activer/désactiver les notifications
- Domaines exclus (un par ligne)
- Touches de contrôle (forcer/empêcher l'interception)

## Communication avec le moteur

L'extension communique avec le moteur guymadown via HTTP sur `http://localhost:3003` :

| Endpoint | Méthode | Usage |
|----------|---------|-------|
| `/api/add` | POST | Ajoute un téléchargement `{url, filename?, connections?}` |
| `/api/status` | GET | Statut du moteur |
| `/api/downloads` | GET | Liste des téléchargements |

Aucune donnée n'est envoyée à un serveur externe — tout reste en local entre le navigateur et le moteur guymadown.

## Structure

```
chrome-extension/
├── manifest.json     # Manifest V3
├── background.js     # Service worker (interception, menu contextuel)
├── content.js        # Détection média + panneau flottant
├── popup.html        # Popup (statut + téléchargements)
├── popup.js          # Logique popup
├── options.html      # Page d'options
├── options.js        # Logique options
├── styles.css        # Styles panneau flottant
└── icons/            # Icônes (16, 32, 48, 128 px)
```

## Empaquetage pour publication

Pour créer un `.zip` publiable sur le Chrome Web Store :

```bash
cd chrome-extension
zip -r ../guymadown-extension.zip . -x "*.DS_Store"
```

Ou utilisez le workflow GitHub Actions (voir ci-dessous).

## Workflow GitHub Actions

Le workflow [`.github/workflows/build-extension.yml`](.github/workflows/build-extension.yml) crée un `.zip` de l'extension à chaque push et l'upload comme artifact.

## Compatibilité

- Chrome / Edge / Brave / Opera / Vivaldi (tous navigateurs Chromium compatibles Manifest V3)
- Firefox : nécessite une adaptation (Manifest V2/V3 différences)

## Limites

- L'extension ne peut pas capturer les téléchargements démarrés par des extensions tiers
- La détection HLS/DASH nécessite l'analyse réseau (partielle dans cette version)
- Les flux DRM protégés ne sont pas contournés (par conception)

## Licence

Open-source.
