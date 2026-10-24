# RON Présence

Page : `ron-presence.html`. Cette version coexiste avec `index.html`, qui conserve ses fonctions multimédias.

## Utilisation

Servir les fichiers sur une adresse HTTPS (ou localhost pour le développement), puis ouvrir `/ron-presence.html` — en adaptant le préfixe si le site est dans un sous-dossier. RON détecte automatiquement les moteurs gratuits déjà présents (navigateur ou localhost). Aucune clé API n'est requise pour ces moteurs. Les fournisseurs cloud avec clé restent des options manuelles et ne sont jamais activés pour contourner le mode zéro euro.

- Interface responsive pour téléphone, tablette et ordinateur ; clavier, souris et tactile.
- Installer : utiliser le bouton Installer ou le menu du navigateur, lorsque disponible. Sur iPhone/iPad, utiliser le menu Partager puis Ajouter à l’écran d’accueil.
- Si la reconnaissance vocale ou WebGL est indisponible, la conversation écrite et la présence visuelle simple restent disponibles.
- Après une première ouverture en ligne et l’installation réussie du service worker, l’interface et le carnet peuvent s’ouvrir hors connexion. Le serveur IA et la reconnaissance vocale ne sont pas rendus hors ligne par cette installation.
- Le service worker est limité à l’URL de cette page et ne met en cache que les fichiers publics de l’interface. Il ne met pas en cache les requêtes IA ni les données de santé.

## Correctifs et mises à jour automatiques

À chaque fusion dans la branche `main`, GitHub Pages publie uniquement les fichiers vérifiés par le processus de déploiement. Le script `ron-tools/build-pages.cjs` ajoute un manifeste `ron-version.json` et inscrit le SHA Git approuvé dans la page et dans le service worker. Le cache de la PWA est unique à chaque publication : plus besoin de modifier à la main un numéro de cache après chaque correctif.

RON vérifie sa version au démarrage (puis périodiquement pendant l'utilisation et lorsque la connexion revient) en consultant **uniquement** `ron-version.json` sur sa propre origine HTTPS. Lorsqu'une mise à jour publiée est disponible, il l'installe via le service worker. Si aucune question n'a été posée, qu'aucun texte n'est en cours d'écriture et qu'aucune fenêtre n'est ouverte, l'interface peut se recharger automatiquement. Sinon, RON affiche « Installer la mise à jour » ou « Plus tard », pour ne pas interrompre une conversation. Le texte personnel, le carnet et les clés ne sont jamais envoyés au système de mise à jour. La commande « Ron, mets-toi à jour » permet aussi une vérification manuelle.

**Limite de sécurité :** la PWA ne modifie pas directement le code de GitHub et n'exécute jamais des « patchs » arbitraires venant d'un dépôt externe. Les changements de code doivent d'abord être publiés et testés dans `main` ; RON les reçoit ensuite automatiquement. Sans Internet, la dernière version déjà installée reste disponible dans le cache. Une session ou un brouillon actif n'est pas effacé automatiquement.

## Dialogue oral Food Maps — glucides et DT1

RON répond directement en **français à voix haute** à une demande telle que « Ron, 150 grammes de pâtes cuites, ça fait combien de glucides ? ». Le spécialiste Food Maps reçoit la portion, cherche les valeurs publiées dans Open Food Facts, affiche les différentes fiches identifiées (produit et marque) et prononce une **phrase courte avec le calcul et sa provenance**, sans lire tous les résultats. La reconnaissance de la question peut utiliser le microphone Chrome, si autorisé ; la restitution utilise les voix de synthèse vocale disponibles sur l’appareil. La disponibilité d'une voix française reste soumise au téléphone.

Pour les féculents concernés, si la personne dit simplement « 150 grammes de riz », RON demande « **cru ou cuit ?** », garde cette précision temporairement en mémoire locale (2 minutes) et accepte « cru », « cuit », « crus », « cuites » au tour suivant. Le poids **avant cuisson ne doit pas être mélangé avec une valeur nutritionnelle pour un aliment cuit** : RON écarte les fiches incompatibles et demande une étiquette si le produit n'est pas clairement identifiable. Pour un repas avec plusieurs ingrédients, il repère les quantités mais ne fabrique pas de total glucidique si les données individuelles sont incertaines.

Pour un calcul exact sur les données fournies par la personne, énonce ou saisis les glucides de l’étiquette pour 100 g : RON calcule **poids de la portion × glucides pour 100 g ÷ 100**, arrondi au dixième. Ce mode ne contacte aucun service externe. Les valeurs venant d'Open Food Facts sont **participatives et ne sont pas garanties** : vérifie le bon produit, sa marque, le code-barres et les valeurs de ton emballage avant toute décision de traitement. RON ne calcule ni ne prescrit une dose d’insuline ; les situations de risque sont orientées vers le protocole médical personnalisé et, en cas de gravité, les secours.

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

## Food Maps et agent éducatif diabète de type 1

**Food Maps** est accessible depuis le bouton Food Maps et dans **Savoirs & connecteurs**. Il couvre un maximum de produits emballés grâce à la recherche mondiale d'**Open Food Facts** (texte, marque et code-barres ; réponses non exhaustives et dépendantes des produits renseignés). Pour le libre-service des aliments génériques, le catalogue officiel **[Ciqual 2025 de l'Anses](https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi%3A10.57745%2FRDMHWY)** recense **3 484 aliments** mais n'est **pas encore importé automatiquement** dans RON : Food Maps affiche un accès à Ciqual et permet de saisir manuellement les valeurs nutritionnelles de l'étiquette. Il serait trompeur de prétendre que toute la base Ciqual est intégrée aujourd'hui.

