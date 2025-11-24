import express from 'express';
const router = express.Router();
import rankingController from '../controllers/ranking.controller.js';
import { authenticateToken } from '../middleware/auth.js';

/**
 * Ranking Routes
 * Mix of public (read) and protected (write) routes
 */

// Public routes (anyone can view rankings)
router.get('/', rankingController.getAllRankings);
router.get('/stall/:stallId', rankingController.getRankingByStall);
router.get('/stalls/top/:limit', rankingController.getTopRankings);
router.get('/students/top/:limit', rankingController.getTopStudents);

// Protected routes (admin only)
router.post('/y', authenticateToken, rankingController.createRanking);
router.post('/calculate', authenticateToken, rankingController.calculateRankings);
router.put('/:id', authenticateToken, rankingController.updateRanking);
router.delete('/:id', authenticateToken, rankingController.deleteRanking);

export default router;
