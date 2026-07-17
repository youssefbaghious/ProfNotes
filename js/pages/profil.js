// Afficher la page de profil du professeur
async function afficherProfil() {
  var Prof = JSON.parse(sessionStorage.getItem('Prof'));
  if (!Prof) return;

  // Charger les données fraîches depuis la base
  var données = await chargerDonneesProfil(Prof);

  // Afficher les 3 panneaux : avatar, infos, sécurité
  afficherPanneauAvatar(données);
  afficherPanneauInfos(données);
  afficherPanneauSecurite(données);

  // Attacher les événements
  attacherEvenementsPhoto(Prof);
  attacherEvenementsProfil(Prof);
  attacherEvenementsMotDePasse();
};

async function chargerDonneesProfil(Prof) {
  try {
    var ProfComplet = await DB.professeurs.obtenirProfParId(Prof.id);
    if (ProfComplet) return ProfComplet;
  } catch (erreur) {
    afficherNotification('Erreur chargement profil', 'error');
  }

  return {
    nom: Prof.nom,
    prénom: Prof.prénom || '',
    email: Prof.email,
    avatar: Prof.avatar || '',
    module: Prof.module || ''
  };
}

function afficherPanneauAvatar(données) {
  // Vider le conteneur
  var zone = document.getElementById('contenu-profil');
  zone.innerHTML = '';

  // Cloner le panneau avatar
  var panneau = document.getElementById('template-panneau-avatar').content.cloneNode(true);
  var zoneAvatar = panneau.querySelector('#avatar-profil-large');

  if (données.avatar) {
    // Afficher la photo
    var img = document.getElementById('template-image-avatar').content.cloneNode(true);
    img.querySelector('img').src = données.avatar;
    zoneAvatar.appendChild(img);
  } else {
    // Afficher les initiales
    var init = document.getElementById('template-avatar-initiales').content.cloneNode(true);
    init.querySelector('span').textContent = calculerInitiales(données.prénom, données.nom);
    zoneAvatar.appendChild(init);
  }

  zone.appendChild(panneau);
}

function afficherPanneauInfos(données) {
  // Cloner le panneau infos
  var zone = document.getElementById('contenu-profil');
  var panneau = document.getElementById('template-panneau-infos').content.cloneNode(true);

  // Remplir les champs
  panneau.querySelector('#p-prénom').value = données.prénom || '';
  panneau.querySelector('#p-nom').value = données.nom || '';
  var moduleValeur = données.module;
  if (moduleValeur === '---') moduleValeur = '';
  panneau.querySelector('#p-module').value = moduleValeur || '';

  zone.appendChild(panneau);
}

function afficherPanneauSecurite(données) {
  // Cloner le panneau sécurité
  var zone = document.getElementById('contenu-profil');
  var panneau = document.getElementById('template-panneau-sécurité').content.cloneNode(true);
  zone.appendChild(panneau);

  // Remplir l'email
  document.getElementById('p-email').value = données.email;
}

// Changer la photo de profil
function attacherEvenementsPhoto(Prof) {
  // Ouvrir le sélecteur de fichier
  document.getElementById('btn-changer-photo').onclick = function() {
    document.getElementById('saisie-photo').click();
  };

  // Quand un fichier est choisi
  document.getElementById('saisie-photo').onchange = function(event) {
    var fichier = event.target.files[0];
    if (!fichier) return;

    // Vérifier la taille (max 2 Mo)
    if (fichier.size > 2 * 1024 * 1024) {
      afficherNotification('Photo trop lourde (max 2 Mo)', 'error');
      return;
    }

    // Lire et redimensionner l'image
    var lecteur = new FileReader();
    lecteur.onload = async function(e) {
      var img = new Image();
      img.onload = async function() {
        await redimensionnerEtUploader(img, Prof);
      };
      img.src = e.target.result;
    };
    lecteur.readAsDataURL(fichier);
  };
}

// Redimensionner l'image et l'uploader
async function redimensionnerEtUploader(img, Prof) {
  var tailleMax = 300;
  var canvas = document.createElement('canvas');
  var largeur = img.width;
  var hauteur = img.height;

  // Redimensionner si nécessaire
  if (largeur > tailleMax || hauteur > tailleMax) {
    var ratio = Math.min(tailleMax / largeur, tailleMax / hauteur);
    largeur = Math.round(largeur * ratio);
    hauteur = Math.round(hauteur * ratio);
  }

  canvas.width = largeur;
  canvas.height = hauteur;
  canvas.getContext('2d').drawImage(img, 0, 0, largeur, hauteur);

    // Afficher l'image redimensionnée
  var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  var avatarContainer = document.getElementById('avatar-profil-large');
  avatarContainer.innerHTML = '';
  var imgEl = document.getElementById('template-image-avatar').content.cloneNode(true);
  imgEl.querySelector('img').src = dataUrl;
  avatarContainer.appendChild(imgEl);

  try {
    var blob = await new Promise(function(resoudre) {
      canvas.toBlob(resoudre, 'image/jpeg', 0.8);
    });
    if (!blob) throw new Error('Échec conversion');

    var nomFichier = 'avatar-' + Prof.id + '-' + Date.now() + '.jpg';

    var upload = await supabaseClient.storage.from('avatars').upload(nomFichier, blob, {
      contentType: 'image/jpeg',
      upsert: true
    });
    if (upload.error) throw upload.error;

    var url = supabaseClient.storage.from('avatars').getPublicUrl(nomFichier).data.publicUrl;

    // Sauvegarder l'URL dans la base
    await DB.professeurs.modifierProfil(Prof.id, { avatar: url });

    // Mettre à jour le sessionStorage
    var ProfMisAJour = JSON.parse(sessionStorage.getItem('Prof'));
    ProfMisAJour.avatar = url;
    sessionStorage.setItem('Prof', JSON.stringify(ProfMisAJour));

    // Mettre à jour tous les avatars affichés
    mettreAJourTousLesAvatars(ProfMisAJour);

    afficherNotification('Photo mise à jour', 'success');
  } catch (erreur) {
    afficherNotification(erreur.message || 'Erreur photo', 'error');
  }
}

