DB.absences = {

  async insererAbsences(absences) {
    var réponse = await supabaseClient
      .from('absences')
      .insert(absences);
      
    if (réponse.error) throw new Error(réponse.error.message);
    return { count: absences.length };
  },

  async supprimerSéance(classeId, dateSéance, typeSéance) {
    var réponse = await supabaseClient
      .from('absences')
      .delete()
      .eq('classe_id', classeId)
      .eq('date_séance', dateSéance)
      .eq('type_séance', typeSéance);

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data;
  },

  async récupérerHistorique(professeurId) {
    var réponse = await supabaseClient.rpc('obtenir_historique_absences', {
      id_prof: professeurId
    });
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || [];
  },

  async absencesSéance(classeId, dateSéance, typeSéance) {
    var réponse = await supabaseClient
      .from('absences')
      .select('*, étudiant:étudiants(nom, prénom, cne)')
      .eq('classe_id', classeId)
      .eq('date_séance', dateSéance)
      .eq('type_séance', typeSéance);

    if (réponse.error) throw new Error(réponse.error.message);
    return (réponse.data || []).sort((a, b) => {
      var n = (a.étudiant?.nom || '').localeCompare(b.étudiant?.nom || '');
      return n || (a.étudiant?.prénom || '').localeCompare(b.étudiant?.prénom || '');
    });
  }
};