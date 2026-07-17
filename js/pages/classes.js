async function afficherClasses() {
  // Récupérer le professeur connecté
  var Prof = JSON.parse(sessionStorage.getItem('Prof'));
  if (!Prof) return;

  var grille = document.getElementById('grille-classes');

  // Cacher tous les messages vides
  document.getElementById('msg-classe-vide').hidden = true;
  document.getElementById('msg-classe-recherche').hidden = true;
  document.getElementById('msg-classe-erreur').hidden = true;

  // vider la grille (sans supprimer les messages)
  var cartes = grille.querySelectorAll('.carte-générale');
  for (var i = 0; i < cartes.length; i++) { cartes[i].remove(); }

  // Récupérer le texte de recherche
  var texteRecherche = '';
  var champRecherche = document.getElementById('recherche-classes');
  if (champRecherche) {
    texteRecherche = champRecherche.value.trim().toLowerCase();
  }

  try {
    // Charger les classes depuis Supabase
    var classes = await DB.classes.récupérerClasses(Prof.id);

    // Si aucune classe, on affiche un message vide
    if (!classes || classes.length === 0) {
      document.getElementById('barre-sélection-classes').classList.add('caché');
      document.getElementById('msg-classe-vide').hidden = false;
      return;
    }

    // Si un texte de recherche est saisi, on filtre les classes
    if (texteRecherche) {
      var classesFiltrees = [];
      for (var i = 0; i < classes.length; i++) {
        var nom = classes[i].nom;
        if (nom && nom.toLowerCase().indexOf(texteRecherche) !== -1) {
          classesFiltrees.push(classes[i]);
        }
      }
      classes = classesFiltrees;
      if (classes.length === 0) {
        document.getElementById('msg-classe-recherche').hidden = false;
        return;
      }
    }

    // Barre de sélection (checkbox)
    var barre = document.getElementById('barre-sélection-classes');
    if (sélectionActive) {
      barre.classList.remove('caché');

      var compteur = Object.keys(classesSélectionnées).length;
      barre.querySelector('#compteur-sélection-classes').textContent =
        compteur + ' classe(s) sélectionnée(s)';
    } else {
      barre.classList.add('caché');
    }

    // construit chaque carte de classe à partir du template
    for (var i = 0; i < classes.length; i++) {
      var c = classes[i];
      var carte = créerCarteClasse(c, sélectionActive);
      grille.appendChild(carte);
    }

  } catch (erreur) {
    if (grille) {
      var cartes = grille.querySelectorAll('.carte-générale');
      for (var i = 0; i < cartes.length; i++) { cartes[i].remove(); }
    }
    var msgErreur = document.getElementById('msg-classe-erreur');
    if (msgErreur) msgErreur.hidden = false;
  }
};

function créerCarteClasse(c, modeSélection) {
  // Cloner le template
  var carte = document.getElementById('template-carte-classe')
    .content.cloneNode(true).querySelector('.carte-générale');

  // Nom de la classe
  carte.querySelector('.nom-classe').textContent = c.nom;

  // Nombre d'étudiants (singulier/pluriel)
  var texte = c.nb_étudiants + ' étudiant';
  if (c.nb_étudiants > 1) texte += 's';
  if (c.coefficient != null) texte += ' - Coeff ' + parseFloat(c.coefficient).toFixed(1).replace('.0', '');
  carte.querySelector('.niveau-classe').textContent = texte;

  // Badge statut (vert/jaune/rouge)
  var couleurÉtiquette = '';
  if (c.statut === 'Complet') {
    couleurÉtiquette = 'étiquette-vert';
  } else if (c.statut === 'En cours') {
    couleurÉtiquette = 'étiquette-jaune';
  } else {
    couleurÉtiquette = 'étiquette-rouge';
  }
  var etiquette = carte.querySelector('.étiquette');
  etiquette.textContent = c.statut;
  etiquette.classList.add(couleurÉtiquette);

  // Moyenne
  carte.querySelector('.classe-moyenne').textContent =
    c.moyenne_classe != null ? 
    c.moyenne_classe.toFixed(1).replace('.', ',') + '/20' : '—/20';

  // Notes saisies / attendues
  carte.querySelector('.classe-notes').textContent =
    c.notes_saisies + '/' + c.notes_attendues;

  // Barre de progression
  carte.querySelector('.progression-classe').style.width =
    Math.min(c.progression, 100) + '%';

  // Mode sélection (checkbox) ou mode normal (boutons)
  var checkbox = carte.querySelector('.case-cocher-classe');
  var actions  = carte.querySelector('.actions-carte');

  // On affiche la checkbox en mode sélection, sinon les boutons d'action
  if (modeSélection) {
    checkbox.style.display = 'inline-block';
    actions.style.display = 'none';

    if (classesSélectionnées[c.id]) {
      checkbox.checked = true;
    }

    checkbox.onclick = function() { cocherClasse(c.id, checkbox.checked); };

  } else {
    checkbox.style.display = 'none';
    actions.style.display = 'flex';

    carte.querySelector('.btn-voir-étudiants').onclick = function() {
      window.location.hash = '#/étudiants/' + c.id;
    };
    carte.querySelector('.btn-saisir-note').onclick = function() {
      window.location.hash = '#/notes';
      setTimeout(function() {
        var bouton = document.getElementById('btn-ajouter-note');
        if (bouton) bouton.click();
      }, 100);
    };
  }

  return carte;
}

