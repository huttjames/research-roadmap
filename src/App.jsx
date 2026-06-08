import { useEffect, useMemo, useState } from "react";
import RoadmapTree from "./components/RoadmapTree.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import { buildRoadmapTree, getRoadmapStats } from "./data/treeBuilder.js";
import { parseCsvText } from "./data/parseWorkbook.js";

const PUBLISHED_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSqLA1y00VMLkhP8oWfYT9WqQp9GqlFCOKXUYnkD051OEq9rLXWWXBvSJe8XeZsUqYR9vhTMZU9VtsR/pub?gid=0&single=true&output=csv";

export default function App() {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [status, setStatus] = useState("Loading published CSV...");
  const [error, setError] = useState("");
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [focusTarget, setFocusTarget] = useState(null);

  useEffect(() => {
    async function loadPublishedCsv() {
      try {
        const response = await fetch(PUBLISHED_CSV_URL);
        if (!response.ok) {
          throw new Error(`Could not load published CSV (${response.status}).`);
        }

        const csvText = await response.text();
        const parsed = parseCsvText(csvText, "Published Google Sheet CSV");
        setQuestions(parsed.questions);
        setStatus("");
      } catch (loadError) {
        setError(loadError.message);
        setStatus("");
      }
    }

    loadPublishedCsv();
  }, []);

  const treeData = useMemo(() => buildRoadmapTree(questions), [questions]);
  const stats = useMemo(() => getRoadmapStats(questions), [questions]);
  const navigatorItems = useMemo(
    () =>
      treeData.children.map((category) => ({
        id: category.id,
        name: category.name,
        subcategories: category.children.map((subcategory) => ({
          id: subcategory.id,
          name: subcategory.name,
          questions: subcategory.children.length,
        })),
      })),
    [treeData],
  );
  const warnings = useMemo(() => {
    const messages = [];
    if (questions.length > 0 && stats.categories !== 5) {
      messages.push(`Expected 5 major categories, but found ${stats.categories}.`);
    }
    return messages;
  }, [questions.length, stats.categories]);

  function focusNode(id, zoom = 1.05) {
    setNavigatorOpen(false);
    setFocusTarget({ id, zoom, key: Date.now() });
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">IfDT Research Roadmap</p>
            <h1>Interactive research question map</h1>
          </div>
        </header>

        <div className="roadmap-toolbar">
          <div className="stats" aria-label="Roadmap counts">
            <button type="button" onClick={() => setNavigatorOpen((open) => !open)}>
              {stats.categories} categories
            </button>
            <button type="button" onClick={() => setNavigatorOpen((open) => !open)}>
              {stats.subcategories} subcategories
            </button>
            <button type="button" onClick={() => setNavigatorOpen((open) => !open)}>
              {stats.questions} questions
            </button>
          </div>
          <div className="load-state">
            {status && <span>{status}</span>}
            {error && <span className="error-text">{error}</span>}
          </div>
        </div>

        {navigatorOpen && (
          <nav className="map-navigator" aria-label="Roadmap navigator">
            <div className="map-navigator-header">
              <strong>Jump To</strong>
              <button type="button" onClick={() => setNavigatorOpen(false)} aria-label="Close navigator">
                x
              </button>
            </div>
            <button className="navigator-root" type="button" onClick={() => focusNode("root", 2.05)}>
              Full roadmap
            </button>
            {navigatorItems.map((category) => (
              <section key={category.id} className="navigator-group">
                <button type="button" className="navigator-category" onClick={() => focusNode(category.id, 3.05)}>
                  {category.name}
                </button>
                {category.subcategories.map((subcategory) => (
                  <button
                    type="button"
                    className="navigator-subcategory"
                    key={subcategory.id}
                    onClick={() => focusNode(subcategory.id, 3.65)}
                  >
                    <span>{subcategory.name}</span>
                    <small>{subcategory.questions}</small>
                  </button>
                ))}
              </section>
            ))}
          </nav>
        )}

        {warnings.length > 0 && (
          <div className="warning-strip" role="status">
            {warnings.map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        )}

        <RoadmapTree
          data={treeData}
          focusTarget={focusTarget}
          selectedQuestionId={selectedQuestion?.id}
          onSelectQuestion={setSelectedQuestion}
        />
      </section>

      <DetailPanel question={selectedQuestion} onClose={() => setSelectedQuestion(null)} />
    </main>
  );
}
