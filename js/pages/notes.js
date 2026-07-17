async function afficherNotes() {
  var pageCourante = pagination.notes || 1;
  var limite = 20;

  try {
    // Charger les notes et le total
    var notes = await DB.notes.obtenirTout(pageCourante - 1, limite);
    var total = await DB.notes.compter();

    // Vider le tableau
    var zoneCorps = document.getElementById('notes-corps');
    nettoyer(zoneCorps, 'tr:not(#msg-notes-vide)');

    // Trier les notes selon la colonne sélectionnée
    if (typeof trierDonnees === 'function') trierDonnees(notes);

    // Afficher chaque note ou un message si vide
    if (notes.length === 0) {
      document.getElementById('msg-notes-vide').hidden = false;
    } else {
      document.getElementById('msg-notes-vide').hidden = true;
      for (var i = 0; i < notes.length; i++) {
        zoneCorps.appendChild(créerLigneNote(notes[i]));
      }
    }

    // Afficher les boutons de pagination
    afficherPaginationNotes(total, limite, pageCourante);

  } catch (erreur) {
    var msg = erreur && erreur.message ? erreur.message : String(erreur);
    afficherNotification('Erreur notes: ' + msg.substring(0, 80), 'error');
  }
};

// Créer une ligne HTML pour une note
function créerLigneNote(note) {
  // Choisir la couleur du badge selon le type
  var classeEtiquette = '';
  if (note.type === 'Examen') {
    classeEtiquette = 'étiquette-avertissement';
  } else if (note.type === 'TP') {
    classeEtiquette = 'étiquette-information';
  } else {
    classeEtiquette = 'étiquette-succès';
  }

  var date = note.date_saisie ? note.date_saisie.split('T')[0] : '';

  // Cloner la ligne depuis le template
  var ligne = document.getElementById('template-ligne-note')
    .content.cloneNode(true).querySelector('tr');

  // Remplir les colonnes
  ligne.querySelector('.col-nom a').textContent = note.étudiants?.nom;
  ligne.querySelector('.col-nom a').href = '#/étudiant/' + note.étudiants?.id;
  ligne.querySelector('.col-prénom').textContent = note.étudiants?.prénom;
  ligne.querySelector('.col-cne').textContent = note.étudiants?.cne;
  ligne.querySelector('.col-filière').textContent = note.étudiants?.filière || '---';
  ligne.querySelector('.col-semestre').textContent = note.semestre || '---';
  ligne.querySelector('.étiquette').textContent = note.type;
  ligne.querySelector('.étiquette').classList.add(classeEtiquette);
  ligne.querySelector('.valeur-note').textContent = note.valeur;
  ligne.querySelector('.valeur-note').style.color = obtenirCouleurNote(note.valeur);
  ligne.querySelector('.col-date').textContent = date;

  // Attacher les boutons d'action
  ligne.querySelector('.btn-modifier').onclick = function() { AjouterModifierNote(note.id); };
  ligne.querySelector('.btn-supprimer').onclick = function() { supprimerNote(note.id); };

  return ligne;
}

// Afficher la pagination (boutons précédent/suivant)
function afficherPaginationNotes(total, limite, pageCourante) {
  // Calculer le nombre de pages
  var totalPages = Math.ceil(total / limite);
  if (totalPages < 1) totalPages = 1;

  // Afficher les boutons
  afficherPagination(
    document.getElementById('pagination-notes'),
    pageCourante,
    totalPages,
    function(page) {
      pagination.notes = page;
      afficherNotes();
    }
  );
}

