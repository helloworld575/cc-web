declare module '@toast-ui/editor' {
  export type PreviewStyle = 'tab' | 'vertical';
  export type EditorType = 'markdown' | 'wysiwyg';
  export type ImageHookCallback = (url: string, text?: string) => void;

  export interface EditorElements {
    mdEditor: HTMLElement;
    mdPreview: HTMLElement;
    wwEditor: HTMLElement;
  }

  export interface EditorOptions {
    el: HTMLElement;
    height?: string;
    minHeight?: string;
    initialValue?: string;
    previewStyle?: PreviewStyle;
    initialEditType?: EditorType;
    language?: string;
    placeholder?: string;
    autofocus?: boolean;
    usageStatistics?: boolean;
    extendedAutolinks?: boolean;
    toolbarItems?: string[][];
    hooks?: {
      addImageBlobHook?: (blob: Blob | File, callback: ImageHookCallback) => void;
    };
  }

  export default class Editor {
    constructor(options: EditorOptions);
    getMarkdown(): string;
    setMarkdown(markdown: string, cursorToEnd?: boolean): void;
    on(type: string, handler: (...args: unknown[]) => void): void;
    destroy(): void;
    getEditorElements(): EditorElements;
  }
}

declare module '@toast-ui/editor/dist/i18n/zh-cn';
