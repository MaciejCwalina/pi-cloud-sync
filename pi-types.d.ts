/**
 * Minimal structural typing for the parts of the pi ExtensionAPI this
 * extension uses. Keeps the project decoupled from the global pi install
 * (the real package is resolved at runtime by jiti, types are erased).
 */
declare module "@earendil-works/pi-coding-agent" {
  export interface ExtensionUi {
    notify?: (message: string, level?: "info" | "warning" | "error") => void;
  }

  export interface ExtensionContextLike {
    hasUI?: boolean;
    ui?: ExtensionUi;
  }

  export interface ExtensionCommandDefinition {
    description: string;
    handler: (name: string | undefined, ctx: ExtensionContextLike) => unknown;
  }

  export interface ExtensionAPI {
    on(event: string, handler: (event: unknown, ctx: ExtensionContextLike) => unknown): void;
    registerCommand(name: string, definition: ExtensionCommandDefinition): void;
  }
}
