const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const { fetch } = require('undici');

const COMFYUI_HOST = "127.0.0.1";
const COMFYUI_PORT = 8000;

const { authMiddleware } = require('../middelware/authMiddleware');

router.post('/comfyui/generate', authMiddleware, async (req, res) => {
  const { userPrompt = '', workflowContent } = req.body;

    console.log('Received prompt for ComfyUI generation:', userPrompt);
    console.log('Using workflow content:', workflowContent);

  if (!workflowContent) {
    return res.status(400).send('Missing workflowContent.');
  }

  let workflowObj;
  try {
    if (typeof workflowContent === 'string') {
      const escapedPrompt = JSON.stringify(String(userPrompt ?? '')).slice(1, -1);
      const workflowString = workflowContent.replace('{{PROMPT_PLACEHOLDER}}', `${escapedPrompt}`);
      workflowObj = JSON.parse(workflowString);
    } else {
      workflowObj = workflowContent;
    }
  } catch (parseError) {
    console.error('Invalid workflow JSON:', parseError);
    return res.status(400).send('Invalid workflow JSON.');
  }

  try {
    const response = await fetch(`http://${COMFYUI_HOST}:${COMFYUI_PORT}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflowObj, client_id: randomUUID() })
    });

    if (!response.ok) {
      return res.status(response.status).send('Error communicating with ComfyUI.');
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error in /api/services/comfyui/generate:', error);
    res.status(500).send('Internal server error. ' + error.message);
  }
});

module.exports = router;