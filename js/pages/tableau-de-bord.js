async function afficherTableauDeBord() {
  var Prof = JSON.parse(sessionStorage.getItem('Prof'));
  if (!Prof) return;

  // Afficher les infos du professeur
  afficherInfosProfesseur(Prof);

  // Charger les statistiques générales
  await chargerStatistiques(Prof);

  // Charger les sections du tableau de bord
  await Promise.all([
    afficherDernieresNotes(Prof.id),
    afficherNotesManquantes(Prof.id),
    afficherÉtudiantsEnDifficulté(Prof.id),
    afficherDistributionNotes(Prof.id),
    afficherClassesResume(Prof.id)
  ]);
};

function afficherInfosProfesseur(Prof) {
  // Remplir le header du tableau de bord
  var nom = formaterNomProfesseur(Prof.prénom, Prof.nom);
  document.getElementById('tableau-de-bord-nom-professeur').textContent = nom;
  document.getElementById('tableau-de-bord-email-professeur').textContent = Prof.email;
  document.getElementById('tableau-de-bord-nom-complet').textContent = nom;
  mettreAJourAvatar(Prof, 'tableau-de-bord-image-professeur', 'tableau-de-bord-initiales-professeur');
}

async function chargerStatistiques(Prof) {
  try {
    // Charger les stats depuis Supabase
    var d = await DB.tableauDeBord.tableauDeBordProfesseur(Prof.id);
    document.querySelector('#statistique-étudiants .nombre-statistique').textContent = d.totalÉtudiants || 0;
    document.querySelector('#statistique-moyenne .nombre-statistique').textContent = (d.moyenneGénérale || 0).toFixed(1);
    document.querySelector('#statistique-réussite .nombre-statistique').textContent = d.tauxRéussite || 0;
    document.querySelector('#statistique-modules .nombre-statistique').textContent = d.notesSaisies || 0;
    document.getElementById('statistique-notes-suffixe').textContent = '/' + (d.totalÉtudiants || 0);

    // Déterminer la matière enseignée
    var ProfComplet = await DB.professeurs.obtenirProfParId(Prof.id);
    var module = '';
    if (ProfComplet && ProfComplet.module && ProfComplet.module !== '---') {
      module = ProfComplet.module;
    } else if (Prof.filière) { 
      module = Prof.filière; 
    } else { 
      module = 'Enseignant';
    }

    // Ajouter le nombre de classes
    if (d.nombreClasses) {
      module += ' - ' + d.nombreClasses + ' classe(s)';
    }
    document.getElementById('tableau-de-bord-matière').textContent = module;
  } catch (erreur) {
    afficherNotification('Pas de connexion internet', 'error');
  }
}

async function afficherDernieresNotes(ProfId) {
  try {
    // Dernières 5 notes saisies
    var notes = await DB.tableauDeBord.dernièresNotes(ProfId, 5);
    if (notes.length === 0) { 
      document.getElementById('pas-de-note').hidden = false; 
      return; 
    }

    var corps = document.getElementById('tableau-de-bord-récent-corps');
    corps.innerHTML = '';

    for (var i = 0; i < notes.length; i++) {
      corps.appendChild(remplirLigneNote(notes[i]));
    }
  } catch (erreur) { 
    afficherNotification('Erreur chargement notes récentes', 'error');
  }
};

function remplirLigneNote(n) {
  // Cloner la ligne depuis le template
  var ligne = clone('template-note-récent', 'tr');

  ligne.querySelector('.col-nom a').textContent = n.étudiants?.nom || '';
  ligne.querySelector('.col-prénom').textContent = n.étudiants?.prénom || '';
  ligne.querySelector('.col-cne').textContent = n.étudiants?.cne || '---';
  ligne.querySelector('.col-filière').textContent = n.étudiants?.filière || '---';

  var noteSpan = ligne.querySelector('.valeur-note');
  noteSpan.textContent = n.valeur;
  noteSpan.style.color = obtenirCouleurNote(n.valeur);

  ligne.querySelector('.col-date').textContent = n.date_saisie ? n.date_saisie.split('T')[0] : '';

  var badge = ligne.querySelector('.étiquette');
  var info = statutNote(n.valeur);
  badge.className = 'étiquette ' + info.classe;
  badge.textContent = info.texte;

  return ligne;
}

