# RON Présence

Page : `ron-presence.html`. Cette version coexiste avec `index.html`, qui conserve ses fonctions multimédias.

## Utilisation

Servir les fichiers sur une adresse HTTPS (ou localhost pour le développement), puis ouvrir `/ron-presence.html` — en adaptant le préfixe si le site est dans un sous-dossier. Dans Réglages, choisir son fournisseur LLM et renseigner sa propre clé. Aucune clé n'est incluse dans le dépôt.

- Interface responsive pour téléphone, tablette et ordinateur ; clavier, souris et tactile.
- Installer : utiliser le bouton Installer ou le menu du navigateur, lorsque disponible. Sur iPhone/iPad, utiliser le menu Partager puis Ajouter à l’écran d’accueil.
- Si la reconnaissance vocale ou WebGL est indisponible, la conversation écrite et la présence visuelle simple restent disponibles.
- Après une première ouverture en ligne et l’installation réussie du service worker, l’interface et le carnet peuvent s’ouvrir hors connexion. Le serveur IA et la reconnaissance vocale ne sont pas rendus hors ligne par cette installation.
- Le service worker est limité à l’URL de cette page et ne met en cache que les fichiers publics de l’interface. Il ne met pas en cache les requêtes IA ni les données de santé.

## Confidentialité et portée

Le carnet est en mémoire de session par défaut. Sa conservation locale est volontaire et n'est pas chiffrée par Ron. Partager avec Ron transmet les 7 dernières entrées au fournisseur configuré. L'historique local peut conserver la réponse générée à partir de ces données. Effacer le carnet efface aussi cet historique, sans supprimer les données déjà transmises au fournisseur.

Le navigateur peut utiliser un service distant pour transcrire la voix. Ron mesure seulement le volume local pour son animation ; il n’identifie pas la personne et n’analyse pas sa santé dans sa voix. Les modes Compagnon, Studio et Analyse orientent les réponses ; ils n'ajoutent pas de recherche web ou de certification médicale.

## Galaxy Watch7 et Galaxy S25 FE 5G

La connexion native n'est pas encore implémentée. Le chemin prévu est : Watch7 → Samsung Health sur le téléphone → Health Connect → compagnon Android Ron, après autorisations par type de donnée. Les données disponibles et leurs délais de synchronisation varient ; aucune surveillance d'urgence en temps réel n'est garantie.

Les actions sur les applications devront passer par les interfaces Android et les API que ces applications exposent. Installer cette version web ne lui donne ni accès à Samsung Health ni le contrôle global du téléphone. Aucun compte ni accès n'est synchronisé automatiquement entre appareils. Une app Wear OS dédiée reste également à développer pour la montre.

Sources techniques :
- https://developer.samsung.com/health/health-connect-faq.html
- https://developer.android.com/guide/components/intents-common
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable

## Moteurs et modèles

Il n'existe pas de meilleur modèle pour tous les appareils et tous les usages. Les réglages proposent ces points de départ, modifiables :

| Moteur | Point de départ | Accès |
| --- | --- | --- |
| Mistral | Routage Mistral existant ou modèle manuel | Clé personnelle, disponibilité selon compte |
| OpenRouter | `openrouter/free` | Clé personnelle ; offres gratuites avec quotas et disponibilité variables |
| Groq | `openai/gpt-oss-20b` | Clé personnelle ; quotas selon compte |
| Ollama | `qwen3.5:4b` | Serveur local installé, modèle téléchargé et matériel suffisant |
| LM Studio / vLLM / personnalisé | Modèle servi par votre endpoint | Serveur compatible avec l'API de conversation OpenAI |

Le bouton **Actualiser les modèles disponibles** interroge le catalogue du fournisseur sélectionné. La recherche et le filtre gratuit OpenRouter permettent de choisir un identifiant réellement annoncé. Le filtre exige des tarifs prompt, completion et request nuls ; un tarif absent n'est pas considéré comme gratuit. La présence dans le catalogue ne garantit ni accès avec votre compte ni disponibilité au moment de l'appel. Un modèle à poids ouverts n'implique pas une API gratuite, et chaque modèle conserve sa propre licence. LM Studio n'est pas présenté ici comme logiciel open source.

OpenRouter reçoit `provider.data_collection: "deny"` : ce choix peut réduire les fournisseurs disponibles. Il ne rend pas le traitement local et ne garantit pas l'absence de toute conservation technique. Aucun basculement automatique vers un autre fournisseur n'est effectué. Le mode Direct est le choix initial des nouvelles sessions pour limiter le nombre de requêtes.

