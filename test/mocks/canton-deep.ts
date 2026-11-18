// Deep-path mocks for canton-node-sdk.
//
// Most deep modules are only imported for types in this repo, but Jest's moduleNameMapper needs the target files to
// exist. The register reader also imports two deep modules at runtime: `WebSocketClient`, stood in for here by a
// scripted socket, and `buildEventFormat`, reproduced exactly.

interface MockWebSocketHandlers {
  readonly onOpen?: () => void | Promise<void>;
  readonly onMessage: (msg: unknown) => void | Promise<void>;
  readonly onError?: (err: Error) => void | Promise<void>;
  readonly onClose?: (code: number, reason: string) => void | Promise<void>;
}

/** One `connect` call the reader made, with the handlers a script drives. */
export interface MockWebSocketConnection {
  readonly client: unknown;
  readonly path: string;
  readonly request: unknown;
  readonly handlers: MockWebSocketHandlers;
  readonly options: unknown;
  closed: boolean;
}

/** What a queued script does with a connection once `connect` has resolved. */
export type MockWebSocketScript = (connection: MockWebSocketConnection) => void | Promise<void>;

/** Every connection opened since the last reset, in order. */
export const webSocketConnections: MockWebSocketConnection[] = [];

const scripts: MockWebSocketScript[] = [];

/** Queue the script that the next `connect` call runs. */
export function queueWebSocketScript(script: MockWebSocketScript): void {
  scripts.push(script);
}

/** Forget queued scripts and recorded connections. */
export function resetWebSocketMock(): void {
  scripts.length = 0;
  webSocketConnections.length = 0;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Deliver messages one by one as WebSocketClient does: each `onMessage` is called without waiting for the previous
 * one, a failing handler reports `onError` and closes the socket with 1011, and `onClose` runs once every handler has
 * settled. `afterEach` runs after each dispatch, before the next message is produced.
 */
export async function deliverMessages(
  connection: MockWebSocketConnection,
  messages: Iterable<unknown>,
  options: { closeCode?: number; closeReason?: string; afterEach?: (index: number) => void } = {}
): Promise<void> {
  const inFlight: Array<Promise<void>> = [];
  let closeCode = options.closeCode ?? 1000;
  let index = 0;
  for (const message of messages) {
    if (connection.closed) break;
    // WebSocketClient calls the handler synchronously on each socket message and does not wait for it.
    let handled: Promise<void>;
    try {
      handled = Promise.resolve(connection.handlers.onMessage(message));
    } catch (error) {
      handled = Promise.reject(toError(error));
    }
    inFlight.push(
      handled.catch(async (error: unknown) => {
        closeCode = 1011;
        connection.closed = true;
        await connection.handlers.onError?.(toError(error));
      })
    );
    options.afterEach?.(index);
    index += 1;
  }
  await Promise.all(inFlight);
  await connection.handlers.onClose?.(closeCode, options.closeReason ?? '');
}

/** Stands in for canton-node-sdk's WebSocketClient: each `connect` runs the next queued script. */
export class WebSocketClient {
  constructor(private readonly client: unknown) {}

  async connect<RequestMessage, InboundMessage>(
    path: string,
    requestMessage: RequestMessage,
    handlers: {
      readonly onOpen?: () => void | Promise<void>;
      readonly onMessage: (msg: InboundMessage) => void | Promise<void>;
      readonly onError?: (err: Error) => void | Promise<void>;
      readonly onClose?: (code: number, reason: string) => void | Promise<void>;
    },
    options?: unknown
  ): Promise<{ close: () => void; isConnected: () => boolean; getConnectionState: () => number }> {
    const script = scripts.shift();
    if (script === undefined) throw new Error(`No WebSocket script queued for ${path}`);
    const connection: MockWebSocketConnection = {
      client: this.client,
      path,
      request: requestMessage,
      handlers: handlers as MockWebSocketHandlers,
      options,
      closed: false,
    };
    webSocketConnections.push(connection);
    setImmediate(() => {
      Promise.resolve()
        .then(async () => script(connection))
        .catch(async (error: unknown) => handlers.onError?.(toError(error)));
    });
    return Promise.resolve({
      close: () => {
        connection.closed = true;
      },
      isConnected: () => !connection.closed,
      getConnectionState: () => (connection.closed ? 3 : 1),
    });
  }
}

/** canton-node-sdk 0.0.269's `buildEventFormat`, reproduced. */
export function buildEventFormat(params: {
  parties: string[];
  templateIds?: string[] | undefined;
  interfaceIds?: string[] | undefined;
  includeInterfaceView?: boolean | undefined;
  includeCreatedEventBlob?: boolean | undefined;
}): { verbose: boolean; filtersByParty: Record<string, { cumulative: unknown[] }> } {
  if (params.parties.length === 0) {
    throw new Error('At least one party is required for event format filters');
  }
  const includeCreatedEventBlob = params.includeCreatedEventBlob ?? false;
  const templateFilters = (params.templateIds ?? []).map((templateId) => ({
    identifierFilter: { TemplateFilter: { value: { templateId, includeCreatedEventBlob } } },
  }));
  const interfaceFilters = (params.interfaceIds ?? []).map((interfaceId) => ({
    identifierFilter: {
      InterfaceFilter: {
        value: { interfaceId, includeInterfaceView: params.includeInterfaceView ?? true, includeCreatedEventBlob },
      },
    },
  }));
  const identifierFilters: unknown[] = [...templateFilters, ...interfaceFilters];
  const cumulative =
    identifierFilters.length > 0
      ? identifierFilters
      : params.includeCreatedEventBlob === true
        ? [{ identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: true } } } }]
        : [];
  return {
    verbose: false,
    filtersByParty: Object.fromEntries(params.parties.map((party) => [party, { cumulative }])),
  };
}
