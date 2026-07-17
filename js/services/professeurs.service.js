DB.professeurs = {

  //  Connexion ou création de compte 
  async connexion(email, motDePasse, supplement) {
    if (supplement === undefined) supplement = {};

    // Essayer de se connecter
    var resultatAuth = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: motDePasse
    });

    // Si la connexion échoue
    if (resultatAuth.error) {
      // Si c'est une tentative de connexion pure (pas de données d'inscription), ne pas essayer signUp
      if (!supplement.nom && !supplement.prénom) {
        throw new Error('Email ou mot de passe incorrect');
      }

      // Sinon, créer un nouveau compte (inscription)
      var resultatInscription = await supabaseClient.auth.signUp({
        email: email,
        password: motDePasse,
        options: {
          data: {
            nom: supplement.nom || '',
            prénom: supplement.prénom || ''
          }
        }
      });
      if (resultatInscription.error) {
        if (resultatInscription.error.message && resultatInscription.error.message.indexOf('already') !== -1) {
          throw new Error('Un compte existe déjà avec cet email. Utilisez le formulaire de connexion.');
        }
        throw new Error('Email ou mot de passe incorrect');
      }

      // Après signUp, la session est déjà disponible (auto-signin si confirm email désactivé)
      var sessionDonnee = null;
      var tentative = await supabaseClient.auth.getSession();
      if (tentative.data && tentative.data.session) {
        sessionDonnee = tentative.data.session;
      } else {
        sessionDonnee = await attendreSessionPrete();
      }
      if (!sessionDonnee || !sessionDonnee.user || !sessionDonnee.user.id) {
        throw new Error('Session non établie après inscription');
      }

      // Créer le profil professeur dans la base
      var profCréé = await DB.professeurs.créerProfesseur({
        auth_id: sessionDonnee.user.id,
        nom: supplement.nom || '',
        prénom: supplement.prénom || '',
        email: email,
        filière: supplement.filière || ''
      });
      if (!profCréé) throw new Error('Erreur création profil');
      sessionStorage.setItem('professeur', JSON.stringify(profCréé));
      return { succes: true, professeur: profCréé };
    }

    // Utiliser la session retournée par signInWithPassword directement
    var sessionDonnee = resultatAuth.data.session;
    if (!sessionDonnee || !sessionDonnee.user || !sessionDonnee.user.id) {
      throw new Error('Session non établie après connexion');
    }

    // Chercher le profil professeur existant
    var recherche = await supabaseClient
      .from('professeurs')
      .select('*')
      .eq('auth_id', sessionDonnee.user.id);

    if (recherche.error) throw new Error('Erreur: ' + recherche.error.message);

    if (!recherche.data || recherche.data.length === 0) {
      // Le professeur n'existe pas encore, le créer
      var profCréé2 = await DB.professeurs.créerProfesseur({
        auth_id: sessionDonnee.user.id,
        nom: supplement.nom || '',
        prénom: supplement.prénom || '',
        email: email,
        filière: supplement.filière || ''
      });
      if (!profCréé2) throw new Error('Erreur création profil');
      sessionStorage.setItem('professeur', JSON.stringify(profCréé2));
      return { succes: true, professeur: profCréé2 };
    }

    // Stocker le professeur et retourner
    var profTrouve = recherche.data?.[0] || null;
    sessionStorage.setItem('professeur', JSON.stringify(profTrouve));
    return { succes: true, professeur: profTrouve };
  },

  //  Lier un auth user à un professeur (remplace lier_professeur SQL)
  async lierProfesseur(courriel, idAuth, nomProf, prénom) {
    var recherche = await supabaseClient
      .from('professeurs')
      .select('*')
      .eq('email', courriel)
      .maybeSingle();
    if (recherche.error) return null;
    if (recherche.data) {
      var misAJour = await supabaseClient
        .from('professeurs')
        .update({ auth_id: idAuth })
        .eq('id', recherche.data.id)
        .select()
        .single();
      return misAJour.error ? null : misAJour.data;
    }
    var cree = await supabaseClient
      .from('professeurs')
      .insert({ auth_id: idAuth, nom: nomProf || '', prénom: prénom || '', email: courriel })
      .select()
      .single();
    return cree.error ? null : cree.data;
  },

  //  Créer un professeur (remplace creer_professeur SQL)
  async créerProfesseur(données) {
    var réponse = await supabaseClient
      .from('professeurs')
      .insert(données)
      .select()
      .single();
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data;
  },

  //  Récupérer un professeur par son ID
  async obtenirProfParId(id) {
    var réponse = await supabaseClient
      .from('professeurs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || null;
  },

  //  Modifier le profil du professeur
  async modifierProfil(id, données) {
    var réponse = await supabaseClient
      .from('professeurs')
      .update(données)
      .eq('id', id);
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data;
  },

  // Changer le mot de passe
  async changerMotDePasse(motDePasseActuel, nouveauMotDePasse) {
    var utilisateur = await supabaseClient.auth.getUser();
    var utilisateurCourant = utilisateur.data.user;
    if (!utilisateurCourant)     throw new Error('Utilisateur non connecté');

    // Vérifier l'ancien mot de passe
    var verification = await supabaseClient.auth.signInWithPassword({
      email: utilisateurCourant.email,
      password: motDePasseActuel
    });
    if (verification.error) throw new Error('Mot de passe actuel incorrect');

    // Appliquer le nouveau mot de passe
    var miseAJour = await supabaseClient.auth.updateUser({
      password: nouveauMotDePasse
    });
    if (miseAJour.error) throw new Error(miseAJour.error.message);

    return { success: true, message: 'Mot de passe modifié avec succès' };
  }
};
