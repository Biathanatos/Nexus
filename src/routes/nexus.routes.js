const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const { authMiddleware } = require('../middelware/authMiddleware');
const { getAllServices } = require('../db/services');
// Liens utiles:
// - Middleware auth: ../middelware/authMiddleware.js
// - Accès DB services: ../db/services.js

/**
 * Route: GET /
 * Objectif: afficher la page d'accueil avec la liste des services.
 * Params: aucun.
 */
router.get('/', authMiddleware, (req, res) => {
    // Auth via cookie JWT.
    const token = req.cookies.token;
    const decoded = jwt.verify(token, 'your_secret_key');
    // Liste des services pour l'accueil.
    const services = getAllServices();

    // Rendu du template EJS: views/pages/nexus.ejs
    res.render('pages/nexus', { userData: decoded, nexusServices: services });
})

module.exports = router;