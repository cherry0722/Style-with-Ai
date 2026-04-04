const express = require('express');
const auth = require('../middleware/auth');
const Activity = require('../models/Activity');

const router = express.Router();

// Helper: get today's date string in UTC (YYYY-MM-DD)
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Helper: extract userId from req.user (consistent with rest of codebase)
function getUserId(req) {
  return req.user?.userId || req.user?._id?.toString() || req.user?.id || req.user?._id || null;
}

// Helper: sum durations of all completed sessions
function calcTotalScreenTime(sessions) {
  return sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
}

// POST /api/activity/session-start
// Creates or updates today's activity record and opens a new session.
// Returns the new session's _id so the client can close it later.
router.post('/session-start', auth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }

    const date = todayUTC();
    const startTime = new Date();

    // Upsert today's activity doc; push a new open session
    const activity = await Activity.findOneAndUpdate(
      { userId, date },
      {
        $setOnInsert: { userId, date, totalScreenTime: 0 },
        $push: { sessions: { startTime, endTime: null, duration: null } },
      },
      { upsert: true, new: true }
    );

    // The new session is always the last one pushed
    const newSession = activity.sessions[activity.sessions.length - 1];

    console.log('[Activity] session-start', { userId: userId.toString().slice(0, 8), date, sessionId: newSession._id });

    return res.status(201).json({
      sessionId: newSession._id,
      date,
      startTime: newSession.startTime,
    });
  } catch (err) {
    console.error('[Activity] POST /session-start error:', err.message);
    next(err);
  }
});

// POST /api/activity/session-end
// Body: { sessionId }
// Finds the open session by ID, sets endTime, calculates duration, updates totalScreenTime.
router.post('/session-end', auth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }

    const { sessionId } = req.body || {};
    if (!sessionId) {
      const err = new Error('sessionId is required');
      err.status = 400;
      return next(err);
    }

    const endTime = new Date();

    // Find the activity doc that contains this session for this user
    const activity = await Activity.findOne({
      userId,
      'sessions._id': sessionId,
    });

    if (!activity) {
      const err = new Error('Session not found');
      err.status = 404;
      return next(err);
    }

    const session = activity.sessions.id(sessionId);
    if (!session) {
      const err = new Error('Session not found');
      err.status = 404;
      return next(err);
    }

    // Idempotency: already closed
    if (session.endTime) {
      return res.status(200).json({ activity, alreadyClosed: true });
    }

    const durationSec = Math.round((endTime - session.startTime) / 1000);

    session.endTime = endTime;
    session.duration = durationSec;
    activity.totalScreenTime = calcTotalScreenTime(activity.sessions);

    await activity.save();

    console.log('[Activity] session-end', {
      userId: userId.toString().slice(0, 8),
      sessionId,
      durationSec,
      totalScreenTime: activity.totalScreenTime,
    });

    return res.status(200).json({ activity });
  } catch (err) {
    if (err.name === 'CastError') {
      err.status = 400;
      err.message = 'Invalid sessionId';
    }
    console.error('[Activity] POST /session-end error:', err.message);
    next(err);
  }
});

// GET /api/activity/stats?period=today|yesterday|week|month|year
// Aggregates screen time for the requested period.
// Returns: { totalScreenTime, sessionCount, averageSessionDuration, dailyBreakdown }
router.get('/stats', auth, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      const err = new Error('Invalid auth payload');
      err.status = 401;
      return next(err);
    }

    const period = req.query.period || 'today';
    const validPeriods = ['today', 'yesterday', 'week', 'month', 'year'];
    if (!validPeriods.includes(period)) {
      const err = new Error(`period must be one of: ${validPeriods.join(', ')}`);
      err.status = 400;
      return next(err);
    }

    // Build date range (UTC, YYYY-MM-DD strings for comparison)
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toDateStr = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

    let startDate, endDate;

    if (period === 'today') {
      startDate = endDate = toDateStr(now);
    } else if (period === 'yesterday') {
      const y = new Date(now);
      y.setUTCDate(y.getUTCDate() - 1);
      startDate = endDate = toDateStr(y);
    } else if (period === 'week') {
      const start = new Date(now);
      start.setUTCDate(now.getUTCDate() - 6);
      startDate = toDateStr(start);
      endDate = toDateStr(now);
    } else if (period === 'month') {
      const start = new Date(now);
      start.setUTCDate(now.getUTCDate() - 29);
      startDate = toDateStr(start);
      endDate = toDateStr(now);
    } else if (period === 'year') {
      const start = new Date(now);
      start.setUTCFullYear(now.getUTCFullYear() - 1);
      start.setUTCDate(start.getUTCDate() + 1);
      startDate = toDateStr(start);
      endDate = toDateStr(now);
    }

    const mongoose = require('mongoose');
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const pipeline = [
      {
        $match: {
          userId: userObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $project: {
          date: 1,
          totalScreenTime: 1,
          // Count only completed sessions (endTime set)
          completedSessions: {
            $filter: {
              input: '$sessions',
              as: 's',
              cond: { $ne: ['$$s.endTime', null] },
            },
          },
        },
      },
      {
        $project: {
          date: 1,
          totalScreenTime: 1,
          sessionCount: { $size: '$completedSessions' },
          sessionDurationSum: { $sum: '$completedSessions.duration' },
        },
      },
      {
        $group: {
          _id: null,
          totalScreenTime: { $sum: '$totalScreenTime' },
          sessionCount: { $sum: '$sessionCount' },
          sessionDurationSum: { $sum: '$sessionDurationSum' },
          dailyBreakdown: {
            $push: {
              date: '$date',
              totalScreenTime: '$totalScreenTime',
              sessionCount: '$sessionCount',
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalScreenTime: 1,
          sessionCount: 1,
          averageSessionDuration: {
            $cond: [
              { $gt: ['$sessionCount', 0] },
              { $divide: ['$sessionDurationSum', '$sessionCount'] },
              0,
            ],
          },
          dailyBreakdown: 1,
        },
      },
    ];

    const results = await Activity.aggregate(pipeline);

    if (results.length === 0) {
      return res.status(200).json({
        period,
        totalScreenTime: 0,
        sessionCount: 0,
        averageSessionDuration: 0,
        dailyBreakdown: [],
      });
    }

    const { totalScreenTime, sessionCount, averageSessionDuration, dailyBreakdown } = results[0];

    // Sort daily breakdown by date ascending
    dailyBreakdown.sort((a, b) => (a.date < b.date ? -1 : 1));

    console.log('[Activity] GET /stats', {
      userId: userId.toString().slice(0, 8),
      period,
      totalScreenTime,
      sessionCount,
    });

    return res.status(200).json({
      period,
      totalScreenTime,
      sessionCount,
      averageSessionDuration: Math.round(averageSessionDuration),
      dailyBreakdown,
    });
  } catch (err) {
    console.error('[Activity] GET /stats error:', err.message);
    next(err);
  }
});

module.exports = router;
