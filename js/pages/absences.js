function cacherSaisie() {
  // Cacher la carte de saisie et la barre d'outils
  document.getElementById('abs-saisie-carte').hidden = true;
  document.getElementById('abs-barre-outils').hidden = true;
}

function viderTableau(idCorps, idMsg) {
  // Vider le tableau et cacher le message vide
  var corps = document.getElementById(idCorps);
  var lignes = corps.querySelectorAll('tr');
  for (var i = 0; i < lignes.length; i++) {
    if (lignes[i].id !== idMsg) lignes[i].remove();
  }
  document.getElementById(idMsg).hidden = true;
}

function remplirSelect(idSelect, données, cleValeur, cleTexte, optionParDéfaut) {
  // Remplir une liste déroulante à partir d'un tableau
  var select = document.getElementById(idSelect);
  select.innerHTML = '';
  var opt = document.createElement('option');
  opt.value = '';
  opt.textContent = optionParDéfaut;
  select.appendChild(opt);
  for (var i = 0; i < données.length; i++) {
    var opt = document.createElement('option');
    opt.value = données[i][cleValeur];
    opt.textContent = données[i][cleTexte];
    select.appendChild(opt);
  }
}

function formaterDateAujourdhui(date) {
  // Formatter une date en YYYY-MM-DD
  if (!date) date = new Date();
  var annee = date.getFullYear();
  var mois = String(date.getMonth() + 1).padStart(2, '0');
  var jour = String(date.getDate()).padStart(2, '0');
  return annee + '-' + mois + '-' + jour;
}

function formaterDateHeureMaintenant() {
  // Formatter la date et l'heure actuelles en ISO local
  var maintenant = new Date();
  var heure = String(maintenant.getHours()).padStart(2, '0');
  var minutes = String(maintenant.getMinutes()).padStart(2, '0');
  return formaterDateAujourdhui(maintenant) + 'T' + heure + ':' + minutes;
}

function créerCallback(données, fonction) {
  // Créer une fermeture pour le callback
  return function() {
    fonction(données.date_séance, données.classe_id, données.type_séance);
  };
}

async function afficherAbsences() {
  // Récupérer le professeur connecté
  var Prof = JSON.parse(sessionStorage.getItem('Prof'));
  if (!Prof) return;

  // Cacher la saisie et vider le tableau
  cacherSaisie();
  viderTableau('abs-corps', 'msg-absences-vide');

  try {
    // Charger les classes depuis Supabase
    var classes = await DB.classes.récupérerClasses(Prof.id);

    // Remplir liste déroulante des classes
    remplirSelect('abs-classe', classes, 'id', 'nom', 'Sélectionner une classe');

    // Date et heure par défaut
    document.getElementById('abs-date').value = formaterDateHeureMaintenant();

    // Associer les boutons de saisie
    document.getElementById('abs-confirmer').onclick = confirmerSelection;
    document.getElementById('abs-enregistrer').onclick = enregistrerAbsences;

    // Filtre par classe
    remplirSelect('abs-filtre-classe', classes, 'id', 'nom', 'Toutes les classes');

    // Filtres par date, classe et type
    document.getElementById('abs-filtre-date').value = formaterDateAujourdhui();
    document.getElementById('abs-filtre-date').onchange = appliquerFiltresHistorique;
    document.getElementById('abs-filtre-classe').onchange = appliquerFiltresHistorique;
    document.getElementById('abs-filtre-type').onchange = appliquerFiltresHistorique;

    // Charger l'historique des séances
    await appliquerFiltresHistorique();
  } catch (err) {
    afficherNotification('Erreur: ' + err.message, 'error');
  }
}

async function confirmerSelection() {
  var classeId = parseInt(document.getElementById('abs-classe').value);
  var dateSéance = document.getElementById('abs-date').value;
  var typeSéance = document.getElementById('abs-type').value;

  // Vérifier les champs obligatoires
  if (!classeId || !dateSéance || !typeSéance) {
    afficherNotification('Veuillez remplir tous les champs.', 'error');
    return;
  }

  var Prof = JSON.parse(sessionStorage.getItem('Prof'));
  if (!Prof) return;

  try {
    var classes = await DB.classes.récupérerClasses(Prof.id);
    var filière = '';
    for (var i = 0; i < classes.length; i++) {
      if (classes[i].id === classeId) {
        filière = classes[i].filière;
        break;
      }
    }

    var tousÉtudiants = await DB.étudiants.récupérerÉtudiants();
  } catch (erreur) {
    afficherNotification('Erreur chargement données', 'error');
    return;
  }
  var étudiants = [];
  for (var i = 0; i < tousÉtudiants.length; i++) {
    if (tousÉtudiants[i].filière === filière) {
      étudiants.push(tousÉtudiants[i]);
    }
  }

  // Vider le tableau
  viderTableau('abs-corps', 'msg-absences-vide');

  // Afficher les étudiants ou un message vide
  if (étudiants.length === 0) {
    document.getElementById('msg-absences-vide').hidden = false;
  } else {
    var template = document.getElementById('template-ligne-absence');

    for (var i = 0; i < étudiants.length; i++) {
      var e = étudiants[i];
      var ligne = template.content.cloneNode(true).querySelector('tr');
      ligne.setAttribute('data-étudiant-id', e.id);
      ligne.querySelector('.abs-nom').textContent = e.nom || '';
      ligne.querySelector('.abs-prénom').textContent = e.prénom || '';
      ligne.querySelector('.abs-cne').textContent = e.cne || '';
 
      var chkPresent = ligne.querySelector('.abs-présent');
      let chkJustifie = ligne.querySelector('.abs-justifié');

      // Désactiver justifié si présent
      chkPresent.addEventListener('change', function() {
        chkJustifie.disabled = this.checked;
        if (this.checked) { chkJustifie.checked = false; }
      });

      document.getElementById('abs-corps').appendChild(ligne);
    }
  }

  // Afficher la carte de saisie
  document.getElementById('abs-saisie-carte').hidden = false;
  document.getElementById('abs-barre-outils').hidden = false;
}

