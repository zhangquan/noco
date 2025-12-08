/**
 * Flow Graph Class
 * Main class for managing flow graphs with nodes and edges
 * @module core/FlowGraph
 */

import { ulid } from 'ulid';
import { Node } from './Node';
import { Edge } from './Edge';
import type {
  FlowSchema,
  FlowTriggerType,
  FlowVariable,
  FlowInput,
  FlowOutput,
  FlowSettings,
  FlowValidationResult,
  FlowValidationError,
  FlowValidationWarning,
  FlowChangeEvent,
  FlowChangeType,
  NodeData,
  EdgeData,
  NodePosition,
  NodeDefinition,
} from '../types';

// ============================================================================
// Types
// ============================================================================

export type FlowEventListener = (event: FlowChangeEvent) => void;

// ============================================================================
// FlowGraph Class
// ============================================================================

/**
 * FlowGraph class - manages the complete flow graph
 */
export class FlowGraph {
  // Core data
  private _id: string;
  private _name: string;
  private _description?: string;
  private _triggerType: FlowTriggerType;
  private _triggerNodeId?: string;

  // Graph structure
  private _nodes: Map<string, Node>;
  private _edges: Map<string, Edge>;

  // Flow configuration
  private _variables: FlowVariable[];
  private _inputs: FlowInput[];
  private _outputs: FlowOutput[];
  private _settings: FlowSettings;
  private _meta: Record<string, unknown>;

  // Metadata
  private _version: string;
  private _createdAt: Date;
  private _updatedAt: Date;

  // Event listeners
  private _listeners: Set<FlowEventListener>;

