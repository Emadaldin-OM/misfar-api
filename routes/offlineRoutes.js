const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const offline = require('../controllers/offlineController');

router.get('/',                              protect, offline.getDownloads);
router.post('/destination/:id',             protect, offline.downloadDestination);
router.post('/trip/:id',                    protect, offline.downloadTrip);
router.delete('/:downloadId',              protect, offline.removeDownload);

module.exports = router;
