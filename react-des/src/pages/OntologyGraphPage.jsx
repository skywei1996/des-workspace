import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { buildApiUrl } from "../config/api";
import { listLocalDatasets } from "../utils/datasetStorage";
import { readDatasetRows } from "../utils/datasetSchemaInference";

const NODE_COLORS = ["#1d70b7", "#dc3526", "#159447", "#e6bd21", "#74b98b", "#87add3", "#d58b82", "#7b62ac"];

class GraphErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const isZh = this.props.isZh;
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center bg-[#f7f8fa] px-8 text-center">
        <div className="max-w-md border border-[#e2e5e9] bg-white px-8 py-10 shadow-sm">
          <div className="text-sm font-semibold text-[#343a43]">{isZh ? "图谱加载失败" : "Graph failed to load"}</div>
          <p className="mt-2 text-xs leading-5 text-[#7d8590]">{isZh ? "图谱组件初始化时出现异常，请重试。" : "The graph could not be initialized. Please retry."}</p>
          <button type="button" onClick={() => this.setState({ hasError: false, error: null })} className="mt-5 h-9 rounded bg-[#e3473c] px-4 text-sm font-medium text-white">{isZh ? "重试" : "Retry"}</button>
          {this.state.error?.message && <div className="mt-4 break-words text-left text-[11px] text-[#a15d59]">{this.state.error.message}</div>}
        </div>
      </main>
    );
  }
}

const edgePredicate = (link, objectTypes) => {
  const sourceName = objectTypes.find((objectType) => objectType.id === link.sourceObjectTypeId)?.name || "";
  const targetName = objectTypes.find((objectType) => objectType.id === link.targetObjectTypeId)?.name || "";
  const predicate = String(link.name || "")
    .replace(sourceName, "")
    .replace(targetName, "")
    .replace(/^[\s:：>→-]+|[\s:：>→-]+$/g, "")
    .trim();

  return predicate || link.name;
};

const collectHopNodes = (startNodeId, links, maxHops) => {
  if (!startNodeId) return null;
  const visited = new Set([startNodeId]);
  let frontier = new Set([startNodeId]);

  for (let hop = 0; hop < maxHops && frontier.size; hop += 1) {
    const nextFrontier = new Set();
    links.forEach((link) => {
      if (frontier.has(link.sourceObjectTypeId) && !visited.has(link.targetObjectTypeId)) nextFrontier.add(link.targetObjectTypeId);
      if (frontier.has(link.targetObjectTypeId) && !visited.has(link.sourceObjectTypeId)) nextFrontier.add(link.sourceObjectTypeId);
    });
    nextFrontier.forEach((nodeId) => visited.add(nodeId));
    frontier = nextFrontier;
  }

  return visited;
};

const TypeGraphRenderer = ({ graph, selectedNodeId, highlightedNodeIds, onSelectNode, isZh }) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current || graph.order === 0) return undefined;

    const width = Math.max(containerRef.current.clientWidth, 680);
    const height = Math.max(containerRef.current.clientHeight, 520);
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const rawNodes = graph.nodes().map((nodeId) => ({
      id: nodeId,
      ...graph.getNodeAttributes(nodeId),
    }));
    const rawXExtent = d3.extent(rawNodes, (node) => Number(node.x));
    const rawYExtent = d3.extent(rawNodes, (node) => Number(node.y));
    const horizontalPadding = Math.min(110, width * 0.16);
    const verticalPadding = Math.min(92, height * 0.18);
    const xScale = d3.scaleLinear()
      .domain(rawXExtent[0] === rawXExtent[1] ? [rawXExtent[0] - 1, rawXExtent[1] + 1] : rawXExtent)
      .range([horizontalPadding, width - horizontalPadding]);
    const yScale = d3.scaleLinear()
      .domain(rawYExtent[0] === rawYExtent[1] ? [rawYExtent[0] - 1, rawYExtent[1] + 1] : rawYExtent)
      .range([verticalPadding, height - verticalPadding]);
    const nodes = rawNodes.map((attributes, index) => {
      return {
        ...attributes,
        x: xScale(Number(attributes.x)),
        y: yScale(Number(attributes.y)),
        color: NODE_COLORS[index % NODE_COLORS.length],
      };
    });
    const links = graph.edges().map((edgeId) => ({
      id: edgeId,
      source: graph.source(edgeId),
      target: graph.target(edgeId),
      ...graph.getEdgeAttributes(edgeId),
    }));

    const layoutLinks = links.map((link) => ({ ...link }));
    const layoutSimulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(layoutLinks).id((node) => node.id).distance(142).strength(0.6))
      .force("charge", d3.forceManyBody().strength(-520).distanceMax(460))
      .force("collision", d3.forceCollide().radius((node) => Math.max(66, String(node.label || node.id).length * 9 + 38)).strength(1).iterations(3))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.08))
      .force("x", d3.forceX(width / 2).strength(0.025))
      .force("y", d3.forceY(height / 2).strength(0.025))
      .stop();
    for (let tick = 0; tick < 220; tick += 1) layoutSimulation.tick();
    nodes.forEach((node) => {
      node.x = Math.max(horizontalPadding, Math.min(width - horizontalPadding, node.x));
      node.y = Math.max(verticalPadding, Math.min(height - verticalPadding, node.y));
    });

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const nodeRadius = (node) => Math.max(15, Math.min(28, Number(node.size || 14) * 1.15)) * 0.6;
    const isHighlightedNode = (nodeId) => !selectedNodeId || highlightedNodeIds?.has(nodeId);
    const isHighlightedLink = (link) => !selectedNodeId || (highlightedNodeIds?.has(link.source) && highlightedNodeIds?.has(link.target));

    const positionById = new Map(nodes.map((node) => [node.id, { x: node.x, y: node.y }]));

    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "type-graph-arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 9)
      .attr("refY", 5)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", "#aeb8c2");

    const linkGroup = svg.append("g");
    const linkSelection = linkGroup
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (link) => (isHighlightedLink(link) ? "#73808c" : "#d5dce2"))
      .attr("stroke-width", (link) => (selectedNodeId && isHighlightedLink(link) ? 2.8 : 1.35))
      .attr("marker-end", "url(#type-graph-arrow)")
      .attr("opacity", (link) => (isHighlightedLink(link) ? 0.95 : 0.55));

    const linkLabelSelection = svg.append("g")
      .selectAll("text")
      .data(links)
      .join("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", 9)
      .attr("font-weight", 500)
      .attr("fill", "#7d8994")
      .attr("stroke", "#f7f8fa")
      .attr("stroke-width", 4)
      .attr("stroke-linejoin", "round")
      .attr("paint-order", "stroke")
      .attr("pointer-events", "none")
      .attr("opacity", (link) => (isHighlightedLink(link) ? 1 : 0.65))
      .text((link) => link.label || (isZh ? "关系" : "Relation"));

    const nodeGroup = svg.append("g");
    const nodeSelection = nodeGroup
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (_, node) => onSelectNode(node.id, node))
      .on("dblclick", (_, node) => onSelectNode(node.id, node));

    nodeSelection
      .append("circle")
      .attr("r", nodeRadius)
      .attr("fill", (node) => (selectedNodeId && node.id === selectedNodeId ? "#e3473c" : node.color || NODE_COLORS[0]))
      .attr("stroke", "#ffffff")
      .attr("stroke-width", (node) => (selectedNodeId && isHighlightedNode(node.id) ? 5 : 3))
      .attr("opacity", (node) => (isHighlightedNode(node.id) ? 1 : 0.72));

    nodeSelection
      .append("text")
      .attr("text-anchor", (node) => (node.x < width / 2 ? "end" : "start"))
      .attr("x", (node) => {
        const radius = nodeRadius(node);
        return node.x < width / 2 ? -radius - 5 : radius + 5;
      })
      .attr("dy", "0.35em")
      .attr("font-size", 13)
      .attr("font-weight", 700)
      .attr("fill", (node) => node.color || NODE_COLORS[0])
      .attr("stroke", "#f7f8fa")
      .attr("stroke-width", 4)
      .attr("paint-order", "stroke")
      .attr("opacity", (node) => (isHighlightedNode(node.id) ? 1 : 0.72))
      .text((node) => node.label || node.id);

    const edgePosition = (link) => {
      const source = nodeById.get(link.source);
      const target = nodeById.get(link.target);
      if (!source || !target) return { x1: width / 2, y1: height / 2, x2: width / 2, y2: height / 2 };
      const deltaX = target.x - source.x;
      const deltaY = target.y - source.y;
      const distance = Math.max(Math.hypot(deltaX, deltaY), 1);
      const unitX = deltaX / distance;
      const unitY = deltaY / distance;
      const sourceRadius = nodeRadius(source) + 2;
      const targetRadius = nodeRadius(target) + 5;
      return {
        x1: source.x + unitX * sourceRadius,
        y1: source.y + unitY * sourceRadius,
        x2: target.x - unitX * targetRadius,
        y2: target.y - unitY * targetRadius,
      };
    };

    linkSelection
      .attr("x1", (link) => edgePosition(link).x1)
      .attr("y1", (link) => edgePosition(link).y1)
      .attr("x2", (link) => edgePosition(link).x2)
      .attr("y2", (link) => edgePosition(link).y2);
    linkLabelSelection
      .attr("x", (link) => {
        const position = edgePosition(link);
        return (position.x1 + position.x2) / 2;
      })
      .attr("y", (link) => {
        const position = edgePosition(link);
        return (position.y1 + position.y2) / 2 - 7;
      });
    nodeSelection.attr("transform", (node) => `translate(${node.x},${node.y})`);

    return undefined;
  }, [graph, highlightedNodeIds, selectedNodeId, onSelectNode]);

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden">
      <svg ref={svgRef} className="h-full w-full" aria-label={isZh ? "对象类型关系图" : "Object type relationship graph"} />
    </div>
  );
};