La formule déterministe est : **glucides (g) = poids de la portion (g) × glucides pour 100 g ÷ 100**. Exemple avec une étiquette indiquant 24 g/100 g : 150 g apportent **36 g de glucides**. Les poids crus et cuits ne sont pas interchangeables. Quand plusieurs produits portent le même nom, RON affiche plusieurs valeurs avec les marques et les liens Open Food Facts. Sans valeur vérifiable, il ne devine pas les glucides ; une valeur inscrite manuellement est explicitement déclarée **non vérifiée**. Les données Open Food Facts sont sous licence **ODbL** (attribution et partage dans les conditions de la licence) ; consulter https://world.openfoodfacts.org/terms-of-use.

**iOS / iPadOS :** Food Maps, la saisie des glucides et l'agent éducatif fonctionnent dans **Safari**, sans WebGPU et sans démarrer de LLM. Sur iPhone, ouvrir l’URL RON Présence dans Safari, utiliser le menu **Partager → Sur l’écran d’accueil** pour l'installer. Le formulaire utilise des champs tactiles d'au moins 16 px (pas de zoom automatique Safari), le défilement natif et les zones sécurisées des appareils à encoche. Un test de la page dans le moteur Apple **WebKit** sur un profil iPhone est inclus dans GitHub Actions : il simule un service Open Food Facts pour éviter les données volatiles. Ce test ne remplace pas un essai sur un iPhone physique. La synthèse vocale et la reconnaissance vocale dépendent de la version iOS et de ses permissions ; le calcul de glucides n'en dépend pas.

L'**agent éducatif diabète de type 1** est une réponse de sécurité spécialisée (sans prétendre être un diabétologue diplômé) qui renvoie vers **[AJD](https://www.ajd-diabete.fr/vivre-avec-un-diabete-de-type-1/prise-en-charge-du-diabete-de-type-1/lalimentation/)** et **[Assurance Maladie](https://www.ameli.fr/assure/sante/themes/diabete-adulte/diabete-symptomes-evolution/acido-cetose-hypoglycemie-hyperglycemie)**. Il donne des notions générales, jamais de dose ou d'adaptation de bolus d'insuline. Des symptômes graves d'hypoglycémie ou d'acidocétose appellent une prise en charge urgente (France : 15 / 112). L'agent n'a pas accès au capteur, au dossier médical ni à une surveillance active. Aucun renseignement clinique n'est envoyé à Open Food Facts : uniquement le nom d'aliment ou le code-barres lors d'une recherche volontaire.

