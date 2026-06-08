import { useEffect, useMemo, useState } from "react";
import RoadmapTree from "./components/RoadmapTree.jsx";
import DetailPanel from "./components/DetailPanel.jsx";
import { buildRoadmapTree, getRoadmapStats } from "./data/treeBuilder.js";
import { parseCsvText, parseWorkbookFromFile } from "./data/parseWorkbook.js";

const PUBLISHED_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSqLA1y00VMLkhP8oWfYT9WqQp9GqlFCOKXUYnkD051OEq9rLXWWXBvSJe8XeZsUqYR9vhTMZU9VtsR/pub?gid=0&single=true&output=csv";

export default function App() {
  const [questions, setQuestions] = useState([]);
  const [sourceName, setSourceName] = useState("Published Google Sheet CSV");
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [status, setStatus] = useState("Loading published CSV...");
  const [error, setError] = useState("");

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
        setStatus(`Loaded ${parsed.questions.length} questions from the published sheet.`);
      } catch (loadError) {
        setError(loadError.message);
        setStatus("");
      }
    }

    loadPublishedCsv();
  }, []);

  const treeData = useMemo(() => buildRoadmapTree(questions), [questions]);
  const stats = useMemo(() => getRoadmapStats(questions), [questions]);
  const warnings = useMemo(() => {
    const messages = [];
    if (questions.length > 0 && stats.categories !== 5) {
      messages.push(`Expected 5 major categories, but found ${stats.categories}.`);
    }
    return messages;
  }, [questions.length, stats.categories]);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setStatus(`Parsing ${file.name}...`);
    setSelectedQuestion(null);

    try {
      const parsed = await parseWorkbookFromFile(file);
      setQuestions(parsed.questions);
      setSourceName(file.name);
      setStatus(`Loaded ${parsed.questions.length} questions from ${parsed.sheetName}.`);
    } catch (uploadError) {
      setError(uploadError.message);
      setStatus("");
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">IfDT Research Roadmap</p>
            <h1>Interactive research question map</h1>
          </div>

          <label className="upload-control">
            <span>Upload data</span>
            <input accept=".csv,.xlsx,.xls" type="file" onChange={handleUpload} />
          </label>
        </header>

        <div className="status-strip">
          <div>
            <strong>{sourceName}</strong>
            {status && <span>{status}</span>}
            {error && <span className="error-text">{error}</span>}
          </div>
          <div className="stats" aria-label="Roadmap counts">
            <span>{stats.categories} categories</span>
            <span>{stats.subcategories} subcategories</span>
            <span>{stats.questions} questions</span>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="warning-strip" role="status">
            {warnings.map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        )}

        <RoadmapTree
          data={treeData}
          selectedQuestionId={selectedQuestion?.id}
          onSelectQuestion={setSelectedQuestion}
        />
      </section>

      <DetailPanel question={selectedQuestion} onClose={() => setSelectedQuestion(null)} />
    </main>
  );
}
