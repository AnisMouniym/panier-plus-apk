# **PANIER+** — Application déclaration de panier repas
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white) ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

**PANIER+** est une application Android qui permet aux salariés d'enregistrer rapidement leur panier repas quotidien et aux administrateurs de piloter les consommations en local. Elle est autonome conçue pour fonctionner sur une tablette centrale en mode borne tactile, sans aucune connexion Internet.

## ✨ Fonctionnalités principales

### 👤 Espace Salarié

**Connexion rapide par code PIN :** Authentification sécurisée à 6 chiffres via un pavé numérique tactile (sans identifiant à saisir).

**Catalogue par catégories :** Sélection intuitive des produits via des listes déroulantes par catégorie, avec ajustement tactile des quantités (− / +).

**Règle métier intégrée :** Limitation automatique à une déclaration validée par jour et par salarié.

**Historique personnel :** Consultation des déclarations passées.

**Confort visuel :** Bascule instantanée entre le thème clair et le thème sombre (🌓).

### ⚙️ Espace Administration

**Tableau de bord :** Suivi en temps réel du nombre de salariés actifs, de produits disponibles, des déclarations du jour et du total cumulé.

**Gestion des salariés :** Création de comptes (Prénom, Nom, PIN à 6 chiffres) et activation/désactivation en un clic.

**Gestion du catalogue :** Ajout et modification des produits (nom, catégorie, unité, description, image facultative et ordre d'affichage).

**Export CSV anonymisé :** Génération d'un fichier .csv (encodé UTF-8 avec séparateur ;, directement compatible avec Microsoft Excel) excluant les noms et identifiants des salariés.

**Purge de l'historique :** Suppression sécurisée (confirmation en deux étapes) de l'historique local après exportation pour libérer de l'espace.

**Sécurité du PIN :** Seul l'administrateur peut modifier son propre code PIN depuis son profil.

## 🏗️ Architecture & Fonctionnement Hors-Ligne

L'application repose sur une architecture légère et autonome.

**Base de données locale :** Stockage persistant directement dans la mémoire privée de l'application sur la tablette via le localStorage de la WebView Android (capacité d'environ 15 000 à 20 000 déclarations).

**Empaquetage Android :** Généré avec **Capacitor** (com.panierplus.borne).

**Compilation Cloud :** Automatisation complète de la création du fichier **.apk** via GitHub Actions (aucun SDK Android ni outil lourd à installer sur poste de travail).

## 📁 Structure du dépôt

panier-plus-apk/
├── .github/
│   └── workflows/
│       └── build-apk.yml       - Workflow GitHub Actions pour compiler l'APK Android
├── www/
│   ├── index.html              - Structure principale et pavé numérique de connexion
│   ├── style.css               - Feuille de styles tactile (thèmes clair et sombre)
│   └── app.js                  - Base de données locale, règles métier et vues dynamiques
├── capacitor.config.json       - Configuration de l'application Android Capacitor
└── package.json                - Dépendances Capacitor


## 🚀 Installation & Première utilisation

_1. Récupérer le fichier **.apk**_

À chaque modification poussée sur la branche main, rendez-vous dans l'onglet Actions du dépôt GitHub.

Ouvrez la dernière exécution réussie du workflow Build Android APK.

Téléchargez l'archive panier-plus-apk dans la section Artifacts en bas de page et extrayez le fichier **app-debug.apk**.

Transférez le fichier **.apk** sur la tablette Android et lancez l'installation (autorisez l'installation depuis des sources inconnues si demandé).

_2. Première connexion (Compte Administrateur)_

Au tout premier démarrage sur la tablette, un compte administrateur par défaut est automatiquement initialisé :

Code PIN par défaut : **123456**

Important : Dès la première ouverture, connectez-vous avec **123456**, rendez-vous dans l'onglet Profil et remplacez ce code par un PIN administrateur personnalisé.

_3. Tester l'interface sur navigateur_

Il est possible de visualiser et tester l'interface directement depuis un navigateur via [GitHub Pages (/www/)](https://anismouniym.github.io/panier-plus-apk/www/), en activant l'émulation tablette dans les outils de développement (`F12` puis `Ctrl + Shift + M`).

## 🛡️ Bonnes pratiques d'exploitation

**Sauvegarde régulière :** Les données étant stockées uniquement dans la mémoire de la tablette, pensez à effectuer un Export CSV chaque semaine ou chaque mois depuis l'onglet Admin, puis à archiver le fichier sur un ordinateur ou un serveur sécurisé.

**Nettoyage périodique :** Une fois l'export CSV sauvegardé, utilisez le bouton Supprimer tout l'historique dans Admin > Déclarations pour conserver des performances optimales.
