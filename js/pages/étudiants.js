afficherÉtudiants = async function(ClasseId) {
  // Si un Id de classe est fourni, on met à jour le filtre
  if (ClasseId !== undefined) {
    filtreClasseId = ClasseId;
    filtreClasseNom = null;
  }

  var recherche = document.getElementById('recherche-étudiants').value.trim();
  var filtre = filtreClasseId;
  var données;

  try {
    if (filtre) {
      var module = await DB.classes.récupérerClasseParId(filtre);
      if (module && module.filière) {
        données = await DB.étudiants.récupérerÉtudiantsAvecMoyenne();
        données = filtrerParFilière(données, module.filière);

      } else {
        données = [];
      }
      if (recherche && données.length > 0) {
        données = filtrerParRecherche(données, recherche);
      }
    } else if (recherche) {
      données = await DB.étudiants.chercherÉtudiants(recherche);
    } else {
      données = await DB.étudiants.récupérerÉtudiantsAvecMoyenne();
    }
  } catch (erreur) {
    données = [];
  }

  // Afficher le filtre actif (classe sélectionnée)
  var ctx = document.getElementById('étudiants-contexte-filtre');
  if (filtre) {
    ctx.style.display = 'flex';
    if (!filtreClasseNom) {
      try {
        var Module = await DB.classes.récupérerClasseParId(filtre);
        if (Module && Module.nom) {
          filtreClasseNom = Module.nom;
        } else {
          filtreClasseNom = 'Classe #' + filtre;
        }
      } catch (erreur) {
        filtreClasseNom = 'Classe #' + filtre;
      }
    }
    document.getElementById('étudiants-contexte-nom-classe').textContent = filtreClasseNom;
  } else {
    ctx.style.display = 'none';
  }

  trierDonnees(données);
  afficherTableauAvecPagination('étudiants', données, afficherLigneÉtudiants, 10);
};

function filtrerParFilière(liste, filière) {
  // Garder les étudiants d'une filière
  var résultat = [];
  for (var i = 0; i < liste.length; i++) {
    if (liste[i].filière === filière) {
      résultat.push(liste[i]);
    }
  }
  return résultat;
}

function filtrerParRecherche(liste, texte) {
  // Garder les étudiants correspondant au texte
  var min = texte.toLowerCase();
  var résultat = [];
  for (var i = 0; i < liste.length; i++) {
    var e = liste[i];
    if (contient(e.nom, min) || contient(e.prénom, min) || contient(e.cne, min)) {
      résultat.push(e);
    }
  }
  return résultat;
}

// Vérifier si un texte contient un mot (insensible à la casse)
function contient(valeur, recherche) {
  return valeur && valeur.toLowerCase().indexOf(recherche) !== -1;
}

// ──────────── Ouvrir la fiche d'étudiant ────────────

function voirÉtudiants(id) {
  window.location.hash = '#/étudiant/' + id;
};

