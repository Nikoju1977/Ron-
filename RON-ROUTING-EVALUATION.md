# RON — protocole d'évaluation du routage et de la résilience

Date du protocole : **7 novembre 2026**. Périmètre : RON Présence / moteur `RONNet` / orchestrateur `RONAgentHub`.

## Ce qui est vérifié

1. Le fichier `ron-tests/routing-cases.json` décrit **56 requêtes françaises** avec leur famille attendue (`weather`, `wiki`, `science`, `github`, `books`, `math`, `clock`, `live` ou traitement local sans appel externe). Certaines précisent les champs `city`, `day`, `query`, `repo` et `synthesize`.
2. `ron-tests/routing-eval.cjs` exécute le même parseur et le même planificateur que l'application. Chaque test est **réussi ou échoué** avec l'écart constaté ; son rapport JSON est horodaté.
3. `ron-tests/resilience.cjs` teste **15 modes de fonctionnement dégradé et de protection** avec données simulées : HTTP 429/503, réponse vide/malformée, mode hors ligne, annulation, provenance invalide, absence de source, interdiction de redirection et repli en cas de panne ou d'hallucination du LLM.
4. GitHub Actions exécute ces tests avec les tests applicatifs habituels et archive `routing-report.json` et `resilience-report.json` comme artefacts téléchargeables de l'exécution.

## Comment reproduire

```bash
npm --prefix ron-tests install --ignore-scripts
npm --prefix ron-tests run eval:routing
node ron-tests/resilience.cjs
npm --prefix ron-tests test
```

Le rapport est écrit dans `ron-tests/reports/`, chemin non publié dans le site PWA. L'artefact GitHub Actions `ron-routing-evaluation` permet d'examiner les résultats associés au SHA du commit.

## Résultat de référence avant correctifs

**49/56 (87,5 %) sur les cas de routage**. Sept échecs : W04, W05, K09, P08, P09, P10, P12. Quatre de ces erreurs envoyaient des questions personnelles vers l'agent météo, ce qui pouvait déclencher une recherche ou une demande de géolocalisation inappropriée. Référence : exécution CI initiale de la branche, le 7 novembre 2026.

Les correctifs portent sur la priorité à la confidentialité, les formulations de pluie et la distinction entre température astronomique et météo locale. Le **nouveau résultat** est à lire dans le rapport du **dernier commit effectivement testé**, et non déduit de cette documentation.

## Limites importantes

- **Ce banc d'essai ne valide pas la vérité des réponses.** Il mesure uniquement la sélection des outils, certains champs extraits, le maintien local des demandes personnelles et des comportements de sécurité simulés.
- Les exemples d'API sont simulés : **disponibilité des services externes, latence réseau réelle, authenticité des données et capacités d'un LLM non testées**.
- Une URL de source conforme prouve seulement l'origine du lien, pas l'exactitude de ce que la source dit.
- Les tests WebKit et Chromium de CI sont exécutés sur des navigateurs automatisés et **ne remplacent pas les appareils physiques**.
- Aucun compte utilisateur, clé API, historique réel ou donnée médicale n'est nécessaire à cette évaluation.

## Matrice manuelle encore à réaliser

| Essai | Android Chrome | iPhone Safari |
| --- | --- | --- |
| Installation de la PWA et premier démarrage | Non testé | Non testé |
| Hors ligne après installation complète et reprise réseau | Non testé | Non testé |
| Microphone autorisé, refusé et interrompu | Non testé | Non testé |
| Synthèse vocale, mode silencieux et sortie audio | Non testé | Non testé |
| Conversation en cours pendant une mise à jour | Non testé | Non testé |
| Mémoire de l'appareil saturée, onglet repris, écran tourné | Non testé | Non testé |

Pour chaque test manuel : relever **modèle d'appareil, OS, navigateur, commit, date, attendu, observé, statut et capture si nécessaire**, sans données personnelles dans les captures. Ne fermer les tickets #24 et #25 que lorsque les preuves correspondantes sont disponibles.

## Critères de décision

Une PR peut être proposée pour revue lorsque les cas déterministes passent, que la suite complète Node/Chromium/WebKit est verte et que les limites non testées sont explicites. **Ne pas qualifier RON de fiable en production sur ces seuls critères.** Toute fusion et toute publication restent des décisions séparées.
