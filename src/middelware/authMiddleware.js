const jwt = require('jsonwebtoken');
// Liens utiles:
// - Utilisé par: ../routes/user.routes.js, ../routes/services.routes.js, ../routes/nexus.routes.js

/**
 * Vérifie la présence d'un JWT et protège les routes privées.
 * @param {import('express').Request} req - Requête Express.
 * @param {import('express').Response} res - Réponse Express.
 * @param {import('express').NextFunction} next - Middleware suivant.
 * @returns {void}
 */
const authMiddleware = (req, res, next) => {
    // Vérifie le cookie et valide le JWT.
    const token = req.cookies.token;

    if (!token) {
        res.redirect('/user/login');
        return;
    }

    try {
        // JWT signé dans user.routes.js.
        const decoded = jwt.verify(token, 'your_secret_key');
        req.userId = decoded.id;
        next();
    } catch (err) {
        res.status(401);
        res.redirect('/user/login');
    }
};

/**
 * Redirige un utilisateur déjà connecté vers son profil.
 * @param {import('express').Request} req - Requête Express.
 * @param {import('express').Response} res - Réponse Express.
 * @param {import('express').NextFunction} next - Middleware suivant.
 * @returns {void}
 */
const unAuthMiddleware = (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        res.redirect('/user/profile');
    } else {
        next();
    }
};

module.exports = { authMiddleware, unAuthMiddleware };