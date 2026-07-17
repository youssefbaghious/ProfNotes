// Couleur texte selon la note
function obtenirCouleurNote(v) {
  if (v >= 12) return 'var(--badge-admis-text)';
  if (v >= 10) return 'var(--badge-limite-text)';
  return 'var(--badge-échoué-text)';
}

// Mention selon la moyenne
function calculerMention(m) {
  if (m >= 16) return 'Très Bien';
  if (m >= 14) return 'Bien';
  if (m >= 12) return 'Assez Bien';
  if (m >= 10) return 'Passable';
  return 'Insuffisant';
}

// Supprimer les éléments d'un conteneur
function nettoyer(conteneur, selecteur) {
  var els = conteneur.querySelectorAll(selecteur);
  for (var i = 0; i < els.length; i++) els[i].remove();
}

// Initiales à partir du prénom et nom
function calculerInitiales(prénom, nom) {
  var init = '';
  if (prénom) init += prénom.charAt(0).toUpperCase();
  if (nom) init += nom.charAt(0).toUpperCase();
  return init || 'P';
}

// Basculer visibilité mot de passe
function basculerMotDePasse(id) {
  var champ = document.getElementById(id);
  if (champ) {
    if (champ.type === 'password') {
      champ.type = 'text';
    } else {
      champ.type = 'password';
    }
    var icône = champ.parentElement.querySelector('.basculer-mot-de-passe i');
    if (icône) {
      icône.className = champ.type === 'password' ? 'far fa-eye-slash' : 'far fa-eye';
    }
  }
}

// Trier les données selon l'état de tri
var étatTri = { champ: null, ascendant: true };
function trierDonnees(données) {
  if (!étatTri.champ) return;

  var champ = étatTri.champ;
  données.sort(function(a, b) {
    var valeurA = a[champ];
    var valeurB = b[champ];

    if (valeurA === null || valeurA === undefined) {
      valeurA = '';
    }
    if (valeurB === null || valeurB === undefined) {
      valeurB = '';
    }

    var cmp;
    if (typeof valeurA === 'number') {
      cmp = valeurA - valeurB;
    } else {
      cmp = String(valeurA).localeCompare(String(valeurB));
    }

    if (étatTri.ascendant) {
      return cmp;
    } else {
      return -cmp;
    }
  });
}

// Formater le nom du professeur
function formaterNomProfesseur(prénom, nom) {
  if (prénom) {
    return "Prof. " + prénom + ' ' + nom;
  }
  return "Prof. " + nom;
}

// Mettre à jour l'avatar (photo ou initiales)
function mettreAJourAvatar(Prof, imgId, initialesId) {
  var initiales = calculerInitiales(Prof.prénom, Prof.nom);

  var img = document.getElementById(imgId);
  var txt = document.getElementById(initialesId);

  if (Prof.avatar) {
    img.src = Prof.avatar;
    img.style.display = '';
    txt.style.display = 'none';
  } else {
    img.style.display = 'none';
    txt.style.display = 'flex';
  }
  txt.textContent = initiales;
}

// ──────────── Initialisation ────────────

// Initialiser l'application
async function initialesialiser() {
  try {
    await chargerDonneesProfesseur();
    initialesialiserTheme();
    initialesialiserRoutage();
    initialesialiserEvenements();
    verifierAuthentification();
  } catch (erreur) {
    afficherNotification('Erreur critique', 'error');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  initialesialiser();
});

