const sessions = require('./sessions');

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

module.exports = { commentOnIssue };