async function enregistrerAbsences() {
  var lignes = document.querySelectorAll('#abs-corps tr');
  if (lignes.length === 0) { afficherNotification('Aucune absence à enregistrer.', 'info'); return; }

  var classeId = parseInt(document.getElementById('abs-classe').value);
  var dateSéance = document.getElementById('abs-date').value;
  var typeSéance = document.getElementById('abs-type').value;
  var absences = [];

  // Construire le tableau d'absences
  for (var i = 0; i < lignes.length; i++) {
    var ligne = lignes[i];
    var etudiantId = parseInt(ligne.getAttribute('data-étudiant-id'));
    if (!etudiantId) continue;

    absences.push({
      étudiant_id: etudiantId,
      classe_id: classeId,
      date_séance: dateSéance,
      type_séance: typeSéance,
      est_present: ligne.querySelector('.abs-présent').checked,
      est_justifié: ligne.querySelector('.abs-justifié').checked
    });
  }

  if (absences.length === 0) { 
    afficherNotification('Aucune donnée valide à enregistrer.', 'info'); 
    return; 
  }

  try {
    // Supprimer les anciennes absences si modification
    if (document.getElementById('abs-enregistrer').dataset.modeModification === 'true') {
      await DB.absences.supprimerSéance(classeId, dateSéance, typeSéance);
      delete document.getElementById('abs-enregistrer').dataset.modeModification;
    }

    // Enregistrer les nouvelles absences
    await DB.absences.insererAbsences(absences);
    afficherNotification('Feuille d\'appel sauvegardée', 'success');

    // Réinitialiser l'interface
    cacherSaisie();
    viderTableau('abs-corps', 'msg-absences-vide');

    await appliquerFiltresHistorique();
  } catch (err) {
    afficherNotification('Erreur : ' + err.message, 'error');
  }
}

async function appliquerFiltresHistorique(absHistoriqueComplet) {
  if (!absHistoriqueComplet) {
    var Prof = JSON.parse(sessionStorage.getItem('Prof'));
    if (!Prof) { viderTableau('abs-historique-corps', 'msg-abs-historique-vide'); return; }
    try {
      absHistoriqueComplet = await DB.absences.récupérerHistorique(Prof.id);
    } catch (erreur) {
      afficherNotification('Erreur chargement historique', 'error');
      viderTableau('abs-historique-corps', 'msg-abs-historique-vide');
      return;
    }
  }
  var filtreDate = document.getElementById('abs-filtre-date').value;
  var filtreClasse = document.getElementById('abs-filtre-classe').value;
  var filtreType = document.getElementById('abs-filtre-type').value;

  // Filtrer les séances selon les critères
  var filtrees = [];
  for (var i = 0; i < absHistoriqueComplet.length; i++) {
    var s = absHistoriqueComplet[i];
    if (filtreDate && s.date_séance.substring(0, 10) !== filtreDate) continue;
    if (filtreClasse && s.classe_id != filtreClasse) continue;
    if (filtreType && s.type_séance !== filtreType) continue;
    filtrees.push(s);
  }

  // Vider le tableau
  viderTableau('abs-historique-corps', 'msg-abs-historique-vide');

  // Afficher un message si aucun résultat
  if (filtrees.length === 0) {
    document.getElementById('msg-abs-historique-vide').hidden = false;
    return;
  }

  // Remplir le tableau avec les séances filtrées
  var template = document.getElementById('template-ligne-historique');
  for (var i = 0; i < filtrees.length; i++) {
    var s = filtrees[i];
    var ligne = template.content.cloneNode(true).querySelector('tr');
    ligne.querySelector('.col-classe').textContent = s.classe_nom;
    ligne.querySelector('.col-date').textContent =
      s.date_séance.substring(0, 10) + ' ' + s.date_séance.substring(11, 16);
    ligne.querySelector('.col-filière').textContent = s.classe_filière || '';
    ligne.querySelector('.col-type').textContent = s.type_séance;
    ligne.querySelector('.col-nb').textContent = s.nb_étudiants;

    var données = {
      date_séance: s.date_séance,
      classe_id: s.classe_id,
      type_séance: s.type_séance
    };

    // Associer les boutons d'action
    ligne.querySelector('.btn-voir').onclick = créerCallback(données, voirDetailSéance);
    ligne.querySelector('.btn-modifier').onclick = créerCallback(données, modifierSéance);
    ligne.querySelector('.btn-supprimer').onclick = créerCallback(données, supprimerSéance);

    document.getElementById('abs-historique-corps').appendChild(ligne);
  }
}