// Charger le thème depuis le localStorage
function initialesialiserTheme() {
  var theme = localStorage.getItem('theme');
  if (!theme) {
    theme = 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
}

// ──────────── Authentification ────────────

// Vérifier si l'utilisateur est connecté
async function verifierAuthentification() {
  var Prof = sessionStorage.getItem('Prof');
  if (Prof) { 
    gererRoute(); 
    return; 
  }

  // Fallback: chargerDonneesProfesseur a stocké 'professeur' (lowercase)
  var prof = sessionStorage.getItem('professeur');
  if (prof) {
    sessionStorage.setItem('Prof', prof);
    gererRoute();
    return;
  }
  
  try {
    var sessionR = await supabaseClient.auth.getSession();
    if (sessionR.data && sessionR.data.session && sessionR.data.session.user) {
      var user = sessionR.data.session.user;
      var nom = (user.user_metadata && user.user_metadata.full_name) || user.email.split('@')[0];
      var prénom = (user.user_metadata && user.user_metadata.given_name) || '';
      var prof = await DB.professeurs.lierProfesseur(user.email, user.id, nom, prénom);
      if (prof) {
        sessionStorage.setItem('professeur', JSON.stringify(prof));
        sessionStorage.setItem('Prof', JSON.stringify(prof));
        gererRoute();
        return;
      }
    }
  } catch (erreur) {}

  afficherConnexion();
}

// Afficher l'interface après la connexion
function afficherApplication() {
  var page = document.getElementById('page-connexion');
  if (page) page.classList.remove('actif');
  document.getElementById('application').classList.remove('caché');

  var Prof = JSON.parse(sessionStorage.getItem('Prof'));
  if (Prof) {
    document.getElementById('en-tête-nom-prof').textContent =
      formaterNomProfesseur(Prof.prénom, Prof.nom);
    mettreAJourAvatar(Prof, 'image-avatar', 'avatar-initiales');
    document.getElementById('barre-latérale-nom-utilisateur').textContent =
      formaterNomProfesseur(Prof.prénom, Prof.nom);
    document.getElementById('barre-latérale-email-utilisateur').textContent = Prof.email;
    mettreAJourAvatar(Prof, 'barre-latérale-avatar-image', 'barre-latérale-avatar-initiales');
  }
}

// Afficher la page de connexion
function afficherConnexion() {
  document.documentElement.setAttribute('data-theme', 'light');
  var app = document.getElementById('application');
  if (app) app.classList.add('caché');
  document.getElementById('page-connexion').classList.add('actif');
}

// Traiter la soumission du formulaire de connexion
async function gererConnexion() {
  var email = document.getElementById('connexion-email').value.trim();
  var motDePasse = document.getElementById('connexion-mot-de-passe').value.trim();
  var err = document.getElementById('erreur-connexion');

  if (!email || !motDePasse) { 
    err.textContent = 'Champs requis'; 
    return; 
  }
  err.textContent = '';

  try {
    var r = await DB.professeurs.connexion(email, motDePasse);
    if (!r.succes || !r.professeur) { 
      err.textContent = 'Email ou mot de passe incorrect'; 
      return; 
    }
    sessionStorage.setItem('Prof', JSON.stringify(r.professeur));
    initialesialiserTheme();
    window.location.hash = '#/tableau-de-bord';
  } catch (erreur) {
    err.textContent = erreur.message || 'Email ou mot de passe incorrect';
  }
}

// Traiter la soumission du formulaire d'inscription
async function gererInscription() {
  var prénom = document.getElementById('inscription-prénom').value.trim();
  var nom = document.getElementById('inscription-nom').value.trim();
  var email = document.getElementById('inscription-email').value.trim();
  var motDePasse = document.getElementById('inscription-mot-de-passe').value.trim();
  var err = document.getElementById('erreur-inscription');

  if (!prénom || !nom || !email || !motDePasse) { 
    err.textContent = 'Champs requis'; 
    return; 
  }
  if (motDePasse.length < 6) { 
    err.textContent = '6 caractères minimum'; 
    return; 
  }
  err.textContent = '';

  try {
    var r = await DB.professeurs.connexion(email, motDePasse, { nom: nom, prénom: prénom });
    if (!r.succes || !r.professeur) { 
      err.textContent = 'Impossible de créer le compte'; 
      return; 
    }
    sessionStorage.setItem('Prof', JSON.stringify(r.professeur));
    initialesialiserTheme();
    window.location.hash = '#/tableau-de-bord';
  } catch (erreur) {
    err.textContent = erreur.message || 'Erreur lors de la création';
  }
}

    // Déconnecter l'utilisateur
async function gererDeconnexion() {
  try {
    await supabaseClient.auth.signOut();
  } catch (e) {
    console.error('Déconnexion: erreur signOut', e);
  }
  sessionStorage.removeItem('Prof');
  window.location.hash = '#/connexion';
}

// Écouter les changements de hash
function initialesialiserRoutage() {
  window.addEventListener('hashchange', function() { 
    gererRoute(); 
  });
}

// Router: afficher la page selon le hash
async function gererRoute() {
  var hash = window.location.hash || '#/tableau-de-bord';
  var parts = hash.split('/');
  var route = decodeURIComponent(parts[1] || 'tableau-de-bord');
  var param = parts[2] ? decodeURIComponent(parts[2]) : null;

  var Prof = sessionStorage.getItem('Prof');

  if (!Prof && route !== 'connexion') {
    return;
  }

  mettreAJourNavigation(route);

  if (Prof && route !== 'connexion') {
    afficherApplication();
  }

  switch (route) {
    case 'connexion': afficherConnexion(); break;
    case 'déconnexion': await gererDeconnexion(); break;
    case 'tableau-de-bord': await afficherTableauDeBord(); break;
    case 'étudiants': await afficherÉtudiants(param ? parseInt(param) : null); break;
    case 'étudiant': await afficherFicheÉtudiants(param); break;
    case 'notes': await afficherNotes(); break;
    case 'saisie-lot': await afficherSaisieRapide(); break;
    case 'classes': await afficherClasses(); break;

    case 'absences': await afficherAbsences(); break;
    case 'profil': await afficherProfil(); break;
    default: window.location.hash = '#/tableau-de-bord';
  }
}

// Mettre à jour le titre et la navigation
var vueCourante = null;
function mettreAJourNavigation(route) {
  var titres = {
    'tableau-de-bord': 'Tableau de bord',
    'étudiants': 'Étudiants',
    'étudiant': 'Fiche d\'étudiant',
    notes: 'Notes',  
    'saisie-lot': 'Saisie en lot',
    classes: 'Classes',

    absences: 'Absences',
    profil: 'Mon profil'
  };

  var titrePage = titres[route];
  if (!titrePage) {
    titrePage = 'Tableau de bord';
  }
  document.getElementById('titre-page').textContent = titrePage;

  var liens = document.querySelectorAll('.lien-navigation');
  for (var i = 0; i < liens.length; i++) {
    liens[i].classList.remove('actif');
  }

  var lienActif = document.querySelector('.lien-navigation[data-nav="' + route + '"]');
  if (lienActif) {
    lienActif.classList.add('actif');
  }

  var vues = document.querySelectorAll('.vue-page');
  for (var i = 0; i < vues.length; i++) {
    vues[i].classList.remove('actif');
  }

  var map = { 
    'étudiant': 'étudiant-détail', 
    'saisie-lot': 'saisie-lot' 
  };
  var id = map[route] || route;
  var vue = document.getElementById('vue-' + id);
  if (vue) {
    vue.classList.add('actif');
  }

  vueCourante = route;
}

// ──────────── Événements ────────────

// Initialiser tous les écouteurs d'événements
var filtreClasseId = null;
var filtreClasseNom = null;
var sélectionActive = false;
var classesSélectionnées = {};
function initialesialiserEvenements() {
  function écouter(id, fonction) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', fonction);
    }
  }
  écouter('bascule-thème', function() { basculerTheme(); });
  écouter('btn-menu-mobile', function() { basculerBarreLaterale(); });
  écouter('barre-latérale-superposition', function() { fermerBarreLaterale(); });
  écouter('fenêtre-fermer', function() { fermerFenetre(); });
  écouter('btn-supprimer-classes', function() { basculerSélectionClasse(); });
  écouter('btn-confirmer-suppression-classes', supprimerClasses);
  écouter('btn-annuler-suppression-classes', annulerSélectionClasses);
  écouter('btn-ajouter-classe', function() { ajouterClasse(null); });
  écouter('btn-effacer-filtre-classe', function() {
    filtreClasseId = null;
    filtreClasseNom = null;
    window.location.hash = '#/classes';
  });
  écouter('btn-ajouter-étudiant', function() { AjouterModifierÉtudiants(null); });
  écouter('btn-ajouter-note', function() { AjouterModifierNote(null); });
  écouter('btn-saisie-lot', function() { window.location.hash = '#/saisie-lot'; });
  écouter('btn-déconnexion-barre-latérale', function(e) { e.preventDefault(); gererDeconnexion(); });
  écouter('btn-déconnexion-en-tête', function(e) { e.preventDefault(); gererDeconnexion(); });
  écouter('tableau-de-bord-ajouter-note', function() {
    window.location.hash = '#/notes';
    setTimeout(function() {
      var bouton = document.getElementById('btn-ajouter-note');
      if (bouton) {
        bouton.click();
      }
    }, 100);
  });

  // Écouteur pour réduire ou étendre la barre latérale
  écouter('barre-latérale-bascule', function() {
    document.getElementById('barre-latérale').classList.toggle('réduit');
    var contenu = document.querySelector('.contenu-principal');
    if (contenu) {
      contenu.classList.toggle('barre-latérale-réduite');
    }
  });

  écouter('basculer-mot-de-passe-connexion', function() { basculerMotDePasse('connexion-mot-de-passe'); });
  écouter('basculer-mot-de-passe-inscription', function() { basculerMotDePasse('inscription-mot-de-passe'); });

  function écouterFormulaire(id, fn) {
    var form = document.getElementById(id);
    if (form) {
      form.addEventListener('submit', function(e) { e.preventDefault(); fn(); });
    }
  }

  écouterFormulaire('formulaire-connexion', gererConnexion);
  écouterFormulaire('formulaire-inscription', gererInscription);

  // Écouteur pour la connexion avec Google
  écouter('btn-google-connexion', async function() {
    try {
      await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
      });
    } catch (e) { afficherNotification('Erreur Google', 'error'); }
  });

  // Lien pour afficher le formulaire d'inscription
  écouter('afficher-inscription', function(e) {
    e.preventDefault();
    document.getElementById('erreur-connexion').textContent = '';
    document.getElementById('conteneur-connexion').style.display = 'none';
    document.getElementById('conteneur-inscription').style.display = 'flex';
  });

  // Lien pour afficher le formulaire de connexion
  écouter('afficher-connexion', function(e) {
    e.preventDefault();
    document.getElementById('erreur-inscription').textContent = '';
    document.getElementById('conteneur-inscription').style.display = 'none';
    document.getElementById('conteneur-connexion').style.display = 'flex';
  });

  // Clic sur la superposition de la fenêtre pour la fermer
  var superposition = document.getElementById('fenêtre-superposition');
  if (superposition) {
    superposition.addEventListener('click', function(e) {
      if (e.target === e.currentTarget) {
        fermerFenetre();
      } 
    });
  }

  // Quand la fenêtre est redimensionnée, on ferme la barre latérale sur les grands écrans
  window.addEventListener('resize', function() {
    var barre = document.getElementById('barre-latérale');
    if (barre && window.innerWidth > 1024 && barre.classList.contains('ouvert')) {
      fermerBarreLaterale();
    }
  });

  // Quand on clique sur un lien de navigation, on ferme la barre latérale
  var liens = document.querySelectorAll('.lien-navigation');
  for (var i = 0; i < liens.length; i++) {
    liens[i].addEventListener('click', function() { 
      fermerBarreLaterale(); 
    });
  }
}