function statutNote(v) {
  // Déterminer le statut selon la valeur
  if (v >= 10) {
    return { classe: 'étiquette-admis', texte: 'Validé' };
  } else {
    return { classe: 'étiquette-échoué', texte: 'Non Validé' };
  }
}

async function afficherNotesManquantes(ProfId) {
  try {
    var d = await DB.tableauDeBord.manquantesProfesseur(ProfId);
    if (d.length === 0) { document.getElementById('pas-de-module').hidden = false; return; }

    var corps = document.getElementById('tableau-de-bord-manquant-corps');
    corps.innerHTML = '';

    for (var i = 0; i < d.length; i++) {
      corps.appendChild(remplirNotesManquantes(d[i]));
    }
  } catch (erreur) { 
    afficherNotification('Erreur chargement notes manquantes', 'error');
  }
};

function remplirNotesManquantes(c) {
  // Calculer le pourcentage manquant
  var pct = c.pct_manquant || 0;
  var severite = '';
  var couleurBarre = '';
  
  // Déterminer la couleur selon la sévérité
  if (pct >= 50) {
    severite = 'high';
    couleurBarre = '#e05050';
  } else if (pct >= 10) {
    severite = 'mid';
    couleurBarre = '#c9a84c';
  } else {
    severite = 'low';
    couleurBarre = '#4caf82';
  }

  // Cloner l'élément depuis le template
  var el = clone('template-notes-manquantes', '.élément-notes-manquantes');

  el.querySelector('.nom-module-manquant').textContent = c.nom;
  var pctSpan = el.querySelector('.pourcentage-manquant');
  pctSpan.setAttribute('data-severity', severite);
  pctSpan.textContent = Math.round(pct) + '%';

  el.querySelector('.remplissage-barre-manquant').style.width = Math.min(pct, 100) + '%';
  el.querySelector('.remplissage-barre-manquant').style.background = couleurBarre;

  el.querySelector('.sous-titre-manquant').textContent =
    c.manquantes + ' note(s) manquante(s) sur ' + c.total_étudiants + ' étudiant(s)';

  return el;
}

async function afficherÉtudiantsEnDifficulté(ProfId) {
  try {
    var d = await DB.tableauDeBord.difficultéProfesseur(ProfId);
    if (d.length === 0) {
      document.getElementById('pas-d-étudiant-difficulté').hidden = false; 
      return; 
    }

    document.getElementById('pas-d-étudiant-difficulté').hidden = true;
    var corps = document.getElementById('tableau-de-bord-difficulté-corps');
    nettoyer(corps, '.élément-élève-difficulté');

    for (var i = 0; i < d.length; i++) {
      corps.appendChild(remplirÉlèveDifficulté(d[i]));
    }
  } catch (erreur) { 
    afficherNotification('Erreur chargement étudiants en difficulté', 'error');
  }
};

function remplirÉlèveDifficulté(e) {
  // Cloner l'élément depuis le template
  var el = clone('template-élève-difficulté', '.élément-élève-difficulté');

  el.querySelector('.note-élève-difficulté').textContent = (e.moyenne || 0).toFixed(2);
  el.querySelector('.nom-élève-difficulté').textContent = e.nom + ' ' + e.prénom;
  el.querySelector('.classe-élève-difficulté').textContent = e.filière || '---';

  var badge = el.querySelector('.étiquette');
  badge.className = 'étiquette étiquette-critique';
  badge.textContent = 'Insuffisant';

  return el;
}