  constructor(schema?: Partial<FlowSchema>) {
    this._id = schema?.id || ulid();
    this._name = schema?.name || 'Untitled Flow';
    this._description = schema?.description;
    this._triggerType = schema?.triggerType || 'manual';
    this._triggerNodeId = schema?.triggerNodeId;
    this._version = schema?.version || '1.0.0';
    this._createdAt = schema?.createdAt ? new Date(schema.createdAt) : new Date();
    this._updatedAt = schema?.updatedAt ? new Date(schema.updatedAt) : new Date();

    this._nodes = new Map();
    this._edges = new Map();
    this._variables = schema?.variables || [];
    this._inputs = schema?.inputs || [];
    this._outputs = schema?.outputs || [];
    this._settings = schema?.settings || {};
    this._meta = schema?.meta || {};
    this._listeners = new Set();

    // Load nodes and edges from schema
    if (schema?.nodes) {
      for (const nodeData of schema.nodes) {
        this._nodes.set(nodeData.id, Node.fromJSON(nodeData));
      }
    }

    if (schema?.edges) {
      for (const edgeData of schema.edges) {
        this._edges.set(edgeData.id, Edge.fromJSON(edgeData));
      }
    }
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a flow graph from a schema
   */
  static fromSchema(schema: FlowSchema): FlowGraph {
    return new FlowGraph(schema);
  }

  /**
   * Create an empty flow graph
   */
  static create(name: string, triggerType: FlowTriggerType = 'manual'): FlowGraph {
    return new FlowGraph({ name, triggerType });
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get id(): string { return this._id; }
  get name(): string { return this._name; }
  get description(): string | undefined { return this._description; }
  get triggerType(): FlowTriggerType { return this._triggerType; }
  get triggerNodeId(): string | undefined { return this._triggerNodeId; }
  get version(): string { return this._version; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get variables(): FlowVariable[] { return [...this._variables]; }
  get inputs(): FlowInput[] { return [...this._inputs]; }
  get outputs(): FlowOutput[] { return [...this._outputs]; }
  get settings(): FlowSettings { return { ...this._settings }; }
  get meta(): Record<string, unknown> { return { ...this._meta }; }

  get nodeCount(): number { return this._nodes.size; }
  get edgeCount(): number { return this._edges.size; }

  // ==========================================================================
  // Setters
  // ==========================================================================

  set name(value: string) {
    this._name = value;
    this.touch();
    this.emit('flow:update', { name: value });
  }

  set description(value: string | undefined) {
    this._description = value;
    this.touch();
    this.emit('flow:update', { description: value });
  }

  set triggerType(value: FlowTriggerType) {
    this._triggerType = value;
    this.touch();
    this.emit('flow:update', { triggerType: value });
  }

  // ==========================================================================
  // Node Operations
  // ==========================================================================

  /**
   * Get all nodes
   */
  getNodes(): Node[] {
    return Array.from(this._nodes.values());
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): Node | undefined {
    return this._nodes.get(id);
  }

  /**
   * Check if a node exists
   */
  hasNode(id: string): boolean {
    return this._nodes.has(id);
  }

  /**
   * Add a node to the graph
   */
  addNode(node: Node | NodeData): Node {
    const newNode = node instanceof Node ? node : Node.fromJSON(node);
    
    if (this._nodes.has(newNode.id)) {
      throw new Error(`Node with ID "${newNode.id}" already exists`);
    }

    this._nodes.set(newNode.id, newNode);
    
    // If this is a trigger node, set it as the trigger
    if (newNode.isTrigger && !this._triggerNodeId) {
      this._triggerNodeId = newNode.id;
    }

    this.touch();
    this.emit('node:add', newNode.toJSON());
    return newNode;
  }

  /**
   * Create and add a node from a definition
   */
  addNodeFromDefinition(
    definition: NodeDefinition,
    position: NodePosition = { x: 0, y: 0 }
  ): Node {
    const node = Node.fromDefinition(definition, position);
    return this.addNode(node);
  }

  /**
   * Update a node
   */
  updateNode(id: string, data: Partial<NodeData>): Node | undefined {
    const node = this._nodes.get(id);
    if (!node) return undefined;

    const previousData = node.toJSON();

    if (data.label !== undefined) node.label = data.label;
    if (data.position !== undefined) node.moveTo(data.position.x, data.position.y);
    if (data.size !== undefined) node.resize(data.size.width, data.size.height);
    if (data.config !== undefined) node.updateConfig(data.config);
    if (data.meta !== undefined) node.updateMeta(data.meta);
    if (data.disabled !== undefined) data.disabled ? node.disable() : node.enable();
    if (data.description !== undefined) node.description = data.description;

    this.touch();
    this.emit('node:update', { id, data: node.toJSON(), previousData });
    return node;
  }

  /**
   * Remove a node and all its connected edges
   */
  removeNode(id: string): boolean {
    const node = this._nodes.get(id);
    if (!node) return false;

    // Remove all edges connected to this node
    const connectedEdges = this.getEdgesForNode(id);
    for (const edge of connectedEdges) {
      this._edges.delete(edge.id);
    }

    // Remove the node
    this._nodes.delete(id);

    // Clear trigger if this was the trigger node
    if (this._triggerNodeId === id) {
      this._triggerNodeId = undefined;
    }

    this.touch();
    this.emit('node:delete', { id, node: node.toJSON() });
    return true;
  }

  /**
   * Move a node to a new position
   */
  moveNode(id: string, x: number, y: number): boolean {
    const node = this._nodes.get(id);
    if (!node) return false;

    const previousPosition = { ...node.position };
    node.moveTo(x, y);

    this.touch();
    this.emit('node:move', { id, position: { x, y }, previousPosition });
    return true;
  }

  /**
   * Clone a node
   */
  cloneNode(id: string, position?: NodePosition): Node | undefined {
    const node = this._nodes.get(id);
    if (!node) return undefined;

    const clonedNode = node.clone(position);
    return this.addNode(clonedNode);
  }

  /**
   * Get nodes by category
   */
  getNodesByCategory(category: string): Node[] {
    return this.getNodes().filter(n => n.category === category);
  }

  /**
   * Get trigger nodes
   */
  getTriggerNodes(): Node[] {
    return this.getNodes().filter(n => n.isTrigger);
  }

  /**
   * Get the primary trigger node
   */
  getTriggerNode(): Node | undefined {
    return this._triggerNodeId ? this._nodes.get(this._triggerNodeId) : undefined;
  }

  // ==========================================================================
  // Edge Operations
  // ==========================================================================

  /**
   * Get all edges
   */
  getEdges(): Edge[] {
    return Array.from(this._edges.values());
  }

  /**
   * Get an edge by ID
   */
  getEdge(id: string): Edge | undefined {
    return this._edges.get(id);
  }

  /**
   * Check if an edge exists
   */
  hasEdge(id: string): boolean {
    return this._edges.has(id);
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edge: Edge | EdgeData): Edge {
    const newEdge = edge instanceof Edge ? edge : Edge.fromJSON(edge);
    
    if (this._edges.has(newEdge.id)) {
      throw new Error(`Edge with ID "${newEdge.id}" already exists`);
    }

    // Validate that source and target nodes exist
    if (!this._nodes.has(newEdge.sourceId)) {
      throw new Error(`Source node "${newEdge.sourceId}" does not exist`);
    }
    if (!this._nodes.has(newEdge.targetId)) {
      throw new Error(`Target node "${newEdge.targetId}" does not exist`);
    }

    this._edges.set(newEdge.id, newEdge);

    this.touch();
    this.emit('edge:add', newEdge.toJSON());
    return newEdge;
  }

  /**
   * Create and add an edge
   */
  connect(
    sourceId: string,
    sourcePort: string,
    targetId: string,
    targetPort: string
  ): Edge {
    const edge = Edge.create(sourceId, sourcePort, targetId, targetPort);
    return this.addEdge(edge);
  }

  /**
   * Update an edge
   */
  updateEdge(id: string, data: Partial<EdgeData>): Edge | undefined {
    const edge = this._edges.get(id);
    if (!edge) return undefined;

    const previousData = edge.toJSON();

    if (data.type !== undefined) edge.setType(data.type);
    if (data.label !== undefined) edge.setLabel(data.label);
    if (data.condition !== undefined) edge.setCondition(data.condition);
    if (data.meta !== undefined) edge.updateMeta(data.meta);
    if (data.disabled !== undefined) data.disabled ? edge.disable() : edge.enable();

    this.touch();
    this.emit('edge:update', { id, data: edge.toJSON(), previousData });
    return edge;
  }

  /**
   * Remove an edge
   */
  removeEdge(id: string): boolean {
    const edge = this._edges.get(id);
    if (!edge) return false;

    this._edges.delete(id);

    this.touch();
    this.emit('edge:delete', { id, edge: edge.toJSON() });
    return true;
  }

  /**
   * Get edges connected to a node
   */
  getEdgesForNode(nodeId: string): Edge[] {
    return this.getEdges().filter(e => e.connectsTo(nodeId));
  }

  /**
   * Get incoming edges for a node
   */
  getIncomingEdges(nodeId: string): Edge[] {
    return this.getEdges().filter(e => e.goesTo(nodeId));
  }

  /**
   * Get outgoing edges from a node
   */
  getOutgoingEdges(nodeId: string): Edge[] {
    return this.getEdges().filter(e => e.comesFrom(nodeId));
  }

  /**
   * Get predecessor nodes (nodes that connect to this node)
   */
  getPredecessors(nodeId: string): Node[] {
    return this.getIncomingEdges(nodeId)
      .map(e => this._nodes.get(e.sourceId))
      .filter((n): n is Node => n !== undefined);
  }

  /**
   * Get successor nodes (nodes this node connects to)
   */
  getSuccessors(nodeId: string): Node[] {
    return this.getOutgoingEdges(nodeId)
      .map(e => this._nodes.get(e.targetId))
      .filter((n): n is Node => n !== undefined);
  }

  /**
   * Check if connecting two nodes would create a cycle
   */
  wouldCreateCycle(sourceId: string, targetId: string): boolean {
    // Use DFS to check if there's a path from target to source
    const visited = new Set<string>();
    const stack = [targetId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === sourceId) return true;
      if (visited.has(current)) continue;
      
      visited.add(current);
      
      for (const successor of this.getSuccessors(current)) {
        stack.push(successor.id);
      }
    }

    return false;
  }

  // ==========================================================================
  // Flow Configuration
  // ==========================================================================

  /**
   * Add a variable
   */
  addVariable(variable: FlowVariable): void {
    const exists = this._variables.find(v => v.name === variable.name);
    if (exists) {
      throw new Error(`Variable "${variable.name}" already exists`);
    }
    this._variables.push(variable);
    this.touch();
    this.emit('flow:update', { variables: this._variables });
  }

  /**
   * Remove a variable
   */
  removeVariable(name: string): boolean {
    const index = this._variables.findIndex(v => v.name === name);
    if (index === -1) return false;
    this._variables.splice(index, 1);
    this.touch();
    this.emit('flow:update', { variables: this._variables });
    return true;
  }

  /**
   * Update a variable
   */
  updateVariable(name: string, data: Partial<FlowVariable>): boolean {
    const variable = this._variables.find(v => v.name === name);
    if (!variable) return false;
    Object.assign(variable, data);
    this.touch();
    this.emit('flow:update', { variables: this._variables });
    return true;
  }

  /**
   * Set flow inputs
   */
  setInputs(inputs: FlowInput[]): void {
    this._inputs = inputs;
    this.touch();
    this.emit('flow:update', { inputs: this._inputs });
  }

  /**
   * Set flow outputs
   */
  setOutputs(outputs: FlowOutput[]): void {
    this._outputs = outputs;
    this.touch();
    this.emit('flow:update', { outputs: this._outputs });
  }

  /**
   * Update flow settings
   */
  updateSettings(settings: Partial<FlowSettings>): void {
    this._settings = { ...this._settings, ...settings };
    this.touch();
    this.emit('flow:update', { settings: this._settings });
  }

  /**
   * Update flow metadata
   */
  updateMeta(meta: Record<string, unknown>): void {
    this._meta = { ...this._meta, ...meta };
    this.touch();
    this.emit('flow:update', { meta: this._meta });
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate the entire flow
   */
  validate(): FlowValidationResult {
    const errors: FlowValidationError[] = [];
    const warnings: FlowValidationWarning[] = [];

    // Flow-level validation
    if (!this._name || this._name.trim() === '') {
      errors.push({
        type: 'flow',
        message: 'Flow name is required',
        code: 'FLOW_NAME_REQUIRED',
      });
    }

    // Check for trigger node
    if (this._nodes.size > 0) {
      const triggerNodes = this.getTriggerNodes();
      if (triggerNodes.length === 0) {
        warnings.push({
          type: 'flow',
          message: 'Flow has no trigger node',
          code: 'NO_TRIGGER_NODE',
        });
      } else if (triggerNodes.length > 1) {
        warnings.push({
          type: 'flow',
          message: 'Flow has multiple trigger nodes',
          code: 'MULTIPLE_TRIGGER_NODES',
        });
      }
    }

    // Validate each node
    for (const node of this._nodes.values()) {
      const nodeResult = node.validate();
      for (const error of nodeResult.errors) {
        errors.push({
          type: 'node',
          targetId: node.id,
          field: error.field,
          message: error.message,
          code: error.code,
        });
      }
      for (const warning of nodeResult.warnings) {
        warnings.push({
          type: 'node',
          targetId: node.id,
          field: warning.field,
          message: warning.message,
          code: warning.code,
        });
      }
    }

    // Validate each edge
    for (const edge of this._edges.values()) {
      const edgeResult = edge.validate();
      for (const error of edgeResult.errors) {
        errors.push({
          type: 'edge',
          targetId: edge.id,
          message: error,
          code: 'EDGE_INVALID',
        });
      }

      // Check for orphaned edges
      if (!this._nodes.has(edge.sourceId)) {
        errors.push({
          type: 'edge',
          targetId: edge.id,
          message: `Edge references non-existent source node "${edge.sourceId}"`,
          code: 'EDGE_ORPHAN_SOURCE',
        });
      }
      if (!this._nodes.has(edge.targetId)) {
        errors.push({
          type: 'edge',
          targetId: edge.id,
          message: `Edge references non-existent target node "${edge.targetId}"`,
          code: 'EDGE_ORPHAN_TARGET',
        });
      }
    }

    // Check for unreachable nodes
    const reachable = this.getReachableNodes();
    for (const node of this._nodes.values()) {
      if (!node.isTrigger && !reachable.has(node.id)) {
        warnings.push({
          type: 'node',
          targetId: node.id,
          message: `Node "${node.label}" is not reachable from any trigger`,
          code: 'NODE_UNREACHABLE',
        });
      }
    }

    this.emit('flow:validate', { errors, warnings });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get all nodes reachable from trigger nodes
   */
  private getReachableNodes(): Set<string> {
    const reachable = new Set<string>();
    const triggerNodes = this.getTriggerNodes();

    for (const trigger of triggerNodes) {
      this.traverseFromNode(trigger.id, reachable);
    }

    return reachable;
  }

  /**
   * Traverse graph from a starting node
   */
  private traverseFromNode(nodeId: string, visited: Set<string>): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    for (const successor of this.getSuccessors(nodeId)) {
      this.traverseFromNode(successor.id, visited);
    }
  }

  // ==========================================================================
  // Graph Analysis
  // ==========================================================================

  /**
   * Get topological order of nodes
   */
  getTopologicalOrder(): Node[] {
    const result: Node[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (nodeId: string): boolean => {
      if (temp.has(nodeId)) return false; // Cycle detected
      if (visited.has(nodeId)) return true;

      temp.add(nodeId);

      for (const successor of this.getSuccessors(nodeId)) {
        if (!visit(successor.id)) return false;
      }

      temp.delete(nodeId);
      visited.add(nodeId);
      const node = this._nodes.get(nodeId);
      if (node) result.unshift(node);

      return true;
    };

    for (const nodeId of this._nodes.keys()) {
      if (!visited.has(nodeId)) {
        if (!visit(nodeId)) {
          throw new Error('Flow contains a cycle');
        }
      }
    }

    return result;
  }

  /**
   * Check if the graph is a DAG (Directed Acyclic Graph)
   */
  isDAG(): boolean {
    try {
      this.getTopologicalOrder();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get isolated nodes (no incoming or outgoing edges)
   */
  getIsolatedNodes(): Node[] {
    return this.getNodes().filter(n => {
      const edges = this.getEdgesForNode(n.id);
      return edges.length === 0;
    });
  }

  // ==========================================================================
  // Event System
  // ==========================================================================

  /**
   * Subscribe to flow changes
   */
  subscribe(listener: FlowEventListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Emit an event
   */
  private emit(type: FlowChangeType, data: unknown): void {
    const event: FlowChangeEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in flow event listener:', error);
      }
    }
  }

  /**
   * Update the updatedAt timestamp
   */
  private touch(): void {
    this._updatedAt = new Date();
  }

  // ==========================================================================
  // Serialization
  // ==========================================================================

  /**
   * Convert to schema object
   */
  toSchema(): FlowSchema {
    return {
      version: this._version,
      id: this._id,
      name: this._name,
      description: this._description,
      triggerType: this._triggerType,
      triggerNodeId: this._triggerNodeId,
      nodes: this.getNodes().map(n => n.toJSON()),
      edges: this.getEdges().map(e => e.toJSON()),
      variables: [...this._variables],
      inputs: [...this._inputs],
      outputs: [...this._outputs],
      settings: { ...this._settings },
      meta: { ...this._meta },
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }

  /**
   * Convert to JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.toSchema(), null, 2);
  }

  /**
   * Clone the flow graph
   */
  clone(newName?: string): FlowGraph {
    const schema = this.toSchema();
    schema.id = ulid();
    schema.name = newName || `${schema.name} (Copy)`;
    schema.createdAt = new Date().toISOString();
    schema.updatedAt = new Date().toISOString();
    return FlowGraph.fromSchema(schema);
  }

  /**
   * Clear all nodes and edges
   */
  clear(): void {
    this._nodes.clear();
    this._edges.clear();
    this._triggerNodeId = undefined;
    this.touch();
    this.emit('flow:update', { cleared: true });
  }
}

export default FlowGraph;
