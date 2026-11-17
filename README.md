# guymadown — Gestionnaire de téléchargement concurrent

Un gestionnaire de téléchargement moderne, multi-connexions, inspiré d'IDM (Internet Download Manager). Open-source, multiplateforme (compilable en exécutable Windows natif via Bun).

![guymadown](chrome-extension/icons/icon128.png)

## Fonctionnalités

- **Téléchargement multi-connexions** avec segmentation dynamique (requêtes HTTP `Range` parallèles)
- **Reprise automatique** après interruption (pause/reprise, perte de connexion, retry avec backoff)
- **Analyse HTTP** : taille, type MIME, ETag, Last-Modified, support Range, nom de fichier (Content-Disposition)
- **Catégories automatiques** : Compressés, Documents, Musique, Programmes, Vidéos, Images, Autres
- **Files d'attente** avec priorité, connexions max, limite de vitesse, planification
- **Téléchargement par lots** : génération de séquences d'URL (`file_[001-150].zip`), import de listes
- **Aspirateur de sites (Site Grabber)** : explore une URL, liste les ressources téléchargeables
- **Limiteur de vitesse** par téléchargement
- **Historique** et journal d'erreurs persistant (SQLite)
- **Interface web** type IDM : barre d'outils, panneau latéral, tableau central, fenêtre détails avec visualisation des segments
- **Extension Chrome** : interception des téléchargements, menu contextuel, détection média

## Architecture

```
guymadown/
├── src/                          # Application web Next.js 16 (interface)
│   ├── app/                      # Route principale + API REST
│   ├── components/               # Composants UI (shadcn/ui)
│   ├── hooks/                    # State management (Zustand)
│   └── lib/                      # Types, socket, mappers
├── mini-services/
│   └── download-engine/          # Moteur de téléchargement (socket.io, port 3003)
│       ├── index.ts              # Engine: multi-connexion, segmentation, retry
│       └── prisma/schema.prisma  # Schéma BDD (SQLite)
├── prisma/schema.prisma          # Schéma principal (partagé)
├── chrome-extension/             # Extension Chrome (Manifest V3)
├── .github/workflows/            # CI : compilation .exe Windows
└── build/                        # Sortie de compilation (guymadown-engine.exe)
```

### Composants

| Composant | Technologie | Rôle |
|-----------|-------------|------|
| Interface web | Next.js 16 + React + TypeScript + Tailwind + shadcn/ui | UI type IDM |
| Moteur de téléchargement | Bun + socket.io + Node `https` | Téléchargements multi-connexions, port 3003 |
| Base de données | SQLite + Prisma ORM | Persistance (téléchargements, segments, catégories, files) |
| Communication temps réel | socket.io | Progression en direct (3x/sec) |
| Extension navigateur | Chrome Manifest V3 | Interception, menu contextuel, détection média |
| Exécutable Windows | `bun build --compile --target=bun-windows-x64` | .exe standalone |

## Démarrage rapide (développement)

### Prérequis
- [Bun](https://bun.sh) >= 1.3
- Node.js 22+ (pour Prisma)

### Installation
```bash
# 1. Installer les dépendances de l'app web
bun install

# 2. Installer les dépendances du moteur
cd mini-services/download-engine
bun install
bun run generate   # générer le client Prisma

# 3. Configurer la base de données
cd ../..
bun run db:push    # créer les tables SQLite

# 4. Lancer le moteur de téléchargement (port 3003)
cd mini-services/download-engine
bun run dev   # ou: bash run.sh (avec auto-restart)

# 5. Lancer l'interface web (port 3000)
cd ../..
bun run dev
```

### Accès
- Interface web : `http://localhost:3000`
- API moteur : `http://localhost:3003/api/status`
- Le moteur et l'app web partagent la même base SQLite (mode WAL)

## Compilation en .exe Windows

### Compilation locale
```bash
cd mini-services/download-engine
bun run generate   # Prisma client avec target Windows
bun build --compile --target=bun-windows-x64 --outfile=../../build/guymadown-engine.exe index.ts
```

Le fichier `build/guymadown-engine.exe` (≈98 MB) est un exécutable Windows standalone (PE32+ x86-64) contenant le runtime Bun + le moteur complet.

### Compilation automatique (GitHub Actions)

Le workflow [`.github/workflows/build-exe.yml`](.github/workflows/build-exe.yml) compile automatiquement le .exe à chaque push sur `main` et crée une release sur les tags `v*`.

```bash
# Créer une release
git tag v1.0.0
git push origin v1.0.0
# → GitHub Actions compile le .exe et publie la release
```

L'artifact `guymadown-engine-windows-x64` est téléchargeable depuis l'onglet Actions.

### Utilisation du .exe sur Windows
1. Téléchargez `guymadown-engine.exe` depuis les Releases
2. Double-cliquez pour lancer — le moteur démarre sur le port 3003
3. (Optionnel) Installez l'extension Chrome depuis le dépôt [IDM_OpenSource_Ext](https://github.com/guylainboka/IDM_OpenSource_Ext)
4. Les téléchargements interceptés par l'extension sont envoyés au moteur
5. L'interface web reste accessible via l'app Next.js (ou une version statique)

## Extension Chrome

L'extension Chrome est dans le dossier `chrome-extension/` et possède son propre dépôt : [IDM_OpenSource_Ext](https://github.com/guylainboka/IDM_OpenSource_Ext).

### Fonctionnalités de l'extension
- **Interception** des téléchargements du navigateur → transfert au moteur guymadown
- **Menu contextuel** : « Télécharger avec guymadown » sur liens, images, vidéos, audio
- **Détection média** : panneau flottant listant les vidéos/audio/images d'une page
- **Popup** : statut du moteur, téléchargements récents, ajout manuel d'URL
- **Options** : domaines exclus, notifications, touches de contrôle

Voir [chrome-extension/README.md](chrome-extension/README.md) pour l'installation.

## API REST du moteur

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/add` | POST | Ajouter un téléchargement (`{url, filename?, connections?}`) |
| `/api/status` | GET | Statut du moteur (`{ok, active, engine}`) |
| `/api/downloads` | GET | Liste des téléchargements |

Le moteur écoute aussi socket.io sur le path `/` pour les événements temps réel (`download.progress`, `download.completed`, etc.).

## Base de données

Tables SQLite (Prisma) :
- `Download` — téléchargements (url, taille, statut, progression…)
- `Segment` — plages d'octets par téléchargement
- `Category` — catégories (nom, couleur, extensions)
- `Queue` / `QueueItem` — files d'attente
- `Setting` — paramètres (clé/valeur)
- `ErrorLog` — journal d'erreurs
- `GrabberProject` — projets aspirateur

## Limites connues

- Les très gros fichiers (>100 Mo) utilisent une seule connexion par défaut pour la stabilité du runtime ; l'utilisateur peut forcer plus de connexions manuellement
- L'extension communique avec le moteur via HTTP (localhost:3003), pas via Native Messaging
- L'interface web nécessite le serveur Next.js ; pour une app 100% desktop il faudrait empaqueter le frontend dans le .exe (amélioration future)

## Licence

Open-source. Voir le cahier des charges V2.0 pour les spécifications complètes.

## Remerciements

Inspiré fonctionnellement d'Internet Download Manager (IDM). Code original, aucune ressource IDM utilisée.
