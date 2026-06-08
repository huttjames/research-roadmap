function splitList(text) {
  return String(text || "")
    .split(/\r?\n|;|\u2022/g)
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function splitLinks(text) {
  const matches = String(text || "").match(/https?:\/\/[^\s,;)\]]+/g);
  if (matches?.length) {
    return matches.map((url) => ({ url, label: url.replace(/^https?:\/\//, "") }));
  }

  return splitList(text).map((item) => ({ url: item, label: item }));
}

function Section({ title, children, empty = "No details provided." }) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section className="detail-section">
      <h3>{title}</h3>
      {hasContent ? children : <p className="empty-state">{empty}</p>}
    </section>
  );
}

export default function DetailPanel({ question, onClose }) {
  if (!question) {
    return (
      <aside className="detail-panel detail-panel-empty" aria-label="Question details">
        <p>Select a question leaf to view the research brief.</p>
      </aside>
    );
  }

  const subQuestions = splitList(question.subQuestions);
  const resourceLinks = splitLinks(question.bestResources);

  return (
    <aside className="detail-panel" aria-label="Question details">
      <button className="close-button" onClick={onClose} type="button" aria-label="Close details">
        x
      </button>

      <p className="detail-kicker">Research Question</p>
      <h2>{question.questionTitle}</h2>

      <Section title="Context">{question.context && <p>{question.context}</p>}</Section>
      <Section title="Why It Matters">
        {question.whyItMatters && <p>{question.whyItMatters}</p>}
      </Section>
      <Section title="How To Solve">
        {question.howToSolve && <p>{question.howToSolve}</p>}
      </Section>
      <Section title="Sub-questions">
        {subQuestions.length > 0 && (
          <ul>
            {subQuestions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Best Resources">
        {resourceLinks.length > 0 && (
          <ul>
            {resourceLinks.map((link) => (
              <li key={`${link.url}-${link.label}`}>
                {/^https?:\/\//.test(link.url) ? (
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label}
                  </a>
                ) : (
                  link.label
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Last Updated">
        {question.lastUpdated && <p>{question.lastUpdated}</p>}
      </Section>
    </aside>
  );
}
