# RON

Assistant agentique multimodal de Studio Niko Design.

- Interface 3D particulaire
- Accès microphone et reconnaissance vocale
- Architecture multi-LLM / endpoints OpenAI-compatible
- Modes Direct, Agentique et Conseil scientifique
- Déploiement web statique compatible Vercel

Le fichier principal est `index.html`.

## RON Présence

La nouvelle version compagnon est disponible dans [`ron-presence.html`](ron-presence.html) : voix douce, commandes, modes Compagnon/Studio/Analyse et carnet de bien-être volontaire. Elle inclut les éléments d'installation comme application web et une interface responsive.

Consulter [l’utilisation, la compatibilité et les limites](README-RON-PRESENCE.md). Les connexions Samsung Health, Android et Wear OS restent à implémenter. La version multimédia `index.html` est conservée.


## RON gratuit · agents + bibliothèque locale

Accès direct : [RON Présence](ron-presence.html) — également par « IA GRATUITE » dans l'interface principale.

- **Moteur par défaut pour une nouvelle installation** : Ollama sur cet appareil avec Qwen 3.5 4B, sans coût API ni clé.
- **Agents** : planificateur, spécialiste, vérificateur pour les tâches complexes, puis synthèse. Les modèles locaux peuvent être plus lents.
- **Protection coût zéro** activée par défaut : seuls les serveurs locaux (Ollama, LM Studio, vLLM, compatible local) et les modèles OpenRouter explicitement gratuits sont autorisés. Une configuration Mistral/Groq ancienne est bloquée tant que la protection reste active.
- **Cloud gratuit en option** : OpenRouter openrouter/free nécessite une clé gratuite et impose des quotas. Aucun compte n'est créé automatiquement.
- **Bibliothèque** : notes et fichiers texte, import explicite de README GitHub publics ou d'extraits de Wikipédia, recherche floue Fuse.js. Rien n'est transmis au LLM sans autorisation.
- **Tests** : exécuter npm --prefix ron-tests install puis npm --prefix ron-tests test.

Voir [installation et limites détaillées](README-RON-PRESENCE.md). Le site statique ne peut installer Ollama sur un ordinateur ni fonctionner comme modèle embarqué autonome sans matériel compatible.


### Configuration intelligente et automatique

Sur une nouvelle installation de RON Présence, la configuration intelligente recherche automatiquement les API de modèles **déjà installées sur localhost uniquement** : Ollama, LM Studio et vLLM. Si un modèle de conversation est détecté, RON choisit l'un des modèles installés en fonction d'une estimation prudente des capacités du navigateur (mémoire disponible annoncée et cœurs), active les agents et sauvegarde uniquement les réglages non secrets. Aucun compte, aucun fournisseur payant, aucune connexion à une machine du réseau local et aucune génération IA ne sont lancés au démarrage.

Un bouton **« Détecter et configurer automatiquement »** permet de relancer ce diagnostic. Les réglages manuels existants sont préservés par défaut ; l'utilisateur peut activer/désactiver les nouveaux scans au démarrage. Si aucun serveur n'est joignable, RON affiche une explication et conserve l'option locale. Les autorisations CORS / réseau privé peuvent limiter la détection sur GitHub Pages. Une vérification effective de la génération passe toujours par « Enregistrer et tester ».
