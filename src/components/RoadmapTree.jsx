import { hierarchy, tree } from "d3-hierarchy";

const WIDTH = 1100;
const HEIGHT = 760;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

function polarToCartesian(angle, radius) {
  const adjustedAngle = angle - Math.PI / 2;
  return {
    x: Math.cos(adjustedAngle) * radius + CENTER_X,
    y: Math.sin(adjustedAngle) * radius + CENTER_Y,
  };
}

function linkPath(link) {
  const source = polarToCartesian(link.source.x, link.source.y);
  const target = polarToCartesian(link.target.x, link.target.y);
  const middle = polarToCartesian(link.target.x, (link.source.y + link.target.y) / 2);

  return `M${source.x},${source.y} Q${middle.x},${middle.y} ${target.x},${target.y}`;
}

function nodeClass(node) {
  return `roadmap-node roadmap-node-${node.data.type}`;
}

function labelAnchor(node) {
  if (node.data.type === "root") return "middle";
  const angle = node.x;
  return angle > Math.PI ? "end" : "start";
}

function labelTransform(node) {
  const angle = (node.x * 180) / Math.PI - 90;
  const rotate = node.x > Math.PI ? angle + 180 : angle;
  const offset = node.data.type === "question" ? 15 : 13;
  return `rotate(${rotate}) translate(${offset},4)`;
}

function labelFor(node) {
  const name = node.data.name;
  if (node.data.type !== "question" || name.length <= 70) return name;
  return `${name.slice(0, 67)}...`;
}

export default function RoadmapTree({ data, selectedQuestionId, onSelectQuestion }) {
  const root = hierarchy(data);
  const layout = tree()
    .size([Math.PI * 2, Math.min(WIDTH, HEIGHT) / 2 - 94])
    .separation((a, b) => {
      if (a.parent === b.parent) return a.data.type === "question" ? 1.2 : 1.5;
      return 2;
    });

  const renderedRoot = layout(root);
  const nodes = renderedRoot.descendants();
  const links = renderedRoot.links();

  return (
    <div className="tree-stage">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Interactive research roadmap">
        <g>
          {links.map((link) => (
            <path className="roadmap-link" d={linkPath(link)} key={`${link.source.data.id}-${link.target.data.id}`} />
          ))}
        </g>

        <g>
          {nodes.map((node) => {
            const point = polarToCartesian(node.x, node.y);
            const isQuestion = node.data.type === "question";
            const isSelected = isQuestion && node.data.question.id === selectedQuestionId;
            const selectQuestion = () => onSelectQuestion(node.data.question);
            const handleQuestionKeyDown = (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectQuestion();
              }
            };

            return (
              <g
                className={`${nodeClass(node)} ${isSelected ? "is-selected" : ""}`}
                key={node.data.id}
                transform={`translate(${point.x},${point.y})`}
              >
                {isQuestion ? (
                  <circle
                    className="node-hitbox"
                    r="18"
                    onClick={selectQuestion}
                    onKeyDown={handleQuestionKeyDown}
                    role="button"
                    tabIndex="0"
                    aria-label={`Open question: ${node.data.name}`}
                  />
                ) : null}
                <circle r={node.data.type === "root" ? 36 : node.data.type === "category" ? 18 : node.data.type === "subcategory" ? 11 : 7} />
                <text
                  textAnchor={labelAnchor(node)}
                  transform={node.data.type === "root" ? "translate(0,62)" : labelTransform(node)}
                  onClick={isQuestion ? selectQuestion : undefined}
                  onKeyDown={isQuestion ? handleQuestionKeyDown : undefined}
                  role={isQuestion ? "button" : undefined}
                  tabIndex={isQuestion ? "0" : undefined}
                >
                  {labelFor(node)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