// ──────────── Recherche temps réel étudiants et classes ────────────
var minuteurRecherche = null;
var minuteurRechercheClasses = null;

document.addEventListener('input', function(e) {
  if (e.target.id === 'recherche-étudiants') {
    clearTimeout(minuteurRecherche);
    minuteurRecherche = setTimeout(function() { 
      afficherÉtudiants(); 
    }, 300);
  }
  if (e.target.id === 'recherche-classes') {
    clearTimeout(minuteurRechercheClasses);
    minuteurRechercheClasses = setTimeout(function() { 
      afficherClasses(); 
    }, 300);
  }
});

// ──────────── Tri des tableaux ────────────

document.addEventListener('click', function(e) {
  var enTete = e.target.closest('th[data-sort]');
  if (!enTete) return;

  var champ = enTete.dataset.sort;

  // Inverser le tri si même colonne, sinon nouveau tri
  if (étatTri.champ === champ) {
    étatTri.ascendant = !étatTri.ascendant;
  } else {
    étatTri.champ = champ;
    étatTri.ascendant = true;
  }

  // Mettre à jour les flèches de tri dans l'en-tête
  var indicateurs = document.querySelectorAll('.indicateur-tri');
  for (var i = 0; i < indicateurs.length; i++) {
    indicateurs[i].textContent = '';
  }

  var indicateur = enTete.querySelector('.indicateur-tri');
  if (étatTri.ascendant) {
    indicateur.textContent = ' ▲';
  } else {
    indicateur.textContent = ' ▼';
  }

  // Re-afficher avec le nouveau tri
  if (vueCourante === 'étudiants') {
    afficherÉtudiants();
  }
  if (vueCourante === 'notes') {
    afficherNotes();
  }
});