const loadLocalOntologyData = async ({ objectTypes, properties, links }) => {
  const datasets = await listLocalDatasets();
  const datasetsById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  const nodes = [];

  for (const objectType of objectTypes.filter((item) => item.primaryDatasourceId)) {
    const dataset = datasetsById.get(objectType.primaryDatasourceId);
    if (!dataset) continue;
    const typeProperties = properties.filter(
      (property) => property.objectTypeId === objectType.id && property.columnName,
    );
    const primaryKeyProperty = typeProperties.find((property) => property.primaryKey);
    const titleProperty = typeProperties.find((property) => property.titleKey);
    if (!primaryKeyProperty) continue;

    const rows = await readDatasetRows(dataset);
    rows.forEach((row) => {
      const primaryKey = String(row[primaryKeyProperty.columnName] ?? "").trim();
      if (!primaryKey) return;
      const displayName = String(row[titleProperty?.columnName] ?? primaryKey).trim() || primaryKey;
      nodes.push({
        id: `local:${objectType.id}:${encodeURIComponent(primaryKey)}`,
        objectTypeId: objectType.id,
        primaryKey,
        displayName,
        properties: Object.fromEntries(
          typeProperties.map((property) => [property.name, row[property.columnName] ?? ""]),
        ),
        source: `dataset:${dataset.id}`,
      });
    });
  }

  const nodesByType = new Map();
  nodes.forEach((node) => {
    if (!nodesByType.has(node.objectTypeId)) nodesByType.set(node.objectTypeId, []);
    nodesByType.get(node.objectTypeId).push(node);
  });

  const instanceLinks = [];
  const keyVariants = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return [];
    const withoutAnnotation = normalized.replace(/[（(][^（）()]*[）)]\s*$/, "").trim();
    return [...new Set([normalized, withoutAnnotation].filter(Boolean))];
  };
  const splitForeignKeyValues = (value) => String(value ?? "")
    .split(/[;,，；|、\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  links.forEach((link) => {
    const mapping = link.mapping;
    if (!mapping?.primaryKeyPropertyId) return;
    const primaryKeyProperty = properties.find((property) => property.id === mapping.primaryKeyPropertyId);
    if (!primaryKeyProperty) return;
    const sourceNodes = nodesByType.get(mapping.foreignKeyObjectTypeId) || [];
    const targetNodes = nodesByType.get(mapping.primaryKeyObjectTypeId) || [];
    const sourceProperties = properties.filter((property) => property.objectTypeId === mapping.foreignKeyObjectTypeId);
    const foreignKeyProperty = properties.find((property) => property.id === mapping.foreignKeyPropertyId)
      || sourceProperties.find((property) => property.name === primaryKeyProperty.name || property.apiName === primaryKeyProperty.apiName);
    if (!foreignKeyProperty) return;
    const targetsByKey = new Map();
    targetNodes.forEach((node) => {
      const aliases = [node.primaryKey, node.displayName, ...Object.values(node.properties || {})];
      aliases.flatMap(keyVariants).forEach((alias) => {
        if (!targetsByKey.has(alias)) targetsByKey.set(alias, node);
      });
    });
    sourceNodes.forEach((sourceNode) => {
      const candidateProperties = [
        foreignKeyProperty,
        ...sourceProperties.filter((property) => property.id !== foreignKeyProperty.id),
      ];
      const matchedTargets = new Map();
      candidateProperties.some((property) => {
        splitForeignKeyValues(sourceNode.properties?.[property.name]).forEach((foreignKey) => {
          const targetNode = keyVariants(foreignKey).map((key) => targetsByKey.get(key)).find(Boolean);
          if (targetNode) matchedTargets.set(targetNode.id, targetNode);
        });
        return matchedTargets.size > 0;
      });
      matchedTargets.forEach((targetNode) => {
        instanceLinks.push({
          id: `${link.id}:${sourceNode.id}:${targetNode.id}`,
          linkTypeId: link.apiName || link.id,
          label: link.name,
          sourceInstanceId: sourceNode.id,
          targetInstanceId: targetNode.id,
        });
      });
    });
  });

  return { nodes, links: instanceLinks };
};

const traverseLocalOntology = ({ data, startInstanceIds, maxHops, maxPerObject = 20, limit = 300 }) => {
  const depths = new Map(startInstanceIds.map((id) => [id, 0]));
  const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
  const countByObjectType = new Map();
  startInstanceIds.forEach((id) => {
    const objectTypeId = nodesById.get(id)?.objectTypeId;
    if (objectTypeId) countByObjectType.set(objectTypeId, (countByObjectType.get(objectTypeId) || 0) + 1);
  });
  let frontier = new Set(startInstanceIds);
  const visibleLinks = new Map();

  for (let depth = 1; depth <= maxHops && frontier.size; depth += 1) {
    const nextFrontier = new Set();
    data.links.forEach((link) => {
      let neighborId = null;
      if (frontier.has(link.sourceInstanceId)) neighborId = link.targetInstanceId;
      else if (frontier.has(link.targetInstanceId)) neighborId = link.sourceInstanceId;
      if (!neighborId) return;
      if (!depths.has(neighborId) && depths.size < limit) {
        const objectTypeId = nodesById.get(neighborId)?.objectTypeId;
        if (objectTypeId && (countByObjectType.get(objectTypeId) || 0) >= maxPerObject) return;
        depths.set(neighborId, depth);
        if (objectTypeId) countByObjectType.set(objectTypeId, (countByObjectType.get(objectTypeId) || 0) + 1);
        nextFrontier.add(neighborId);
      }
      if (depths.has(neighborId)) visibleLinks.set(link.id, link);
    });
    frontier = nextFrontier;
  }

  return {
    nodes: [...depths.entries()].flatMap(([id, depth]) => {
      const node = nodesById.get(id);
      return node ? [{ ...node, depth }] : [];
    }),
    links: [...visibleLinks.values()].filter(
      (link) => depths.has(link.sourceInstanceId) && depths.has(link.targetInstanceId),
    ),
  };
};

const collectInstanceHopNodes = (startNodeId, links, maxHops) => {
  if (!startNodeId) return null;
  const visited = new Set([startNodeId]);
  let frontier = new Set([startNodeId]);
  for (let hop = 0; hop < maxHops && frontier.size; hop += 1) {
    const nextFrontier = new Set();
    links.forEach((link) => {
      const sourceId = typeof link.source === "object" ? link.source.id : link.source ?? link.sourceInstanceId;
      const targetId = typeof link.target === "object" ? link.target.id : link.target ?? link.targetInstanceId;
      if (frontier.has(sourceId) && !visited.has(targetId)) nextFrontier.add(targetId);
      if (frontier.has(targetId) && !visited.has(sourceId)) nextFrontier.add(sourceId);
    });
    nextFrontier.forEach((nodeId) => visited.add(nodeId));
    frontier = nextFrontier;
  }
  return visited;
};

const BasicKnowledgeGraph = ({ data, selectedInstanceId, locatedInstanceId, expandedProperty, objectTypes, hopDepth, maxDisplayCount, onInspectEntity, onExploreEntity, onSelectValue, isZh }) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const viewportRef = useRef(null);
  const zoomRef = useRef(null);
  const positionsRef = useRef(new Map());
  const objectTypeIndex = useMemo(() => new Map(objectTypes.map((item, index) => [item.id, index])), [objectTypes]);
  const instancePredicate = (link) => {
    const sourceNode = data.nodes.find((node) => node.id === link.sourceInstanceId);
    const targetNode = data.nodes.find((node) => node.id === link.targetInstanceId);
    const sourceName = objectTypes.find((item) => item.id === sourceNode?.objectTypeId)?.name || "";
    const targetName = objectTypes.find((item) => item.id === targetNode?.objectTypeId)?.name || "";
    const predicate = String(link.label || link.linkTypeId || "")
      .replace(sourceName, "")
      .replace(targetName, "")
      .replace(/^[\s:：>→-]+|[\s:：>→-]+$/g, "")
      .trim();
    return predicate || (isZh ? "关联" : "Related");
  };

  const completeGraph = useMemo(() => {
    const nodes = data.nodes.map((node) => ({ ...node, nodeKind: "entity" }));
    const graphLinks = data.links.map((link) => ({ id: link.id, source: link.sourceInstanceId, target: link.targetInstanceId, label: instancePredicate(link), linkKind: "relation" }));
    if (!expandedProperty) {
      const propertyValues = new Map();
      data.nodes.forEach((instance) => {
        Object.entries(instance.properties || {}).filter(([, value]) => value !== "" && value !== null && value !== undefined).slice(0, maxDisplayCount).forEach(([propertyName, value]) => {
          String(value).split(/[;,，；|、\n]+/).map((item) => item.trim()).filter(Boolean).forEach((propertyValue) => {
            const normalizedValue = propertyValue.toLocaleLowerCase();
            const propertyValueId = `property-value:${encodeURIComponent(propertyName)}:${encodeURIComponent(normalizedValue)}`;
            if (!propertyValues.has(propertyValueId)) {
              const valueNode = { id: propertyValueId, nodeKind: "property-value", propertyName, propertyValue, displayName: propertyValue };
              propertyValues.set(propertyValueId, valueNode);
              nodes.push(valueNode);
            }
            graphLinks.push({ id: `property-link:${instance.id}:${encodeURIComponent(propertyName)}:${encodeURIComponent(normalizedValue)}`, source: instance.id, target: propertyValueId, label: propertyName, linkKind: "property-value" });
          });
        });
      });
    }
    if (expandedProperty) {
      const valueNode = { id: `pivot:${expandedProperty.propertyName}:${expandedProperty.propertyValue}`, nodeKind: "pivot", propertyName: expandedProperty.propertyName, propertyValue: expandedProperty.propertyValue, displayName: expandedProperty.propertyValue };
      nodes.push(valueNode);
      data.nodes.forEach((node) => graphLinks.push({ id: `pivot-link:${node.id}`, source: valueNode.id, target: node.id, label: expandedProperty.propertyName, linkKind: "property" }));
    }
    return { nodes, links: graphLinks };
  }, [data, expandedProperty, isZh, maxDisplayCount, selectedInstanceId]);

  const visibleGraph = completeGraph;
  const highlightedGraphNodeIds = useMemo(
    () => collectInstanceHopNodes(selectedInstanceId, completeGraph.links, hopDepth),
    [completeGraph.links, hopDepth, selectedInstanceId],
  );

  useEffect(() => {
    const container = containerRef.current;
    const svgElement = svgRef.current;
    const viewportElement = viewportRef.current;
    if (!container || !svgElement || !viewportElement || !visibleGraph.nodes.length) return undefined;
    const width = Math.max(container.clientWidth, 680);
    const height = Math.max(container.clientHeight, 560);
    const svg = d3.select(svgElement).attr("viewBox", `0 0 ${width} ${height}`);
    const viewport = d3.select(viewportElement);
    viewport.selectAll("*").remove();
    const nodes = visibleGraph.nodes.map((node, index) => {
      const previous = positionsRef.current.get(node.id);
      const angle = (index / Math.max(visibleGraph.nodes.length, 1)) * Math.PI * 2;
      return { ...node, x: previous?.x ?? width / 2 + Math.cos(angle) * 130, y: previous?.y ?? height / 2 + Math.sin(angle) * 130 };
    });
    const links = visibleGraph.links.map((link) => ({ ...link }));
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const endpointId = (endpoint) => typeof endpoint === "object" ? endpoint.id : endpoint;
    const isHighlightedNode = (nodeId) => {
      if (!selectedInstanceId) return true;
      const node = nodesById.get(nodeId);
      if (!node) return false;
      return highlightedGraphNodeIds?.has(nodeId);
    };
    const isHighlightedLink = (item) => {
      if (!selectedInstanceId) return true;
      const sourceId = endpointId(item.source);
      const targetId = endpointId(item.target);
      return highlightedGraphNodeIds?.has(sourceId) && highlightedGraphNodeIds?.has(targetId);
    };
    const radius = (node) => node.nodeKind === "pivot" ? 18 : node.id === selectedInstanceId ? 16 : node.nodeKind === "entity" ? 12 : 7;
    const truncate = (value, max = 12) => String(value).length > max ? `${String(value).slice(0, max)}…` : String(value);
    const color = (node) => {
      if (selectedInstanceId && !isHighlightedNode(node.id)) return "#b8bec5";
      if (node.nodeKind === "pivot") return "#87add3";
      if (node.nodeKind === "property-value") return "#e6bd21";
      if (node.id === selectedInstanceId) return "#dc3526";
      return NODE_COLORS[(objectTypeIndex.get(node.objectTypeId) || 0) % NODE_COLORS.length];
    };
    const hasHiddenNeighbors = (nodeId) => completeGraph.links.some((link) => {
      const neighborId = link.source === nodeId ? link.target : link.target === nodeId ? link.source : null;
      return neighborId && !nodesById.has(neighborId);
    });
    const linkGroup = viewport.append("g");
    const link = linkGroup.selectAll("line").data(links).join("line").attr("stroke", (item) => isHighlightedLink(item) ? "#73808c" : item.linkKind?.startsWith("property-") ? "#ddd6bd" : "#d5dce2").attr("stroke-width", (item) => selectedInstanceId && isHighlightedLink(item) ? 2.8 : item.linkKind?.startsWith("property-") ? 1 : 1.35).attr("stroke-opacity", (item) => isHighlightedLink(item) ? 0.95 : 0.55).attr("marker-end", "url(#force-graph-arrow)");
    const edgeLabels = linkGroup.selectAll("text").data(links).join("text").attr("pointer-events", "none").attr("text-anchor", "middle").attr("font-size", 9).attr("font-weight", 500).attr("fill", "#7d8994").attr("opacity", (item) => item.linkKind?.startsWith("property-") ? 0 : isHighlightedLink(item) ? 1 : 0.65).attr("paint-order", "stroke").attr("stroke", "#f4f6f8").attr("stroke-width", 4).text((item) => item.linkKind?.startsWith("property-") ? "" : truncate(item.label, 8));
    const node = viewport.append("g").selectAll("g").data(nodes).join("g").attr("class", (item) => `graph-node cursor-pointer${item.id === locatedInstanceId ? " graph-node-located" : ""}`).attr("tabindex", 0).attr("role", "button");
    node.append("circle").attr("r", radius).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", (item) => selectedInstanceId && isHighlightedNode(item.id) ? 4 : 2.5).attr("opacity", (item) => isHighlightedNode(item.id) ? 1 : 0.72);
    node.filter((item) => item.nodeKind === "entity" && hasHiddenNeighbors(item.id)).append("circle").attr("cx", (item) => radius(item) * 0.72).attr("cy", (item) => -radius(item) * 0.72).attr("r", 5).attr("fill", "#fff").attr("stroke", "#7d8994");
    node.filter((item) => item.nodeKind === "entity" && hasHiddenNeighbors(item.id)).append("text").attr("x", (item) => radius(item) * 0.72).attr("y", (item) => -radius(item) * 0.72 + 3).attr("text-anchor", "middle").attr("font-size", 8).attr("font-weight", 700).attr("fill", "#58636e").text("+");
    node.append("text").attr("text-anchor", (item) => item.x < width / 2 ? "end" : "start").attr("x", (item) => item.x < width / 2 ? -radius(item) - 6 : radius(item) + 6).attr("y", 4).attr("font-size", (item) => item.nodeKind?.startsWith("property-") ? 10 : 12).attr("font-weight", 700).attr("fill", color).attr("opacity", (item) => isHighlightedNode(item.id) ? 1 : 0.72).attr("paint-order", "stroke").attr("stroke", "#f4f6f8").attr("stroke-width", 4).attr("pointer-events", "none").text((item) => truncate(item.displayName, 15));
    node.append("title").text((item) => item.nodeKind === "property-value" ? `${item.propertyName}: ${item.propertyValue}` : `${item.displayName}${item.primaryKey ? ` · ${item.primaryKey}` : ""}`);
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((item) => item.id).distance((item) => item.linkKind?.startsWith("property-") ? 85 : 145).strength(0.45))
      .force("charge", d3.forceManyBody().strength((item) => item.nodeKind === "entity" ? -360 : -110).distanceMax(700))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.055))
      .force("collision", d3.forceCollide().radius((item) => radius(item) + 30).strength(1).iterations(3))
      .alphaDecay(0.025).velocityDecay(0.34)
      .on("tick", () => {
        link.each(function positionLink(item) {
          const deltaX = item.target.x - item.source.x;
          const deltaY = item.target.y - item.source.y;
          const distance = Math.max(Math.hypot(deltaX, deltaY), 1);
          const unitX = deltaX / distance;
          const unitY = deltaY / distance;
          d3.select(this)
            .attr("x1", item.source.x + unitX * (radius(item.source) + 2))
            .attr("y1", item.source.y + unitY * (radius(item.source) + 2))
            .attr("x2", item.target.x - unitX * (radius(item.target) + 5))
            .attr("y2", item.target.y - unitY * (radius(item.target) + 5));
        });
        edgeLabels.attr("x", (item) => (item.source.x + item.target.x) / 2).attr("y", (item) => (item.source.y + item.target.y) / 2 - 6);
        node.attr("transform", (item) => `translate(${item.x},${item.y})`);
        nodes.forEach((item) => positionsRef.current.set(item.id, { x: item.x, y: item.y }));
      });
    node.call(d3.drag().on("start", (event, item) => { if (!event.active) simulation.alphaTarget(0.22).restart(); item.fx = item.x; item.fy = item.y; }).on("drag", (event, item) => { item.fx = event.x; item.fy = event.y; }).on("end", (event, item) => { if (!event.active) simulation.alphaTarget(0); item.fx = null; item.fy = null; }));
    node.on("click", (event, item) => {
      if (event.defaultPrevented) return;
      if (item.nodeKind === "property-value") return onSelectValue(item);
      if (item.nodeKind !== "entity") return;
      onInspectEntity(item);
    });
    node.on("dblclick", (event, item) => { event.stopPropagation(); if (item.nodeKind === "entity") onExploreEntity(item); });
    const zoom = d3.zoom().scaleExtent([0.08, 14]).on("zoom", (event) => viewport.attr("transform", event.transform));
    zoomRef.current = zoom;
    svg.call(zoom).on("dblclick.zoom", null);
    const focusNode = nodesById.get(locatedInstanceId || selectedInstanceId);
    const focusTimer = focusNode ? window.setTimeout(() => {
      const scale = locatedInstanceId ? 1.45 : 1.1;
      svg.transition().duration(700).ease(d3.easeCubicInOut).call(zoom.transform, d3.zoomIdentity.translate(width / 2 - focusNode.x * scale, height / 2 - focusNode.y * scale).scale(scale));
    }, 420) : null;
    return () => {
      if (focusTimer) window.clearTimeout(focusTimer);
      simulation.stop();
      svg.on(".zoom", null);
    };
  }, [completeGraph, highlightedGraphNodeIds, locatedInstanceId, objectTypeIndex, onExploreEntity, onInspectEntity, onSelectValue, selectedInstanceId, visibleGraph]);

  const zoomBy = (factor) => {
    if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().duration(220).call(zoomRef.current.scaleBy, factor);
  };
  const fitGraph = () => {
    if (!svgRef.current || !viewportRef.current || !zoomRef.current) return;
    const bounds = viewportRef.current.getBBox();
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const scale = Math.min(1.25, 0.85 / Math.max(bounds.width / width, bounds.height / height, 0.1));
    const transform = d3.zoomIdentity.translate(width / 2 - scale * (bounds.x + bounds.width / 2), height / 2 - scale * (bounds.y + bounds.height / 2)).scale(scale);
    d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, transform);
  };

  return (
    <div ref={containerRef} className="relative h-full min-h-[560px] w-full overflow-hidden bg-[#f4f6f8]">
      <style>{`
        @keyframes graph-located-pulse { 0%,100% { filter: drop-shadow(0 0 5px rgba(217,57,50,.45)); } 50% { filter: drop-shadow(0 0 18px rgba(217,57,50,.95)); } }
        .graph-node-located { animation:graph-located-pulse 1.7s ease-in-out infinite; }
      `}</style>
      <svg ref={svgRef} className="relative z-10 block h-full w-full touch-none" role="img" aria-label={isZh ? "可交互实例知识图谱" : "Interactive instance knowledge graph"}>
        <defs>
          <marker id="force-graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#aeb8c2" /></marker>
        </defs>
        <g ref={viewportRef} />
      </svg>
      <div className="absolute bottom-4 left-4 z-20 flex overflow-hidden rounded-md border border-[#d7dde3] bg-white/95 shadow-sm backdrop-blur">
        <button type="button" onClick={() => zoomBy(1.3)} title={isZh ? "放大" : "Zoom in"} className="h-9 w-9 border-r border-[#e1e5e9] text-lg text-[#4f5a65] hover:bg-[#f3f6f7]">+</button>
        <button type="button" onClick={() => zoomBy(0.77)} title={isZh ? "缩小" : "Zoom out"} className="h-9 w-9 border-r border-[#e1e5e9] text-lg text-[#4f5a65] hover:bg-[#f3f6f7]">−</button>
        <button type="button" onClick={fitGraph} title={isZh ? "适应画布" : "Fit graph"} className="h-9 px-3 text-xs font-medium text-[#4f5a65] hover:bg-[#f3f6f7]">{isZh ? "适应" : "Fit"}</button>
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 z-20 rounded border border-white/70 bg-white/80 px-3 py-2 text-[11px] text-[#68737e] shadow-sm backdrop-blur">{visibleGraph.nodes.length} {isZh ? "节点 · 单击选择，双击设为中心" : "nodes · Click to select, double-click to center"}</div>
    </div>
  );
};

