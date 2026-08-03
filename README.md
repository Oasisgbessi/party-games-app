# Socle technique — Soirée Jeux

Ce qui est livré ici : le système de **salles/tables**, pas encore les jeux eux-mêmes.
Ça permet de valider tout de suite le cœur du système (connexion, choix de pseudo,
tables avec capacité, saturation) avant d'attaquer le premier jeu pilote.

## Lancer en local (ou sur ton VPS)

```bash
npm install
npm start
```

Puis ouvrir `http://localhost:3000` — dans plusieurs onglets/téléphones pour simuler
plusieurs joueurs.

## Ce qui fonctionne déjà

- Chaque joueur choisit un pseudo puis clique sur une table dans le jeu de son choix
- Les places se remplissent en temps réel pour tout le monde (Socket.io)
- Une table pleine devient grisée et non-cliquable
- Un jeu devient "complet" quand toutes ses tables sont saturées
- On peut quitter une table, la place se libère immédiatement pour les autres

## Ce qui n'est PAS encore fait (volontairement)

- Aucune logique de jeu (pas de vraies parties de Pique, Uno, etc.) — c'est la
  prochaine étape : le jeu pilote
- Pas de persistance (si le serveur redémarre, toutes les tables se vident)
- Pas de bot IA

## Calibrage des jeux/tables

Tout se règle dans `games-config.js` — nombre de tables et capacité par jeu,
sans toucher au reste du code.
