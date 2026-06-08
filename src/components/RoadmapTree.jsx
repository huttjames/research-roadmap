import { useEffect, useMemo, useRef, useState } from "react";

const WIDTH = 9000;
const HEIGHT = 7000;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const INITIAL_ZOOM = 2.05;
const CATEGORY_RADIUS = 1050;
const SUBCATEGORY_RADIUS = 1900;
const QUESTION_RADIUS = 3000;

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
  const source = link.source.point;
  const target = link.target.point;
  const middle = {
    x: (source.x + target.x) / 2,
    y: (source.y + target.y) / 2,
  };

  return `M${source.x},${source.y} Q${middle.x},${middle.y} ${target.x},${target.y}`;
}

function nodeClass(node) {
  return `roadmap-node roadmap-node-${node.data.type}`;
}

function nodeBox(node) {
  if (node.data.type === "root") return { width: 360, height: 118 };
  if (node.data.type === "category") return { width: 620, height: 220 };
  if (node.data.type === "subcategory") return { width: 420, height: 140 };
  return { width: 520, height: 176 };
}

function countLeaves(node) {
  if (!node.children?.length) return node.type === "question" ? 1 : 0;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function createRoadmapLayout(data) {
  const root = {
    data,
    point: { x: CENTER_X, y: CENTER_Y },
  };
  const nodes = [root];
  const links = [];
  const nodePoints = new Map([[data.id, root.point]]);
  const categories = data.children || [];
  const categoryWeights = categories.map((category) =>
    Math.max(
      4,
      (category.children || []).reduce((sum, subcategory) => sum + Math.max(2.4, countLeaves(subcategory)), 0),
    ),
  );
  const totalWeight = categoryWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  let angleCursor = 0;

  categories.forEach((category, categoryIndex) => {
    const categorySpan = (Math.PI * 2 * categoryWeights[categoryIndex]) / totalWeight;
    const categoryStart = angleCursor;
    const categoryEnd = angleCursor + categorySpan;
    const categoryAngle = (categoryStart + categoryEnd) / 2;
    const categoryNode = {
      data: category,
      point: polarToCartesian(categoryAngle, CATEGORY_RADIUS),
    };
    nodes.push(categoryNode);
    links.push({ source: root, target: categoryNode });
    nodePoints.set(category.id, categoryNode.point);

    const subcategories = category.children || [];
    const subcategoryWeights = subcategories.map((subcategory) => Math.max(2.4, countLeaves(subcategory)));
    const subcategoryTotal = subcategoryWeights.reduce((sum, weight) => sum + weight, 0) || 1;
    const categoryPadding = Math.min(0.12, categorySpan * 0.08);
    let subcategoryCursor = categoryStart + categoryPadding;
    const availableSpan = Math.max(0.1, categorySpan - categoryPadding * 2);

    subcategories.forEach((subcategory, subcategoryIndex) => {
      const subcategorySpan = (availableSpan * subcategoryWeights[subcategoryIndex]) / subcategoryTotal;
      const subcategoryStart = subcategoryCursor;
      const subcategoryEnd = subcategoryCursor + subcategorySpan;
      const subcategoryAngle = (subcategoryStart + subcategoryEnd) / 2;
      const subcategoryNode = {
        data: subcategory,
        point: polarToCartesian(subcategoryAngle, SUBCATEGORY_RADIUS),
      };
      nodes.push(subcategoryNode);
      links.push({ source: categoryNode, target: subcategoryNode });
      nodePoints.set(subcategory.id, subcategoryNode.point);

      const questions = subcategory.children || [];
      const questionPadding = Math.min(0.08, subcategorySpan * 0.16);
      const questionStart = subcategoryStart + questionPadding;
      const questionEnd = subcategoryEnd - questionPadding;
      const questionSpan = Math.max(0, questionEnd - questionStart);

      questions.forEach((question, questionIndex) => {
        const questionAngle =
          questions.length === 1
            ? subcategoryAngle
            : questionStart + (questionSpan * questionIndex) / (questions.length - 1);
        const questionRadius = QUESTION_RADIUS + (questionIndex % 2) * 240;
        const questionNode = {
          data: question,
          point: polarToCartesian(questionAngle, questionRadius),
        };
        nodes.push(questionNode);
        links.push({ source: subcategoryNode, target: questionNode });
        nodePoints.set(question.id, questionNode.point);
      });

      subcategoryCursor += subcategorySpan;
    });

    angleCursor = categoryEnd;
  });

  return { nodes, links, nodePoints };
}

function showKicker(type) {
  return type === "question";
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

  const { nodes, links, nodePoints } = useMemo(() => createRoadmapLayout(data), [data]);

  useEffect(() => {
    if (!focusTarget) return;
    const point = nodePoints.get(focusTarget.id);
    if (!point) return;

    const nextK = clamp(focusTarget.zoom ?? 1, 0.35, 5);
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
    const nextK = clamp(viewport.k * (event.deltaY > 0 ? 0.9 : 1.1), 0.35, 5);
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
              const point = node.point;
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
                      {showKicker(node.data.type) && <span className="node-card-kicker">Question</span>}
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
