const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const upload = multer();

const { authMiddleware } = require('../middelware/authMiddleware');
const { getDatabase, createServiceTables } = require('../db/db');
const { getDefaultServiceTemplate, getAllServices, createServicesInDB, createServicesFiles, removeService } = require('../db/services');
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
 * Route: GET /services/create/:serviceIsAI
 * Objectif: afficher la page de création d'un service (IA ou non).
 * Params:
 * - serviceIsAI: "1" pour IA, sinon 0.
 */
router.get('/create/:serviceIsAI', authMiddleware, (req, res) => {
    // Convertit le paramètre en booléen exploitable.
    const isAI = req.params.serviceIsAI === '1' ? true : false;
    const token = req.cookies.token;
    const decoded = jwt.verify(token, 'your_secret_key');
    // Liste actuelle pour éviter les doublons côté front.
    const services = getAllServices();
    const servicesNames = services.map(s => s.name);
    // Récupère le template par défaut (voir: ../db/services.js).
    const defaultServiceTemplate = getDefaultServiceTemplate(isAI);
    const defautlServiceTemplatePath = path.join(__dirname, '../', defaultServiceTemplate.path);
    const defaultServiceTemplateContent = fs.readFileSync(defautlServiceTemplatePath, 'utf-8');
    
    // Rendu du template EJS: views/pages/services/create.ejs
    res.render('pages/services/create', { userData: decoded, templateContent: defaultServiceTemplateContent, filename: defaultServiceTemplate.name, existingServices: servicesNames, isAI: req.params.serviceIsAI});
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
    if (!fs.existsSync(serviceFilePath) && !service.serviceIsAI) {
        writeDefaultServiceFile();
    } else if (!fs.existsSync(serviceFilePath) && service.serviceIsAI) {
        writeDefaultAiServiceFile();
    }
    // Envoie le script client utilisé par la vue: views/pages/services/detail.ejs
    res.type('application/javascript').sendFile(serviceFilePath);
});

router.get('/files/:serviceName', authMiddleware, (req, res) => {
    const { serviceName } = req.params;
    const serviceDataDir = path.join(__dirname, '..', 'services', serviceName, 'data');

    if (!fs.existsSync(serviceDataDir)) {
        return res.status(404).send('File not found.');
    }

    res.json({ files: fs.readdirSync(serviceDataDir) });
});

router.get('/files/:serviceName/:fileName', authMiddleware, (req, res) => {
    const { serviceName, fileName } = req.params;
    const filePath = path.join(__dirname, '..', 'services', serviceName, 'data', fileName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found.');
    }

    res.sendFile(filePath);
});

/**
 * Route: GET /services/:id/:serviceIsAI
 * Objectif: afficher la page détail d'un service.
 * Params:
 * - id: identifiant du service.
 * - serviceIsAI: "1" pour IA, sinon 0.
 */
router.get('/:id/:serviceIsAI', authMiddleware, (req, res) => {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, 'your_secret_key');
    const { id, serviceIsAI } = req.params;
    let isAI;

    if (typeof serviceIsAI === 'boolean') {
        isAI = serviceIsAI;
    } else {
        isAI = serviceIsAI === '1' ? true : false;
    }

    if (id === 'test') {
        // Variante de test pour la page détail (front: public/js/services_detail_test.js).
        return res.render('pages/services/detail', { userData: decoded, service: { id: 'test', name: 'Test Service', description: 'This is a test service.', created_at: 'N/A' }, clientScriptUrl: '#', isAI: isAI });
    } else if (typeof id !== 'string' || isNaN(parseInt(id))) {
        return res.status(400).send('Invalid service ID.');
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
router.post('/create', authMiddleware, upload.array('files'), async (req, res) => {
    const { serviceName, serviceDescription, serviceTags, serviceIsAI, serviceScript,  aiInputSchema } = req.body;
    const services = getAllServices();
    const servicesNames = services.map(s => s.name);

    // Récupère les chemins des fichiers de dépendances.
    const raw = req.body.paths;
    const paths = Array.isArray(raw) ? raw : (raw ? [raw] : []);

    // Crée le slug du service et son dossier.
    const slug = serviceName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const serviceDir = path.join(__dirname, '..', 'services', slug);

    if (fs.existsSync(serviceDir)) {
        return res.status(400).send('Service directory already exists.');
    }

    // Vérifie l'unicité du nom de service.
    if (servicesNames.includes(serviceName)) {
        return res.status(400).send('Service with this name already exists.');
    }

    let createDBResult;

    try {
        createDBResult = await createServicesInDB(
            req.files,
            paths,
            serviceName,
            serviceDescription,
            serviceIsAI === '1' ? true : false,
            serviceIsAI === '1' ? aiInputSchema : null,
            slug,
            serviceTags ? (Array.isArray(serviceTags) ? serviceTags : [serviceTags]) : [],
        );

        if (createDBResult?.status !== 200) {
            return res.status(createDBResult?.status || 500).send(createDBResult?.message || 'Error creating service in database.');
        }

        try {
            const createFilesResult = await createServicesFiles(req.files, paths, serviceDir, slug, serviceScript);
            // En cas d'échec de la création des fichiers, supprime l'entrée DB créée.
            if (createFilesResult.status !== 200) {
                removeService(createDBResult.serviceId);
                throw new Error(createFilesResult.message);
            }
        } catch (error) {
            // En cas d'erreur lors de la création des fichiers, supprime l'entrée DB créée.
            const db = getDatabase();
            const serviceIdStmt = db.prepare('SELECT id FROM service WHERE name = ?');
            const service = serviceIdStmt.get(serviceName);

            if (service) {
                removeService(service.id);
            }
            return res.status(createDBResult?.status || 500).send(`Error creating service files: ${createDBResult?.message || error.message}`);
        }

    } catch (error) {
        console.log(createDBResult?.status, createDBResult?.message);
        console.error('Unexpected error during service creation:', error);
        return res.status(createDBResult?.status || 500).send(`Unexpected error during service creation: ${createDBResult?.message || error.message}`);
    }

    // Redirige vers la liste des services.
    return res.redirect('/services');
});

router.post('/create/:serviceName/:fileName', authMiddleware, upload.single('file'), (req, res) => {
    const { serviceName, fileName } = req.params;
    const fileContent = req.file.buffer;

    // Sauvegarde le fichier uploadé.
    fs.writeFileSync(path.join(__dirname, '..', 'services', serviceName, 'data', fileName), fileContent);
    res.status(200).send('File uploaded successfully.');
});

module.exports = router;