const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const { authMiddleware } = require('../middelware/authMiddleware');
const { getDatabase } = require('../db/db');
const { getDefaultServiceTemplate, getAllServices } = require('../db/services');
const { writeDefaultServiceFile, writeDefaultAiServiceFile } = require('../db/serviceFiles');
// Liens utiles:
// - Middleware auth: ../middelware/authMiddleware.js
// - Accès DB services: ../db/services.js
// - Templates fichiers services: ../db/serviceFiles.js

/**
 * Route: GET /services/
 * Objectif: afficher la liste des services disponibles.
 * Params: aucun.
 */
router.get('/', authMiddleware, (req, res) => {
    // Auth: le JWT est stocké dans le cookie "token".
    const token = req.cookies.token;
    const decoded = jwt.verify(token, 'your_secret_key');
    // Récupère tous les services depuis la DB (voir: ../db/services.js).
    const services = getAllServices();

    // Rendu du template EJS: views/pages/services/services.ejs
    res.render('pages/services/services', { userData: decoded, services: services });
});

/**
 * Route: GET /services/create/:is_ai
 * Objectif: afficher la page de création d'un service (IA ou non).
 * Params:
 * - is_ai: "1" pour IA, sinon 0.
 */
router.get('/create/:is_ai', authMiddleware, (req, res) => {
    // Convertit le paramètre en booléen exploitable.
    const isAI = req.params.is_ai === '1' ? true : false;
    console.log('isAI:', isAI);
    const token = req.cookies.token;
    const decoded = jwt.verify(token, 'your_secret_key');
    // Liste actuelle pour éviter les doublons côté front.
    const services = getAllServices();
    const servicesNames = services.map(s => s.name);
    // Récupère le template par défaut (voir: ../db/services.js).
    const defaultServiceTemplate = getDefaultServiceTemplate(isAI);
    console.log('Default Service Template:', defaultServiceTemplate);
    const defautlServiceTemplatePath = path.join(__dirname, '../', defaultServiceTemplate.path);
    const defaultServiceTemplateContent = fs.readFileSync(defautlServiceTemplatePath, 'utf-8');
    
    // Rendu du template EJS: views/pages/services/create.ejs
    res.render('pages/services/create', { userData: decoded, templateContent: defaultServiceTemplateContent, filename: defaultServiceTemplate.name, existingServices: servicesNames, isAI: req.params.is_ai});
})

/**
 * Route: GET /services/:id/client.js
 * Objectif: fournir le script client du service demandé.
 * Params:
 * - id: identifiant du service.
 */
router.get('/:id/client.js', authMiddleware, (req, res) => {
    const serviceId = req.params.id;

    // Récupération du service ciblé en DB (voir: ../db/db.js).
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM service WHERE id = ?');
    const service = stmt.get(serviceId);

    if (!service) {
        return res.status(404).send('Service not found.');
    }

    const serviceFilePath = path.join(__dirname, '..', service.path);

    // S'assure que le fichier de service existe (templates gérés par ../db/serviceFiles.js).
    if (!fs.existsSync(serviceFilePath) && !service.is_ai) {
        writeDefaultServiceFile();
    } else if (!fs.existsSync(serviceFilePath) && service.is_ai) {
        writeDefaultAiServiceFile();
    }
    // Envoie le script client utilisé par la vue: views/pages/services/detail.ejs
    res.type('application/javascript').sendFile(serviceFilePath);
});

/**
 * Route: GET /services/:id/:is_ai
 * Objectif: afficher la page détail d'un service.
 * Params:
 * - id: identifiant du service.
 * - is_ai: "1" pour IA, sinon 0.
 */
router.get('/:id/:is_ai', authMiddleware, (req, res) => {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, 'your_secret_key');
    const { id, is_ai } = req.params;
    let isAI;

    if (typeof is_ai === 'boolean') {
        isAI = is_ai;
    } else {
        isAI = is_ai === '1' ? true : false;
    }

    if (id === 'test') {
        // Variante de test pour la page détail (front: public/js/services_detail_test.js).
        return res.render('pages/services/detail', { userData: decoded, service: { id: 'test', name: 'Test Service', description: 'This is a test service.', created_at: 'N/A' }, clientScriptUrl: '#', isAI: isAI });
    }

    // Lecture du service depuis la DB.
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM service WHERE id = ?');
    const service = stmt.get(id);

    // Charge les tags associés (tables: service_tags / tags).
    const tags = db.prepare(`
        SELECT t.tag FROM tags t
        JOIN service_tags st ON t.id = st.tag_id
        WHERE st.service_id = ?
    `).all(id);
    service.tags = tags.map(t => t.tag);

    if (!service) {
        return res.status(404).send('Service not found.');
    }

    // Rendu du template EJS: views/pages/services/detail.ejs
    res.render('pages/services/detail', { userData: decoded, service: service, clientScriptUrl: `/services/${service.id}/client.js`, isAI: isAI });
});

/**
 * Route: POST /services/create
 * Objectif: créer un service (fichier + enregistrement en base).
 * Body:
 * - serviceName: nom du service.
 * - serviceDescription: description du service.
 * - serviceScript: contenu JS du service.
 * - serviceIsAI: boolean.
 * - serviceTags: tableau de tags.
 */
router.post('/create', authMiddleware, (req, res) => {
    const { serviceName, serviceDescription, serviceScript } = req.body;
    const services = getAllServices();
    const servicesNames = services.map(s => s.name);

    if (servicesNames.includes(serviceName)) {
        return res.status(400).send('Service with this name already exists.');
    }

    // Chemin d'écriture du fichier service dans src/services/.
    const serviceFilePath = path.join(__dirname, '..', 'services', `${serviceName.replace(/\s+/g, '_').toLowerCase()}.js`);
    fs.writeFileSync(serviceFilePath, serviceScript);

    // Enregistre le service en DB (table: service).
    const db = getDatabase();

    const stmt = db.prepare('INSERT INTO service (name, description, path, is_ai) VALUES (?, ?, ?, ?)');
    stmt.run(serviceName, serviceDescription, `services/${serviceName.replace(/\s+/g, '_').toLowerCase()}.js`, req.body.serviceIsAI ? 1 : 0);

    // Récupère l'id du service créé pour relier les tags.
    const serviceId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    if (req.body.serviceTags && Array.isArray(req.body.serviceTags)) {
        // Normalise et insère les tags, puis crée les liaisons.
        const insertTagStmt = db.prepare('INSERT INTO tags(tag) VALUES (?) ON CONFLICT(tag) DO NOTHING');
        const link = db.prepare('INSERT INTO service_tags(service_id, tag_id) VALUES (?, (SELECT id FROM tags WHERE tag = ?)) ON CONFLICT DO NOTHING');
        
        for (const raw of req.body.serviceTags) {
            const tag = String(raw).trim();
            if (!tag) continue;

            insertTagStmt.run(tag);
            link.run(serviceId, tag);
        }
    }

    res.redirect('/services');
});

module.exports = router;