const buildOntologyGraph = ({ objectTypes, links, visibleNodeIds }) => {
  const graph = new Graph({ multi: true, type: "directed" });
  const visibleObjects = objectTypes.filter((objectType) => visibleNodeIds.has(objectType.id));
  const radius = Math.max(8, visibleObjects.length * 2.8);

  visibleObjects.forEach((objectType, index) => {
    const angle = (index / Math.max(visibleObjects.length, 1)) * Math.PI * 2;
    graph.addNode(objectType.id, {
      label: objectType.name,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      size: 13,
      color: NODE_COLORS[index % NODE_COLORS.length],
      objectType,
    });
  });

  links
    .filter((link) => graph.hasNode(link.sourceObjectTypeId) && graph.hasNode(link.targetObjectTypeId))
    .forEach((link) => {
      graph.addEdgeWithKey(link.id, link.sourceObjectTypeId, link.targetObjectTypeId, {
        label: edgePredicate(link, objectTypes),
        size: 2.8,
        color: "#68717d",
        type: "arrow",
        link,
      });
    });

  graph.forEachNode((node) => {
    const degree = graph.degree(node);
    graph.setNodeAttribute(node, "size", 12 + Math.sqrt(Math.max(degree, 1)) * 4);
  });

  if (graph.order > 2 && graph.size > 0) {
    forceAtlas2.assign(graph, {
      iterations: Math.min(180, 60 + graph.order * 8),
      settings: {
        barnesHutOptimize: graph.order > 40,
        gravity: 1.2,
        scalingRatio: 8,
        slowDown: 4,
      },
    });
  }

  return graph;
};

