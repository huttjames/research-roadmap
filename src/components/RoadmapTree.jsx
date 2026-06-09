import { useEffect, useMemo, useRef, useState } from "react";

const BASE_WIDTH = 3000;
const MIN_HEIGHT = 1700;
const ROOT_X = 220;
const CATEGORY_X = 700;
const SUBCATEGORY_X = 1350;
const QUESTION_X = 2250;
const PADDING_Y = 145;
const CATEGORY_GAP = 180;
const SUBCATEGORY_GAP = 95;
const QUESTION_GAP = 165;
const INITIAL_ZOOM = 1.0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function linkPath(link) {
  const sourceBox = nodeBox(link.source);
  const targetBox = nodeBox(link.target);
  const source = {
    x: link.source.point.x + sourceBox.width / 2,
    y: link.source.point.y,
  };
  const target = {
    x: link.target.point.x - targetBox.width / 2,
    y: link.target.point.y,
  };
  const elbowX = source.x + (target.x - source.x) * 0.54;

  return `M${source.x},${source.y} H${elbowX} V${target.y} H${target.x}`;
}

function nodeClass(node) {
  return `roadmap-node roadmap-node-${node.data.type}`;
}

function nodeBox(node) {
  if (node.data.type === "root") return { width: 340, height: 108 };
  if (node.data.type === "category") return { width: 560, height: 155 };
  if (node.data.type === "subcategory") return { width: 430, height: 112 };
  return { width: 720, height: 148 };
}

function createRoadmapLayout(data) {
  const root = { data, point: { x: ROOT_X, y: PADDING_Y } };
  const categoryNodes = [];
  const subcategoryNodes = [];
  const questionNodes = [];
  const links = [];
  const nodePoints = new Map();
  const categories = data.children || [];
  let cursorY = PADDING_Y;

  categories.forEach((category) => {
    const categoryStartY = cursorY;
    const subcategories = category.children || [];
    const currentSubcategoryNodes = [];

    subcategories.forEach((subcategory) => {
      const subcategoryStartY = cursorY;
      const questions = subcategory.children || [];
      const currentQuestionNodes = [];

      questions.forEach((question, questionIndex) => {
        const questionNode = {
          data: question,
          point: { x: QUESTION_X, y: cursorY + questionIndex * QUESTION_GAP },
        };
        questionNodes.push(questionNode);
        currentQuestionNodes.push(questionNode);
        nodePoints.set(question.id, questionNode.point);
      });

      const firstQuestion = currentQuestionNodes[0] || { point: { y: subcategoryStartY } };
      const lastQuestion = currentQuestionNodes[currentQuestionNodes.length - 1] || firstQuestion;
      const subcategoryNode = {
        data: subcategory,
        point: { x: SUBCATEGORY_X, y: (firstQuestion.point.y + lastQuestion.point.y) / 2 },
      };
      subcategoryNodes.push(subcategoryNode);
      currentSubcategoryNodes.push(subcategoryNode);
      nodePoints.set(subcategory.id, subcategoryNode.point);

      currentQuestionNodes.forEach((questionNode) => {
        links.push({ source: subcategoryNode, target: questionNode });
      });

      cursorY = Math.max(subcategoryStartY + QUESTION_GAP, lastQuestion.point.y + QUESTION_GAP + SUBCATEGORY_GAP);
    });

    const firstSubcategory = currentSubcategoryNodes[0];
    const lastSubcategory = currentSubcategoryNodes[currentSubcategoryNodes.length - 1];
    const fallbackCategoryY = categoryStartY + CATEGORY_GAP / 2;
    const categoryNode = {
      data: category,
      point: {
        x: CATEGORY_X,
        y: firstSubcategory && lastSubcategory ? (firstSubcategory.point.y + lastSubcategory.point.y) / 2 : fallbackCategoryY,
      },
    };
    categoryNodes.push(categoryNode);
    nodePoints.set(category.id, categoryNode.point);

    currentSubcategoryNodes.forEach((subcategoryNode) => {
      links.push({ source: categoryNode, target: subcategoryNode });
    });

    cursorY += CATEGORY_GAP;
  });

  if (categoryNodes.length > 0) {
    root.point = {
      x: ROOT_X,
      y: (categoryNodes[0].point.y + categoryNodes[categoryNodes.length - 1].point.y) / 2,
    };
  }

  nodePoints.set(data.id, root.point);
  categoryNodes.forEach((categoryNode) => {
    links.push({ source: root, target: categoryNode });
  });

  return {
    nodes: [root, ...categoryNodes, ...subcategoryNodes, ...questionNodes],
    links,
    nodePoints,
    width: BASE_WIDTH,
    height: Math.max(MIN_HEIGHT, cursorY + PADDING_Y),
  };
}

