DB.notes = {

  async obtenirNoteparID(id) {
    var réponse = await supabaseClient
      .from('notes')
      .select('*, étudiants(nom, prénom, cne)')
      .eq('id', id)
      .single();

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data;
  },

  // Toutes les notes avec pagination
  async obtenirTout(page = 0, limite = 20) {
    var réponse = await supabaseClient
      .from('notes')
      .select('*, étudiants(id, nom, prénom, cne, filière), classes(nom)')
      .order('date_saisie', { ascending: false })
      .range(page * limite, (page + 1) * limite - 1);

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || [];
  },

  // Nombre total de notes
  async compter() {
    var réponse = await supabaseClient
      .from('notes')
      .select('*', { count: 'exact', head: true });

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.count || 0;
  },

  // Notes d'un étudiant
  async obtenirNotesÉtudiant(id) {
    var réponse = await supabaseClient
      .from('notes')
      .select('*, classes(nom)')
      .eq('étudiant_id', id)
      .order('date_saisie');

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data;
  },

  // Moyenne d'un étudiant
  async obtenirMoyenneÉtudiants(etudiantId) {
    var réponse = await supabaseClient.rpc('moyenne_étudiant', {
      id_etu: etudiantId
    });
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || 0;
  },

  async ajouterNote(d) {
    var réponse = await supabaseClient
    .from('notes')
    .insert(d);

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data;
  },

  // Ajouter plusieurs notes en lot
  async ajouterplusieursNote(notes) {
    var réponse = await supabaseClient
      .from('notes')
      .insert(notes);

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data;
  },

  // Modifier une note
  async modifierNote(id, données) {
    var réponse = await supabaseClient
      .from('notes')
      .update(données)
      .eq('id', id);

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse;
  },

  // Supprimer une note
  async supprimerNote(id) {
    var réponse = await supabaseClient
      .from('notes')
      .delete()
      .eq('id', id);

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse;
  },

  // Notes filtrées par module
  async obtenirNotes(idModule) {
    var réponse = await supabaseClient
      .from('notes')
      .select('*, étudiants(nom, prénom, cne), classes(nom)')
      .eq('module_id', idModule)
      .order('date_saisie', { ascending: false });

    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data;
  },
};
