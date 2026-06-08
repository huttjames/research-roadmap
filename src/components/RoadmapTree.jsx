import { hierarchy, tree } from "d3-hierarchy";

const WIDTH = 1220;
const HEIGHT = 820;
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

function labelFor(node) {
  const name = node.data.name;
  if (node.data.type !== "question" || name.length <= 96) return name;
  return `${name.slice(0, 93)}...`;
}

function labelBox(node, point) {
  if (node.data.type === "root") {
    return {
      x: point.x - 150,
      y: point.y + 45,
      width: 300,
      height: 50,
      side: "center",
    };
  }

  const width = node.data.type === "question" ? 292 : node.data.type === "category" ? 210 : 164;
  const height = node.data.type === "question" ? 54 : 38;
  const side = point.x < CENTER_X ? "left" : "right";
  const offset = node.data.type === "question" ? 22 : 17;

  return {
    x: side === "left" ? point.x - width - offset : point.x + offset,
    y: point.y - height / 2,
    width,
    height,
    side,
  };
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
        <defs>
          <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#18212f" floodOpacity="0.18" />
          </filter>
        </defs>
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
            const label = labelBox(node, point);
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
                <foreignObject
                  className={`node-label-wrap node-label-wrap-${label.side}`}
                  x={label.x - point.x}
                  y={label.y - point.y}
                  width={label.width}
                  height={label.height}
                >
                  <div
                    className={`node-label node-label-${node.data.type}`}
                    onClick={isQuestion ? selectQuestion : undefined}
                    onKeyDown={isQuestion ? handleQuestionKeyDown : undefined}
                    role={isQuestion ? "button" : undefined}
                    tabIndex={isQuestion ? "0" : undefined}
                    title={node.data.name}
                  >
                    {labelFor(node)}
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
