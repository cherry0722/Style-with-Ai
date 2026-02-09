const express = require('express');
const auth = require('../middleware/auth');
const CalendarPlan = require('../models/calendarPlan');

const router = express.Router();

function getUserId(req) {
  return req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id;
}

// POST /api/planner — create or replace plan for a date
router.post('/', auth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }
    const { date, plans } = req.body || {};
    if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const err = new Error('date must be YYYY-MM-DD');
      err.status = 400;
      return next(err);
    }
    const plansArray = Array.isArray(plans) ? plans : [];
    const entry = await CalendarPlan.findOneAndUpdate(
      { userId, date },
      { userId, date, plans: plansArray },
      { new: true, upsert: true }
    ).lean();
    res.status(201).json({ entry: { date: entry.date, plans: entry.plans } });
  } catch (err) {
    next(err);
  }
});

// GET /api/planner?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', auth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }
    const { from, to } = req.query;
    if (!from || !to) {
      const err = new Error('Query from and to (YYYY-MM-DD) are required');
      err.status = 400;
      return next(err);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const err = new Error('from and to must be YYYY-MM-DD');
      err.status = 400;
      return next(err);
    }
    const entries = await CalendarPlan.find({
      userId,
      date: { $gte: from, $lte: to },
    })
      .sort({ date: 1 })
      .lean();
    res.status(200).json({
      entries: entries.map((e) => ({ date: e.date, plans: e.plans })),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/planner/:date
router.patch('/:date', auth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }
    const date = req.params.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const err = new Error('date must be YYYY-MM-DD');
      err.status = 400;
      return next(err);
    }
    const { plans } = req.body || {};
    const plansArray = Array.isArray(plans) ? plans : undefined;
    const entry = await CalendarPlan.findOne({ userId, date });
    if (!entry) {
      const err = new Error('Plan not found for this date');
      err.status = 404;
      return next(err);
    }
    if (plansArray !== undefined) entry.plans = plansArray;
    await entry.save();
    res.status(200).json({ entry: { date: entry.date, plans: entry.plans } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