// ouvrir le formulaire d'ajout ou modification d'une note 
async function AjouterModifierNote(id) {
  var note = null;
  var étudiants = [];

  try {
    if (id) note = await DB.notes.obtenirNoteparID(id);
    étudiants = await DB.étudiants.récupérerÉtudiants();
  } catch (erreur) {
    afficherNotification('Erreur chargement données note', 'error');
  }

  var moduleId = await trouverModuleId();
  var filieres = extraireFilieres(étudiants);
  var tousÉtudiants = étudiants;
  var étudiants = trouverÉtudiants(étudiants, note);
  var semestre = semestreActuel();

  var formulaire = document.getElementById('template-formulaire-note')
    .content.cloneNode(true).querySelector('#formulaire-note');

  // Remplir le sélecteur de filière et les champs
  remplirSelectFiliere(formulaire.querySelector('#f-note-filière'), filieres, étudiants);
  remplirChampsNote(formulaire, note, semestre, étudiants);

  var texteBouton = id ? 'Modifier' : 'Enregistrer';

  ouvrirFenetreFormulaire(
    id ? 'Modifier la note' : 'Saisir une note',
    formulaire,
    async function() {
      var d = lireDonneesNote(moduleId);
      if (!validerNote(d)) return;

      try {
        if (id) {
          await DB.notes.modifierNote(id, d);
          afficherNotification('Note modifiée', 'success');
        } else {
          await DB.notes.ajouterNote(d);
          afficherNotification('Note enregistrée', 'success');
          pagination.notes = 1;
        }
        fermerFenetre();
        await afficherNotes();
      } catch (erreur) {
        afficherNotification('Erreur', 'error');
      }
    },
    texteBouton
  );

  // Attacher les événements (recherche étudiant, filtre, etc.)
  attacherEvenementsNote(tousÉtudiants);
};

// Trouver l'ID du module (matière) du professeur
async function trouverModuleId() {
  var Prof = JSON.parse(sessionStorage.getItem('Prof'));
  if (!Prof) return null;

  try {
    var modules = await DB.classes.récupérerClassesActives(Prof.id);
    for (var i = 0; i < modules.length; i++) {
      if (modules[i].professeur_id == Prof.id) {
        return modules[i].id;
      }
    }
  } catch (erreur) {
    afficherNotification('Erreur chargement classes', 'error');
  }

  // Si aucun module trouvé, chercher par le nom
  if (Prof.module) {
    try {
      var résultat = await supabaseClient
        .from('classes')
        .select('id')
        .eq('nom', Prof.module)
        .maybeSingle();
      if (résultat.data) return résultat.data.id;
    } catch (erreur) {
      afficherNotification('Erreur recherche classe', 'error');
    }

    // Créer le module si inexistant
    try {
      var nouveau = await DB.classes.ajouterClasse({ nom: Prof.module });
      if (nouveau && nouveau.id) return nouveau.id;
    } catch (erreur) {
      afficherNotification('Erreur création classe', 'error');
    }
  }

  return null;
}

// Extraire la liste des filières sans doublons
function extraireFilieres(étudiants) {
  var filieres = [];
  for (var i = 0; i < étudiants.length; i++) {
    var f = étudiants[i].filière;
    if (f && filieres.indexOf(f) === -1) {
      filieres.push(f);
    }
  }
  return filieres.sort();
}

// Trouver un étudiant dans la liste à partir de la note
function trouverÉtudiants(étudiants, note) {
  if (!note) return null;
  for (var i = 0; i < étudiants.length; i++) {
    if (étudiants[i].id === note.étudiant_id) {
      return étudiants[i];
    }
  }
  return null;
}

// Déterminer le semestre actuel (1 ou 2)
function semestreActuel() {
  var mois = new Date().getMonth() + 1;
  return (mois >= 2 && mois <= 6) ? 2 : 1;
}

// Remplir le menu déroulant des filières
function remplirSelectFiliere(select, filieres, étudiants) {
  // Vider et remplir le select
  select.innerHTML = '<option value="">Sélectionnez</option>';
  for (var i = 0; i < filieres.length; i++) {
    var opt = document.createElement('option');
    opt.value = filieres[i];
    opt.textContent = filieres[i];
    select.appendChild(opt);
  }
  // Présélectionner la filière de l'étudiant
  if (étudiants) select.value = étudiants.filière;
}

// Remplir les champs du formulaire note
function remplirChampsNote(formulaire, note, semestre, étudiants) {
  if (note) {
    formulaire.querySelector('#f-note-valeur').value = note.valeur;
    formulaire.querySelector('#f-note-coeff').value = note.coefficient || '1';
    formulaire.querySelector('#f-note-type').value = note.type;
    formulaire.querySelector('#f-note-semestre').value = note.semestre;
    formulaire.querySelector('#f-note-commentaire').value = note.commentaire || '';
  } else {
    formulaire.querySelector('#f-note-coeff').value = '1';
    formulaire.querySelector('#f-note-semestre').value = semestre;
  }

  if (étudiants) {
    var selectEtu = formulaire.querySelector('#f-note-étudiant');
    var opt = document.createElement('option');
    opt.value = étudiants.id;
    opt.selected = true;
    selectEtu.appendChild(opt);

    formulaire.querySelector('#f-note-recherche').value = étudiants.prénom + ' ' + étudiants.nom;
    formulaire.querySelector('#f-note-recherche').dataset.selectedId = étudiants.id;
  }
}

