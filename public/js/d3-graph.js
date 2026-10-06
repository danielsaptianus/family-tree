/**
 * D3.js Network Graph Renderer (Force-Directed)
 * Visualizes non-linear relationships, partnerships, and descent links
 */

export class D3GraphRenderer {
  constructor(svgElement, options = {}) {
    this.svg = d3.select(svgElement);
    this.options = Object.assign({
      onNodeClick: () => {},
    }, options);

    this.container = null;
    this.zoom = null;
    this.simulation = null;
    this.init();
  }

  init() {
    this.svg.selectAll('*').remove();

    const defs = this.svg.append('defs');

    // Arrow marker for parent-child links
    defs.append('marker')
      .attr('id', 'graph-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'rgba(99, 102, 241, 0.7)');

    this.container = this.svg.append('g').attr('class', 'graph-container');

    this.zoom = d3.zoom()
      .scaleExtent([0.15, 3])
      .on('zoom', (event) => {
        this.container.attr('transform', event.transform);
      });

    this.svg.call(this.zoom).on('dblclick.zoom', null);
  }

  render(graphData) {
    if (!graphData || !graphData.nodes) return;

    if (this.simulation) {
      this.simulation.stop();
    }

    const parent = this.svg.node().parentElement;
    const width = parent.clientWidth;
    const height = parent.clientHeight;

    // Clone data to avoid mutating original
    const nodes = graphData.nodes.map(d => Object.assign({}, d));
    const links = graphData.links.map(d => Object.assign({}, d));

    // Force Simulation Setup
    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(d => d.type === 'partnership' ? 90 : 140))
      .force('charge', d3.forceManyBody().strength(-550))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(48));

    // Links Rendering
    const link = this.container.selectAll('.graph-link')
      .data(links)
      .join('line')
      .attr('class', d => `graph-link ${d.type === 'partnership' ? 'partnership-link' : 'tree-link'}`)
      .attr('marker-end', d => d.type === 'partnership' ? null : 'url(#graph-arrow)');

    // Nodes Rendering
    const node = this.container.selectAll('.graph-node')
      .data(nodes)
      .join('g')
      .attr('class', 'graph-node node-card')
      .call(this.drag(this.simulation))
      .on('click', (event, d) => {
        event.stopPropagation();
        this.selectNode(d);
        this.options.onNodeClick(d);
      });

    // Node Circle
    node.append('circle')
      .attr('r', 24)
      .attr('fill', d => d.gender === 'female' ? '#1f1325' : '#0f1f2e')
      .attr('stroke', d => d.gender === 'female' ? '#f43f5e' : '#06b6d4')
      .attr('stroke-width', 2.5)
      .attr('filter', 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))');

    // Initials Text
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#ffffff')
      .attr('font-size', '13px')
      .attr('font-weight', '700')
      .text(d => (d.firstName ? d.firstName.charAt(0).toUpperCase() : '?'));

    // Label below node
    node.append('text')
      .attr('class', 'node-name')
      .attr('text-anchor', 'middle')
      .attr('y', 38)
      .attr('font-size', '12px')
      .text(d => `${d.firstName || ''} ${d.lastName ? d.lastName.charAt(0) + '.' : ''}`.trim());

    // Simulation Tick
    this.simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Fit view after small stabilization
    setTimeout(() => {
      this.fitToScreen();
    }, 450);
  }

  drag(simulation) {
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }

  selectNode(d) {
    this.container.selectAll('.graph-node circle')
      .attr('stroke-width', 2.5);

    this.container.selectAll('.graph-node')
      .filter(node => node.id === d.id)
      .select('circle')
      .attr('stroke-width', 4.5);
  }

  fitToScreen() {
    const bounds = this.container.node().getBBox();
    const parent = this.svg.node().parentElement;
    const fullWidth = parent.clientWidth;
    const fullHeight = parent.clientHeight;

    if (bounds.width === 0 || bounds.height === 0) return;

    const midX = bounds.x + bounds.width / 2;
    const midY = bounds.y + bounds.height / 2;

    const scale = Math.min(
      (fullWidth * 0.8) / bounds.width,
      (fullHeight * 0.8) / bounds.height,
      1.1
    );

    const translate = [
      fullWidth / 2 - scale * midX,
      fullHeight / 2 - scale * midY
    ];

    this.svg.transition().duration(600).call(
      this.zoom.transform,
      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );
  }

  zoomIn() {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, 1.3);
  }

  zoomOut() {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, 0.77);
  }

  resetZoom() {
    this.fitToScreen();
  }
}
