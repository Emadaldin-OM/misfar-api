// controllers/offlineController.js  –  V2: Offline/PWA download tracking
const { query } = require('../config/db');

// ── GET /api/offline/downloads ────────────────────────────────
exports.getDownloads = async (req, res, next) => {
  try {
    const r = await query(
      `SELECT od.*, d.name AS dest_name, d.category, d.region, t.title AS trip_title
       FROM offline_downloads od
       LEFT JOIN destinations d ON d.id = od.destination_id
       LEFT JOIN trips t ON t.id = od.trip_id
       WHERE od.user_id = $1
       ORDER BY od.downloaded_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
};

// ── POST /api/offline/destination/:id ────────────────────────
exports.downloadDestination = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch full destination data including education
    const [dest, edu, reviews, photos] = await Promise.all([
      query(`SELECT * FROM destinations WHERE id = $1 AND is_active = TRUE`, [id]),
      query(`SELECT * FROM destination_education WHERE destination_id = $1`, [id]),
      query(`SELECT r.rating, r.comment, r.sentiment_label, u.username, r.created_at
             FROM reviews r JOIN users u ON u.id = r.user_id
             WHERE r.destination_id = $1 AND r.status = 'approved' LIMIT 20`, [id]),
      query(`SELECT photo_url, caption FROM destination_photos WHERE destination_id = $1`, [id]),
    ]);

    if (!dest.rows.length) return res.status(404).json({ success: false, message: 'Destination not found.' });

    // Track download
    await query(
      `INSERT INTO offline_downloads (user_id, destination_id)
       VALUES ($1,$2) ON CONFLICT (user_id, destination_id) DO UPDATE SET downloaded_at = NOW()`,
      [req.user.id, id]
    );

    res.json({
      success: true,
      data: {
        destination: dest.rows[0],
        education:   edu.rows[0] || null,
        reviews:     reviews.rows,
        photos:      photos.rows,
        cached_at:   new Date().toISOString(),
      }
    });
  } catch (err) { next(err); }
};

// ── POST /api/offline/trip/:id ────────────────────────────────
exports.downloadTrip = async (req, res, next) => {
  try {
    const { id } = req.params;
    const trip = await query(
      `SELECT t.*, json_agg(ts.* ORDER BY ts.day_number, ts.stop_order) AS stops
       FROM trips t
       LEFT JOIN trip_stops ts ON ts.trip_id = t.id
       WHERE t.id = $1 AND t.user_id = $2
       GROUP BY t.id`,
      [id, req.user.id]
    );
    if (!trip.rows.length) return res.status(404).json({ success: false, message: 'Trip not found.' });

    await query(
      `INSERT INTO offline_downloads (user_id, trip_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.user.id, id]
    );

    res.json({ success: true, data: { trip: trip.rows[0], cached_at: new Date().toISOString() } });
  } catch (err) { next(err); }
};

// ── DELETE /api/offline/:downloadId ──────────────────────────
exports.removeDownload = async (req, res, next) => {
  try {
    await query(
      `DELETE FROM offline_downloads WHERE id = $1 AND user_id = $2`,
      [req.params.downloadId, req.user.id]
    );
    res.json({ success: true, message: 'Download removed.' });
  } catch (err) { next(err); }
};
