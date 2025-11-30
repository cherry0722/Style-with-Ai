// backend/routes/agent.js
const express = require('express');
const axios = require('axios');

const router = express.Router();

// Base URL for the Python AI service
// Example: http://127.0.0.1:5002
const AI_SERVICE_URL =
  (process.env.AI_SERVICE_URL || 'http://127.0.0.1:5002').replace(/\/$/, '');

router.post('/suggest_outfit', async (req, res) => {
  const targetUrl = `${AI_SERVICE_URL}/suggest_outfit`;

  console.log('[AgentRoute] Forwarding request to AI service:', targetUrl);
  console.log('[AgentRoute] Request body:', req.body);

  try {
    const response = await axios.post(targetUrl, req.body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    console.log('[AgentRoute] AI service response status:', response.status);
    res.status(response.status).json(response.data);
  } catch (err) {
    console.error('[AgentRoute] Error calling AI service:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });

    res.status(502).json({
      message: 'Failed to reach AI outfit service',
      detail: err.response?.data || err.message,
    });
  }
});

module.exports = router;