async function afficherFicheÉtudiants(id) {
  try {
    var étudiants = await DB.étudiants.récupérerÉtudiantsParId(id);
    if (!étudiants || étudiants.id === undefined) {
      window.location.hash = '#/étudiants';
      return;
    }

    // Titre de la fiche
    document.getElementById('étudiant-nom-détail').textContent = "Informations personnelles";

    // On calcule la moyenne générale et la mention
    var moyenne = await DB.notes.obtenirMoyenneÉtudiants(id);
    var mention = calculerMention(moyenne);
    var couleur = 'var(--badge-échoué-text)';
    if (moyenne >= 10) {
      couleur = 'var(--badge-admis-text)';
    }

     // Remplir les infos de l'étudiant
     var info = document.getElementById('template-infos-détail').content.cloneNode(true);
    info.querySelector('.info-nom').textContent = étudiants.nom;
    info.querySelector('.info-prénom').textContent = étudiants.prénom;
    info.querySelector('.info-cne').textContent = (étudiants.cne || '').toUpperCase();
    info.querySelector('.info-filière').textContent = étudiants.filière;
    info.querySelector('.info-moyenne').textContent = moyenne;
    info.querySelector('.info-moyenne').style.color = couleur;
    info.querySelector('.info-mention').textContent = mention;

    var infoClasse = info.querySelector('.info-classe');
    if (étudiants.filière) {
      var prof = DB._professeur();
      if (prof) {
        var classe = await DB.classes.récupérerClasseParFilière(étudiants.filière, prof.id);
        infoClasse.textContent = (classe && classe.nom) || '';
      }
    } else {
      infoClasse.textContent = '';
    }

    var zoneInfo = document.getElementById('étudiant-infos-détail');
    zoneInfo.innerHTML = '';
    zoneInfo.appendChild(info);

    // Charger et grouper les notes par module
    var notes = await DB.notes.obtenirNotesÉtudiant(id);
    var groupes = grouperNotesParModule(notes);

    // Afficher les notes
    var zoneNotes = document.getElementById('étudiant-notes-détail');
    zoneNotes.innerHTML = '';

    var cles = Object.keys(groupes);
    if (cles.length === 0) {
      var emptyTable = document.getElementById('template-notes-vide').content.cloneNode(true);
      zoneNotes.appendChild(emptyTable);
    } else {
      for (var i = 0; i < cles.length; i++) {
        var nom = cles[i];
        var groupe = groupes[nom];
        var bloc = créerBlocModule(nom, groupe);
        zoneNotes.appendChild(bloc);
      }
    }
  } catch (erreur) {
    var msg = erreur && erreur.message ? erreur.message : String(erreur);
    afficherNotification('Erreur fiche: ' + msg.substring(0, 100), 'error');
    window.location.hash = '#/étudiants';
  }

  // Bouton retour vers la liste des étudiants
  document.getElementById('btn-retour-étudiants').onclick = function() {
    window.location.hash = '#/étudiants';
  };
};

function grouperNotesParModule(notes) {
  // Grouper les notes par nom de module
  var groupes = {};
  for (var i = 0; i < notes.length; i++) {
    var n = notes[i];
    var nomModule = n.classes && n.classes.nom;
    if (!groupes[nomModule]) {
      groupes[nomModule] = { notes: [], coefficient: n.coefficient };
    }
    groupes[nomModule].notes.push(n);
  }
  return groupes;
}

function créerBlocModule(nom, groupe) {
  // Calculer la moyenne pondérée du module
  var sommeP = 0;
  var sommeC = 0;
  for (var j = 0; j < groupe.notes.length; j++) {
    sommeP = sommeP + groupe.notes[j].valeur * groupe.notes[j].coefficient;
    sommeC = sommeC + groupe.notes[j].coefficient;
  }
  var moyModule = (sommeP / sommeC).toFixed(2);

  var bloc = document.getElementById('template-notes-module').content.cloneNode(true);

  var corps = bloc.querySelector('.module-corps');
  for (var j = 0; j < groupe.notes.length; j++) {
    var n = groupe.notes[j];
    var ligne = document.getElementById('template-ligne-note-fiche').content.cloneNode(true);
    ligne.querySelector('.col-type').textContent = n.type;
    ligne.querySelector('.col-note').textContent = n.valeur + '/20';
    ligne.querySelector('.col-coeff').textContent = n.coefficient;
    ligne.querySelector('.col-date').textContent = n.date_saisie ? n.date_saisie.split('T')[0] : '';
    ligne.querySelector('.col-commentaire').textContent = n.commentaire || '-';
    corps.appendChild(ligne);
  }

  return bloc;
}

// ──────────── ajouter ou modifier un étudiant ────────────

