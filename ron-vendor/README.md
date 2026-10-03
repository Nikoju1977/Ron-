# Bibliothèques embarquées

- `marked.js` : Marked 18.0.14, distribution UMD du paquet npm `marked`. Licence : `marked-LICENSE`. Source : https://github.com/markedjs/marked
- `purify.min.js` : DOMPurify 3.4.16, distribution du paquet npm `dompurify`. Licences : `dompurify-LICENSE`. Source : https://github.com/cure53/DOMPurify

Versions figées pour un déploiement reproductible. Les réponses passent par le nettoyage DOMPurify après le parsing Marked. Les images, scripts, styles, attributs événementiels et liens non HTTP(S) ne sont pas autorisés par le rendu de Ron.