Les clés sont séparées par fournisseur **et** endpoint. Leur conservation locale est facultative et non chiffrée ; par défaut les nouvelles sessions ne les enregistrent pas durablement. Modifier l'endpoint vide le champ de clé. Enregistrer un autre fournisseur ou endpoint efface le contexte de conversation envoyé au modèle, tout en conservant le carnet séparé. Ne jamais publier sa clé dans GitHub.

### Ollama local

Installer Ollama et exécuter `ollama pull qwen3.5:4b`, puis autoriser l'origine de cette page avec `OLLAMA_ORIGINS=https://nikoju1977.github.io` dans l'environnement du serveur et le redémarrer. Le navigateur peut demander une autorisation de réseau local ou bloquer l'accès selon sa politique de sécurité. Le modèle 4b est un point de départ ; adapter sa taille aux ressources disponibles.

Sur téléphone, `localhost` désigne le téléphone, pas votre ordinateur. Un serveur sur ordinateur exige une connexion accessible et protégée, généralement HTTPS avec authentification. Ne pas exposer un serveur Ollama sans protection sur Internet. Le serveur local doit prendre en charge CORS et l'API `/v1/chat/completions`.

### Composants ouverts

- Marked 18.0.14 : rendu Markdown des réponses terminées.
- DOMPurify 3.4.16 : nettoyage HTML avec liste restrictive de balises et liens HTTP(S).
- Les deux bibliothèques et leurs licences sont distribuées dans `ron-vendor/`, sans CDN nécessaire.
- Ollama et vLLM sont des options de serveurs ouverts ; leurs modèles se téléchargent séparément.

La version mobile réduit le nombre de particules et la cadence de rendu. Le rendu est suspendu lorsque la page est masquée et tient compte de la préférence de réduction des animations.

Documentation des fournisseurs :
- https://docs.mistral.ai/models
- https://openrouter.ai/docs/quickstart
- https://openrouter.ai/docs/guides/routing/provider-selection
- https://console.groq.com/docs/models
- https://console.groq.com/docs/reasoning
- https://ollama.com/library/qwen3.5
- https://docs.ollama.com/faq

## Validation

Les quatre suites simulées couvrent la conversation, le carnet et son partage volontaire, les interruptions, les erreurs Mistral et le streaming, l'isolation des clés, le catalogue, le filtre gratuit le nettoyage Markdown et les pauses après limitation. Elles utilisent jsdom et fake-indexeddb ; elles ne consomment aucun quota IA.

Depuis la racine du dépôt :

```sh
npm --prefix ron-tests install
npm --prefix ron-tests test
```

Syntaxe JavaScript vérifiée. Les appels de génération avec une vraie clé, le microphone réel, l'installation, le service worker en navigateur et les rendus sur appareils physiques restent à valider. Compatibilité visée : navigateurs modernes ; aucune garantie pour tous les navigateurs, téléviseurs ou montres.

## Ange et protection des limites

Ron apparaît en ange de particules : deux ailes de plumes, silhouette, auréole dorée, réaction à l’écoute et à la parole. Une version SVG s’affiche si WebGL est indisponible. Le moteur Three.js existant est embarqué et inclus dans le cache public hors connexion.

Après HTTP 429, Ron respecte Retry-After. Sans délai fourni, une pause de protection d’au moins 65 secondes est appliquée, sans relance automatique. Un délai explicite de 30 secondes ou moins autorise au maximum une relance pour la conversation ; DOTS ne relance pas. Un quota/crédit épuisé reconnu dans le message d’erreur bloque les relances automatiques et applique une pause locale de 15 minutes minimum. Cette pause n’annonce pas le renouvellement réel du quota.

Le compteur reste visible et les délais sont conservés par fournisseur/endpoint dans la session de l’onglet, y compris après rechargement et enregistrement des réglages. Aucun secret n’est stocké dans ces délais. Les tâches DOTS attendent et le conseil multi-agents passe temporairement en mode direct après une limitation Mistral. Le bouton Arrêter annule une attente de conversation. Les quotas Mistral restent ceux du compte ; Ron ne peut pas les augmenter. Des onglets ou applications distincts peuvent consommer le même quota.

Documentation : https://docs.mistral.ai/admin/billing-usage/usage-limits

Vérification supplémentaire : rendu WebGL réel dans Chromium, formats ordinateur et téléphone, redimensionnement sans erreur JavaScript. Ces essais ne remplacent pas un test physique du microphone ou de la montre Samsung.
