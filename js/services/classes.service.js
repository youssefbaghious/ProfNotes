DB.classes = {

  // Résumé de toutes les classes
  async récupérerClasses(professeurId) {
    var réponse = await supabaseClient.rpc('obtenir_résumé_classes', {
      id_prof: professeurId
    });
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || [];
  },

  // Classes actives uniquement
  async récupérerClassesActives(professeurId) {
    var réponse = await supabaseClient
      .from('classes')
      .select('*')
      .eq('professeur_id', professeurId);
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || [];
  },

  // Classe par filière
  async récupérerClasseParFilière(filière, professeurId) {
    var réponse = await supabaseClient
      .from('classes')
      .select('nom, coefficient')
      .eq('filière', filière)
      .eq('professeur_id', professeurId)
      .maybeSingle();
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || null;
  },

  // Classe par son ID
  async récupérerClasseParId(id) {
    var réponse = await supabaseClient
      .from('classes')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || null;
  },

  // Ajouter une classe
  async ajouterClasse(données) {
    var prof = DB._professeur();
    if (!prof) throw new Error('Professeur non connecté');
    var réponse = await supabaseClient
      .from('classes')
      .insert({
        nom: données.nom,
        filière: données.filière || '',
        coefficient: données.coefficient || 1,
        professeur_id: prof.id
      })
      .select()
      .single();
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || null;
  },

  // Modifier une classe
  async modifierClasse(id, données) {
    var réponse = await supabaseClient
      .from('classes')
      .update({
        nom: données.nom,
        filière: données.filière,
        coefficient: données.coefficient || 1
      })
      .eq('id', id);
    if (réponse.error) throw réponse.error;
    return réponse.data;
  },

  // Supprimer plusieurs classes (CASCADE supprime les notes)
  async supprimerClasses(Ids) {
    if (!Ids || !Ids.length) return [];
    var réponses = [];
    for (var i = 0; i < Ids.length; i++) {
      var réponse = await supabaseClient
        .from('classes')
        .delete()
        .eq('id', Ids[i]);
      if (réponse.error) throw réponse.error;
      réponses.push(réponse.data);
    }
    return réponses;
  }
};
