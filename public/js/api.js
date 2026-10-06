/**
 * Family Tree API Client
 * Interfaces with NestJS backend REST endpoints
 */

const API_BASE = '/api/v1';

export const FamilyTreeAPI = {
  /**
   * Fetch all family trees
   */
  async getTrees() {
    try {
      const response = await fetch(`${API_BASE}/trees`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const json = await response.json();
      return json.data || [];
    } catch (err) {
      console.error('Failed to fetch trees:', err);
      throw err;
    }
  },

  /**
   * Fetch tree render data (Hierarchy or Graph format)
   * @param {string} treeId 
   * @param {Object} options { format, rootPersonId, direction, depth }
   */
  async renderTree(treeId, options = {}) {
    const {
      format = 'hierarchy',
      rootPersonId = null,
      direction = 'descendants',
      depth = null,
    } = options;

    const params = new URLSearchParams();
    if (format) params.append('format', format);
    if (rootPersonId) params.append('rootPersonId', rootPersonId);
    if (direction) params.append('direction', direction);
    if (depth) params.append('depth', depth.toString());

    try {
      const response = await fetch(`${API_BASE}/trees/${treeId}/render?${params.toString()}`);
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.message || `HTTP error ${response.status}`);
      }
      const json = await response.json();
      return json.data;
    } catch (err) {
      console.error('Failed to render tree:', err);
      throw err;
    }
  },

  /**
   * Fetch focused My-View
   */
  async getMyView(treeId, personId = null) {
    const params = new URLSearchParams();
    if (personId) params.append('personId', personId);

    try {
      const response = await fetch(`${API_BASE}/trees/${treeId}/my-view?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const json = await response.json();
      return json.data;
    } catch (err) {
      console.error('Failed to fetch my-view:', err);
      throw err;
    }
  },

  /**
   * Fetch single person detail with direct relations
   */
  async getPersonDetail(treeId, personId) {
    try {
      const response = await fetch(`${API_BASE}/trees/${treeId}/persons/${personId}`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const json = await response.json();
      return json.data;
    } catch (err) {
      console.error('Failed to fetch person detail:', err);
      throw err;
    }
  },

  /**
   * Fetch cousins of a person
   */
  async getCousins(treeId, personId) {
    try {
      const response = await fetch(`${API_BASE}/trees/${treeId}/persons/${personId}/cousins`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const json = await response.json();
      return json.data;
    } catch (err) {
      console.error('Failed to fetch cousins:', err);
      throw err;
    }
  }
};