// Lire les données du formulaire
function lireDonneesNote(moduleId) {
  return {
    étudiant_id: parseInt(document.getElementById('f-note-étudiant').value),
    module_id: moduleId,
    valeur: parseFloat(document.getElementById('f-note-valeur').value),
    coefficient: parseFloat(document.getElementById('f-note-coeff').value) || 1,
    type: document.getElementById('f-note-type').value,
    semestre: parseInt(document.getElementById('f-note-semestre').value),
    commentaire: document.getElementById('f-note-commentaire').value.trim() || null
  };
}

// Valider les données du formulaire note
function validerNote(d) {
  if (isNaN(d.étudiant_id)) {
    afficherNotification('Sélectionnez un étudiant', 'error');
    return false;
  }
  if (!d.module_id) {
    afficherNotification('Aucun classe associé', 'error');
    return false;
  }
  if (isNaN(d.valeur) || d.valeur < 0 || d.valeur > 20) {
    afficherNotification('Note entre 0 et 20', 'error');
    return false;
  }
  return true;
}

// Filtrer les étudiants par filière et texte
function filtrerÉtudiantsNote(étudiants) {
  var filièreChoisie = document.getElementById('f-note-filière').value;
  var recherche = document.getElementById('f-note-recherche').value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  var suggestions = document.getElementById('f-note-suggestions');
  suggestions.innerHTML = '';

  if (!recherche) {
    suggestions.classList.remove('visible');
    return;
  }

  var aucunResultat = true;

  for (var i = 0; i < étudiants.length; i++) {
    if (filièreChoisie && étudiants[i].filière !== filièreChoisie) continue;

    var nomComplet = (étudiants[i].nom + ' ' + étudiants[i].prénom).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (nomComplet.indexOf(recherche) === -1) continue;

    aucunResultat = false;

    var div = document.getElementById('template-suggestion')
      .content.cloneNode(true).querySelector('.élément-suggestion');
    div.textContent = étudiants[i].nom + ' ' + étudiants[i].prénom;
    div.dataset.id = étudiants[i].id;
    div.dataset.filière = étudiants[i].filière || '';
    suggestions.appendChild(div);
  }

  if (aucunResultat) {
    var msg = document.createElement('div');
    msg.textContent = 'Aucun étudiant trouvé';
    msg.style.cssText = 'padding:8px 10px;color:var(--texte-muet);font-size:.85rem';
    suggestions.appendChild(msg);
  }

  suggestions.classList.add('visible');
}

// Sélectionner un étudiant dans les suggestions
async function selectionnerÉtudiantsNote(id, nom, filière) {
  document.getElementById('f-note-recherche').value = nom;

  var selectEtu = document.getElementById('f-note-étudiant');
  selectEtu.innerHTML = '';

  var opt = document.createElement('option');
  opt.value = id;
  opt.selected = true;
  selectEtu.appendChild(opt);

  document.getElementById('f-note-suggestions').classList.remove('visible');

  // Auto-remplir le coefficient depuis la classe de l'étudiant
  if (filière) {
    var Prof = JSON.parse(sessionStorage.getItem('Prof'));
    if (Prof) {
      try {
        var classe = await DB.classes.récupérerClasseParFilière(filière, Prof.id);
        if (classe && classe.coefficient) {
          document.getElementById('f-note-coeff').value = classe.coefficient;
        }
      } catch (erreur) {
        afficherNotification('Erreur chargement coefficient', 'error');
      }
    }
  }
}

