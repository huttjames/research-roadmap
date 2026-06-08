import { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, tree } from "d3-hierarchy";

const WIDTH = 2400;
const HEIGHT = 1700;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const INITIAL_ZOOM = 1.08;

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
  if (node.data.type === "root") return { width: 320, height: 104 };
  if (node.data.type === "category") return { width: 360, height: 130 };
  if (node.data.type === "subcategory") return { width: 260, height: 82 };
  return { width: 390, height: 126 };
}

function nodeKicker(type) {
  if (type === "root") return "Roadmap";
  if (type === "category") return "Major Category";
  if (type === "subcategory") return "Subcategory";
  return "Question";
}

export default function RoadmapTree({ data, focusTarget, selectedQuestionId, onSelectQuestion }) {
  const [viewport, setViewport] = useState({
    x: CENTER_X - CENTER_X * INITIAL_ZOOM,
    y: CENTER_Y - CENTER_Y * INITIAL_ZOOM,
    k: INITIAL_ZOOM,
  });
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const clickBlockedRef = useRef(false);

  const { nodes, links, nodePoints } = useMemo(() => {
    const root = hierarchy(data);
    const layout = tree()
      .size([Math.PI * 2, Math.min(WIDTH, HEIGHT) / 2 - 170])
      .separation((a, b) => {
        if (a.parent === b.parent) return a.data.type === "question" ? 2.6 : 2.9;
        return 3.35;
      });
    const renderedRoot = layout(root);
    const renderedNodes = renderedRoot.descendants();
    const points = new Map(
      renderedNodes.map((node) => [node.data.id, polarToCartesian(node.x, node.y)]),
    );

    return {
      nodes: renderedNodes,
      links: renderedRoot.links(),
      nodePoints: points,
    };
  }, [data]);

  useEffect(() => {
    if (!focusTarget) return;
    const point = nodePoints.get(focusTarget.id);
    if (!point) return;

    const nextK = clamp(focusTarget.zoom ?? 1, 0.45, 2.2);
    setViewport({
      x: CENTER_X - point.x * nextK,
      y: CENTER_Y - point.y * nextK,
      k: nextK,
    });
  }, [focusTarget, nodePoints]);

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
    const nextK = clamp(viewport.k * (event.deltaY > 0 ? 0.9 : 1.1), 0.45, 2.2);
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

    setViewport((current) => ({
      x: drag.originX + dx,
      y: drag.originY + dy,
      k: current.k,
    }));
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

  function handleQuestionPointerDown(event) {
    event.stopPropagation();
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
                      onPointerDown={isQuestion ? handleQuestionPointerDown : undefined}
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
