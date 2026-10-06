/**
 * D3.js Hierarchy Tree Renderer
 * Implements interactive collapsible tree with rich card aesthetics
 */

export class D3HierarchyRenderer {
  constructor(svgElement, options = {}) {
    this.svg = d3.select(svgElement);
    this.options = Object.assign({
      cardWidth: 230,
      cardHeight: 90,
      nodeSpacingX: 270,
      nodeSpacingY: 150,
      onNodeClick: () => {},
    }, options);

    this.container = null;
    this.zoom = null;
    this.root = null;
    this.init();
  }

  init() {
    this.svg.selectAll('*').remove();

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

    // Neutral / Unknown gradient
    const neutralGrad = defs.append('linearGradient')
      .attr('id', 'neutral-grad')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    neutralGrad.append('stop').attr('offset', '0%').attr('stop-color', '#6366f1');
    neutralGrad.append('stop').attr('offset', '100%').attr('stop-color', '#8b5cf6');

    this.container = this.svg.append('g').attr('class', 'tree-container');

    this.zoom = d3.zoom()
      .scaleExtent([0.15, 3])
      .on('zoom', (event) => {
        this.container.attr('transform', event.transform);
      });

    this.svg.call(this.zoom).on('dblclick.zoom', null);
  }

  getPersonName(d) {
    if (!d) return 'Tanpa Nama';
    if (d.name) return d.name;
    const full = `${d.firstName || ''} ${d.lastName || ''}`.trim();
    return full || 'Tanpa Nama';
  }

  getGender(d) {
    if (!d || !d.gender) return 'unknown';
    return d.gender.toLowerCase();
  }

  getAvatarGradient(gender) {
    if (gender === 'female') return 'url(#female-grad)';
    if (gender === 'male') return 'url(#male-grad)';
    return 'url(#neutral-grad)';
  }

  getPartnerInfo(d) {
    if (d.unions && d.unions.length > 0) {
      const u = d.unions[0];
      return {
        name: u.partner?.name || 'Pasangan',
        status: u.status || 'married',
      };
    }
    if (d.partners && d.partners.length > 0) {
      const p = d.partners[0];
      return {
        name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Pasangan',
        status: p.status || p.type || 'married',
      };
    }
    return null;
  }

  render(data) {
    if (!data) return;

    // Handle nested data wrappers if any
    const rootData = data.data || data;

    this.rawTreeData = rootData;
    this.root = d3.hierarchy(rootData, d => d.children);
    this.root.x0 = 0;
    this.root.y0 = 0;

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

    const linkEnter = link.enter()
      .insert('path', 'g')
      .attr('class', 'tree-link')
      .attr('d', () => {
        const o = { x: source.x0 || 0, y: source.y0 || 0 };
        return this.diagonal({ source: o, target: o });
      });

    link.merge(linkEnter).transition().duration(duration)
      .attr('d', d => this.diagonal(d));

    link.exit().transition().duration(duration)
      .attr('d', () => {
        const o = { x: source.x, y: source.y };
        return this.diagonal({ source: o, target: o });
      })
      .remove();

    // ==========================================
    // NODES
    // ==========================================
    const node = this.container.selectAll('g.node-group')
      .data(nodes, d => d.data.id);

    const nodeEnter = node.enter()
      .append('g')
      .attr('class', 'node-group')
      .attr('transform', () => `translate(${source.x0 || 0},${source.y0 || 0})`);

    const card = nodeEnter.append('g')
      .attr('class', 'node-card')
      .on('click', (event, d) => {
        event.stopPropagation();
        this.selectNode(d);
        this.options.onNodeClick(d.data);
      });

    // Background Card
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
      .attr('class', d => `gender-indicator ${this.getGender(d.data)}`)
      .attr('x', -cardWidth / 2 + 4)
      .attr('y', -cardHeight / 2 + 10)
      .attr('width', 4.5)
      .attr('height', cardHeight - 20)
      .attr('rx', 2);

    // Avatar Circle
    const avatarGroup = card.append('g')
      .attr('transform', `translate(${-cardWidth / 2 + 32}, 0)`);

    avatarGroup.append('circle')
      .attr('r', 20)
      .attr('fill', d => this.getAvatarGradient(this.getGender(d.data)))
      .attr('stroke', 'rgba(255,255,255,0.25)')
      .attr('stroke-width', 1.5);

    avatarGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#ffffff')
      .attr('font-size', '13px')
      .attr('font-weight', '700')
      .text(d => this.getPersonName(d.data).charAt(0).toUpperCase());

    // Person Name
    card.append('text')
      .attr('class', 'node-name')
      .attr('x', -cardWidth / 2 + 62)
      .attr('y', -12)
      .text(d => {
        const full = this.getPersonName(d.data);
        return full.length > 17 ? full.substring(0, 15) + '...' : full;
      });

    // Sub-text: Years & Status
    card.append('text')
      .attr('class', 'node-dates')
      .attr('x', -cardWidth / 2 + 62)
      .attr('y', 8)
      .text(d => {
        const bYear = d.data.birthDate ? new Date(d.data.birthDate).getFullYear() : '—';
        const dYear = d.data.deathDate ? new Date(d.data.deathDate).getFullYear() : (d.data.isLiving !== false ? 'Sekarang' : '—');
        return `${bYear} — ${dYear}`;
      });

    // Partner badge if exists
    card.each((d, i, nodesList) => {
      const partner = this.getPartnerInfo(d.data);
      if (partner) {
        const g = d3.select(nodesList[i]);
        const pBadge = g.append('g')
          .attr('transform', `translate(${-cardWidth / 2 + 62}, 24)`);

        pBadge.append('rect')
          .attr('fill', 'rgba(244, 63, 94, 0.15)')
          .attr('stroke', 'rgba(244, 63, 94, 0.35)')
          .attr('rx', 4)
          .attr('width', cardWidth - 72)
          .attr('height', 16);

        pBadge.append('text')
          .attr('x', 6)
          .attr('y', 11)
          .attr('fill', '#fb7185')
          .attr('font-size', '9.5px')
          .attr('font-weight', '600')
          .text(`💍 ${partner.name.length > 18 ? partner.name.substring(0, 16) + '..' : partner.name}`);
      }
    });

    // Collapse / Expand Toggle
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

    // UPDATE
    const nodeUpdate = node.merge(nodeEnter).transition().duration(duration)
      .attr('transform', d => `translate(${d.x},${d.y})`);

    nodeUpdate.select('.expand-toggle')
      .style('display', d => (d.children || d._children ? 'block' : 'none'))
      .select('text')
      .text(d => (d.children ? '−' : '+'));

    // EXIT
    const nodeExit = node.exit().transition().duration(duration)
      .attr('transform', () => `translate(${source.x},${source.y})`)
      .remove();

    nodeExit.select('.node-card').style('opacity', 0);

    nodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

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
      (fullWidth * 0.82) / bounds.width,
      (fullHeight * 0.82) / bounds.height,
      1.1
    );

    const translate = [
      fullWidth / 2 - scale * midX,
      fullHeight * 0.28 - scale * (bounds.y)
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