// Attacher les événements du formulaire note
function attacherEvenementsNote(étudiants) {
  // Filtrer par filière
  document.getElementById('f-note-filière').onchange = function() {
    document.getElementById('f-note-recherche').value = '';
    document.getElementById('f-note-étudiant').innerHTML = '';
    filtrerÉtudiantsNote(étudiants);
  };

  // Filtrer pendant la saisie
  document.getElementById('f-note-recherche').oninput = function() {
    filtrerÉtudiantsNote(étudiants);
  };

  // Sélectionner au clic sur une suggestion
  document.getElementById('f-note-suggestions').onmousedown = function(e) {
    var el = e.target.closest('div[data-id]');
    if (el) {
      selectionnerÉtudiantsNote(el.dataset.id, el.textContent.trim(), el.dataset.filière);
    }
  };

  // Cacher les suggestions au blur
  document.getElementById('f-note-recherche').onblur = function() {
    setTimeout(function() {
      document.getElementById('f-note-suggestions').classList.remove('visible');
    }, 200);
  };
}

async function supprimerNote(id) {
  // Cloner le template de confirmation
  var contenu = document.getElementById('template-confirmer-suppression-note')
    .content.cloneNode(true);
  // Afficher la fenêtre de confirmation
  ouvrirFenetre('Confirmer', contenu.firstElementChild.outerHTML, [
    {
      text: 'Annuler',
      class: 'btn-contour',
      action: function() { fermerFenetre(); }
    },
    {
      text: 'Supprimer',
      class: 'btn-danger',
      action: async function() {
        try {
          await DB.notes.supprimerNote(id);
          fermerFenetre();
          await afficherNotes();
          afficherNotification('Note supprimée', 'success');
        } catch (erreur) {
          afficherNotification('Erreur suppression note', 'error');
        }
      }
    }
  ]);
};

async function afficherSaisieRapide() {
  var Prof = JSON.parse(sessionStorage.getItem('Prof'));
  var classes = [];
  var tousÉtudiants = [];

  try {
    classes = await DB.classes.récupérerClasses(Prof.id);
    tousÉtudiants = await DB.étudiants.récupérerÉtudiants();
  } catch (erreur) {
    afficherNotification('Erreur chargement saisie en lot', 'error');
  }

  // Remplir le selecteur de classe
  var selecteurClasse = document.getElementById('lot-classe');
  selecteurClasse.innerHTML = '';

  for (var i = 0; i < classes.length; i++) {
    var opt = document.createElement('option');
    opt.value = classes[i].id;
    opt.textContent = classes[i].nom;
    selecteurClasse.appendChild(opt);
  }

  // Coefficient par défaut depuis la première classe
  if (classes.length > 0) {
    document.getElementById('lot-coeff').value = classes[0].coefficient || '1';
  }

  // Charger les étudiants au changement de classe
  selecteurClasse.onchange = function() {
    chargerÉtudiantsLot(classes, tousÉtudiants);
    var idChoisi = parseInt(document.getElementById('lot-classe').value);
    for (var i = 0; i < classes.length; i++) {
      if (classes[i].id === idChoisi) {
        document.getElementById('lot-coeff').value = classes[i].coefficient || '1';
        break;
      }
    }
  };
  if (classes.length > 0) await chargerÉtudiantsLot(classes, tousÉtudiants);

  document.getElementById('btn-lot-enregistrer').onclick = function() {
    enregistrerLot(classes, tousÉtudiants, Prof);
  };
  document.getElementById('btn-retour-notes').onclick = function() {
    window.location.hash = '#/notes';
  };
};

