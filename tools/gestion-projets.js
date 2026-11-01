(() => {
  "use strict";

  const headings = [
    ["contexte", "Contexte"],
    ["moyens", "Conditions et moyens"],
    ["description", "Description de l'activité"],
    ["productions", "Productions et preuves"],
    ["recul", "Ce que j'en retiens"],
  ];
  const elements = Object.fromEntries([
    "incompatible", "connexion", "choisir-dossier", "changer-dossier", "atelier",
    "nom-dossier", "message", "nouveau-projet", "liste-projets", "aucun-projet",
    "vue-formulaire", "titre-formulaire", "formulaire-projet", "titre-projet",
    "date-projet", "resume-projet", "cadre-projet", "categorie-projet",
    "statut-projet", "technologies-projet", "github-projet", "demo-projet",
    "liste-competences", "images-projet", "liste-images", "section-contexte",
    "section-moyens", "section-description", "section-productions", "section-recul",
    "optimiser-images", "annuler-edition", "vue-apercu", "resume-apercu", "markdown-apercu",
    "modifier-apercu", "enregistrer-projet",
  ].map((id) => [id, document.getElementById(id)]));

  const state = {
    root: null,
    competences: [],
    projets: [],
    edition: null,
    frontmatter: [],
    prefixeMarkdown: "",
    ordreMarkdown: [],
    images: [],
    apercu: null,
  };

  function afficherMessage(message, type = "") {
    elements.message.textContent = message;
    elements.message.dataset.type = type;
  }

  function valeurYAML(value) {
    return JSON.stringify(String(value));
  }

  function lireValeurYAML(value) {
    const text = value.trim();
    if (!text) return "";
    if (text.startsWith("[") && text.endsWith("]")) {
      const inner = text.slice(1, -1).trim();
      if (!inner) return [];
      const parts = [];
      let current = "";
      let quote = "";
      let escaped = false;
      for (const char of inner) {
        if (escaped) {
          current += char;
          escaped = false;
        } else if (char === "\\" && quote === '"') {
          current += char;
          escaped = true;
        } else if (quote) {
          current += char;
          if (char === quote) quote = "";
        } else if (char === '"' || char === "'") {
          quote = char;
          current += char;
        } else if (char === ",") {
          parts.push(lireValeurYAML(current));
          current = "";
        } else {
          current += char;
        }
      }
      if (current.trim()) parts.push(lireValeurYAML(current));
      return parts;
    }
    if (text.startsWith('"') && text.endsWith('"')) {
      try {
        return JSON.parse(text);
      } catch {
        return text.slice(1, -1);
      }
    }
    if (text.startsWith("'") && text.endsWith("'")) {
      return text.slice(1, -1).replace(/''/g, "'");
    }
    return text;
  }

  function lireFrontmatter(markdown) {
    const source = markdown.replace(/^\uFEFF/, "");
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (!match) throw new Error("Le fichier n’a pas de front matter YAML Jekyll reconnaissable.");
    const lines = match[1].split(/\r?\n/);
    const fields = {};
    for (const line of lines) {
      const item = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
      if (item) fields[item[1]] = lireValeurYAML(item[2] || "");
    }
    return { lines, fields, body: source.slice(match[0].length) };
  }

  function extraireSections(body) {
    const sections = Object.fromEntries(headings.map(([key]) => [key, ""]));
    const chunks = [];
    let lines = [];
    let fenced = false;
    let fence = "";
    for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (!fenced && !marker && /^##\s+/.test(line)) {
        chunks.push(lines.join("\n"));
        lines = [line];
      } else {
        lines.push(line);
      }
      if (marker) {
        if (!fenced) {
          fenced = true;
          fence = marker[1][0];
        } else if (marker[1][0] === fence) {
          fenced = false;
          fence = "";
        }
      }
    }
    chunks.push(lines.join("\n"));
    const prefix = chunks.shift() || "";
    const order = [];
    for (const chunk of chunks) {
      const newline = chunk.indexOf("\n");
      const title = (newline === -1 ? chunk : chunk.slice(0, newline)).replace(/^##\s+/, "").trim().toLocaleLowerCase("fr");
      const entry = headings.find(([, heading]) => heading.toLocaleLowerCase("fr") === title);
      const value = newline === -1 ? "" : chunk.slice(newline + 1).replace(/^\n+|\n+$/g, "");
      if (entry) {
        sections[entry[0]] = value;
        order.push({ key: entry[0] });
      } else {
        order.push({ raw: chunk.replace(/\n+$/g, "") });
      }
    }
    return { sections, prefix, order };
  }

  function serialiserCorps(sections, prefix, order) {
    const chunks = [];
    if (prefix.trim()) chunks.push(prefix.replace(/\n+$/g, ""));
    const written = new Set();
    for (const part of order) {
      if (part.raw !== undefined) {
        if (part.raw.trim()) chunks.push(part.raw);
        continue;
      }
      const entry = headings.find(([key]) => key === part.key);
      if (!entry || written.has(part.key)) continue;
      chunks.push(`## ${entry[1]}${sections[part.key] ? `\n\n${sections[part.key].replace(/\n+$/g, "")}` : ""}`);
      written.add(part.key);
    }
    for (const [key, heading] of headings) {
      if (written.has(key)) continue;
      chunks.push(`## ${heading}${sections[key] ? `\n\n${sections[key].replace(/\n+$/g, "")}` : ""}`);
    }
    return `${chunks.join("\n\n").replace(/^\n+|\n+$/g, "")}\n`;
  }

  function remplacerChampYAML(lines, key, value) {
    const pattern = new RegExp(`^${key}:`);
    const start = lines.findIndex((line) => pattern.test(line));
    if (start === -1) {
      if (value !== undefined) lines.push(`${key}: ${value}`);
      return;
    }
    let end = start + 1;
    while (end < lines.length && (/^\s/.test(lines[end]) || !/^[A-Za-z0-9_-]+:/.test(lines[end]))) end += 1;
    if (value === undefined) lines.splice(start, end - start);
    else {
      lines.splice(start, end - start, `${key}: ${value}`);
    }
  }

  function champsDepuisFormulaire() {
    const form = elements["formulaire-projet"];
    const value = (name) => form.elements.namedItem(name).value.trim();
    const competenceCodes = [...elements["liste-competences"].querySelectorAll("input:checked")].map((input) => input.value);
    const technologies = value("technologies").split(",").map((item) => item.trim()).filter(Boolean);
    return {
      title: value("title"),
      date: value("date"),
      resume: value("resume"),
      cadre: value("cadre"),
      categorie: value("categorie"),
      statut: value("statut"),
      technologies,
      github: value("github"),
      demo: value("demo"),
      competences: competenceCodes,
      sections: Object.fromEntries(headings.map(([key]) => [key, elements[`section-${key}`].value])),
    };
  }

  function nomSlug(title) {
    const slug = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug || "projet";
  }

  function nomFichierProjet(fields) {
    return `${fields.date.slice(0, 7)}-${nomSlug(fields.title)}.md`;
  }

  function nomImageSecurise(filename) {
    const dot = filename.lastIndexOf(".");
    const extension = dot > 0 ? filename.slice(dot).toLocaleLowerCase("en") : "";
    const stem = dot > 0 ? filename.slice(0, dot) : filename;
    const safeStem = stem.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr").replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
    const safeExtension = /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : "";
    return `${safeStem}${safeExtension}`;
  }

  async function optimiserImage(file) {
    if (!elements["optimiser-images"].checked || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
    const bitmap = await createImageBitmap(file);
    try {
      const ratio = Math.min(1, 1920 / bitmap.width, 1920 / bitmap.height);
      const width = Math.max(1, Math.round(bitmap.width * ratio));
      const height = Math.max(1, Math.round(bitmap.height * ratio));
      if (width === bitmap.width && height === bitmap.height && file.type === "image/png") return file;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Le navigateur ne peut pas préparer l’image sélectionnée.");
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error(`Impossible d’optimiser ${file.name}.`));
        }, file.type, 0.9);
      });
      if (blob.size >= file.size && width === bitmap.width && height === bitmap.height) return file;
      const extension = file.type === "image/jpeg" ? ".jpg" : file.type === "image/webp" ? ".webp" : ".png";
      const stem = file.name.replace(/\.[^.]+$/, "");
      return new File([blob], `${stem}${extension}`, { type: blob.type, lastModified: file.lastModified });
    } finally {
      bitmap.close();
    }
  }

  function echapperTexteMarkdown(value) {
    return value.replace(/([\\[\]])/g, "\\$1").replace(/\r?\n/g, " ");
  }

  function preparerMarkdown(fields) {
    const lines = [...state.frontmatter];
    const simpleFields = ["title", "date", "resume", "cadre", "categorie", "statut", "github", "demo", "image", "image_alt"];
    const values = { ...fields };
    const cover = state.images.find((image) => image.isCover);
    values.image = cover ? (cover.plannedPath || cover.path) : "";
    values.image_alt = cover ? cover.alt.trim() : "";
    for (const key of simpleFields) {
      const value = values[key];
      remplacerChampYAML(lines, key, value ? valeurYAML(value) : undefined);
    }
    const gallery = state.images.filter((image) => !image.isCover);
    const arrays = {
      technologies: fields.technologies,
      competences: fields.competences,
      galerie: gallery.map((image) => image.plannedPath || image.path),
      galerie_alt: gallery.map((image) => image.alt.trim()),
    };
    for (const [key, valuesForKey] of Object.entries(arrays)) {
      const value = valuesForKey.length ? `[${valuesForKey.map(valeurYAML).join(", ")}]` : undefined;
      remplacerChampYAML(lines, key, value);
    }
    const sections = { ...fields.sections };
    const newImages = state.images.filter((image) => image.file && !image.isCover);
    const references = newImages.map((image) => `![${echapperTexteMarkdown(image.alt.trim())}](${image.plannedPath.replace(/^\//, "../../")})`);
    if (references.length) {
      const current = sections.productions.trimEnd();
      sections.productions = [current, ...references].filter(Boolean).join("\n\n");
    }
    const body = serialiserCorps(sections, state.prefixeMarkdown, state.ordreMarkdown);
    return `---\n${lines.join("\n")}\n---\n\n${body}`;
  }

  function ajouterChamp(liste, labelText, valeur) {
    const item = document.createElement("p");
    const label = document.createElement("strong");
    label.textContent = `${labelText} : `;
    item.append(label, document.createTextNode(valeur));
    liste.append(item);
  }

  async function construireApercu() {
    if (!elements["formulaire-projet"].reportValidity()) return;
    const fields = champsDepuisFormulaire();
    for (const [label, url] of [["GitHub", fields.github], ["Démonstration", fields.demo]]) {
      if (!url) continue;
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        throw new Error(`Le lien ${label} n’est pas une URL valide.`);
      }
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`Le lien ${label} doit utiliser HTTP ou HTTPS.`);
    }
    state.apercu = { fields };
    await planifierFichiersImages();
    elements["markdown-apercu"].textContent = preparerMarkdown(fields);
    elements["resume-apercu"].replaceChildren();
    ajouterChamp(elements["resume-apercu"], "Titre", fields.title);
    ajouterChamp(elements["resume-apercu"], "Fichier", state.edition?.name || nomFichierProjet(fields));
    if (fields.categorie) ajouterChamp(elements["resume-apercu"], "Catégorie", fields.categorie);
    if (fields.technologies.length) ajouterChamp(elements["resume-apercu"], "Technologies", fields.technologies.join(", "));
    ajouterChamp(elements["resume-apercu"], "Images", state.images.map((image) => image.file?.name || image.path.split("/").pop()).join(", ") || "Aucune");
    elements["vue-formulaire"].classList.add("masque");
    elements["vue-apercu"].classList.remove("masque");
  }

  async function lireCompetences(root) {
    const dataFolder = await root.getDirectoryHandle("_data");
    const fileHandle = await dataFolder.getFileHandle("competences.yml");
    const text = await (await fileHandle.getFile()).text();
    const result = [];
    let current = null;
    for (const line of text.split(/\r?\n/)) {
      const code = line.match(/^\s*-\s*code:\s*(.+?)\s*$/);
      const label = line.match(/^\s+libelle:\s*(.+?)\s*$/);
      if (code) {
        if (current) result.push(current);
        current = { code: lireValeurYAML(code[1]), libelle: "" };
      } else if (label && current) {
        current.libelle = lireValeurYAML(label[1]);
      }
    }
    if (current) result.push(current);
    if (!result.length || result.some((item) => !item.code || !item.libelle)) {
      throw new Error("Le fichier _data/competences.yml ne contient aucune compétence lisible.");
    }
    return result;
  }

  async function verifierRacine(root) {
    await root.getDirectoryHandle("_projets");
    await root.getDirectoryHandle("_data");
    await root.getFileHandle("index.html");
    return lireCompetences(root);
  }

  async function obtenirPermission(handle) {
    let permission = await handle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted") permission = await handle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") throw new Error("L’autorisation de lecture et d’écriture sur ce dossier est nécessaire.");
  }

  async function choisirDossier() {
    if (!("showDirectoryPicker" in window)) {
      elements.incompatible.classList.remove("masque");
      elements.connexion.classList.add("masque");
      return;
    }
    try {
      const root = await window.showDirectoryPicker({ mode: "readwrite" });
      await obtenirPermission(root);
      const competences = await verifierRacine(root);
      state.root = root;
      state.competences = competences;
      elements.connexion.classList.add("masque");
      elements.incompatible.classList.add("masque");
      elements.atelier.classList.remove("masque");
      elements["nom-dossier"].textContent = `Dossier sélectionné : ${root.name}`;
      afficherMessage("Dossier prêt. Les modifications restent sur votre ordinateur jusqu’à leur publication manuelle.", "succes");
      await actualiserProjets();
    } catch (error) {
      if (error.name !== "AbortError") afficherMessage(`Impossible d’ouvrir ce dossier : ${error.message}`, "erreur");
    }
  }

  function construireCompetences(selection = []) {
    const container = elements["liste-competences"];
    container.replaceChildren();
    for (const competence of state.competences) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = competence.code;
      input.checked = selection.includes(competence.code);
      label.append(input, document.createTextNode(competence.libelle));
      container.append(label);
    }
  }

  async function actualiserProjets() {
    const directory = await state.root.getDirectoryHandle("_projets");
    const projects = [];
    for await (const [name, handle] of directory.entries()) {
      if (handle.kind !== "file" || !name.endsWith(".md") || name.startsWith("_")) continue;
      const text = await (await handle.getFile()).text();
      try {
        const parsed = lireFrontmatter(text);
        projects.push({ name, handle, fields: parsed.fields, body: parsed.body, markdown: text });
      } catch (error) {
        afficherMessage(`Le fichier ${name} est ignoré dans la liste : ${error.message}`, "erreur");
      }
    }
    projects.sort((a, b) => String(b.fields.date || "").localeCompare(String(a.fields.date || "")));
    state.projets = projects;
    afficherListeProjets();
  }

  function afficherListeProjets() {
    const list = elements["liste-projets"];
    list.replaceChildren();
    elements["aucun-projet"].classList.toggle("masque", state.projets.length > 0);
    for (const project of state.projets) {
      const item = document.createElement("li");
      item.className = "projet-outil";
      const description = document.createElement("p");
      const title = document.createElement("strong");
      title.textContent = project.fields.title || project.name;
      description.append(title, document.createElement("br"), document.createTextNode(project.name));
      const actions = document.createElement("div");
      actions.className = "actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "bouton-secondaire";
      edit.textContent = "Modifier";
      edit.addEventListener("click", () => ouvrirEdition(project));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "bouton-danger";
      remove.textContent = "Supprimer";
      remove.addEventListener("click", () => supprimerProjet(project));
      actions.append(edit, remove);
      item.append(description, actions);
      list.append(item);
    }
  }

  function definirValeurs(form, fields) {
    for (const name of ["title", "date", "resume", "cadre", "categorie", "statut", "github", "demo"]) {
      form.elements.namedItem(name).value = fields[name] || "";
    }
    form.elements.namedItem("technologies").value = Array.isArray(fields.technologies) ? fields.technologies.join(", ") : "";
  }

  function mettreImages(images) {
    state.images = images;
    const container = elements["liste-images"];
    container.replaceChildren();
    state.images.forEach((image, index) => {
      const row = document.createElement("div");
      row.className = "image-outil";
      const label = document.createElement("label");
      label.textContent = image.file?.name || image.path.split("/").pop();
      const altLabel = document.createElement("label");
      altLabel.textContent = "Texte alternatif";
      const alt = document.createElement("input");
      alt.type = "text";
      alt.required = true;
      alt.maxLength = 200;
      alt.value = image.alt || "";
      alt.setAttribute("aria-label", `Texte alternatif pour ${label.textContent}`);
      alt.addEventListener("input", () => { image.alt = alt.value; });
      altLabel.append(alt);
      const coverLabel = document.createElement("label");
      coverLabel.className = "choix-couverture";
      const cover = document.createElement("input");
      cover.type = "radio";
      cover.name = "image-principale";
      cover.checked = Boolean(image.isCover);
      cover.addEventListener("change", () => {
        state.images.forEach((candidate, candidateIndex) => { candidate.isCover = candidateIndex === index; });
      });
      coverLabel.append(cover, document.createTextNode("Image principale"));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "bouton-secondaire";
      remove.textContent = "Retirer cette image";
      remove.addEventListener("click", () => {
        const wasCover = image.isCover;
        const remaining = state.images.filter((candidate) => candidate !== image);
        if (wasCover && remaining.length) remaining[0].isCover = true;
        mettreImages(remaining);
      });
      row.append(label, altLabel, coverLabel, remove);
      container.append(row);
    });
  }

  function initialiserNouveauProjet() {
    state.edition = null;
    state.frontmatter = [];
    state.prefixeMarkdown = "";
    state.ordreMarkdown = [];
    definirValeurs(elements["formulaire-projet"], {});
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    elements["date-projet"].value = localDate;
    for (const [key] of headings) elements[`section-${key}`].value = "";
    construireCompetences();
    mettreImages([]);
    elements["titre-formulaire"].textContent = "Nouveau projet";
    elements["vue-apercu"].classList.add("masque");
    elements["vue-formulaire"].classList.remove("masque");
    elements["titre-projet"].focus();
  }

  async function ouvrirEdition(project) {
    try {
      const markdown = await (await project.handle.getFile()).text();
      state.edition = { ...project, markdown };
      const parsed = lireFrontmatter(markdown);
      state.frontmatter = parsed.lines;
      const extracted = extraireSections(parsed.body);
      state.prefixeMarkdown = extracted.prefix;
      state.ordreMarkdown = extracted.order;
      definirValeurs(elements["formulaire-projet"], parsed.fields);
      for (const [key] of headings) elements[`section-${key}`].value = extracted.sections[key];
      construireCompetences(Array.isArray(parsed.fields.competences) ? parsed.fields.competences : []);
      const images = [];
      if (parsed.fields.image) images.push({ path: parsed.fields.image, alt: parsed.fields.image_alt || "", isCover: true });
      const gallery = Array.isArray(parsed.fields.galerie) ? parsed.fields.galerie : [];
      const alternatives = Array.isArray(parsed.fields.galerie_alt) ? parsed.fields.galerie_alt : [];
      gallery.forEach((path, index) => images.push({ path, alt: alternatives[index] || "", isCover: false }));
      mettreImages(images);
      elements["titre-formulaire"].textContent = `Modifier : ${parsed.fields.title || project.name}`;
      elements["vue-apercu"].classList.add("masque");
      elements["vue-formulaire"].classList.remove("masque");
      elements["titre-projet"].focus();
      afficherMessage(`Modification de ${project.name}. Les sections Markdown existantes ont été reprises dans le formulaire.`);
    } catch (error) {
      afficherMessage(`Impossible de charger le projet : ${error.message}`, "erreur");
    }
  }

  async function planifierFichiersImages() {
    const folder = nomSlug(state.apercu.fields.title);
    let existing = new Set();
    try {
      const imagesRoot = await state.root.getDirectoryHandle("images");
      const projectsFolder = await imagesRoot.getDirectoryHandle("projets");
      const projectFolder = await projectsFolder.getDirectoryHandle(folder);
      for await (const [name] of projectFolder.entries()) existing.add(name);
    } catch (error) {
      if (error.name !== "NotFoundError") throw error;
    }
    for (const image of state.images) {
      if (!image.file) continue;
      const base = nomImageSecurise(image.file.name);
      const dot = base.lastIndexOf(".");
      const stem = dot > 0 ? base.slice(0, dot) : base;
      const extension = dot > 0 ? base.slice(dot) : "";
      let name = base;
      let index = 2;
      while (existing.has(name)) name = `${stem}-${index++}${extension}`;
      existing.add(name);
      image.plannedPath = `/images/projets/${folder}/${name}`;
    }
  }

  async function copierImages() {
    const newImages = state.images.filter((image) => image.file);
    if (!newImages.length) return;
    const imagesRoot = await state.root.getDirectoryHandle("images", { create: true });
    const projectsFolder = await imagesRoot.getDirectoryHandle("projets", { create: true });
    const projectFolder = await projectsFolder.getDirectoryHandle(nomSlug(state.apercu.fields.title), { create: true });
    for (const image of newImages) {
      const filename = image.plannedPath.split("/").pop();
      let fileHandle;
      try {
        await projectFolder.getFileHandle(filename);
        throw new Error(`Le fichier image ${filename} existe déjà; préparez un nouvel aperçu avant de réessayer.`);
      } catch (error) {
        if (error.name !== "NotFoundError") throw error;
        fileHandle = await projectFolder.getFileHandle(filename, { create: true });
      }
      const writable = await fileHandle.createWritable();
      try {
        await writable.write(image.file);
        await writable.close();
      } catch (error) {
        await writable.abort();
        throw new Error(`Échec de copie de ${image.file.name} : ${error.message}`);
      }
      image.path = image.plannedPath;
      image.file = null;
    }
  }

  async function ecrireProjet() {
    await planifierFichiersImages();
    const directory = await state.root.getDirectoryHandle("_projets");
    const filename = state.edition ? state.edition.name : nomFichierProjet(state.apercu.fields);
    if (state.edition) {
      const current = await (await state.edition.handle.getFile()).text();
      if (current !== state.edition.markdown) {
        throw new Error("Ce fichier a changé depuis son ouverture. Rechargez la liste et recommencez afin de ne pas écraser une modification récente.");
      }
    } else {
      try {
        await directory.getFileHandle(filename);
        throw new Error(`Le fichier ${filename} existe déjà. Choisissez un autre titre ou une autre date.`);
      } catch (error) {
        if (error.name !== "NotFoundError") throw error;
      }
    }
    const markdown = preparerMarkdown(state.apercu.fields);
    try {
      await copierImages();
      const fileHandle = state.edition
        ? state.edition.handle
        : await creerFichierSansEcraser(directory, filename);
      const writable = await fileHandle.createWritable();
      try {
        await writable.write(markdown);
        await writable.close();
      } catch (error) {
        await writable.abort();
        throw error;
      }
    } catch (error) {
      throw new Error(`Enregistrement interrompu : ${error.message} Les fichiers déjà copiés ne sont pas supprimés.`);
    }
    state.edition = null;
    elements["vue-apercu"].classList.add("masque");
    elements["vue-formulaire"].classList.add("masque");
    afficherMessage(`Projet enregistré dans _projets/${filename}. Les modifications restent locales; publiez-les vous-même avec GitHub.`, "succes");
    await actualiserProjets();
  }

  async function creerFichierSansEcraser(directory, filename) {
    try {
      await directory.getFileHandle(filename);
      throw new Error(`Le fichier ${filename} existe déjà; aucun contenu n’a été remplacé.`);
    } catch (error) {
      if (error.name !== "NotFoundError") throw error;
      return directory.getFileHandle(filename, { create: true });
    }
  }

  async function supprimerProjet(project) {
    const title = project.fields.title || project.name;
    if (!window.confirm(`Supprimer le fichier « ${title} » ? Les images du projet seront conservées.`)) return;
    try {
      const directory = await state.root.getDirectoryHandle("_projets");
      await directory.removeEntry(project.name);
      afficherMessage(`Le fichier ${project.name} a été supprimé. Les images sont conservées dans le dossier du dépôt.`, "succes");
      await actualiserProjets();
    } catch (error) {
      afficherMessage(`Impossible de supprimer le projet : ${error.message}`, "erreur");
    }
  }

  async function ajouterImages(files) {
    const selected = [...files];
    if (selected.some((file) => !file.type.startsWith("image/"))) {
      afficherMessage("Seuls les fichiers image sont acceptés.", "erreur");
      elements["images-projet"].value = "";
      return;
    }
    try {
      const images = [...state.images];
      for (const originalFile of selected) {
        const file = await optimiserImage(originalFile);
        images.push({
          file,
          originalName: originalFile.name,
          originalSize: originalFile.size,
          path: "",
          alt: "",
          isCover: images.length === 0,
        });
      }
      mettreImages(images);
      const optimized = images.filter((image) => image.originalName && image.file.name !== image.originalName).length;
      afficherMessage(optimized ? `${optimized} image(s) redimensionnée(s) ou compressée(s) avant aperçu.` : "Images ajoutées; leurs fichiers originaux sont conservés.");
    } catch (error) {
      afficherMessage(`Impossible de préparer les images : ${error.message}`, "erreur");
    }
  }

  elements["choisir-dossier"].addEventListener("click", choisirDossier);
  elements["changer-dossier"].addEventListener("click", choisirDossier);
  elements["nouveau-projet"].addEventListener("click", initialiserNouveauProjet);
  elements["annuler-edition"].addEventListener("click", () => {
    elements["vue-formulaire"].classList.add("masque");
    elements["vue-apercu"].classList.add("masque");
    state.edition = null;
  });
  elements["images-projet"].addEventListener("change", (event) => ajouterImages(event.currentTarget.files));
  elements["formulaire-projet"].addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await construireApercu();
      afficherMessage("Vérifiez l’aperçu et le Markdown avant d’enregistrer.");
    } catch (error) {
      afficherMessage(`Impossible de préparer l’aperçu : ${error.message}`, "erreur");
    }
  });
  elements["modifier-apercu"].addEventListener("click", () => {
    elements["vue-apercu"].classList.add("masque");
    elements["vue-formulaire"].classList.remove("masque");
    elements["titre-projet"].focus();
  });
  elements["enregistrer-projet"].addEventListener("click", async () => {
    elements["enregistrer-projet"].disabled = true;
    try {
      await ecrireProjet();
    } catch (error) {
      afficherMessage(error.message, "erreur");
    } finally {
      elements["enregistrer-projet"].disabled = false;
    }
  });

  if (!("showDirectoryPicker" in window)) {
    elements.incompatible.classList.remove("masque");
    elements.connexion.classList.add("masque");
  }
})();
