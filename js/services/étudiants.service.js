DB.étudiants = {

  async récupérerÉtudiants() {
    var réponse = await supabaseClient
      .from('étudiants')
      .select('*')
      .order('nom');
      
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || [];
  },

  async récupérerÉtudiantsParId(id) {
    var réponse = await supabaseClient
      .from('étudiants')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || null;
  },

  async chercherÉtudiants(recherche) {
    var prof = DB._professeur();
    var réponse = await supabaseClient.rpc('chercher_étudiants', {
      id_prof: prof.id,
      recherche: recherche
    });
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || [];
  },

  async récupérerÉtudiantsAvecMoyenne() {
    var prof = DB._professeur();
    var réponse = await supabaseClient.rpc('obtenir_étudiants_avec_moyenne', {
      id_prof: prof.id
    });
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || [];
  },

  async ajouterÉtudiants(d) {
    var prof = DB._professeur();
    if (!prof) throw new Error('Professeur non connecté');
    var réponse = await supabaseClient
    .from('étudiants')
    .insert({ ...d, professeur_id: prof.id });

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data;
  },

  async modifierÉtudiants(id, d) {
    var réponse = await supabaseClient
    .from('étudiants')
    .update(d)
    .eq('id', id);

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data;
  },

  async supprimerÉtudiants(id) {
    var réponse = await supabaseClient
      .from('étudiants')
      .delete()
      .eq('id', id);
      
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data;
  }
};