// Charger les étudiants d'une classe pour la saisie en lot
async function chargerÉtudiantsLot(classes, tousÉtudiants) {
  var classeChoisie = parseInt(document.getElementById('lot-classe').value);
  var filièreChoisie = '';

  // Trouver la filière de la classe choisie
  for (var i = 0; i < classes.length; i++) {
    if (classes[i].id === classeChoisie) {
      filièreChoisie = classes[i].filière;
      break;
    }
  }

  // Charger les notes déjà existantes pour cette classe
  var notesExistantes = [];
  try {
    notesExistantes = await DB.notes.obtenirNotes(classeChoisie);
  } catch (erreur) {
    afficherNotification('Erreur chargement notes existantes', 'error');
  }

  // Indexer les notes par étudiant_id
  var dico = {};
  for (var i = 0; i < notesExistantes.length; i++) {
    dico[notesExistantes[i].étudiant_id] = notesExistantes[i];
  }

  // Afficher chaque étudiant de la filière
  var zoneCorps = document.getElementById('lot-corps');
  zoneCorps.innerHTML = '';

  for (var i = 0; i < tousÉtudiants.length; i++) {
    var e = tousÉtudiants[i];
    if (e.filière !== filièreChoisie) continue;

    var existante = dico[e.id];
    var valeurNote = existante ? existante.valeur : '';
    var valeurCommentaire = existante ? (existante.commentaire || '') : '';
    var noteId = existante ? existante.id : '';

    var ligne = document.getElementById('template-ligne-lot')
      .content.cloneNode(true).querySelector('tr');

    ligne.querySelector('.lot-nom').textContent = e.nom;
    ligne.querySelector('.lot-prénom').textContent = e.prénom;
    ligne.querySelector('.lot-cne').textContent = e.cne;
    ligne.querySelector('.lot-note').value = valeurNote;
    ligne.querySelector('.lot-note').dataset.etu = e.id;
    ligne.querySelector('.lot-note').dataset.noteId = noteId;
    ligne.querySelector('.lot-commentaire').value = valeurCommentaire;
    ligne.querySelector('.lot-commentaire').dataset.etu = e.id;

    zoneCorps.appendChild(ligne);
  }
}

// Enregistrer toutes les notes du lot
async function enregistrerLot(classes, tousÉtudiants, Prof) {
  // Lire la classe, le type et le semestre
  var classeChoisie = parseInt(document.getElementById('lot-classe').value);
  var typeChoisie = document.getElementById('lot-type').value;
  var semestre = semestreActuel();

  // Parcourir les lignes du tableau
  var lignes = document.querySelectorAll('.lot-note');
  var notesAInserer = [];
  var notesAModifier = [];
  var erreurSaisie = false;

  for (var i = 0; i < lignes.length; i++) {
    var valeurSaisie = lignes[i].value.trim();
    var noteId = lignes[i].dataset.noteId;
    if (valeurSaisie === '' && !noteId) continue;

    if (valeurSaisie !== '') {
      var valeurNumerique = parseFloat(valeurSaisie);
      if (isNaN(valeurNumerique) || valeurNumerique < 0 || valeurNumerique > 20) {
        erreurSaisie = true;
        continue;
      }
    }

    var étudiantsId = parseInt(lignes[i].dataset.etu);

    var commentaireEl = document.querySelector('.lot-commentaire[data-etu="' + étudiantsId + '"]');
    var commentaire = null;
    if (commentaireEl) {
      commentaire = commentaireEl.value.trim();
      if (!commentaire) commentaire = null;
    }

    var donnéesCommunes = {
      coefficient: parseFloat(document.getElementById('lot-coeff').value) || 1,
      type: typeChoisie,
      semestre: semestre,
      commentaire: commentaire
    };

    if (noteId) {
      if (valeurSaisie !== '') {
        donnéesCommunes.valeur = valeurNumerique;
        notesAModifier.push({ id: parseInt(noteId), données: donnéesCommunes });
      }
    } else {
      donnéesCommunes.étudiant_id = étudiantsId;
      donnéesCommunes.module_id = classeChoisie;
      donnéesCommunes.valeur = valeurNumerique;
      notesAInserer.push(donnéesCommunes);
    }
  }

  if (erreurSaisie) {
    afficherNotification('Notes invalides (doivent être entre 0 et 20)', 'error');
    return;
  }
  if (notesAInserer.length === 0 && notesAModifier.length === 0) {
    afficherNotification('Aucune note saisie', 'info');
    return;
  }

  // Enregistrer les notes
  try {
    if (notesAInserer.length > 0) {
      await DB.notes.ajouterplusieursNote(notesAInserer);
    }
    if (notesAModifier.length > 0) {
      await Promise.all(notesAModifier.map(function(n) {
        return DB.notes.modifierNote(n.id, n.données);
      }));
    }
    var total = notesAInserer.length + notesAModifier.length;
    afficherNotification(total + ' note(s) enregistrée(s)', 'success');
    pagination.notes = 1;
    await chargerÉtudiantsLot(classes, tousÉtudiants);
  } catch (erreur) {
    afficherNotification('Erreur', 'error');
  }
}