async function ajouterClasse(id) {
  // Charger la classe si modification
  var module = null;
  if (id) {
    try {
      module = await DB.classes.récupérerClasseParId(id);
    } catch (erreur) { 
      afficherNotification('Erreur chargement classe', 'error'); 
      return;
    }
  }

  // cloner le formulaire depuis le template
  var formulaire = document.getElementById('template-formulaire-classe')
    .content.cloneNode(true).querySelector('#formulaire-classe');

  // On remplit les valeurs si modification
  if (module) {
    formulaire.querySelector('#f-classe-nom').value = module.nom;
    formulaire.querySelector('#f-classe-filière').value = module.filière;
    formulaire.querySelector('#f-classe-coefficient').value = module.coefficient || 1;
  }

  // On ouvre la fenêtre
  ouvrirFenetreFormulaire(
    id ? 'Modifier la classe' : 'Nouvelle classe',
    formulaire.outerHTML,
    async function() {
        var données = {
          nom: document.getElementById('f-classe-nom').value.trim(),
          filière: document.getElementById('f-classe-filière').value.trim(),
          coefficient: parseFloat(document.getElementById('f-classe-coefficient').value) || 1
        };

        if (!données.nom) {
          afficherNotification('Nom requis', 'error');
          return;
        }
        if (!données.filière) {
          afficherNotification('Filière requise', 'error');
          return;
        }

        try {
          if (id) {
            await DB.classes.modifierClasse(id, données);
            fermerFenetre();
            await afficherClasses();
            afficherNotification('Classe modifiée', 'success');
          } else {
            await DB.classes.ajouterClasse(données);
            fermerFenetre();
            await afficherClasses();
            afficherNotification('Classe ajoutée', 'success');
          }
        } catch (erreur) {
          afficherNotification(erreur.message || 'Erreur', 'error');
        }
      },
    id ? 'Modifier' : 'Ajouter'
  );
};

function basculerSélectionClasse() {
  if (sélectionActive) {
    sélectionActive = false;
    classesSélectionnées = {};
  } else {
    sélectionActive = true;
  }
  afficherClasses();
};

function cocherClasse(id, estCoche) {
  if (estCoche) {
    classesSélectionnées[id] = true;
  } else {
    delete classesSélectionnées[id];
  }

  var compteur = Object.keys(classesSélectionnées).length;
  document.getElementById('compteur-sélection-classes').textContent =
    compteur + ' classe(s) sélectionnée(s)';
  var nbSélection = document.getElementById('nombre-sélection-classes');
  if (nbSélection) nbSélection.textContent = compteur;
};

async function supprimerClasses() {
  var tableauCles = Object.keys(classesSélectionnées);
  var Ids = [];

  for (var i = 0; i < tableauCles.length; i++) {
    Ids.push(Number(tableauCles[i]));
  }

  if (Ids.length === 0) {
    return;
  }

  var contenu = document.getElementById('template-confirmer-suppression-classes')
    .content.cloneNode(true);
  contenu.querySelector('.nb-classes').textContent = Ids.length;

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
          await DB.classes.supprimerClasses(Ids);
          fermerFenetre();
          classesSélectionnées = {};
          sélectionActive = false;
          await afficherClasses();
          afficherNotification(Ids.length + ' classe(s) supprimée(s)', 'success');
        } catch (erreur) {
          fermerFenetre();
          afficherNotification('Erreur', 'error');
        }
      }
    }
  ]);
};

function annulerSélectionClasses() {
  sélectionActive = false;
  classesSélectionnées = {};
  afficherClasses();
};
