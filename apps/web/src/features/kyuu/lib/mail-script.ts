// The Google Apps Script the user pastes into script.google.com (signed in as the Gmail
// account to read). It runs in their Google account, free, every 30 minutes, and posts the last
// three days of mail to Kyuu. Kyuu skips what it has already read.

export function mailScript(endpoint: string, key: string): string {
	return `// Kyuu mail sync — reads your Gmail, posts recent mail to Kyuu.
// Run "install" once (allow access when asked). Remove the trigger to stop.
const KYUU_URL = ${JSON.stringify(endpoint)};
const KYUU_KEY = ${JSON.stringify(key)};
const DAYS = 3;
const QUERY = "newer_than:" + DAYS + "d -in:sent -in:chats -in:spam -category:promotions -category:social";

function install() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncKyuu").timeBased().everyMinutes(30).create();
  syncKyuu();
}

function syncKyuu() {
  const me = Session.getActiveUser().getEmail().toLowerCase();
  const tz = Session.getScriptTimeZone();
  const since = Date.now() - DAYS * 86400000;
  const messages = [];
  for (const thread of GmailApp.search(QUERY, 0, 150)) {
    for (const m of thread.getMessages()) {
      if (m.getDate().getTime() < since) continue;
      if (m.getFrom().toLowerCase().includes(me)) continue;
      messages.push({
        id: m.getId(),
        threadId: thread.getId(),
        from: m.getFrom().slice(0, 1000),
        subject: m.getSubject().slice(0, 2000),
        date: m.getDate().toISOString(),
        day: Utilities.formatDate(m.getDate(), tz, "yyyy-MM-dd"),
        body: m.getPlainBody().slice(0, 8000),
      });
    }
  }
  for (let i = 0; i < messages.length; i += 100) {
    const res = UrlFetchApp.fetch(KYUU_URL, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + KYUU_KEY },
      payload: JSON.stringify({ account: me, messages: messages.slice(i, i + 100) }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() >= 300) throw new Error("Kyuu answered " + res.getResponseCode() + ": " + res.getContentText());
  }
}
`;
}
