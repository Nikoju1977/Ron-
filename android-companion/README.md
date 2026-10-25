# RON Android Compagnon — prototype natif

Le compagnon Android est une application **distincte de la PWA RON**. Il fournit une exécution de missions demandée explicitement par l'utilisateur via un **service de premier plan visible et arrêt-able**. Il ne constitue **ni une conscience subjective**, ni une garantie de traitement 24 h/24 : le système peut suspendre ou arrêter un processus, particulièrement sur les appareils Samsung avec économie d'énergie.

## Ce qui fonctionne

- **Bouton Démarrer** dans l'application native : demande un service de premier plan Android de type `specialUse`, avec notification permanente et action **Arrêter RON**. Le service n'écoute ni microphone ni GPS, et ne démarre jamais secrètement.
- **Boucle locale** toutes les ~60 secondes lorsque le processus Android reste actif. Elle sélectionne une responsabilité active, appelle **un modèle sur le réseau local uniquement** (API compatible OpenAI, sans clé), recueille un JSON de progression, journalise l'étape et passe en attente lorsque RON répète la même étape trois fois sans progrès.
- **Limites** : au plus 24 cycles/jour (UTC) et minimum 1 minute entre les cycles ; délai progressif en cas d'erreur. Une requête maximum à la fois et des délais réseau stricts.
- **Reprise différée** via WorkManager (fenêtre minimale de 15 minutes, non exacte) si le système arrête le service ; la planification persiste à travers un redémarrage, selon la politique Android. **Arrêter** désactive le service et annule la reprise.
- **Mémoire** privée locale et fusion des missions par identifiant et date de modification. L'app native contient RON WebView connecté à ses données grâce à un **canal de messages réservé à l'origine GitHub Pages et au cadre principal**, sans donner à la page la permission de lancer le service.
- **Migration depuis Chrome** : ouvrir le panneau DOTS de RON dans Chrome, toucher **Exporter vers Android**, puis dans le compagnon Android utiliser **Importer des missions DOTS (.json)**. Chrome et WebView ont des espaces de stockage distincts, la synchronisation ne traverse pas automatiquement les deux applications.

## Installation et essai (prototype)

1. Dans GitHub Actions, ouvrir **RON Android companion** et télécharger l'artefact `ron-android-companion-debug` d'une exécution verte. Il s'agit d'un **APK de développement** signé avec la clé debug de GitHub Actions, **pas** d'une version publique de production.
2. Sur Samsung, autoriser l'installation de cet APK pour la source choisie (si tu fais confiance au fichier), installer et ouvrir l'application.
3. Préparer un **modèle local OpenAI-compatible** sur un ordinateur de ton réseau Wi‑Fi privé. Exemple d'adresse native : `http://192.168.1.2:11434/v1`, modèle `qwen3:4b` si effectivement installé sur ce serveur. Depuis le téléphone, `127.0.0.1` représente **le téléphone**, pas ton ordinateur. Si tu configures Ollama sur le LAN, **limite son écoute au réseau privé protégé** ; n'ouvre pas son port sur Internet.
4. Renseigner l'adresse, le nom exact du modèle, l'intervalle, puis **Enregistrer**. Ajouter une mission ou l'importer.
5. Appuyer sur **Démarrer** et accepter la permission de notification. Vérifier la notification **RON · Missions autonomes**. En quittant l'application ou en verrouillant le téléphone, le service essaie de poursuivre quand Android lui accorde du temps processeur.
6. Pour interrompre toute exécution : **Arrêter** dans l'app ou via la notification. **Pause** conserve le service mais arrête les cycles. En l'absence de modèle local, RON n'invente pas une progression.

## Sécurité et limites

- La connexion du modèle n'accepte que `http://` et une **adresse IPv4 littérale privée avec port explicite** (10/8, 172.16/12, 192.168/16, ou bouclage 127/8), chemin `/v1` ou racine ; pas de DNS arbitraire, clé API, redirection HTTP, endpoint public ou dépense cloud automatique.
- HTTP LAN n'est **pas chiffré**. Utiliser exclusivement un Wi‑Fi de confiance, un modèle privé et aucune donnée sensible. Pour une connexion sûre à distance il faudrait construire un tunnel chiffré avec authentification et contrôles supplémentaires.
- Le modèle peut se tromper, déduire un progrès non vérifié ou échouer. Le journal ne certifie pas que des actions externes ont été réalisées : aucun outil n'est exécuté sur l'ordinateur hébergeant le modèle.
- La notification nécessite l'autorisation Android 13+. Certains fabricants restreignent les services de premier plan, même explicitement démarrés. Les alarmes et processus peuvent subir la veille profonde Doze.
- Android 14+ exige un type de service. Le type `specialUse` est déclaré avec son objectif ; **la publication Play Store reste soumise à l'examen de Google**. Rien ne garantit son approbation. Le type `dataSync` ne convient pas pour une tâche réellement continue et est limité sur Android 15+.
- **Ne désactive pas les protections de sécurité Android**. Si les restrictions du fabricant arrêtent le service, WorkManager pourra effectuer des cycles différés mais n'offre pas de garantie d'horaire exact ou 24/7.

## Construire

Ouvrir le dossier `android-companion/` dans Android Studio (JDK 17, Android SDK 35), puis lancer `gradle :app:assembleDebug :app:testDebugUnitTest` avec Gradle 8.11.1. Le workflow GitHub `.github/workflows/android-companion.yml` construit le même APK. Un téléphone réel doit encore servir à vérifier notification, veille, WebView et disponibilité du modèle LAN avant de qualifier l'exécution prolongée de fiable.

Ce projet ne réclame aucune permission de microphone, d'accessibilité, de localisation, de SMS ou de lecture des comptes.
