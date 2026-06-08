import { useRef, useState } from "react";
import { hierarchy, tree } from "d3-hierarchy";

const WIDTH = 1500;
const HEIGHT = 980;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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

function nodeBox(node) {
  if (node.data.type === "root") return { width: 300, height: 96 };
  if (node.data.type === "category") return { width: 280, height: 106 };
  if (node.data.type === "subcategory") return { width: 210, height: 68 };
  return { width: 324, height: 104 };
}

function nodeKicker(type) {
  if (type === "root") return "Roadmap";
  if (type === "category") return "Major Category";
  if (type === "subcategory") return "Subcategory";
  return "Question";
}

export default function RoadmapTree({ data, selectedQuestionId, onSelectQuestion }) {
  const [viewport, setViewport] = useState({ x: 0, y: 0, k: 1 });
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const clickBlockedRef = useRef(false);

  const root = hierarchy(data);
  const layout = tree()
    .size([Math.PI * 2, Math.min(WIDTH, HEIGHT) / 2 - 92])
    .separation((a, b) => {
      if (a.parent === b.parent) return a.data.type === "question" ? 1.55 : 1.85;
      return 2.35;
    });

  const renderedRoot = layout(root);
  const nodes = renderedRoot.descendants();
  const links = renderedRoot.links();

  function svgPoint(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      rect,
    };
  }

  function handleWheel(event) {
    event.preventDefault();
    const point = svgPoint(event);
    const nextK = clamp(viewport.k * (event.deltaY > 0 ? 0.9 : 1.1), 0.55, 1.85);
    const worldX = (point.x - viewport.x) / viewport.k;
    const worldY = (point.y - viewport.y) / viewport.k;

    setViewport({
      x: point.x - worldX * nextK,
      y: point.y - worldY * nextK,
      k: nextK,
    });
  }

  function handlePointerDown(event) {
    const point = svgPoint(event);
    movedRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
      rect: point.rect,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const dx = ((event.clientX - drag.startX) / drag.rect.width) * WIDTH;
    const dy = ((event.clientY - drag.startY) / drag.rect.height) * HEIGHT;
    if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;

    setViewport({
      x: drag.originX + dx,
      y: drag.originY + dy,
      k: viewport.k,
    });
  }

  function handlePointerUp(event) {
    if (movedRef.current) {
      clickBlockedRef.current = true;
      window.setTimeout(() => {
        clickBlockedRef.current = false;
      }, 0);
    }

    if (dragRef.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragRef.current = null;
    }
  }

  function selectQuestion(question) {
    if (clickBlockedRef.current) return;
    onSelectQuestion(question);
  }

  return (
    <div className="tree-stage">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Interactive research roadmap"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#18212f" floodOpacity="0.16" />
          </filter>
        </defs>

        <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.k})`}>
          <g>
            {links.map((link) => (
              <path className="roadmap-link" d={linkPath(link)} key={`${link.source.data.id}-${link.target.data.id}`} />
            ))}
          </g>

          <g>
            {nodes.map((node) => {
              const point = polarToCartesian(node.x, node.y);
              const box = nodeBox(node);
              const isQuestion = node.data.type === "question";
              const isSelected = isQuestion && node.data.question.id === selectedQuestionId;
              const handleQuestionKeyDown = (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectQuestion(node.data.question);
                }
              };

              return (
                <g
                  className={`${nodeClass(node)} ${isSelected ? "is-selected" : ""}`}
                  key={node.data.id}
                  transform={`translate(${point.x},${point.y})`}
                >
                  <foreignObject
                    className="node-card-wrap"
                    x={box.width / -2}
                    y={box.height / -2}
                    width={box.width}
                    height={box.height}
                  >
                    <div
                      className={`node-card node-card-${node.data.type}`}
                      onClick={isQuestion ? () => selectQuestion(node.data.question) : undefined}
                      onKeyDown={isQuestion ? handleQuestionKeyDown : undefined}
                      role={isQuestion ? "button" : undefined}
                      tabIndex={isQuestion ? "0" : undefined}
                      title={node.data.name}
                    >
                      <span className="node-card-kicker">{nodeKicker(node.data.type)}</span>
                      <span className="node-card-title">{node.data.name}</span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
