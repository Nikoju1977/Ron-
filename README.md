# RON

Assistant agentique multimodal de Studio Niko Design.

- Interface 3D particulaire
- Accès microphone et reconnaissance vocale
- Architecture multi-LLM / endpoints OpenAI-compatible
- Modes Direct, Agentique et Conseil scientifique
- Déploiement web statique compatible Vercel

Le fichier principal est `index.html`.


## Intégration Radar 44

RON peut interroger directement les sorties publiques de `Nikoju1977/radar-de-niko` sans dupliquer son moteur de collecte.

Commandes reconnues, à l'écrit comme à la voix :

- `Radar 44` — synthèse générale
- `Actualités 44` / `Quoi de neuf dans le 44 ?`
- `Météo 44`
- `Trafic 44`
- `Transports 44`
- `Carburants 44`
- `Vigilance 44` / `Crues 44`

La passerelle lit `radar.jsonl` et `services.json` depuis GitHub Pages, avec cache court et timeout réseau. Elle est aussi exposée dans le navigateur via `window.RON_RADAR44` pour de futures extensions.
