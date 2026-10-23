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

## IA automatique sans clé — version navigateur

RON Présence essaie de trouver, sans inscription ni paiement, un moteur conversationnel local déjà lancé (Ollama, LM Studio, vLLM). S'il n'en trouve pas et que la configuration automatique est active, il vérifie l'IA intégrée au navigateur (Chrome Prompt API, modèle déjà disponible) ou la possibilité de faire tourner un modèle WebGPU directement sur l'appareil via WebLLM. Les modèles légers choisis sont Qwen2.5-0.5B-Instruct et SmolLM2-360M-Instruct. La sélection est une **estimation de compatibilité**, pas une preuve que le modèle démarrera.

Les modèles WebGPU ne sont **pas téléchargés au démarrage de la PWA**. À la première question, WebLLM peut télécharger **plusieurs centaines de Mo** de fichiers libres vers le cache local. L'utilisateur voit un état de chargement ; l'installation du modèle peut échouer si le GPU, le navigateur, l'espace disque ou Internet ne sont pas suffisants. Le premier téléchargement utilise des fournisseurs publics de fichiers (jsDelivr pour WebLLM et Hugging Face/MLC pour les modèles) : il n'y a pas de clé API de génération, mais la consultation de ces serveurs reste soumise à leurs politiques de réseau. Ensuite, la génération est locale et peut fonctionner sans transmission des questions à une API distante. Le calcul sur un petit modèle peut être lent et moins précis ; le mode conversation directe est privilégié pour éviter les enchaînements d'agents gourmands.

Chrome Prompt API n'est pas disponible sur tous les appareils et pas sur Chrome mobile à ce jour ; elle dépend des limites de matériel, de modèle et de langue. WebGPU n'est pas universel. **Aucune solution purement statique ne garantit une IA sans clé sur tous les téléphones**, et RON doit afficher un diagnostic quand aucune option n'est possible. En cas de réglage manuel déjà enregistré, RON le respecte tant que la recherche automatique n'a pas été activée.

Sources d'implémentation : [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api) et [WebLLM](https://webllm.mlc.ai/docs/user/get_started.html).

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


## IA gratuite et agents spécialisés

Sur une nouvelle installation, RON propose Ollama et Qwen 3.5 4B en premier. Pour fonctionner sur ordinateur :

1. Installer [Ollama](https://ollama.com/download) (logiciel tiers gratuit).
2. Dans un terminal : ollama pull qwen3.5:4b (téléchargement de plusieurs Go), ou ollama pull qwen3.5:2b pour un appareil plus modeste.
3. Pour utiliser le serveur sur le même ordinateur depuis GitHub Pages, autoriser uniquement l'origine https://nikoju1977.github.io via OLLAMA_ORIGINS avant de démarrer Ollama. Redémarrer le serveur après modification. Les règles CORS et l'accès au réseau local varient selon le navigateur.
4. Dans RON : Réglages → Activer l’IA locale gratuite → Enregistrer et tester.

Cette option n'utilise ni API cloud facturable ni clé, mais le matériel, l'électricité et le réseau nécessaire au téléchargement restent à la charge de l'utilisateur. Le modèle n'est pas embarqué dans les fichiers du site. Sur téléphone, localhost désigne le téléphone, pas l'ordinateur où tourne Ollama.

Cloud gratuit : le bouton « Préparer un cloud gratuit » choisit openrouter/free et le filtre de modèles gratuits. Il faut un compte et une clé OpenRouter créés par l'utilisateur. Les quotas, modèles et conditions peuvent changer. Le contrôle « Bloquer les appels API facturables » est activé par défaut et refuse les modèles sans indication de gratuité et les endpoints cloud facturables. Vérifier les conditions tarifaires du fournisseur. Désactiver volontairement cette protection réautorise les moteurs historiques potentiellement payants.

Orchestration agentique : le mode Agentique lance un planificateur, un spécialiste puis une synthèse ; les demandes complexes peuvent ajouter un vérificateur contradicteur. Le mode Conseil peut entraîner davantage d'appels. Aucun agent ne contrôle les appareils, ne lance des programmes externes ni ne fait de recherche web autonome. La qualité et les performances dépendent du modèle choisi. Pas de décision médicale autonome.

Bibliothèque : RON Savoirs utilise [Fuse.js 7.5.0](https://github.com/krisk/Fuse) (licence Apache-2.0) pour la recherche de notes et fichiers texte dans le navigateur. Les connecteurs GitHub (README de dépôts publics uniquement, sans jeton) et Wikipédia sont déclenchés uniquement par un clic. Le contenu externe peut être inexact ou inclure des instructions malveillantes ; il est traité comme référence, jamais comme commande. Le partage d'extraits avec le LLM est désactivé par défaut à chaque session. La conservation des documents dans IndexedDB est facultative et non chiffrée. L'effacement local ne retire pas les données déjà transmises à un fournisseur cloud.

Tests : suites automatisées de conversation, moteurs, limites, Mistral simulé, bibliothèque locale, sécurité et orchestration du modèle libre. Les tests simulés ne prouvent pas les performances d'un modèle Ollama réel ou les permissions d'un téléphone physique.


## Configuration automatique locale

RON propose désormais une **auto-configuration sans abonnement** : sur les nouveaux profils, à l'ouverture de RON Présence, un diagnostic court interroge **uniquement localhost** sur les ports 11434 (Ollama), 1234 (LM Studio) et 8000 (vLLM), sans clé et sans appel aux API cloud. Les serveurs doivent être déjà lancés sur l'appareil utilisé. Les modèles de génération disponibles sont lus depuis leurs catalogues compatibles OpenAI. Les modèles réservés à l'embedding, à la transcription ou à la synthèse vocale sont écartés ; RON choisit un modèle conversationnel en privilégiant les familles récentes et une taille raisonnable selon les informations approximatives fournies par le navigateur (mémoire, nombre de cœurs). L'auto-détection ne mesure pas la RAM/GPU réellement disponible et ne garantit pas que le modèle pourra générer une réponse.

Si la détection réussit, RON règle automatiquement le modèle, le mode Agentique, le budget Éco et le verrouillage zéro euro, puis enregistre les paramètres non secrets. Le démarrage ne demande **aucune génération au modèle** ; utiliser « Enregistrer et tester » dans les réglages pour vérifier l'inférence réelle. Si aucun moteur n'est joignable, une aide d'installation apparaît ; aucun serveur payant n'est choisi en secours. La configuration automatique ne transmet aucun document, conversation, son, fichier ou donnée de santé aux moteurs détectés.

Pour éviter les changements surprises, les anciens profils ayant configuré leur moteur conservent leurs préférences et leur auto-détection reste désactivée tant qu'ils ne l'activent pas. L'interrupteur « Configuration automatique » contrôle les démarrages ultérieurs. Le bouton « Détecter et configurer automatiquement » lance le diagnostic à la demande. Une modification manuelle pendant le diagnostic prime toujours sur le résultat automatique.

**Limites** : les navigateurs peuvent bloquer les requêtes HTTP vers localhost depuis un site HTTPS, ou exiger des permissions de réseau privé. Un téléphone ne peut pas découvrir automatiquement un Ollama installé sur l'ordinateur via localhost. RON ne peut pas installer Ollama, télécharger un modèle volumineux ou consentir à une connexion avec une application tierce à la place de l'utilisateur. Rien de payant n'est lancé automatiquement.
