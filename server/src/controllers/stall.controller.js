import Stall from '../models/Stall.model.js';
import QRCodeService from '../services/qrCode.js';
import { successResponse, errorResponse } from '../helpers/response.js';
import { query } from '../config/db.js';


/**
 * Stall Controller
 * Handles stall operations and QR code retrieval
 */

/**
 * Get all stalls
 * @route GET /api/stall
 */
const getAllStalls = async (req, res, next) => {
  try {
    const stalls = await Stall.findAll(query);
    return successResponse(res, stalls);
  } catch (error) {
    next(error);
  }
};

/**
 * Get stall by ID
 * @route GET /api/stall/:id
 */
const getStallById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const stall = await Stall.findById(id, query);

    if (!stall) {
      return errorResponse(res, 'Stall not found', 404);
    }

    return successResponse(res, stall);
  } catch (error) {
    next(error);
  }
};

/**
 * Get stall by stall number
 * @route GET /api/stall/number/:stallNumber
 */
const getStallByNumber = async (req, res, next) => {
  try {
    const { stallNumber } = req.params;
    const stall = await Stall.findByStallNumber(parseInt(stallNumber), query);

    if (!stall) {
      return errorResponse(res, 'Stall not found', 404);
    }

    return successResponse(res, stall);
  } catch (error) {
    next(error);
  }
};

/**
 * Get stall QR code
 * @route GET /api/stall/:id/qr-code
 */
const getStallQRCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const stall = await Stall.findById(id, query);

    if (!stall) {
      return errorResponse(res, 'Stall not found', 404);
    }

    if (!stall.qr_code_token) {
      return errorResponse(res, 'QR code not generated for this stall', 404);
    }

    // Generate QR code image
    const qrCodeImage = await QRCodeService.generateQRCodeImage(stall.qr_code_token);

    return successResponse(res, {
      qr_code: qrCodeImage,
      token: stall.qr_code_token,
      stall_number: stall.stall_number,
      stall_name: stall.stall_name
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get stalls by school name
 * @route GET /api/stall/school/:schoolName
 */
const getStallsBySchool = async (req, res, next) => {
  try {
    const { schoolName } = req.params;
    const stalls = await Stall.findBySchoolName(schoolName, query);
    return successResponse(res, stalls);
  } catch (error) {
    next(error);
  }
};

/**
 * Get stall visitor statistics
 * @route GET /api/stall/:id/stats
 */
const getStallStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const CheckInOut = require('../models/CheckInOut.model');
    
    const stall = await Stall.findById(id, query);
    if (!stall) {
      return errorResponse(res, 'Stall not found', 404);
    }

    const checkIns = await CheckInOut.findByStallId(id);
    
    return successResponse(res, {
      stall_name: stall.stall_name,
      stall_number: stall.stall_number,
      total_visits: checkIns.length,
      active_visitors: checkIns.filter(c => !c.check_out_time).length
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new stall (admin only)
 * @route POST /api/stall
 */
const createStall = async (req, res, next) => {
  try {
    const { stall_name, stall_number, school_name, description } = req.body;

    if (!stall_name || !stall_number || !school_name) {
      return errorResponse(res, 'Stall name, number, and school name are required', 400);
    }

    // Check if stall number already exists
    const existingStall = await Stall.findByStallNumber(stall_number, query);
    if (existingStall) {
      return errorResponse(res, 'Stall number already exists', 409);
    }

    // Generate QR code token
    const qrCodeToken = await QRCodeService.generateStallQRToken(stall_number);

    const stallData = {
      stall_name,
      stall_number,
      school_name,
      description: description || null,
      qr_code_token: qrCodeToken
    };

    const newStall = await Stall.create(stallData, query);

    return successResponse(res, newStall, 'Stall created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Update stall (admin only)
 * @route PUT /api/stall/:id
 */
const updateStall = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stall_name, description } = req.body;

    const updateData = {};
    if (stall_name) updateData.stall_name = stall_name;
    if (description !== undefined) updateData.description = description;

    const updatedStall = await Stall.update(id, updateData, query);
    if (!updatedStall) {
      return errorResponse(res, 'Stall not found', 404);
    }

    return successResponse(res, updatedStall, 'Stall updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete stall (admin only)
 * @route DELETE /api/stall/:id
 */
const deleteStall = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const deleted = await Stall.delete(id, query);
    if (!deleted) {
      return errorResponse(res, 'Stall not found', 404);
    }

    return successResponse(res, null, 'Stall deleted successfully');
  } catch (error) {
    next(error);
  }
};

export default {
  getAllStalls,
  getStallById,
  getStallByNumber,
  getStallQRCode,
  getStallsBySchool,
  getStallStats,
  createStall,
  updateStall,
  deleteStall
};