const buildInstanceGraph = ({ nodes, instanceLinks, linkTypes, objectTypes, selectedInstanceId, expandedProperty }) => {
  const graph = new Graph({ multi: true, type: "directed" });
  const maxDepth = Math.max(1, ...nodes.map((node) => node.depth || 0));
  const isPropertyExpansion = Boolean(expandedProperty);

  nodes.forEach((node, index) => {
    const depth = node.depth || 0;
    const nodesAtDepth = nodes.filter((item) => (item.depth || 0) === depth);
    const depthIndex = nodesAtDepth.findIndex((item) => item.id === node.id);
    const angle = ((isPropertyExpansion ? index : depthIndex) / Math.max(isPropertyExpansion ? nodes.length : nodesAtDepth.length, 1)) * Math.PI * 2;
    const radius = isPropertyExpansion ? Math.max(24, nodes.length * 2.8) : depth === 0 ? 0 : 8 + depth * 12;
    graph.addNode(node.id, {
      label: node.displayName,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      size: depth === 0 ? 20 : 15 - Math.min(depth, 3),
      color: depth === 0 ? "#e3473c" : NODE_COLORS[(depth + index) % NODE_COLORS.length],
      instance: node,
      selectable: true,
      nodeKind: "instance",
    });
  });

  instanceLinks.forEach((link) => {
    if (!graph.hasNode(link.sourceInstanceId) || !graph.hasNode(link.targetInstanceId)) return;
    const linkType = linkTypes.find((item) => item.id === link.linkTypeId || item.apiName === link.linkTypeId);
    graph.addEdgeWithKey(link.id, link.sourceInstanceId, link.targetInstanceId, {
      label: linkType ? edgePredicate(linkType, objectTypes) : link.linkTypeId,
      size: 2.4,
      color: "#68717d",
      type: "arrow",
      link,
    });
  });

  if (expandedProperty) {
    const valueNodeId = `expanded-value:${expandedProperty.propertyName}:${expandedProperty.propertyValue}`;
    graph.addNode(valueNodeId, {
      label: expandedProperty.propertyValue,
      x: 0,
      y: 0,
      size: 18,
      color: "#2563a8",
      selectable: false,
      nodeKind: "expanded-property-value",
    });
    nodes.forEach((instance, instanceIndex) => {
      graph.addEdgeWithKey(`value-match:${valueNodeId}:${instance.id}`, valueNodeId, instance.id, {
        label: expandedProperty.propertyName,
        size: 2,
        color: "#2563a8",
        type: "arrow",
      });
      const instanceAngle = (instanceIndex / Math.max(nodes.length, 1)) * Math.PI * 2;
      const entityX = graph.getNodeAttribute(instance.id, "x");
      const entityY = graph.getNodeAttribute(instance.id, "y");
      const propertyEntries = Object.entries(instance.properties || {})
        .filter(([, value]) => value !== "" && value !== null && value !== undefined);
      propertyEntries.forEach(([name, value], propertyIndex) => {
        const spread = (propertyIndex - (propertyEntries.length - 1) / 2) * 0.14;
        const detailAngle = instanceAngle + spread;
        const detailNodeId = `expanded-property:${instance.id}:${name}`;
        graph.addNode(detailNodeId, {
          label: `${name}: ${String(value)}`,
          x: entityX + Math.cos(detailAngle) * 14,
          y: entityY + Math.sin(detailAngle) * 14,
          size: 7,
          color: "#e7a23b",
          selectable: false,
          nodeKind: "entity-property-value",
        });
        graph.addEdgeWithKey(`expanded-property-edge:${instance.id}:${name}`, instance.id, detailNodeId, {
          label: "属性值",
          size: 1,
          color: "#c6ccd3",
          type: "arrow",
        });
      });
    });
  } else {
    const selectedInstance = nodes.find((node) => node.id === selectedInstanceId);
    if (selectedInstance && graph.hasNode(selectedInstance.id)) {
    const propertyEntries = Object.entries(selectedInstance.properties || {})
      .filter(([, value]) => value !== "" && value !== null && value !== undefined);
    propertyEntries.forEach(([name, value], index) => {
      const angle = (index / Math.max(propertyEntries.length, 1)) * Math.PI * 2;
      const attributeNodeId = `attribute:${selectedInstance.id}:${name}`;
      const valueNodeId = `value:${selectedInstance.id}:${name}`;
      graph.addNode(attributeNodeId, {
        label: name,
        x: Math.cos(angle) * 17,
        y: Math.sin(angle) * 17,
        size: 10,
        color: "#e7a23b",
        selectable: false,
        nodeKind: "attribute",
        propertyName: name,
      });
      graph.addNode(valueNodeId, {
        label: String(value),
        x: Math.cos(angle) * 27,
        y: Math.sin(angle) * 27,
        size: 10,
        color: "#68717d",
        selectable: true,
        nodeKind: "property-value",
        propertyName: name,
        propertyValue: String(value),
        ownerInstanceId: selectedInstance.id,
      });
      graph.addEdgeWithKey(`attribute-edge:${selectedInstance.id}:${name}`, selectedInstance.id, attributeNodeId, {
        label: "属性",
        size: 1.2,
        color: "#c6ccd3",
        type: "arrow",
      });
      graph.addEdgeWithKey(`value-edge:${selectedInstance.id}:${name}`, attributeNodeId, valueNodeId, {
        label: "值",
        size: 1,
        color: "#d6dbe0",
        type: "arrow",
      });
    });
    }
  }

  if (graph.order > 2 && graph.size > 0 && maxDepth > 1) {
    forceAtlas2.assign(graph, {
      iterations: Math.min(120, 40 + graph.order * 6),
      settings: { gravity: 1.8, scalingRatio: 10, slowDown: 5 },
    });
  }
  return graph;
};

