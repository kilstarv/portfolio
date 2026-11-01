# Portfolio BTS SIO

Portfolio statique construit avec Jekyll et publié par GitHub Pages. Les projets sont des fichiers Markdown dans `_projets`; les compétences sont définies dans `_data/competences.yml`.

## Première publication

1. Créez un dépôt à partir du modèle avec GitHub.
2. Modifiez le titre, la description et les coordonnées dans `_config.yml`.
3. Dans les réglages GitHub du dépôt, activez Pages depuis la branche `main`, dossier racine.

## Consulter le site sans serveur

Le fichier `index.html` à la racine est un modèle Jekyll; il doit d'abord être généré. Depuis la racine du dépôt, lancez `bundle exec jekyll build`, puis ouvrez `_site/index.html` dans votre navigateur. Les chemins relatifs permettent de parcourir les pages et les images directement en `file://`, sans lancer de serveur HTTP. Après toute modification du contenu, relancez la commande pour actualiser `_site`.

## Ajouter ou modifier un projet avec l’assistant local

1. Ouvrez `tools/gestion-projets.html` dans une version récente de Chrome ou Edge.
2. Choisissez le dossier racine de votre copie locale du dépôt et accordez l’accès en lecture/écriture.
3. Sélectionnez **Nouveau projet** ou **Modifier**. Renseignez le titre, la date et le résumé; les autres champs et sections sont facultatifs.
4. Choisissez les compétences dans la liste lisible, ajoutez des images et indiquez un texte alternatif pour chacune.
5. Prévisualisez le Markdown, puis enregistrez. Les pages sont écrites dans `_projets/`; les images sont copiées dans `images/projets/<slug>/`.
6. Vérifiez les fichiers produits, puis publiez vos changements par votre procédure Git habituelle. L’assistant n’accède pas à GitHub, ne crée aucun commit et ne publie rien.

L’accès disque utilise l’API File System Access du navigateur et demande explicitement le dossier et l’autorisation. Si l’ouverture directe du fichier est bloquée, vous pouvez servir le dépôt uniquement sur votre ordinateur avec un serveur HTTP local, puis ouvrir `tools/gestion-projets.html` sur cette adresse locale. Aucun serveur distant, service tiers ou dépendance npm n’est utilisé. Les navigateurs ne prenant pas en charge cette API peuvent toujours modifier les fichiers Markdown directement.

La suppression depuis l’assistant demande confirmation et retire uniquement le fichier Markdown; les images restent en place. Le modèle de contenu est dans `_projets/_A-COPIER.md`.

## Modifier un projet manuellement

Copiez `_projets/_A-COPIER.md` vers un nouveau fichier `.md` de `_projets/`, renseignez son front matter et ses sections Markdown, puis placez ses images dans `images/`. Les métadonnées catégorie, statut, technologies, image, galerie, dépôt et démonstration sont facultatives.

## Licences

Code sous licence MIT; textes et captures sous licence CC BY 4.0.
