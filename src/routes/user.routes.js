const bcrypt = require('bcrypt');
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
router.use(express.urlencoded({ extended: true }));

const { getDatabase } = require('../db/db');
const { getUserByEmail, getUserAppearanceById, registerUser } = require('../db/user');

const { authMiddleware, unAuthMiddleware } = require('../middelware/authMiddleware');
// Liens utiles:
// - Middleware auth: ../middelware/authMiddleware.js
// - Accès DB user: ../db/user.js

/**
 * Route: GET /user/profile
 * Objectif: afficher le profil utilisateur et ses préférences.
 * Params: aucun.
 */
router.get('/profile', authMiddleware, (req, res) => {
    // Connexion DB partagée (voir: ../db/db.js).
    const db = getDatabase();

    const token = req.cookies.token;
    const decoded = jwt.verify(token, 'your_secret_key');
    // Charge l'apparence utilisateur (voir: ../db/user.js).
    const userAppearance = JSON.stringify(getUserAppearanceById(decoded.id));

    if (!userAppearance) {
        res.redirect('/user/logout');
        return;
    }

    // Charge les références de tons de peau pour le formulaire.
    const skinTonesStmt = db.prepare('SELECT * FROM ref_skin_tones;');
    const availableSkinTones = skinTonesStmt.all();

    // Rendu du template EJS: views/pages/user/profile.ejs
    res.render('pages/user/profile', { userData: decoded, userAppearance, availableSkinTones });
});

/**
 * Route: GET /user/login
 * Objectif: afficher la page de connexion.
 * Params: aucun.
 */
router.get('/login', unAuthMiddleware, (req, res) => {
    // Rendu du template EJS: views/pages/user/login.ejs
    res.render('pages/user/login', { title: 'Login' });
});

/**
 * Route: GET /user/register
 * Objectif: afficher la page d'inscription.
 * Params: aucun.
 */
router.get('/register', unAuthMiddleware, (req, res) => {
    // Rendu du template EJS: views/pages/user/register.ejs
    res.render('pages/user/register', { title: 'Register' });
});

/**
 * Route: GET /user/logout
 * Objectif: déconnecter l'utilisateur en supprimant le cookie.
 * Params: aucun.
 */
router.get('/logout', authMiddleware, (req, res) => {
    // Supprime le cookie d'auth et renvoie sur la page login.
    res.clearCookie('token');
    res.redirect('/user/login');
});

/**
 * Route: POST /user/login
 * Objectif: authentifier l'utilisateur et créer un JWT.
 * Body:
 * - email: email de l'utilisateur.
 * - password: mot de passe.
 */
router.post('/login', unAuthMiddleware, (req, res) => {
    // Validation minimale des champs.
    if (!req.body.email || !req.body.password) {
        res.status(400).send('Email and password are required');
        return;
    }

    // Recherche utilisateur via email (voir: ../db/user.js).
    const user = getUserByEmail(req.body.email);
    if (!user) {
        res.status(401).send('Invalid email or password');
        return;
    }

    const passwordMatch = bcrypt.compareSync(req.body.password, user.password);
    if (!passwordMatch) {
        res.status(401).send('Invalid email or password');
        return;
    }

    const userId = user.id;
    const userUsername = user.username;
    const userEmail = user.email;

    // Crée un JWT pour l'auth et le place dans un cookie httpOnly.
    const token = jwt.sign({ id: userId, username: userUsername, email: userEmail }, 'your_secret_key', { expiresIn: '1h' });

    res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'strict', maxAge: 3600000 });
    res.redirect('/user/profile');
});

/**
 * Route: POST /user/register
 * Objectif: créer un compte utilisateur.
 * Body:
 * - email: email.
 * - username: pseudo.
 * - password: mot de passe.
 */
router.post('/register', unAuthMiddleware, (req, res) => {
    // Validation minimale des champs.
    if (!req.body.email || !req.body.username || !req.body.password) {
        res.status(400).send('All fields are required');
        return;
    }

    // Création en DB (voir: ../db/user.js).
    const result = registerUser(req.body.email, req.body.username, req.body.password);

    if (!result.success) {
        res.status(500).send('Registration failed');
        return;
    }

    // Redirection vers la page login.
    res.redirect('/user/login');
});

module.exports = router;