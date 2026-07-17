const DB = {};

//  Lit le professeur stocké dans le navigateur 
DB._professeur = function() {
  var profActuel = sessionStorage.getItem('Prof');
  if (profActuel) {
    return JSON.parse(profActuel);
  }
  return null;
};

//  Attendre que la session Supabase soit prête 
function attendreSessionPrete() {
  return new Promise(function(resolve, reject) {
    // Écouter le changement d'état auth
    var abonnement = supabaseClient.auth.onAuthStateChange(function(événement, sessionDonnee) {
      if (sessionDonnee && sessionDonnee.user && sessionDonnee.user.id) {
        abonnement.data.subscription.unsubscribe();
        resolve(sessionDonnee);
      }
    });

    // Après 5 secondes, arrêter d'écouter et vérifier
    setTimeout(async function() {
      abonnement.data.subscription.unsubscribe();
      var réponse = await supabaseClient.auth.getSession();
      var sessionDonnee = réponse.data.session;
      if (sessionDonnee && sessionDonnee.user && sessionDonnee.user.id) {
        resolve(sessionDonnee);
      } else {
        reject(new Error('Session non établie après connexion'));
      }
    }, 5000);
  });
};

  //  Charger le professeur au démarrage
  async function chargerDonneesProfesseur() {
    var réponse = await supabaseClient
      .from('professeurs')
      .select('*');
    var prof = réponse.data?.[0] || null;
    if (prof) {
      sessionStorage.setItem('professeur', JSON.stringify(prof));
    }
    return true;
  };
