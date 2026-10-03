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

## Validation

Syntaxe JavaScript et manifeste vérifiés. Les 19 vérifications simulées de conversation, carnet, consentement, commandes, écoute et interruption passent. Le microphone réel, l'installation, le service worker en navigateur et les rendus sur appareils physiques restent à valider. Compatibilité visée : navigateurs modernes ; aucune garantie pour tous les navigateurs, téléviseurs ou montres.
