// routes/educationRoutes.js
const express = require('express');
const router  = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const edu = require('../controllers/educationController');

// Public
router.get('/trails',                edu.getTrails);
router.get('/trails/:id',            edu.getTrail);
router.get('/:id/education',         edu.getEducation);

// Authenticated
router.get('/me/badges',             protect, edu.getMyBadges);

// Admin only
router.put('/:id/education',         protect, adminOnly, edu.upsertEducation);
router.post('/trails',               protect, adminOnly, edu.createTrail);

module.exports = router;
