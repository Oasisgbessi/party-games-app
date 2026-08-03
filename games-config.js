// Configuration centrale : chaque jeu = nombre de tables x capacité par table.
// C'est ici qu'on ajuste le calibrage sans toucher au reste du serveur.

module.exports = {
  pique: { label: "Pique", tables: 3, capacity: 4 },
  uno: { label: "Uno", tables: 3, capacity: 4 },
  marche_ou_creve: { label: "Marche ou crève", tables: 2, capacity: 8 },
  on_ecoute: { label: "On écoute mais on juge pas", tables: 1, capacity: 30 },
  ngl: { label: "NGL", tables: 1, capacity: 30 },
  devinettes: { label: "Devinettes", tables: 3, capacity: 6 },
  scrabble: { label: "Scrabble Classique", tables: 2, capacity: 4 },
  monopoly: { label: "Monopoly", tables: 1, capacity: 6 },
  puissance4: { label: "Puissance 4", tables: 4, capacity: 2 },
};
