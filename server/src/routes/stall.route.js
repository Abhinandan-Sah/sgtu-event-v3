import express from 'express';
const router = express.Router();
import stallController from '../controllers/stall.controller.js';
import { authenticateToken } from '../middleware/auth.js';

/**
 * Stall Routes
 * Mix of public (read) and protected (write) routes
 */

// Public routes (anyone can view stalls)
router.get('/', stallController.getAllStalls);
router.get('/:id', stallController.getStallById);
router.get('/number/:stallNumber', stallController.getStallByNumber);
router.get('/:id/qr-code', stallController.getStallQRCode);
router.get('/school/:schoolName', stallController.getStallsBySchool);
router.get('/:id/stats', stallController.getStallStats);

// Protected routes (admin only)
router.post('/', authenticateToken, stallController.createStall);
router.put('/:id', authenticateToken, stallController.updateStall);
router.delete('/:id', authenticateToken, stallController.deleteStall);

export default router;
