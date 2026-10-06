/**
 * D3.js Hierarchy Tree Renderer
 * Implements interactive collapsible tree with rich card aesthetics
 */

export class D3HierarchyRenderer {
  constructor(svgElement, options = {}) {
    this.svg = d3.select(svgElement);
    this.options = Object.assign({
      cardWidth: 200,
      cardHeight: 84,
      nodeSpacingX: 240,
      nodeSpacingY: 130,
      onNodeClick: () => {},
    }, options);

    this.container = null;
    this.zoom = null;
    this.root = null;
    this.init();
  }

  init() {
    this.svg.selectAll('*').remove();

    // Define gradients and filters
    const defs = this.svg.append('defs');

    // Male gradient
    const maleGrad = defs.append('linearGradient')
      .attr('id', 'male-grad')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    maleGrad.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4');
    maleGrad.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6');

    // Female gradient
    const femaleGrad = defs.append('linearGradient')
      .attr('id', 'female-grad')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    femaleGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e');
    femaleGrad.append('stop').attr('offset', '100%').attr('stop-color', '#d946ef');

    // Glow filter
    const filter = defs.append('filter')
      .attr('id', 'card-glow')
      .attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feDropShadow')
      .attr('dx', '0').attr('dy', '6')
      .attr('stdDeviation', '8')
      .attr('flood-color', '#000000')
      .attr('flood-opacity', '0.5');

    // Container for zooming
    this.container = this.svg.append('g').attr('class', 'tree-container');

    // Zoom behavior
    this.zoom = d3.zoom()
      .scaleExtent([0.15, 3])
      .on('zoom', (event) => {
        this.container.attr('transform', event.transform);
      });

    this.svg.call(this.zoom).on('dblclick.zoom', null);
  }

  render(data) {
    if (!data) return;

    this.rawTreeData = data;
    this.root = d3.hierarchy(data, d => d.children);
    this.root.x0 = 0;
    this.root.y0 = 0;

    // Tree layout
    this.treeLayout = d3.tree()
      .nodeSize([this.options.nodeSpacingX, this.options.nodeSpacingY]);

    this.update(this.root);
    this.fitToScreen();
  }

