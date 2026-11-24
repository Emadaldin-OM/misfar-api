// controllers/educationController.js  –  V2: Educational Module
const { query } = require('../config/db');

// ── GET /api/destinations/:id/education ──────────────────────
exports.getEducation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const r = await query(
      `SELECT de.*, d.name AS destination_name, d.region, d.category
       FROM destination_education de
       JOIN destinations d ON d.id = de.destination_id
       WHERE de.destination_id = $1`,
      [id]
    );
    if (!r.rows.length) {
      return res.json({ success: true, data: null, message: 'No educational content yet.' });
    }
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
};

// ── PUT /api/destinations/:id/education (admin) ───────────────
exports.upsertEducation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cultural_facts, historical_note, notable_figure, fun_fact, curriculum_tags, trail_id } = req.body;
    const r = await query(
      `INSERT INTO destination_education
         (destination_id, cultural_facts, historical_note, notable_figure, fun_fact, curriculum_tags, trail_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (destination_id) DO UPDATE SET
         cultural_facts   = EXCLUDED.cultural_facts,
         historical_note  = EXCLUDED.historical_note,
         notable_figure   = EXCLUDED.notable_figure,
         fun_fact         = EXCLUDED.fun_fact,
         curriculum_tags  = EXCLUDED.curriculum_tags,
         trail_id         = EXCLUDED.trail_id,
         updated_at       = NOW()
       RETURNING *`,
      [id, cultural_facts || [], historical_note, notable_figure, fun_fact, curriculum_tags || [], trail_id || null]
    );
    res.json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
};

// ── GET /api/trails ───────────────────────────────────────────
exports.getTrails = async (req, res, next) => {
  try {
    const r = await query(`SELECT * FROM learning_trails WHERE is_active = TRUE ORDER BY name`);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
};

// ── GET /api/trails/:id ───────────────────────────────────────
exports.getTrail = async (req, res, next) => {
  try {
    const trail = await query(`SELECT * FROM learning_trails WHERE id = $1`, [req.params.id]);
    if (!trail.rows.length) return res.status(404).json({ success: false, message: 'Trail not found.' });
    // Fetch each destination in the trail
    const t = trail.rows[0];
    let destinations = [];
    if (t.destination_ids?.length) {
      const dests = await query(
        `SELECT id, name, area, region, category, avg_rating, entry_fee FROM destinations
         WHERE id = ANY($1::uuid[]) AND is_active = TRUE`,
        [t.destination_ids]
      );
      destinations = dests.rows;
    }
    res.json({ success: true, data: { ...t, destinations } });
  } catch (err) { next(err); }
};

// ── POST /api/trails (admin) ──────────────────────────────────
exports.createTrail = async (req, res, next) => {
  try {
    const { name, theme, curriculum_link, grade_level, destination_ids } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Trail name is required.' });
    const r = await query(
      `INSERT INTO learning_trails (name, theme, curriculum_link, grade_level, destination_ids)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, theme, curriculum_link, grade_level, destination_ids || []]
    );
    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) { next(err); }
};

// ── GET /api/users/me/badges ──────────────────────────────────
exports.getMyBadges = async (req, res, next) => {
  try {
    const r = await query(
      `SELECT badge_type, earned_at FROM user_badges WHERE user_id = $1 ORDER BY earned_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
};

// ── Badge award logic (called internally) ────────────────────
exports.checkAndAwardBadges = async (userId) => {
  try {
    // Count visited destinations (reviewed + bookmarked)
    const visitedRes = await query(
      `SELECT COUNT(DISTINCT destination_id) AS cnt FROM reviews WHERE user_id = $1 AND status = 'approved'`,
      [userId]
    );
    const visited = parseInt(visitedRes.rows[0]?.cnt || 0);

    const BADGE_THRESHOLDS = [
      { badge: 'bronze_explorer',      min: 1 },
      { badge: 'silver_historian',     min: 5 },
      { badge: 'gold_guardian',        min: 10 },
      { badge: 'platinum_ambassador',  min: 20 },
    ];

    for (const { badge, min } of BADGE_THRESHOLDS) {
      if (visited >= min) {
        await query(
          `INSERT INTO user_badges (user_id, badge_type) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [userId, badge]
        );
      }
    }
  } catch { /* badge award failure is silent */ }
};
