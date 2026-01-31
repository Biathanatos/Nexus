const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const { fetch } = require('undici');

const COMFYUI_HOST = "127.0.0.1";
const COMFYUI_PORT = 8000;

function extractImagesFromHistory(historyForPromptId) {
  const outputs = historyForPromptId?.outputs ?? {};
  const images = [];
  for (const nodeOutput of Object.values(outputs)) {
    if (nodeOutput?.images) images.push(...nodeOutput.images);
  }
  return images;
}

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
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in /api/services/comfyui/generate:', error);
    res.status(500).send('Internal server error. ' + error.message);
  }
});

router.get('/comfyui/status', authMiddleware, async (req, res) => {
  const { prompt_id } = req.query;

  if (!prompt_id) {
    return res.status(400).send('Missing prompt_id.');
  }

  try {
    const historyRes = await fetch(`http://${COMFYUI_HOST}:${COMFYUI_PORT}/history/${prompt_id}`);
    if (!historyRes.ok) {
      return res.status(historyRes.status).send('Error fetching ComfyUI history.');
    }

    const history = await historyRes.json();
    const historyEntry = history[prompt_id];
    const images = extractImagesFromHistory(historyEntry);

    if (images.length > 0) {
      const img0 = images[0];
      const url =
        `/api/services/comfyui/view` +
        `?filename=${encodeURIComponent(img0.filename)}` +
        `&subfolder=${encodeURIComponent(img0.subfolder ?? '')}` +
        `&type=${encodeURIComponent(img0.type ?? '')}`;
      return res.status(200).json({ status: 'done', image: img0, url });
    }

    return res.status(202).json({ status: 'processing' });
  } catch (error) {
    console.error('Error in /api/services/comfyui/status:', error);
    return res.status(500).send('Internal server error. ' + error.message);
  }
});

router.get('/comfyui/view', authMiddleware, async (req, res) => {
  const { filename, subfolder = '', type = '' } = req.query;

  if (!filename) {
    return res.status(400).send('Missing filename.');
  }

  try {
    const viewUrl =
      `http://${COMFYUI_HOST}:${COMFYUI_PORT}/view` +
      `?filename=${encodeURIComponent(filename)}` +
      `&subfolder=${encodeURIComponent(subfolder)}` +
      `&type=${encodeURIComponent(type)}`;

    const response = await fetch(viewUrl);

    if (!response.ok) {
      return res.status(response.status).send('Error fetching image from ComfyUI.');
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Error in /api/services/comfyui/view:', error);
    return res.status(500).send('Internal server error. ' + error.message);
  }
});

module.exports = router;