L'API de recherche Open Food Facts est communautaire et limitée en fréquence ; RON effectue les recherches seulement à la demande, met en cache temporairement quelques fiches pendant la session, et ne requiert ni clé API ni modèle LLM pour le calcul. En l'absence de CORS, d'accès réseau ou de valeurs nutritionnelles, le calcul manuel à partir de l'étiquette reste disponible hors connexion.

## Connecteurs Internet publics sans clé (RON Net)

RON répond directement aux demandes explicites de **météo aujourd’hui/demain**, de **recherche Wikipédia**, d’**études scientifiques** (OpenAlex) et de **dépôts GitHub publics**. Ces requêtes passent par une API publique en HTTPS, **sans démarrer le modèle IA local** : notamment, une météo ne demande pas de calcul Gemma CPU. Les résultats incluent des sources cliquables et RON distingue une réponse en direct d’une réponse générée par le modèle.

- Météo : Open-Meteo, données prévisionnelles avec date, températures, précipitations, vent et source. Une ville écrite dans la question suffit (« météo demain à Nantes »). Sans ville, le navigateur demande l’autorisation de localisation ; si elle est refusée, il invite à préciser la commune. Les coordonnées ne sont envoyées qu’à Open-Meteo lorsque c’est indispensable à la recherche météo.
- Wikipédia : recherche d’articles et résumés dans l’encyclopédie française, pas une source d’actualités en temps réel.
- Publications : recherche OpenAlex, affichage de titres, année, revue et liens DOI. Cela ne signifie ni que l’article a été lu ni que ses conclusions sont validées.
- GitHub : consultation de métadonnées publiques de dépôts, recherche et lien direct vers la source ; quota d’API public possible.

Le nouvel espace **Savoirs et connecteurs → Rechercher en ligne** permet de faire ces recherches sans les ajouter automatiquement à la bibliothèque personnelle. Seul le terme recherché (ou la ville / des coordonnées après autorisation pour la météo) est transmis au fournisseur concerné. Aucun carnet, historique de conversation ou fichier personnel n'est transmis aux connecteurs Internet. Les endpoints sont limités à des hôtes publics déterminés, aucun proxy arbitraire ni clé API, et aucun téléchargement de modèle n'est nécessaire pour ces réponses. Cette approche **n’est pas un moteur de recherche universel** et ne garantit pas la lecture de toutes les pages du Web (restrictions CORS, API et quotas). Pour les actualités récentes, les données devront venir d’une source d’actualité dédiée vérifiable : Wikipédia ne suffit pas. Les API peuvent être indisponibles ou limitées. Gratuité Open-Meteo soumise notamment aux usages non commerciaux et aux seuils du fournisseur ; vérifiez ses conditions.

Documentation : https://open-meteo.com/ ; https://www.mediawiki.org/wiki/API:Cross-site_requests ; https://docs.openalex.org ; https://docs.github.com/en/rest

## Bibliothèques LLM libres et agents spécialisés

RON dispose d'adaptateurs vers plusieurs moteurs exécutés localement. Chaque moteur doit réellement être **installé et disponible** : RON ne prétend pas installer un LLM lourd en arrière-plan depuis GitHub.

