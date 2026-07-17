# ProfNotes

Application web destinée aux professeurs pour gérer les notes, les absences et les étudiants. Le backend est entièrement géré par Supabase (PostgreSQL, authentification, stockage). Aucun serveur PHP ou Node.js n'est requis.


## Objectif du projet

Remplacer la saisie manuscrite des notes par un outil numérique simple, rapide et accessible depuis n'importe quel navigateur. Chaque professeur crée son compte, importe ses classes et ses étudiants, puis saisit les notes et les absences au fur et à mesure. L'application calcule automatiquement les moyennes et le taux de réussite.


## Fonctionnalités

- **Authentification** : inscription, connexion par email/mot de passe ou compte Google
- **Tableau de bord** : statistiques en temps réel (nombre d'étudiants, moyenne générale, taux de réussite, notes saisies), dernières notes saisies, étudiants en difficulté, notes manquantes, distribution des notes
- **Étudiants** : ajout, modification, suppression, consultation détaillée et recherche par nom ou CNE
- **Notes** : saisie individuelle ou en lot pour toute une classe, avec coefficient par classe
- **Classes** : création, modification et suppression de classes avec coefficient et aperçu des statistiques
- **Absences** : gestion des présences par séance avec suivi des justifications et historique
- **Profil** : modification du nom, prénom, matière enseignée, photo de profil et mot de passe du compte
- **Thème clair/sombre** : basculement entre thème clair et sombre


## Technologies utilisées

Le projet est développé en HTML et CSS avec des variables, flexbox et grid pour la mise en page, le tout écrit en JavaScript (async/await, templates). La base de données PostgreSQL est hébergée sur Supabase, qui gère aussi l'authentification (email/mot de passe et Google) et le stockage des photos de profil. Les graphiques du tableau de bord sont dessinés par le navigateur avec Canvas (pas de bibliothèque externe).


## Structure du projet

```
ProfNotes/
├── index.html                  
├── Schéma.sql
├── README.md
├── css/
│   ├── style.css             
│   ├── responsive.css         
│   └── pages/                
│       ├── connexion.css
│       ├── tableau-de-bord.css
│       ├── classes.css 
│       └── profil.css 
├── images/
│   ├── img.png
│   └── logo.png
├── js/
│   ├── app.js                  
│   ├── config/
│   │   └── supabase.js         
│   ├── services/              
│   │   ├── base.service.js
│   │   ├── professeurs.service.js
│   │   ├── étudiants.service.js
│   │   ├── classes.service.js
│   │   ├── notes.service.js
│   │   ├── absences.service.js
│   │   └── tableau-de-bord.service.js
│   │   
│   └── pages/                  
│       ├── tableau-de-bord.js
│       ├── étudiants.js
│       ├── notes.js
│       ├── classes.js
│       ├── absences.js
│       └── profil.js
```


## Base de données

Le fichier `Schéma.sql` décrit toute la structure de la base de données. Il contient :

- **5 tables** : `professeurs`, `classes`, `étudiants`, `notes`, `absences`
- **Protection des données** : chaque professeur accède uniquement à ses propres données (RLS)
- **11 fonctions SQL** : traitent et retournent les données affichées dans le site
- **Triggers** : mise à jour automatique de la date de dernière modification
- **Index** : accélération des requêtes fréquentes (recherche, filtres)


## Architecture de l'application

Application web développée en HTML, CSS et JavaScript pur, qui communique avec Supabase pour la base de données, l'authentification et le stockage. Pas de serveur backend.


## Captures d'écran de l'application



## Auteur

*Youssef Baghious*
