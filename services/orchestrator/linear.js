const sessions = require('./sessions');

// Webhooks only give us the issue's internal UUID, not its human identifier
// (e.g. TRY-10) or URL — fetch those once per session so PRs can link back
// to something a reviewer can actually recognize.
async function getIssueRef(session) {
  if (session.linearRef !== undefined) return session.linearRef;
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey || !session.linearIssueId) {
    session.linearRef = null;
    return null;
  }
  try {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({
        query: `query($id: String!) { issue(id: $id) { identifier url title } }`,
        variables: { id: session.linearIssueId },
      }),
    });
    const json = await res.json();
    session.linearRef = json.data?.issue ?? null;
  } catch (err) {
    sessions.emit(session, 'log', { level: 'warn', text: `[linear] issue lookup failed: ${err.message}` });
    session.linearRef = null;
  }
  return session.linearRef;
}

async function commentOnIssue(session, body) {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey || !session.linearIssueId) return;

  try {
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({
        query: `mutation($issueId: String!, $body: String!) {
          commentCreate(input: { issueId: $issueId, body: $body }) { success }
        }`,
        variables: { issueId: session.linearIssueId, body },
      }),
    });
    const json = await res.json();
    if (json.errors) {
      sessions.emit(session, 'log', { level: 'warn', text: `[linear] comment failed: ${JSON.stringify(json.errors)}` });
    } else {
      sessions.emit(session, 'log', { level: 'info', text: '[linear] posted comment back to issue' });
    }
  } catch (err) {
    sessions.emit(session, 'log', { level: 'warn', text: `[linear] comment failed: ${err.message}` });
  }
}

module.exports = { commentOnIssue, getIssueRef };
