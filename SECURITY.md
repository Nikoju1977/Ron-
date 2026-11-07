# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas publier de faille exploitable, de secrets, de données personnelles ou de captures sensibles dans une issue publique**. Utiliser les signalements privés de vulnérabilités GitHub lorsque cette fonction est activée pour le dépôt ; à défaut, contacter le mainteneur en privé via un canal indiqué sur son profil. Ne jamais joindre de mots de passe, jetons, clés d'API ou données médicales réelles.

Indiquer dans le rapport : la version/commit, le composant, les étapes minimales de reproduction avec des **données fictives**, l'impact attendu et les pistes d'atténuation. Aucun délai de traitement ni programme de récompenses n'est promis.

## Périmètre

Ce dépôt peut contenir un prototype ou une expérimentation. La publication du code, d'un README ou d'une démonstration **ne constitue pas** un audit de sécurité, une certification ou une autorisation d'usage en production.

Éviter de committer les fichiers `.env`, les clés privées, les jetons d'authentification, les sauvegardes d'utilisateurs et les exports de données personnelles. Vérifier manuellement les permissions, les dépendances tierces, la configuration de production et les flux réseau avant chaque déploiement.

## Assistants IA et actions automatisées

Surveiller particulièrement : injection de prompt, outils déclenchant des effets réels sans confirmation, permissions excessives, fuite de clés de fournisseurs, journaux de conversations, accès micro/caméra et dépendances distantes. Une réponse d'un modèle ou d'un outil externe ne doit jamais être interprétée comme une autorisation d'exécuter une action sensible.

## Mises à jour

Avant de corriger un incident : préparer un correctif limité, examiner les régressions, vérifier l'absence de secrets dans le diff et documenter les changements dans une pull request. Les avis de sécurité applicables dépendent des dépendances et versions réellement employées.

[Retour au profil Studio Niko Design](https://github.com/Nikoju1977).

## Renforcement appliqué à RON (novembre 2026)

### Surface d'attaque et contrôles
- Les connecteurs de données publiques sont en lecture seule, ne joignent pas de cookie et refusent les redirections automatiques ; les réponses JSON dépassant 2 Mio sont rejetées dans les API publiques et les imports de documents.
- Les requêtes JSON du moteur LLM refusent les redirections, suppriment les cookies et plafonnent les corps à 4 Mio. La diffusion SSE historique via XMLHttpRequest est plafonnée en caractères ; elle ne dispose toutefois pas du même contrôle explicite des redirections que `fetch`.
- Les demandes personnelles continuent d'être traitées localement sans requête automatique vers les connecteurs publics ; les recherches réelles et les modèles configurés doivent toujours respecter les choix de l'utilisateur.
- Le pont de messages du compagnon Android accepte uniquement l'origine HTTPS officielle et la page exacte `/Ron-/ron-presence.html`, et refuse les autres chemins, paramètres et schémas de navigation.
- Les signaux d'annulation des requêtes sont contrôlés par l'appelant ; un résultat de synthèse obtenu après une annulation ne doit pas être présenté.

### Limites restant à traiter
- Une clé API enregistrée volontairement dans le navigateur reste stockée localement sur l'appareil, **pas chiffrée de bout en bout par RON**. Sur appareil partagé, éviter « mémoriser la clé », effacer les données du site ou révoquer la clé chez le fournisseur.
- Le compagnon Android accepte du HTTP sur des adresses IPv4 privées pour les modèles locaux ; ce trafic peut être intercepté sur un Wi-Fi non fiable. Utiliser un réseau personnel protégé ou un accès TLS de confiance pour des données sensibles.
- Les scripts tiers et les moteurs de modèles téléchargeables méritent une revue des dépendances et une politique CSP adaptée. Les tests du dépôt ne constituent pas un audit de sécurité indépendant.
- La diffusion SSE historique utilise XMLHttpRequest et peut suivre les redirections selon le navigateur. Ne pas envoyer de contenu sensible à un endpoint personnalisé non maîtrisé ; sa migration vers un streaming `fetch` avec `redirect:'error'` reste à réaliser.
- Les tests actuels sont principalement automatisés/simulés ; l'installation PWA, l'audio, le stockage contraint et les réseaux dégradés sur téléphones physiques doivent être validés séparément.

### Vérification reproductible
Exécuter `npm --prefix ron-tests test` et `npm --prefix ron-tests run test:security`, puis inspecter l'artefact CI `security-hardening.json` associé au SHA. Le compagnon Android dispose en plus de tests unitaires du filtrage d'URL via `gradle :app:testDebugUnitTest`. Ne fusionner qu'avec les checks GitHub au vert.
