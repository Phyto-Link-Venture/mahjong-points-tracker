const router = require('express').Router();
const requireAuth = require('../middleware/requireAuth');

const GITHUB_REPO = 'Phyto-Link-Venture/mahjong-points-tracker';
const GITHUB_API = 'https://api.github.com';

router.post('/', requireAuth, async (req, res) => {
  const { title, message } = req.body;
  if (!title?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(503).json({ error: 'Feedback not configured' });

  const issueBody = [
    `**Submitted by:** ${req.user.name} (${req.user.email})`,
    `**Date:** ${new Date().toISOString().split('T')[0]}`,
    '',
    message.trim(),
  ].join('\n');

  try {
    const r = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: `[Feedback] ${title.trim()}`,
        body: issueBody,
        labels: ['feedback'],
      }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      console.error('GitHub issue create failed:', r.status, err);
      return res.status(502).json({ error: 'Failed to submit feedback' });
    }

    const issue = await r.json();
    res.json({ ok: true, issueNumber: issue.number });
  } catch (e) {
    console.error('Feedback error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
