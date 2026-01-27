const bcrypt = require('bcrypt');
const { getDatabase, createUserTable } = require('./db');
// Liens utiles:
// - Routes utilisateurs: ../routes/user.routes.js
// - DB init: ./db.js

/**
 * Récupère un utilisateur par ID.
 * @param {number} id - Identifiant utilisateur.
 * @returns {object|undefined} Utilisateur trouvé.
 */
function getUserById(id) {
    // Accès DB centralisé.
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
}

/**
 * Récupère un utilisateur via son email.
 * @param {string} email - Email utilisateur.
 * @returns {object|null} Utilisateur trouvé ou null.
 */
function getUserByEmail(email) {
    // Protection: email manquant.
    const db = getDatabase();
    
    if (!email) {
        return null;
    }

    // Vérifie l'existence des tables avant de requêter.
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users';").get();

    if (!tableCheck) {
        createUserTable();
    }

    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const result = stmt.get(email);

    return result;
}

/**
 * Récupère les attributs d'apparence d'un utilisateur.
 * @param {number} userId - Identifiant utilisateur.
 * @returns {object|null} Apparence trouvée.
 */
function getUserAppearanceById(userId) {
    // Table userAppearance créée dans db.js -> createUserTable().
    const db = getDatabase();

    // Vérifie l'existence de la table avant requête.
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='userAppearance';").get();

    if (!tableCheck) {
        return null;
    }

    const stmt = db.prepare('SELECT * FROM userAppearance WHERE user_id = ?');
    const result = stmt.get(userId);
    return result;
}

/**
 * Crée un nouvel utilisateur et son entrée d'apparence.
 * @param {string} email - Email utilisateur.
 * @param {string} username - Pseudo utilisateur.
 * @param {string} password - Mot de passe brut.
 * @returns {{success: boolean}} Statut de création.
 */
function registerUser(email, username, password) {
    // Crée l'utilisateur + entrée d'apparence par défaut.
    const db = getDatabase();

    // Vérifie les tables et les crée si nécessaire.
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users';").get();

    if (!tableCheck) {
        createUserTable();
    }

    // TODO: Add more validation (e.g., email format, password strength)
    // TODO: Handle duplicate usernames/emails
    try {
        // Hash le mot de passe avant stockage.
        const PASSWORD = bcrypt.hashSync(password, 10);

        // Insère le nouvel utilisateur.
        const stmt = db.prepare('INSERT INTO users (email, username, password) VALUES (?, ?, ?)');
        stmt.run(email, username, PASSWORD);

        // Crée une entrée d'apparence par défaut.
        const user = getUserByEmail(email);
        const appearanceStmt = db.prepare('INSERT INTO userAppearance (user_id) VALUES (?)');
        appearanceStmt.run(user.id);
    } catch (err) {
        return { success: false };
    }

    const user = getUserByEmail(email);

    if (user) {
        return { success: true };
    }

    return { success: false };
}

module.exports = { getUserById, getUserByEmail, getUserAppearanceById, registerUser };