async function afficherDistributionNotes(ProfId) {
  try {
    var d = await DB.tableauDeBord.distributionProfesseur(ProfId);
    var tranches = preparerTranches(d);
    var couleurs = ['var(--bar-1)', 'var(--bar-2)', 'var(--bar-3)',
                    'var(--bar-4)', 'var(--bar-5)', 'var(--bar-6)'];

    var graphique = document.createElement('div');
    graphique.className = 'graphique-répartition-notes';

    for (var i = 0; i < tranches.length; i++) {
      graphique.appendChild(remplirBarre(tranches[i], couleurs[i], tranches));
    }

    var corps = document.getElementById('tableau-de-bord-distribution-corps');
    corps.innerHTML = '';
    corps.appendChild(graphique);

  } catch (erreur) { 
    afficherNotification('Erreur chargement distribution notes', 'error');
  }
};

function preparerTranches(données) {
  // Initialiser les 6 tranches de notes
  var t = [
    { tranche: '0-9', nombre: 0 }, 
    { tranche: '10-11', nombre: 0 },
    { tranche: '12-13', nombre: 0 }, 
    { tranche: '14-15', nombre: 0 },
    { tranche: '16-17', nombre: 0 }, 
    { tranche: '18-20', nombre: 0 }
  ];
  // Remplir avec les données
  if (données && données.length > 0) {
    for (var i = 0; i < données.length; i++) {
      for (var j = 0; j < t.length; j++) {
        if (t[j].tranche === données[i].tranche) { 
          t[j].nombre = données[i].nombre; 
          break; 
        }
      }
    }
  }
  return t;
}

function trouverMax(tranches) {
  // Trouver la tranche avec le plus d'étudiants
  var max = 1;
  for (var i = 0; i < tranches.length; i++) {
    if (tranches[i].nombre > max) {
      max = tranches[i].nombre;
    }
  }
  return max;
}

function remplirBarre(tranche, couleur, toutes) {
  // Calculer la hauteur proportionnelle
  var max = trouverMax(toutes);
  var hauteur = Math.max(2, (tranche.nombre / max) * 90);

  // Cloner la barre depuis le template
  var el = clone('template-barre-graphique', '.groupe-barre-graphique');

  el.querySelector('.compte-barre-graphique').textContent = tranche.nombre;
  el.querySelector('.barre-graphique').style.height = hauteur + 'px';
  el.querySelector('.barre-graphique').style.background = couleur;
  el.querySelector('.étiquette-barre-graphique').textContent = tranche.tranche;

  return el;
}

async function afficherClassesResume(ProfId) {
  try {
    var d = await DB.tableauDeBord.classesProfesseur(ProfId);
    var corps = document.getElementById('tableau-de-bord-classes-corps');

    nettoyer(corps, '.élément-liste-classes');
    document.getElementById('pas-de-module-chart').hidden = true;

    if (!d || d.length === 0) { 
      document.getElementById('pas-de-module-chart').hidden = false;
      return; 
    }

    for (var i = 0; i < d.length; i++) {
      corps.appendChild(remplirClasse(d[i]));
    }
  } catch (erreur) {
    var corps = document.getElementById('tableau-de-bord-classes-corps');
    if (corps) nettoyer(corps, '.élément-liste-classes');
    document.getElementById('pas-de-module-chart').hidden = false;
  }
};

function remplirClasse(c) {
  // Choisir le badge selon le statut
  var classeBadge = 'étiquette-attente';
  if (c.statut === 'Complet')  classeBadge = 'étiquette-complet';
  else if (c.statut === 'En cours') classeBadge = 'étiquette-encours';

  // Cloner l'élément depuis le template
  var el = clone('template-liste-classes', '.élément-liste-classes');

  el.querySelector('.nom-classe-liste').textContent = c.nom;
  el.querySelector('.info-classe-liste').textContent =
    c.nb_étudiants + ' étudiant(s) - Moyenne ' + (c.moyenne_classe || 0);

  var badge = el.querySelector('.étiquette');
  badge.className = 'étiquette ' + classeBadge;
  badge.textContent = c.statut;

  return el;
}

function clone(idTemplate, selecteur) {
  // Cloner un élément depuis un template
  var t = document.getElementById(idTemplate);
  return t.content.cloneNode(true).querySelector(selecteur);
}