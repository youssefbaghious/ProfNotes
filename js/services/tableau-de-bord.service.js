DB.tableauDeBord = {

  //   Données du tableau de bord (résumé général)  
  async tableauDeBordProfesseur(professeurId) {
    var [répétudiants, répClasses] = await Promise.all([
      supabaseClient.from('étudiants').select('id').eq('professeur_id', professeurId),
      supabaseClient.from('classes').select('*', { count: 'exact', head: true }).eq('professeur_id', professeurId)
    ]);
    if (répétudiants.error) throw répétudiants.error;
    if (répClasses.error) throw répClasses.error;

    var ids = (répétudiants.data || []).map(function(e) { return e.id; });
    var totalÉtudiants = ids.length;
    var nbClasses = répClasses.count || 0;
    var notesSaisies = 0;
    var moyenneGénérale = 0;
    var étudiantsValidés = 0;

    if (ids.length > 0) {
      var { data: toutesNotes, error: errNotes } = await supabaseClient
        .from('notes')
        .select('valeur, coefficient, étudiant_id')
        .in('étudiant_id', ids);
      if (errNotes) throw errNotes;
      var toutesNotes = toutesNotes || [];
      notesSaisies = toutesNotes.length;

      var notesParÉtudiant = {};
      for (var i = 0; i < toutesNotes.length; i++) {
        var n = toutesNotes[i];
        if (!notesParÉtudiant[n.étudiant_id]) notesParÉtudiant[n.étudiant_id] = [];
        notesParÉtudiant[n.étudiant_id].push(n);
      }

      var sommeMoyennes = 0;
      for (var k = 0; k < ids.length; k++) {
        var etuId = ids[k];
        var notes = notesParÉtudiant[etuId];
        var moyenne = 0;
        if (notes && notes.length > 0) {
          var sommePondérée = 0;
          var sommeCoeffs = 0;
          for (var j = 0; j < notes.length; j++) {
            sommePondérée += notes[j].valeur * notes[j].coefficient;
            sommeCoeffs += notes[j].coefficient;
          }
          moyenne = sommeCoeffs > 0 ? sommePondérée / sommeCoeffs : 0;
        }
        sommeMoyennes += moyenne;
        if (moyenne >= 10) étudiantsValidés++;
      }

      moyenneGénérale = totalÉtudiants > 0
        ? Math.round((sommeMoyennes / totalÉtudiants) * 100) / 100
        : 0;
    }

    var tauxRéussite = totalÉtudiants > 0
      ? Math.round((étudiantsValidés / totalÉtudiants) * 100)
      : 0;

    return { totalÉtudiants, moyenneGénérale, tauxRéussite, notesSaisies, nombreClasses: nbClasses };
  },

  //   Dernières notes saisies par le professeur (1 note par étudiant)  
  async dernièresNotes(profId, limite = 5) {
    var réponse = await supabaseClient
      .from('notes')
      .select('*, étudiants(nom, prénom, cne, filière), classes!inner(nom)')
      .eq('classes.professeur_id', profId)
      .order('date_saisie', { ascending: false })
      .limit(100);
      
    if (réponse.error) throw réponse.error;
    var notes = réponse.data || [];
    var vus = {};
    var résultat = [];
    for (var i = 0; i < notes.length && résultat.length < limite; i++) {
      if (!vus[notes[i].étudiant_id]) {
        vus[notes[i].étudiant_id] = true;
        résultat.push(notes[i]);
      }
    }
    return résultat;
  },

  //   Étudiants n'ayant pas encore de note  
  async manquantesProfesseur(professeurId) {
    var réponse = await supabaseClient.rpc('obtenir_notes_manquantes', {
      id_prof: professeurId
    });
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || [];
  },

  //   Étudiants en difficulté (moyenne < 10)  
  async difficultéProfesseur(professeurId) {
    var réponse = await supabaseClient.rpc('obtenir_élèves_difficulté', {
      id_prof: professeurId
    });
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || [];
  },

  //   Distribution des notes (tranches)  
  async distributionProfesseur(professeurId) {
    var réponse = await supabaseClient.rpc('obtenir_distribution_notes', {
      id_prof: professeurId
    });
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || [];
  },

  //   Récapitulatif des classes du professeur  
  async classesProfesseur(professeurId) {
    var réponse = await supabaseClient.rpc('obtenir_résumé_classes', {
      id_prof: professeurId
    });
    if (réponse.error) throw new Error(réponse.error.message);
    return réponse.data || [];
  }
};