const OntologyGraphPage = ({ isZh, objectTypes, properties, links }) => {
  const [graphMode, setGraphMode] = useState("instances");
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hopDepth, setHopDepth] = useState(1);
  const [maxDisplayCount, setMaxDisplayCount] = useState(20);
  const [instanceQuery, setInstanceQuery] = useState("Y2-225M");
  const [instanceObjectTypeId, setInstanceObjectTypeId] = useState("");
  const [localOntologyData, setLocalOntologyData] = useState({ nodes: [], links: [] });
  const [instanceGraphData, setInstanceGraphData] = useState({ nodes: [], links: [] });
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState(null);
  const [locatedInstanceId, setLocatedInstanceId] = useState(null);
  const [expandedProperty, setExpandedProperty] = useState(null);
  const [instanceLoading, setInstanceLoading] = useState(false);
  const [instanceError, setInstanceError] = useState("");
  const defaultInstanceLoadedRef = useRef(false);
  const hasInstanceDatasource = objectTypes.some((objectType) => objectType.primaryDatasourceId);

  const filteredLinks = useMemo(() => links, [links]);

  const visibleNodeIds = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    let matched = new Set(
      objectTypes
        .filter((objectType) => `${objectType.name} ${objectType.apiName} ${objectType.description || ""}`.toLowerCase().includes(normalizedQuery))
        .map((objectType) => objectType.id),
    );
    if (normalizedQuery) {
      filteredLinks.forEach((link) => {
        if (matched.has(link.sourceObjectTypeId) || matched.has(link.targetObjectTypeId) || String(link.name || "").toLowerCase().includes(normalizedQuery)) {
          matched.add(link.sourceObjectTypeId);
          matched.add(link.targetObjectTypeId);
        }
      });
    }
    if (!normalizedQuery) matched = new Set(objectTypes.map((objectType) => objectType.id));
    return matched;
  }, [filteredLinks, objectTypes, query]);

  const highlightedNodeIds = useMemo(
    () => collectHopNodes(selectedNodeId, filteredLinks, hopDepth),
    [filteredLinks, hopDepth, selectedNodeId],
  );

  const typeGraph = useMemo(
    () => buildOntologyGraph({ objectTypes, links, visibleNodeIds }),
    [links, objectTypes, visibleNodeIds],
  );

  const graph = typeGraph;

  const refreshLocalOntology = async () => {
    const data = await loadLocalOntologyData({ objectTypes, properties, links });
    setLocalOntologyData(data);
    return data;
  };

  const searchInstances = async () => {
    setInstanceLoading(true);
    setInstanceError("");
    try {
      if (!hasInstanceDatasource) {
        setInstanceGraphData({ nodes: [], links: [] });
        setLocatedInstanceId(null);
        setInstanceError(isZh ? "当前对象尚未绑定实例数据源，请先在对象类型中配置主数据源。" : "No instance data source is configured. Bind a primary data source to an object type first.");
        return;
      }
      const data = await refreshLocalOntology();
      const normalizedQuery = instanceQuery.trim().toLowerCase();
      const results = data.nodes.map((node) => {
        if (instanceObjectTypeId && node.objectTypeId !== instanceObjectTypeId) return false;
        if (!normalizedQuery) return { node, score: 0 };
        const displayName = String(node.displayName || "").toLowerCase();
        const primaryKey = String(node.primaryKey || "").toLowerCase();
        const propertyValues = Object.values(node.properties || {}).map((value) => String(value).toLowerCase());
        let score = -1;
        if (displayName === normalizedQuery || primaryKey === normalizedQuery) score = 4;
        else if (displayName.startsWith(normalizedQuery) || primaryKey.startsWith(normalizedQuery)) score = 3;
        else if (displayName.includes(normalizedQuery) || primaryKey.includes(normalizedQuery)) score = 2;
        else if (propertyValues.some((value) => value.includes(normalizedQuery))) score = 1;
        return score >= 0 ? { node, score } : false;
      }).filter(Boolean).sort((left, right) => right.score - left.score).map(({ node }) => node);
      if (normalizedQuery && results.length) {
        setLocatedInstanceId(results[0].id);
        await exploreInstance(results[0]);
      } else {
        setLocatedInstanceId(null);
        setInstanceGraphData({ nodes: [], links: [] });
        setInstanceError(normalizedQuery
          ? (isZh ? "未找到匹配的实体，请检查关键词或实体类型。" : "No matching entity was found. Check the query or entity type.")
          : (isZh ? "请输入实体名称、业务主键或属性值。" : "Enter an entity name, business key, or property value."));
      }
    } catch (error) {
      setInstanceError(error.message);
    } finally {
      setInstanceLoading(false);
    }
  };

  const exploreInstance = async (instance) => {
    setSelectedInstanceId(instance.id);
    setSelectedGraphNodeId(instance.id);
    setExpandedProperty(null);
    setInstanceLoading(true);
    setInstanceError("");
    try {
      const data = localOntologyData.nodes.length ? localOntologyData : await refreshLocalOntology();
      setInstanceGraphData(traverseLocalOntology({ data, startInstanceIds: [instance.id], maxHops: 3, maxPerObject: maxDisplayCount }));
    } catch (error) {
      setInstanceError(error.message);
      setInstanceGraphData({ nodes: [], links: [] });
    } finally {
      setInstanceLoading(false);
    }
  };

  const inspectInstance = (instance) => {
    setSelectedInstanceId(instance.id);
    setSelectedGraphNodeId(instance.id);
    setExpandedProperty(null);
  };

  useEffect(() => {
    const productType = objectTypes.find((objectType) => objectType.name === "产品" || String(objectType.apiName || "").toLowerCase() === "product");
    const productPropertiesReady = productType && properties.some((property) => property.objectTypeId === productType.id);
    const productLinksReady = productType && links.some((link) => link.sourceObjectTypeId === productType.id || link.targetObjectTypeId === productType.id);
    if (!productType || !productPropertiesReady || !productLinksReady || defaultInstanceLoadedRef.current || !hasInstanceDatasource) return;
    defaultInstanceLoadedRef.current = true;
    setInstanceObjectTypeId(productType.id);
    setInstanceLoading(true);
    setInstanceError("");
    const loadDefaultInstance = async () => {
      try {
        const data = await refreshLocalOntology();
        const normalizedQuery = "y2-225m";
        const instance = data.nodes.find((node) => node.objectTypeId === productType.id && (
          String(node.displayName || "").toLowerCase().includes(normalizedQuery)
          || String(node.primaryKey || "").toLowerCase().includes(normalizedQuery)
          || Object.values(node.properties || {}).some((value) => String(value).toLowerCase().includes(normalizedQuery))
        ));
        if (!instance) {
          setInstanceError(isZh ? "未找到默认产品：三相异步电动机 Y2-225M。" : "The default product Y2-225M was not found.");
          return;
        }
        setLocatedInstanceId(instance.id);
        setSelectedInstanceId(instance.id);
        setSelectedGraphNodeId(instance.id);
        setExpandedProperty(null);
        setInstanceGraphData(traverseLocalOntology({ data, startInstanceIds: [instance.id], maxHops: 3, maxPerObject: maxDisplayCount }));
      } catch (error) {
        setInstanceError(error.message);
      } finally {
        setInstanceLoading(false);
      }
    };
    loadDefaultInstance();
  }, [hasInstanceDatasource, links, objectTypes, properties]);

  const expandPropertyValue = async (node) => {
    setSelectedGraphNodeId(`value:${node.propertyName}:${node.propertyValue}`);
    setInstanceLoading(true);
    setInstanceError("");
    try {
      const data = await refreshLocalOntology();
      const startInstanceIds = data.nodes
        .filter((instance) => String(instance.properties?.[node.propertyName] ?? "") === node.propertyValue)
        .map((instance) => instance.id);
      if (!startInstanceIds.length) {
        setInstanceGraphData({ nodes: [], links: [] });
        return;
      }
      setExpandedProperty({ propertyName: node.propertyName, propertyValue: node.propertyValue });
      setSelectedInstanceId(null);
      setInstanceGraphData(traverseLocalOntology({ data, startInstanceIds, maxHops: 3, maxPerObject: maxDisplayCount }));
    } catch (error) {
      setInstanceError(error.message);
    } finally {
      setInstanceLoading(false);
    }
  };

  useEffect(() => {
    if (graphMode !== "instances" || !selectedInstanceId) return;
    const selectedInstance = instanceGraphData.nodes.find((node) => node.id === selectedInstanceId);
    if (selectedInstance) exploreInstance(selectedInstance);
  }, [maxDisplayCount]);

  const selectedObject = objectTypes.find((objectType) => objectType.id === selectedNodeId) || null;
  const selectedInstance = instanceGraphData.nodes.find((node) => node.id === selectedInstanceId) || null;
  const visibleObjectCount = graphMode === "instances" ? instanceGraphData.nodes.length : graph.order;
  const visibleLinkCount = graphMode === "instances" ? instanceGraphData.links.length : graph.size;
  const selectedProperties = selectedObject ? properties.filter((property) => property.objectTypeId === selectedObject.id) : [];
  const selectedLinks = selectedObject ? links.filter((link) => link.sourceObjectTypeId === selectedObject.id || link.targetObjectTypeId === selectedObject.id) : [];
  const propertyName = (propertyId) => properties.find((property) => property.id === propertyId)?.name || propertyId || "-";
  const objectName = (objectTypeId) => objectTypes.find((objectType) => objectType.id === objectTypeId)?.name || objectTypeId || "-";

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f7f8fa]">
      <header className="border-b border-[#e2e5e9] bg-white px-7 py-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-xl font-semibold text-[#242a32]">{isZh ? "本体图谱" : "Ontology graph"}</h1>
            <p className="mt-1 text-sm text-[#727b87]">{isZh ? "基于对象类型、属性和可执行关系生成的结构图谱。" : "A structural graph generated from object types, properties, and executable links."}</p>
          </div>
          <div className="flex gap-5 text-sm text-[#59626e]">
            <span><strong className="mr-1 text-[#252b33]">{visibleObjectCount}</strong>{isZh ? "对象" : "objects"}</span>
            <span><strong className="mr-1 text-[#252b33]">{visibleLinkCount}</strong>{isZh ? "关系" : "links"}</span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex rounded-md border border-[#d9dde3] bg-white p-1">
            <button type="button" onClick={() => setGraphMode("types")} className={`h-8 px-3 text-xs font-medium ${graphMode === "types" ? "bg-[#252b33] text-white" : "text-[#616a76]"}`}>{isZh ? "类型图" : "Types"}</button>
            <button type="button" onClick={() => setGraphMode("instances")} className={`h-8 px-3 text-xs font-medium ${graphMode === "instances" ? "bg-[#252b33] text-white" : "text-[#616a76]"}`}>{isZh ? "实例图" : "Instances"}</button>
          </div>
          {graphMode === "instances" && (
            <select value={instanceObjectTypeId} onChange={(event) => setInstanceObjectTypeId(event.target.value)} aria-label={isZh ? "实体类型" : "Entity type"} className="h-10 min-w-[150px] rounded-md border border-[#d9dde3] bg-white px-3 text-sm text-[#434b56] outline-none focus:border-[#e3473c]">
              <option value="">{isZh ? "全部实体类型" : "All entity types"}</option>
              {objectTypes.map((objectType) => <option key={objectType.id} value={objectType.id}>{objectType.name}</option>)}
            </select>
          )}
          <div className="relative min-w-[260px] flex-1 max-w-[440px]">
            {graphMode === "types" ? (
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isZh ? "搜索对象、API Name 或关系" : "Search objects, API names, or links"} className="h-10 w-full rounded-md border border-[#d9dde3] bg-[#fbfcfd] pl-4 pr-10 text-sm outline-none focus:border-[#e3473c] focus:bg-white" />
            ) : (
              <input value={instanceQuery} onChange={(event) => setInstanceQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && searchInstances()} placeholder={isZh ? "搜索实体名称、业务主键或属性值" : "Search entity name, key, or property value"} className="h-10 w-full rounded-md border border-[#d9dde3] bg-[#fbfcfd] pl-4 pr-20 text-sm outline-none focus:border-[#e3473c] focus:bg-white" />
            )}
            {query && <button type="button" onClick={() => setQuery("")} title={isZh ? "清除搜索" : "Clear search"} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#89919b]">×</button>}
            {graphMode === "instances" && <button type="button" onClick={searchInstances} className="absolute right-1 top-1 h-8 px-3 text-xs font-medium text-[#e3473c]">{isZh ? "查询" : "Search"}</button>}
          </div>
          <div className="flex items-center rounded-md border border-[#d9dde3] bg-white p-1">
            {[1, 2, 3].map((depth) => (
              <button key={depth} type="button" onClick={() => setHopDepth(depth)} className={`h-8 min-w-10 px-2 text-xs font-medium ${hopDepth === depth ? "bg-[#252b33] text-white" : "text-[#616a76] hover:bg-[#f3f4f6]"}`}>{depth}{isZh ? "跳" : " hop"}</button>
            ))}
          </div>
          {graphMode === "instances" && (
            <label className="flex h-10 items-center gap-2 rounded-md border border-[#d9dde3] bg-white px-3 text-xs font-medium text-[#616a76]">
              <span>{isZh ? "每类/属性上限" : "Per type/property"}</span>
              <input type="number" min="1" max="100" value={maxDisplayCount} onChange={(event) => setMaxDisplayCount(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} className="h-7 w-14 rounded border border-[#d9dde3] px-2 text-center text-xs text-[#343b45] outline-none focus:border-[#e3473c]" />
            </label>
          )}
        </div>
        {graphMode === "instances" && instanceError && <p className="mt-2 text-xs text-[#d94338]">{instanceError}</p>}
      </header>

      <section className="grid min-h-0 flex-1 grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-h-0 border-r border-[#e0e4e8] bg-[#f4f6f8]">
          {graphMode === "instances" && instanceGraphData.nodes.length > 0 ? (
            <BasicKnowledgeGraph
              data={instanceGraphData}
              selectedInstanceId={selectedInstanceId}
              locatedInstanceId={locatedInstanceId}
              expandedProperty={expandedProperty}
              objectTypes={objectTypes}
              hopDepth={hopDepth}
              maxDisplayCount={maxDisplayCount}
              onInspectEntity={inspectInstance}
              onExploreEntity={(instance) => {
                setLocatedInstanceId(null);
                exploreInstance(instance);
              }}
              onSelectValue={expandPropertyValue}
              isZh={isZh}
            />
          ) : graphMode === "types" && graph.order > 0 ? (
            <>
              <TypeGraphRenderer
                graph={graph}
                selectedNodeId={selectedNodeId}
                highlightedNodeIds={highlightedNodeIds}
                onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
                isZh={isZh}
              />
              <div className="absolute bottom-4 left-4 z-10 flex overflow-hidden rounded-md shadow-sm">
                <button type="button" onClick={() => setSelectedNodeId((current) => current || (graph.order > 0 ? graph.nodes()[0] : null))} className="flex h-9 w-9 items-center justify-center border border-[#d8dde4] bg-white text-lg text-[#4f5864] transition hover:border-[#aeb6c1] hover:bg-[#f7f8fa]">+</button>
                <button type="button" onClick={() => setSelectedNodeId(null)} className="flex h-9 w-9 items-center justify-center border border-l-0 border-[#d8dde4] bg-white text-lg text-[#4f5864] transition hover:border-[#aeb6c1] hover:bg-[#f7f8fa]">−</button>
                <button type="button" onClick={() => setSelectedNodeId(null)} className="flex h-9 w-auto items-center justify-center border border-l-0 border-[#d8dde4] bg-white px-3 text-xs font-medium text-[#4f5864] transition hover:border-[#aeb6c1] hover:bg-[#f7f8fa]">{isZh ? "适应" : "Fit"}</button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-8 text-center text-sm text-[#7d8590]">{instanceLoading ? (isZh ? "正在查询实例图谱..." : "Loading instance graph...") : graphMode === "instances" ? (!hasInstanceDatasource ? (isZh ? "暂无实例数据。请先在对象类型中绑定主数据源。" : "No instance data is available. Bind a primary data source to an object type first.") : (isZh ? "搜索实体后将直接展示关联图谱。" : "Search for an entity to display its graph.")) : (isZh ? "没有符合条件的对象和关系。" : "No matching objects or relationships.")}</div>
          )}
          <div className="pointer-events-none absolute left-4 top-4 z-30 border border-[#dce1e6] bg-white/95 px-3 py-2 text-xs text-[#68717d] shadow-sm">
            {graphMode === "instances" ? (
              <><span className="mr-4"><i className="mr-1 inline-block h-2.5 w-2.5 bg-[#e3473c]" />{isZh ? "实体" : "Entity"}</span><span><i className="mr-1 inline-block h-[2px] w-5 bg-[#9aa3ad] align-middle" />{isZh ? "数据关系" : "Data link"}</span></>
            ) : (
              <><span className="mr-4"><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#e3473c]" />{isZh ? "对象类型" : "Object type"}</span><span><i className="mr-1 inline-block h-[2px] w-5 bg-[#68717d] align-middle" />{isZh ? "关系" : "Relationship"}</span></>
            )}
          </div>
        </div>

        <aside className="hidden min-h-0 overflow-y-auto bg-white p-5 min-[1100px]:block">
          {graphMode === "instances" && selectedInstance ? (
            <>
              <div className="border-b border-[#e7eaed] pb-5"><h2 className="text-lg font-semibold">{selectedInstance.displayName}</h2><code className="text-xs text-[#7a838f]">{selectedInstance.primaryKey}</code><p className="mt-2 text-xs text-[#68717d]">{objectName(selectedInstance.objectTypeId)} · {selectedInstance.depth || 0}{isZh ? " 跳" : " hops"}</p></div>
              <div className="py-5"><h3 className="text-xs font-semibold uppercase text-[#7b8490]">{isZh ? "实例属性" : "Instance properties"}</h3><div className="mt-3 space-y-2">{Object.entries(selectedInstance.properties || {}).map(([key, value]) => <div key={key} className="flex items-start justify-between gap-3 border-b border-[#f0f1f3] py-2 text-sm"><span className="text-[#68717d]">{key}</span><span className="max-w-[180px] break-words text-right font-medium">{String(value)}</span></div>)}</div></div>
            </>
          ) : selectedObject ? (
            <>
              <div className="border-b border-[#e7eaed] pb-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#fff0ee] font-semibold text-[#e3473c]">{selectedObject.name.slice(0, 1)}</span>
                  <div className="min-w-0"><h2 className="truncate text-lg font-semibold">{selectedObject.name}</h2><code className="text-xs text-[#7a838f]">{selectedObject.apiName}</code></div>
                </div>
                {selectedObject.description && <p className="mt-3 text-sm leading-6 text-[#68717c]">{selectedObject.description}</p>}
              </div>
              <div className="py-5">
                <h3 className="text-xs font-semibold uppercase text-[#7b8490]">{isZh ? `属性 · ${selectedProperties.length}` : `Properties · ${selectedProperties.length}`}</h3>
                <div className="mt-3 space-y-2">
                  {selectedProperties.map((property) => <div key={property.id} className="flex items-center justify-between gap-3 border-b border-[#f0f1f3] py-2 text-sm"><span className="truncate font-medium">{property.name}{property.primaryKey && <em className="ml-2 rounded bg-[#fff0ee] px-1.5 py-0.5 text-[10px] not-italic text-[#d94338]">PK</em>}</span><code className="shrink-0 text-xs text-[#818995]">{property.dataType}</code></div>)}
                </div>
              </div>
              <div className="border-t border-[#e7eaed] pt-5">
                <h3 className="text-xs font-semibold uppercase text-[#7b8490]">{isZh ? `关系 · ${selectedLinks.length}` : `Links · ${selectedLinks.length}`}</h3>
                <div className="mt-3 space-y-3">
                  {selectedLinks.map((link) => <div key={link.id} className="rounded-md border border-[#e1e5e9] p-3"><div className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{link.name}</span><span className="shrink-0 text-[10px] text-[#8a929d]">{link.cardinality}</span></div><p className="mt-2 text-xs text-[#68717d]">{objectName(link.sourceObjectTypeId)} → {objectName(link.targetObjectTypeId)}</p><p className="mt-1 truncate text-[11px] text-[#9299a2]" title={`${propertyName(link.mapping?.foreignKeyPropertyId)} → ${propertyName(link.mapping?.primaryKeyPropertyId)}`}>{propertyName(link.mapping?.foreignKeyPropertyId)} → {propertyName(link.mapping?.primaryKeyPropertyId)}</p></div>)}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#dce1e6] text-[#7b8490]">◎</div><h2 className="text-sm font-semibold text-[#414852]">{isZh ? "选择一个对象" : "Select an object"}</h2><p className="mt-2 max-w-[220px] text-xs leading-5 text-[#8a929d]">{isZh ? "点击图谱节点查看属性、主键、关系和字段映射。" : "Click a graph node to inspect properties, keys, links, and mappings."}</p></div>
          )}
        </aside>
      </section>
    </main>
  );
};

const SafeOntologyGraphPage = (props) => (
  <GraphErrorBoundary isZh={props.isZh}>
    <OntologyGraphPage {...props} />
  </GraphErrorBoundary>
);

export default SafeOntologyGraphPage;