function showKicker(type) {
  return type === "question";
}

function nodeZoom(type) {
  if (type === "root") return 1.05;
  if (type === "category") return 1.35;
  if (type === "subcategory") return 1.65;
  return 1.9;
}

export default function RoadmapTree({ data, focusTarget, selectedQuestionId, onSelectQuestion }) {
  const [viewport, setViewport] = useState({ x: 0, y: 0, k: 1 });
  const dragRef = useRef(null);
  const initializedRef = useRef(false);
  const movedRef = useRef(false);
  const clickBlockedRef = useRef(false);

  const { nodes, links, nodePoints, width, height } = useMemo(() => createRoadmapLayout(data), [data]);

  useEffect(() => {
    if (initializedRef.current) return;
    const categories = nodes.filter((node) => node.data.type === "category");
    if (categories.length === 0) return;

    const firstCategory = categories[0];
    const lastCategory = categories[categories.length - 1];
    const targetPoint = {
      x: CATEGORY_X,
      y: (firstCategory.point.y + lastCategory.point.y) / 2,
    };
    setViewport({
      x: width / 2 - SUBCATEGORY_X * INITIAL_ZOOM,
      y: height / 2 - targetPoint.y * INITIAL_ZOOM,
      k: INITIAL_ZOOM,
    });
    initializedRef.current = true;
  }, [height, nodes, width]);

  useEffect(() => {
    if (!focusTarget) return;
    const point = nodePoints.get(focusTarget.id);
    if (!point) return;

    const nextK = clamp(focusTarget.zoom ?? 1, 0.35, 5);
    setViewport({
      x: width / 2 - point.x * nextK,
      y: height / 2 - point.y * nextK,
      k: nextK,
    });
  }, [focusTarget, height, nodePoints, width]);

  function svgPoint(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * width,
      y: ((event.clientY - rect.top) / rect.height) * height,
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

    const dx = ((event.clientX - drag.startX) / drag.rect.width) * width;
    const dy = ((event.clientY - drag.startY) / drag.rect.height) * height;
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

  function centerNode(node) {
    if (clickBlockedRef.current) return;
    const nextK = nodeZoom(node.data.type);
    setViewport({
      x: width / 2 - node.point.x * nextK,
      y: height / 2 - node.point.y * nextK,
      k: nextK,
    });
  }

  function activateNode(node) {
    if (node.data.type === "question") {
      selectQuestion(node.data.question);
      return;
    }

    centerNode(node);
  }

  function handleNodePointerDown(event) {
    event.stopPropagation();
  }

  return (
    <div className="tree-stage">
      <svg
        viewBox={`0 0 ${width} ${height}`}
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
          <g className="roadmap-column-labels" aria-hidden="true">
            <text className="roadmap-column-label" x={CATEGORY_X} y="42">
              Categories
            </text>
            <text className="roadmap-column-label" x={SUBCATEGORY_X} y="42">
              Subcategories
            </text>
            <text className="roadmap-column-label" x={QUESTION_X} y="42">
              Questions
            </text>
          </g>

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
              const isInteractive = node.data.type !== "root" || nodes.length > 1;
              const isSelected = isQuestion && node.data.question.id === selectedQuestionId;
              const handleNodeKeyDown = (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activateNode(node);
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
                      onClick={isInteractive ? () => activateNode(node) : undefined}
                      onPointerDown={isInteractive ? handleNodePointerDown : undefined}
                      onKeyDown={isInteractive ? handleNodeKeyDown : undefined}
                      role={isInteractive ? "button" : undefined}
                      tabIndex={isInteractive ? "0" : undefined}
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