// ──────────── Thème (clair / sombre) ────────────

// Basculer entre le thème clair et sombre
function basculerTheme() {
  var html = document.documentElement;
  var themeActuel = html.getAttribute('data-theme');
  if (themeActuel === 'dark') {
    html.setAttribute('data-theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
  }
  localStorage.setItem('theme', html.getAttribute('data-theme'));
}

// ──────────── Barre latérale (mode mobile) ────────────

// Ouvrir ou fermer la barre latérale
function basculerBarreLaterale() {
  var barre = document.getElementById('barre-latérale');
  var superposition = document.getElementById('barre-latérale-superposition');
  var ouvert = barre.classList.toggle('ouvert');
  if (ouvert) {
    superposition.classList.add('visible');
  } else {
    superposition.classList.remove('visible');
  }
}

// Fermer la barre latérale
function fermerBarreLaterale() {
  document.getElementById('barre-latérale').classList.remove('ouvert');
  document.getElementById('barre-latérale-superposition').classList.remove('visible');
}

// ──────────── Fenêtre modale ────────────

// Ouvrir une fenêtre modale
function ouvrirFenetre(titre, contenu, boutons) {
  document.getElementById('fenêtre-titre').textContent = titre;

  var corps = document.getElementById('fenêtre-corps');
  if (typeof contenu === 'string') { 
    corps.innerHTML = contenu; 
  }
  else { 
    corps.innerHTML = ''; corps.appendChild(contenu);
  }

  var pied = document.getElementById('fenêtre-pied');
  pied.innerHTML = '';

  for (var i = 0; i < boutons.length; i++) {
    var btn = document.getElementById('template-btn-fenêtre')
      .content.cloneNode(true).querySelector('.btn');

    btn.textContent = boutons[i].text;
    btn.className = 'btn ' + boutons[i].class;
    btn.dataset.index = i;
    btn.addEventListener('click', function() { 
      var index = parseInt(this.dataset.index);
      if (boutons[index] && boutons[index].action) {
        boutons[index].action();
      }
    }); 
  
    pied.appendChild(btn);
  }

  document.getElementById('fenêtre-superposition').classList.remove('caché');
}

// Fermer la fenêtre modale
function fermerFenetre() {
  document.getElementById('fenêtre-superposition').classList.add('caché');
}

// Ouvrir une fenêtre avec Annuler + action
function ouvrirFenetreFormulaire(titre, contenuHTML, actionCallback, texteBouton) {
  ouvrirFenetre(titre, contenuHTML, [
    { text: 'Annuler', class: 'btn-contour', action: function() { fermerFenetre(); } },
    { text: texteBouton || 'Enregistrer', class: 'btn-principal', action: actionCallback }
  ]);
}

// ──────────── Table et pagination ────────────
var pagination = {};

// Afficher un tableau avec pagination
function afficherTableauAvecPagination(cle, données, fnLigne, nbParPage) {
  var page = pagination[cle] || 1;
  var total = Math.max(1, Math.ceil(données.length / nbParPage));
  var début = (page - 1) * nbParPage;
  var elements = données.slice(début, début + nbParPage);

  var corps = document.getElementById(cle + '-corps');
  if (corps) {
    if (elements.length > 0) {
      corps.innerHTML = '';
      for (var i = 0; i < elements.length; i++) {
        corps.appendChild(fnLigne(elements[i]));
      }
    } else {
      corps.innerHTML = document.getElementById('template-ligne-vide').innerHTML;
    }
  }

  var zone = document.getElementById('pagination-' + cle);
  if (zone) {
    afficherPagination(zone, page, total, function(p) {
      pagination[cle] = p;
      afficherTableauAvecPagination(cle, données, fnLigne, nbParPage);
    });
  }
}

// Afficher les boutons de pagination
function afficherPagination(container, page, total, fnClic) {
  container.innerHTML = '';

  function créerBtn(texte, active, desactive) {
    var btn = document.getElementById('template-btn-page')
      .content.cloneNode(true).querySelector('.btn-page');
    btn.textContent = texte;
    if (active) btn.classList.add('actif');
    btn.disabled = desactive;
    return btn;
  }

  function clicPage(page, btn, total) {
    if (page < 1 || page > total) return;
    var c = btn.parentElement;
    if (c._fnClic) c._fnClic(page);
  }

  // précédent
  var btn = créerBtn('<', false, page <= 1);
  if (!btn.disabled) btn.onclick = function() { clicPage(page - 1, this, total); };
  container.appendChild(btn);

  // Numéro
  var début = Math.max(1, page - 2);
  var fin = Math.min(total, page + 2);
  for (var i = début; i <= fin; i++) {
    var btn = créerBtn(i, i === page, false);
    btn.onclick = (function(p) {
      return function() { clicPage(p, this, total); };
    })(i);
    container.appendChild(btn);
  }

  // Suivant
  var btn = créerBtn('>', false, page >= total);
  if (!btn.disabled) btn.onclick = function() { clicPage(page + 1, this, total); };
  container.appendChild(btn);

  container._fnClic = fnClic;
}

// Ligne du tableau des étudiants
const CNE = /^[A-Z][0-9]{9}$/;
function afficherLigneÉtudiants(e) {
  var cne = (e.cne || '').toUpperCase();
  var cneAffiche = '—';
  if (CNE.test(cne)) {
    cneAffiche = cne;
  }

  var ligne = document.getElementById('template-étudiant-row')
    .content.cloneNode(true).querySelector('tr');

  ligne.querySelector('.col-nom').textContent = e.nom;
  ligne.querySelector('.col-prénom').textContent = e.prénom;
  ligne.querySelector('.col-cne').textContent = cneAffiche;
  ligne.querySelector('.col-filière').textContent = e.filière;

  var strong = ligne.querySelector('.col-moyenne strong');
  strong.textContent = e.moyenne || 0;
  strong.style.color = obtenirCouleurNote(e.moyenne || 0);

  ligne.querySelector('.btn-voir').onclick = function() { voirÉtudiants(e.id); };
  ligne.querySelector('.btn-modifier').onclick = function() { AjouterModifierÉtudiants(e.id); };
  ligne.querySelector('.btn-supprimer').onclick = function() { supprimerÉtudiants(e.id); };

  return ligne;
}

// ──────────── Notification ────────────

// Afficher une notification
function afficherNotification(message, type) {
  var container = document.getElementById('conteneur-notification');

  var icône = '';
  if (type === 'success') {
    icône = '✓';
  } else if (type === 'error') {
    icône = '✗';
  } else {
    icône = '?';
  }

  var toast = document.getElementById('template-notification')
    .content.cloneNode(true).querySelector('.notification');

  toast.classList.add('notification-' + type);
  toast.querySelector('.notification-icône').textContent = icône;
  toast.querySelector('.notification-message').textContent = message;

  container.appendChild(toast);

  setTimeout(function() {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 3000);
};