async function AjouterModifierÉtudiants(id) {
  var étudiants = null;
  if (id) {
    try {
      étudiants = await DB.étudiants.récupérerÉtudiantsParId(id);
    } catch (erreur) {
      afficherNotification('Erreur chargement étudiant', 'error');
    }
  }

  // Titre et texte du bouton selon ajout ou modification
  var titre = id ? "Modifier l'étudiant" : 'Ajouter un étudiant';
  var texteBouton = id ? 'Modifier' : 'Ajouter';

  // Cloner le formulaire depuis le template
  var formulaire = document.getElementById('template-formulaire-étudiant')
    .content.cloneNode(true).querySelector('#formulaire-étudiant');

  // Remplit les champs si modification
  if (étudiants) {
    formulaire.querySelector('#f-nom').value = étudiants.nom;
    formulaire.querySelector('#f-prénom').value = étudiants.prénom;
    formulaire.querySelector('#f-cne').value = étudiants.cne;
    formulaire.querySelector('#f-filière').value = étudiants.filière;
  }

  // CNE en majuscules automatiquement
  formulaire.querySelector('#f-cne').setAttribute('oninput', 'this.value = this.value.toUpperCase()');

  // On ouvre la fenêtre
  ouvrirFenetreFormulaire(
    titre,
    formulaire,
    async function() {
      // Effacer les erreurs précédentes
      var erreurs = document.querySelectorAll('#formulaire-étudiant .erreur-champ');
      for (var i = 0; i < erreurs.length; i++) {
        erreurs[i].textContent = '';
      }

      // Lecture des données
      var données = {
        nom: document.getElementById('f-nom').value.trim(),
        prénom: document.getElementById('f-prénom').value.trim(),
        cne: document.getElementById('f-cne').value.trim().toUpperCase(),
        filière: document.getElementById('f-filière').value.trim()
      };

      // Validation des champs requis
      if (validerÉtudiants(données) === false) return;

      // Enregistrement
      try {
        if (id) {
          await DB.étudiants.modifierÉtudiants(id, données);
          afficherNotification('Étudiant modifié', 'success');
        } else {
          await DB.étudiants.ajouterÉtudiants(données);
          afficherNotification('Étudiant ajouté', 'success');
        }
        fermerFenetre();
        await afficherÉtudiants();
      } catch (erreur) {
        afficherNotification('Erreur', 'error');
      }
    },
    texteBouton
  );
};

// Valider les champs du formulaire étudiant
function validerÉtudiants(d) {
  var erreur = true;

  if (!d.nom) {
    document.getElementById('nom-erreur').textContent = 'Champ requis'; 
    erreur = false; 
  }
  if (!d.prénom) {
    document.getElementById('prénom-erreur').textContent = 'Champ requis'; 
    erreur = false; 
  }
  if (!d.cne) {
    document.getElementById('cne-erreur').textContent = 'Champ requis'; 
    erreur = false; 
  }
  if (!d.filière){
    document.getElementById('filière-erreur').textContent = 'Champ requis'; 
    erreur = false; 
  }
  if (!erreur) return false;

  // Vérification du format CNE
  if (!CNE.test(d.cne)) {
    document.getElementById('cne-erreur').textContent = 'Lettre + 9 chiffres (ex: D123456789)';
    return false;
  }

  return true;
}

// Fenêtre pour confirmer la suppression d'un étudiant
async function supprimerÉtudiants(id) {
  var étudiants = null;
  try {
    étudiants = await DB.étudiants.récupérerÉtudiantsParId(id);
  } catch (erreur) { 
    afficherNotification('Erreur chargement étudiant', 'error'); 
  }

  var nomComplet = '';
  if (étudiants) {
    nomComplet = (étudiants.prénom || '') + ' ' + (étudiants.nom || '');
  }
  nomComplet = nomComplet.trim();

  // On affiche le nom dans le template
  var contenu = document.getElementById('template-confirmer-suppression').content.cloneNode(true);
  contenu.querySelector('.nom-étudiant').textContent = nomComplet;

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
          await DB.étudiants.supprimerÉtudiants(id);
        } catch (erreur) { afficherNotification('Erreur suppression étudiant', 'error'); }
        fermerFenetre();
        await afficherÉtudiants();
        afficherNotification('Étudiant supprimé', 'success');
      }
    }
  ]);
};