// Mettre à jour tous les avatars dans l'interface
function mettreAJourTousLesAvatars(prof) {
  var couples = [
    ['image-avatar', 'avatar-initiales'],
    ['tableau-de-bord-image-professeur', 'tableau-de-bord-initiales-professeur'],
    ['barre-latérale-avatar-image', 'barre-latérale-avatar-initiales']
  ];

  for (var i = 0; i < couples.length; i++) {
    mettreAJourAvatar(prof, couples[i][0], couples[i][1]);
  }
}

// Enregistrer les informations du profil
function attacherEvenementsProfil(Prof) {
  document.getElementById('btn-enregistrer-profil').onclick = async function() {
    var nom = document.getElementById('p-nom').value.trim();
    var prénom = document.getElementById('p-prénom').value.trim();
    var module = document.getElementById('p-module').value.trim();
    var message = document.getElementById('message-enregistrement-profil');

    // Valider les champs requis
    if (!nom || !module) {
      afficherNotification('Nom et module requis', 'error');
      return;
    }

    // Effacer le message
    message.textContent = '';

    try {
      await DB.professeurs.modifierProfil(Prof.id, {
        nom: nom,
        prénom: prénom,
        module: module,
        email: Prof.email,
        filière: Prof.filière || '',
        avatar: Prof.avatar || null
      });

    // Mettre à jour le sessionStorage
      var ProfModifie = JSON.parse(sessionStorage.getItem('Prof'));
      ProfModifie.nom = nom;
      ProfModifie.prénom = prénom;
      ProfModifie.module = module;
      sessionStorage.setItem('Prof', JSON.stringify(ProfModifie));

      // Mettre à jour l'interface
      mettreAJourInterfaceProfil(ProfModifie);

      afficherSucces(message, 'Profil mis à jour');
      afficherNotification('Profil mis à jour', 'success');
    } catch (erreur) {
      afficherNotification('Erreur lors de la sauvegarde', 'error');
    }
  };
}

// Mettre à jour l'interface après modification du profil
function mettreAJourInterfaceProfil(prof) {
  var initiales = calculerInitiales(prof.prénom, prof.nom);

  var moduleAffiché = prof.module;
  if (moduleAffiché === '---') moduleAffiché = '';
  document.getElementById('tableau-de-bord-matière').textContent = moduleAffiché;
  document.getElementById('en-tête-nom-prof').textContent =
    formaterNomProfesseur(prof.prénom, prof.nom);
  document.getElementById('avatar-initiales').textContent = initiales;
  document.getElementById('barre-latérale-nom-utilisateur').textContent =
    formaterNomProfesseur(prof.prénom, prof.nom);
  document.getElementById('barre-latérale-avatar-initiales').textContent = initiales;
}

// Changer le mot de passe
function attacherEvenementsMotDePasse() {
  document.getElementById('btn-enregistrer-mot-de-passe').onclick = async function() {
    var actuel = document.getElementById('p-mot-de-passe-current').value;
    var nouveau = document.getElementById('p-mot-de-passe-new').value;
    var confirmation = document.getElementById('p-mot-de-passe-confirm').value;
    var message = document.getElementById('message-enregistrement-mot-de-passe');

    // Valider les champs
    if (!actuel || !nouveau || !confirmation) {
      afficherNotification('Tous les champs sont requis', 'error');
      return;
    }
    if (nouveau.length < 4) {
      afficherNotification('Minimum 4 caractères', 'error');
      return;
    }
    if (nouveau !== confirmation) {
      afficherNotification('Les mots de passe ne correspondent pas', 'error');
      return;
    }

    message.textContent = '';

    try {
      var résultat = await DB.professeurs.changerMotDePasse(actuel, nouveau);
      afficherSucces(message, résultat.message || 'Mot de passe modifié');

      // Vider les champs
      document.getElementById('p-mot-de-passe-current').value = '';
      document.getElementById('p-mot-de-passe-new').value = '';
      document.getElementById('p-mot-de-passe-confirm').value = '';

      afficherNotification('Mot de passe modifié', 'success');
    } catch (erreur) {
      afficherNotification(erreur.message || 'Erreur', 'error');
    }
  };
}

function afficherSucces(e, texte) {
  // Afficher un message de succès
  e.className = 'message-profil message-profil-succès';
  e.textContent = texte;
}