async function voirDetailSéance(dateSéance, classeId, typeSéance) {
  var carte = document.getElementById('abs-séance-détail-carte');
  var cléSession = dateSéance + '|' + classeId + '|' + typeSéance;

  // Toggle : si même séance déjà affichée, cacher
  if (!carte.hidden && carte.dataset.session === cléSession) {
    carte.hidden = true;
    return;
  }

  try {
    // Charger les absences de la séance
    var absences = await DB.absences.absencesSéance(classeId, dateSéance, typeSéance);
    var tbody = document.getElementById('abs-séance-détail-corps');
    tbody.innerHTML = '';

    // Cloner le template pour chaque étudiant
    var template = document.getElementById('template-ligne-détail-absence');
    for (var i = 0; i < absences.length; i++) {
      var a = absences[i];
      var ligne = template.content.cloneNode(true).querySelector('tr');
      ligne.querySelector('.abs-nom').textContent = a.étudiant?.nom || '';
      ligne.querySelector('.abs-prénom').textContent = a.étudiant?.prénom || '';
      ligne.querySelector('.abs-cne').textContent = a.étudiant?.cne || '';
      ligne.querySelector('.abs-présent').checked = a.est_present;
      ligne.querySelector('.abs-justifié').checked = a.est_justifié;
      tbody.appendChild(ligne);
    }

    // Afficher la carte de détail
    carte.dataset.session = cléSession;
    carte.hidden = false;
    document.getElementById('abs-séance-détail-carte').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    afficherNotification('Erreur chargement détail : ' + err.message, 'error');
  }
}

async function modifierSéance(dateSéance, classeId, typeSéance) {
  var carteSaisie = document.getElementById('abs-saisie-carte');
  var btnEnregistrer = document.getElementById('abs-enregistrer');
  var cléSession = dateSéance + '|' + classeId + '|' + typeSéance;

  // Toggle : si même séance déjà en mode édition, cacher
  if (!carteSaisie.hidden && btnEnregistrer.dataset.modeModification === 'true' && carteSaisie.dataset.session === cléSession) {
    cacherSaisie();
    delete btnEnregistrer.dataset.modeModification;
    return;
  }

  carteSaisie.dataset.session = cléSession;

  // Cacher le détail
  document.getElementById('abs-séance-détail-carte').hidden = true;

  // Pré-remplir le formulaire
  document.getElementById('abs-classe').value = classeId;
  document.getElementById('abs-date').value = dateSéance.substring(0, 16);
  document.getElementById('abs-type').value = typeSéance;

  // Charger les étudiants
  try {
    await confirmerSelection();
  } catch (erreur) {
    afficherNotification('Erreur chargement séance', 'error');
    return;
  }

  try {
    // Restaurer les coches existantes
    var absences = await DB.absences.absencesSéance(classeId, dateSéance, typeSéance);
    for (var i = 0; i < absences.length; i++) {
      var a = absences[i];
      var ligne = document.querySelector('#abs-corps tr[data-étudiant-id="' + a.étudiant_id + '"]');
      if (ligne) {
        ligne.querySelector('.abs-présent').checked = a.est_present;
        ligne.querySelector('.abs-justifié').checked = a.est_justifié;
      }
    }
    // Activer le mode modification
    document.getElementById('abs-enregistrer').dataset.modeModification = 'true';
  } catch (err) {
    afficherNotification('Erreur chargement données : ' + err.message, 'error');
  }

  document.getElementById('vue-absences').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function supprimerSéance(dateSéance, classeId, typeSéance) {
  // Afficher la fenêtre de confirmation
  ouvrirFenetre('Confirmer', '<p>Supprimer cette séance ? Toutes les absences associées seront effacées.</p>', [
    {
      text: 'Annuler',
      class: 'btn-contour',
      action: function() { fermerFenetre(); }
    },
    {
      text: 'Supprimer',
      class: 'btn-danger',
      action: async function() {
        fermerFenetre();
        try {
          // Supprimer la séance et recharger l'historique
          await DB.absences.supprimerSéance(classeId, dateSéance, typeSéance);
          afficherNotification('Séance supprimée', 'success');
          await appliquerFiltresHistorique();
        } catch (err) {
          afficherNotification('Erreur : ' + err.message, 'error');
        }
      }
    }
  ]);
}