- **[Transformers.js](https://github.com/huggingface/transformers.js)** et **ONNX Runtime Web** : génération dans un Web Worker navigateur sur CPU/WebAssembly avec Gemma 3 270M, sans clé. Compatible uniquement avec les appareils qui réussissent l'initialisation réelle du modèle.
- **[WebLLM](https://github.com/mlc-ai/web-llm)** : moteur d'inférence WebGPU via téléchargement volontaire à la première question ; si le GPU est incompatible, RON essaie le moteur CPU.
- **[Ollama](https://github.com/ollama/ollama)** : moteur open source sur ordinateur ou appareil équipé. Les modèles sont sélectionnés selon la mémoire disponible. Aucun serveur distant n'est interrogé pendant la détection automatique.
- **[llama.cpp](https://github.com/ggml-org/llama.cpp)** : nouveau connecteur vers `llama-server` et son API compatible OpenAI sur `http://localhost:8080/v1`, avec catalogue des modèles et génération ; le serveur et le modèle doivent être démarrés par l'utilisateur. Le serveur doit autoriser l'origine de la PWA si son navigateur le demande.
- **[vLLM](https://github.com/vllm-project/vllm)** : autre serveur d'inférence compatible OpenAI, adapté aux machines puissantes. LM Studio est aussi pris en charge, mais n'est pas qualifié de bibliothèque open source.

**Agents spécialisés réellement intégrés** : `ron-agent-hub.js` dirige une demande vers l'agent météo (Open-Meteo), encyclopédique (Wikipédia), scientifique (OpenAlex), bibliothécaire (Open Library), GitHub, calculateur ou horloge. Le déroulement est *routeur → outil → vérification des sources → réponse*. Les agents ne possèdent pas d'accès shell, ne modifient pas de dépôt et n'exécutent aucun code distant. Les questions personnelles vont au modèle local sans recherche Internet automatique.

Si une demande de **synthèse de références publiques** est explicite, si le mode agentique est activé et si un moteur local adapté comme Ollama, llama.cpp ou vLLM est joignable, RON peut produire une synthèse à partir des résultats récupérés et afficher les liens source vérifiés. En l'absence d'un modèle ou si la génération échoue, il montre les données sourcées directement. L'IA n'est pas une preuve et les notices scientifiques ne contiennent pas les résultats complets des études. Les fonctions ne garantissent pas une réponse correcte à absolument toutes les questions. Les téléphones Android restent limités par leur RAM, CPU et quotas de stockage.

## Routage factuel automatique, vérification et langue française

RON reconnaît directement les questions factuelles publiques en français courant, notamment « Qui est Marie Curie ? », « Peux-tu me dire qui a découvert la pénicilline ? », « Que sais-tu de Marie Curie ? » et « Parle-moi de Marie Curie ». Il cherche alors un résumé encyclopédique dans **Wikipédia en français** sans imposer « cherche sur Internet » et sans lancer un minuscule LLM qui pourrait inventer des faits. Les connecteurs dédiés restent prioritaires pour météo, publications scientifiques, livres, GitHub, calcul et heure. Le routeur repose sur des expressions françaises explicites ; il ne comprend pas toutes les formulations et ne remplace pas un moteur Web universel.

Les questions personnelles, les documents privés et les informations médicales décrites à la première personne ne déclenchent pas automatiquement de recherche publique. Pour une recherche volontaire, les outils de l'espace « Savoirs et connecteurs » restent disponibles. RON ne transmet pas automatiquement l'historique de conversation aux API publiques. Les nouvelles questions sur les actualités ou les cours en direct donnent une réponse d'indisponibilité plutôt qu'une invention : **aucune source d'actualité en direct n'est encore intégrée**.

**Vérification :** chaque agent accepte désormais uniquement des URL HTTPS appartenant au domaine attendu (météo : Open-Meteo ; science : DOI/OpenAlex ; livres : Open Library ; encyclopédie : Wikipédia ; code : GitHub). Cette vérification prouve la provenance du lien retourné, **pas la véracité du contenu**. Aucun taux de justesse chiffré n'est revendiqué. Les résultats OpenAlex contiennent des notices bibliographiques et ne constituent pas une lecture critique des articles.

**Connexion à l'IA sélectionnée :** lorsqu'une question demande explicitement une analyse ou une synthèse de références publiques, RON peut demander au modèle **déjà configuré** (Ollama, llama.cpp, LM Studio, vLLM ou fournisseur distant activé par l'utilisateur) de reformuler ces données. Le modèle Gemma 3 270M du téléphone n'est pas sollicité pour cette synthèse coûteuse : les références sont affichées directement. Le mode zéro euro continue de bloquer les appels facturables. Les extraits externes sont traités comme des données non fiables, pas comme des instructions de contrôle. Une synthèse manifestement non française ou contenant des URL inventées est écartée au profit du résultat sourcé. Les autres erreurs factuelles ne peuvent pas toutes être détectées automatiquement.

**Français :** les fournisseurs compatibles OpenAI reçoivent une instruction linguistique commune, et l'interface de conversation, le moteur CPU, la reconnaissance vocale et la synthèse vocale privilégient `fr-FR`. Cela améliore la cohérence mais aucun modèle, notamment les plus petits, ne garantit une réponse toujours correcte ou parfaitement française.

## IA automatique sans clé — version navigateur

RON Présence cherche sans inscription ni paiement un moteur conversationnel local déjà lancé (Ollama, LM Studio, vLLM). Si aucun n'est joignable, il examine l'IA intégrée de Chrome puis propose de la génération **sans GPU sur le processeur avec WebAssembly et Transformers.js**, notamment sur Android, même si le navigateur prétend avoir un adaptateur WebGPU. Le modèle CPU choisi est désormais **`onnx-community/gemma-3-270m-it-ONNX`** en q4f16 (environ **426 Mo** de poids, plus les fichiers du tokenizer et du runtime). Ce modèle, conçu pour des appareils légers, est plus compact que Qwen2.5-0.5B q8 (512 Mo), qui ne chargeait pas sur le téléphone. La qualité de ses réponses en français reste dépendante du matériel et de la question, à télécharger uniquement à la première question. La génération se fait localement : aucune clé API, aucun service de génération facturé. **La préparation et le calcul CPU s’exécutent désormais dans un Web Worker séparé**, pas sur le fil d’interface ; les messages de progression restent visibles, le bouton « Arrêter » peut terminer le calcul, et les délais maximaux (210 secondes pour la préparation, 90 secondes pour générer) évitent de laisser la page indéfiniment bloquée. Un téléchargement à 100 % n’équivaut pas à un modèle déjà chargé en mémoire. Sur Chrome Android, le modèle utilise désormais le **module WebAssembly SIMD CPU classique** d'ONNX Runtime, sélectionné avant tout chargement et épinglé à la version fournie par Transformers.js 4.3.1. Cela vise l’erreur `ERROR_CODE: 9` / `GatherBlockQuantized` : le module Asyncify pouvait manquer de cet opérateur. La réussite sur ce téléphone reste à vérifier. Le français est explicitement demandé dans les instructions du modèle, avec un contexte court ; les réponses incomplètes ou répétitives sont refusées au lieu d’être présentées comme fiables. Le calcul CPU reste lent, demande de la mémoire et la qualité n'atteint pas celle d'un grand modèle. Sur un ordinateur compatible, le WebGPU reste proposé ; **si WebGPU échoue**, RON essaie automatiquement le modèle CPU.

Les modèles WebGPU ou modèles intégrés encore absents ne sont **pas téléchargés au démarrage de la PWA**. À la première question, WebLLM peut télécharger **plusieurs centaines de Mo** de fichiers libres vers le cache local. L'utilisateur voit un état de chargement ; l'installation du modèle peut échouer si le GPU, le navigateur, l'espace disque ou Internet ne sont pas suffisants. Le premier téléchargement utilise des fournisseurs publics de fichiers (jsDelivr pour WebLLM et Hugging Face/MLC pour les modèles) : il n'y a pas de clé API de génération, mais la consultation de ces serveurs reste soumise à leurs politiques de réseau. Ensuite, la génération est locale et peut fonctionner sans transmission des questions à une API distante. Le calcul sur un petit modèle peut être lent et moins précis ; le mode conversation directe est privilégié pour éviter les enchaînements d'agents gourmands.

Chrome Prompt API n'est pas disponible sur tous les appareils et pas sur Chrome mobile à ce jour ; elle dépend des limites de matériel, de modèle et de langue. WebGPU n'est pas universel. WebAssembly est plus largement disponible sur Android, mais un modèle peut encore échouer (mémoire, quota de stockage, connexion, temps de calcul ou modèle hébergé indisponible). **Aucune solution purement statique ne garantit une IA sans clé sur tous les téléphones** : RON affiche une erreur courte, garde la question et ne prétend pas être prêt après une simple détection. En cas de réglage manuel déjà enregistré, RON le respecte tant que la recherche automatique n'a pas été activée.

Sources d'implémentation : [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api), [WebLLM](https://webllm.mlc.ai/docs/user/get_started.html), [Transformers.js](https://huggingface.co/docs/transformers.js) et [modèle Gemma 3 270M ONNX](https://huggingface.co/onnx-community/gemma-3-270m-it-ONNX). Les configurations CPU enregistrées avec Qwen ou SmolLM2 sont automatiquement migrées au prochain démarrage.

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
