import type { Entities } from '../types/entities';

export interface CreateMediaInput {
  topicNodeId: string;
  storageKey: string;
  sizeBytes: number;
  originalName: string;
  type: string;
  uploadedById: string;
}

export interface IMediaRepository {
  findById(id: string): Promise<Entities.Content.Media | null>;
  /**
   * List READY rows for a topic node.
   * Pass `{ includePending: true }` to also include PENDING rows.
   * DELETED rows are always excluded.
   */
  listByTopic(topicNodeId: string, opts?: { includePending?: boolean }): Promise<Entities.Content.Media[]>;
  /** Always inserts with status = 'pending'. */
  create(data: CreateMediaInput): Promise<Entities.Content.Media>;
  /** Transitions a PENDING row to READY. */
  markReady(id: string): Promise<Entities.Content.Media>;
  /** Status → 'deleted'; row is retained in the database. */
  softDelete(id: string): Promise<void>;
  /** Removes the row from the database entirely. */
  hardDelete(id: string): Promise<void>;
}