  update(source) {
    const duration = 400;
    const treeData = this.treeLayout(this.root);
    const nodes = treeData.descendants();
    const links = treeData.links();

    const { cardWidth, cardHeight } = this.options;

    // ==========================================
    // LINKS
    // ==========================================
    const link = this.container.selectAll('path.tree-link')
      .data(links, d => d.target.data.id);

    // Enter Links
    const linkEnter = link.enter()
      .insert('path', 'g')
      .attr('class', 'tree-link')
      .attr('d', d => {
        const o = { x: source.x0 || 0, y: source.y0 || 0 };
        return this.diagonal({ source: o, target: o });
      });

    // Update Links
    link.merge(linkEnter).transition().duration(duration)
      .attr('d', d => this.diagonal(d));

    // Exit Links
    link.exit().transition().duration(duration)
      .attr('d', d => {
        const o = { x: source.x, y: source.y };
        return this.diagonal({ source: o, target: o });
      })
      .remove();

    // ==========================================
    // NODES
    // ==========================================
    const node = this.container.selectAll('g.node-group')
      .data(nodes, d => d.data.id);

    // Enter Nodes
    const nodeEnter = node.enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('transform', d => `translate(${source.x0 || 0},${source.y0 || 0})`);

    // Outer Card
    const card = nodeEnter.append('g')
      .attr('class', 'node-card')
      .on('click', (event, d) => {
        event.stopPropagation();
        this.selectNode(d);
        this.options.onNodeClick(d.data);
      });

    // Card background
    card.append('rect')
      .attr('class', 'node-bg')
      .attr('x', -cardWidth / 2)
      .attr('y', -cardHeight / 2)
      .attr('width', cardWidth)
      .attr('height', cardHeight)
      .attr('rx', 12)
      .attr('ry', 12);

    // Gender Left Indicator Strip
    card.append('rect')
      .attr('class', d => `gender-indicator ${d.data.gender || 'male'}`)
      .attr('x', -cardWidth / 2 + 3)
      .attr('y', -cardHeight / 2 + 10)
      .attr('width', 4.5)
      .attr('height', cardHeight - 20)
      .attr('rx', 2);

    // Avatar Circle
    const avatarGroup = card.append('g')
      .attr('transform', `translate(${-cardWidth / 2 + 28}, 0)`);

    avatarGroup.append('circle')
      .attr('r', 18)
      .attr('fill', d => d.data.gender === 'female' ? 'url(#female-grad)' : 'url(#male-grad)')
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-width', 1.5);

    avatarGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#ffffff')
      .attr('font-size', '12px')
      .attr('font-weight', '700')
      .text(d => (d.data.firstName ? d.data.firstName.charAt(0).toUpperCase() : '?'));

    // Person Name
    card.append('text')
      .attr('class', 'node-name')
      .attr('x', -cardWidth / 2 + 56)
      .attr('y', -10)
      .text(d => {
        const full = `${d.data.firstName || ''} ${d.data.lastName || ''}`.trim();
        return full.length > 15 ? full.substring(0, 13) + '...' : full;
      });

    // Sub-text: Years & Status
    card.append('text')
      .attr('class', 'node-dates')
      .attr('x', -cardWidth / 2 + 56)
      .attr('y', 10)
      .text(d => {
        const bYear = d.data.birthDate ? new Date(d.data.birthDate).getFullYear() : '?';
        const dYear = d.data.deathDate ? new Date(d.data.deathDate).getFullYear() : (d.data.isLiving ? 'Sekarang' : '?');
        return `${bYear} — ${dYear}`;
      });

    // Partner badge if exists
    card.each(function(d) {
      if (d.data.partners && d.data.partners.length > 0) {
        const partner = d.data.partners[0];
        const g = d3.select(this);
        const pBadge = g.append('g')
          .attr('transform', `translate(${-cardWidth / 2 + 56}, 26)`);

        pBadge.append('rect')
          .attr('fill', 'rgba(244, 63, 94, 0.15)')
          .attr('stroke', 'rgba(244, 63, 94, 0.3)')
          .attr('rx', 4)
          .attr('width', cardWidth - 68)
          .attr('height', 16);

        pBadge.append('text')
          .attr('x', 6)
          .attr('y', 11)
          .attr('fill', '#fb7185')
          .attr('font-size', '9.5px')
          .attr('font-weight', '600')
          .text(`💍 ${partner.firstName || ''} ${partner.lastName || ''}`.trim());
      }
    });

    // Collapse / Expand Toggle Button (if has children)
    const toggle = nodeEnter.append('g')
      .attr('class', 'expand-toggle')
      .attr('transform', `translate(0, ${cardHeight / 2})`)
      .on('click', (event, d) => {
        event.stopPropagation();
        this.toggleChildren(d);
      });

    toggle.append('circle')
      .attr('r', 9);

    toggle.append('text')
      .text(d => (d.children || d._children ? (d.children ? '−' : '+') : ''));

    // UPDATE Node Positions
    const nodeUpdate = node.merge(nodeEnter).transition().duration(duration)
      .attr('transform', d => `translate(${d.x},${d.y})`);

    nodeUpdate.select('.expand-toggle')
      .style('display', d => (d.children || d._children ? 'block' : 'none'))
      .select('text')
      .text(d => (d.children ? '−' : '+'));

    // EXIT Nodes
    const nodeExit = node.exit().transition().duration(duration)
      .attr('transform', d => `translate(${source.x},${source.y})`)
      .remove();

    nodeExit.select('.node-card').style('opacity', 0);

    // Stash current positions for transitions
    nodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  // Smooth cubic bezier connector
  diagonal(d) {
    const { source, target } = d;
    const cardH = this.options.cardHeight;
    const sy = source.y + cardH / 2;
    const ty = target.y - cardH / 2;
    return `M ${source.x} ${sy}
            C ${source.x} ${(sy + ty) / 2},
              ${target.x} ${(sy + ty) / 2},
              ${target.x} ${ty}`;
  }

  toggleChildren(d) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else {
      d.children = d._children;
      d._children = null;
    }
    this.update(d);
  }

  selectNode(d) {
    this.container.selectAll('.node-card').classed('selected', false);
    this.container.selectAll('.node-group')
      .filter(node => node.data.id === d.data.id)
      .select('.node-card')
      .classed('selected', true);
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
      (fullWidth * 0.85) / bounds.width,
      (fullHeight * 0.85) / bounds.height,
      1.2
    );

    const translate = [
      fullWidth / 2 - scale * midX,
      fullHeight * 0.25 - scale * (bounds.y)
    ];

    this.svg.transition().duration(750).call(
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
