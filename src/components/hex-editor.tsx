// src/components/hex-editor.tsx
'use client';

import { useRef, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { isValidHex } from '@/lib/utils/hex';

interface HexEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function HexEditor({ value, onChange, placeholder, className }: HexEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Configure the editor for hex input
    editor.updateOptions({
      wordWrap: 'off',
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      fontSize: 13,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      lineHeight: 20,
      padding: { top: 16, bottom: 16 },
      renderWhitespace: 'none',
      renderControlCharacters: false,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        useShadows: false,
        verticalHasArrows: false,
        horizontalHasArrows: false,
      },
      // Disable text truncation
      domReadOnly: false,
      readOnly: false,
      // Ensure all content is visible
      scrollbarSize: 12,
      // Better for hex display
      rulers: [10], // Vertical ruler at column 10 (after offset)
      glyphMargin: false,
    });

    // Add custom validation
    const validateHex = () => {
      const model = editor.getModel();
      if (!model) return;

      const text = model.getValue();
      const lines = text.split('\n');
      const markers: any[] = [];

      lines.forEach((line: string, lineIndex: number) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        // Extract hex part (after the offset)
        const hexPart = trimmedLine.includes(':') ? trimmedLine.split(':')[1]?.trim() : trimmedLine;
        if (!hexPart) return;

        // Check if hex part contains only valid hex characters
        if (!/^[0-9a-fA-F]*$/.test(hexPart)) {
          const colonIndex = trimmedLine.indexOf(':');
          const startCol = colonIndex > 0 ? colonIndex + 2 : 1;
          markers.push({
            startLineNumber: lineIndex + 1,
            startColumn: startCol,
            endLineNumber: lineIndex + 1,
            endColumn: line.length + 1,
            message: 'Invalid hex character',
            severity: monaco.MarkerSeverity.Error,
          });
        }
      });

      monaco.editor.setModelMarkers(model, 'hex-validation', markers);
    };

    // Validate on content change
    editor.onDidChangeModelContent(validateHex);
    
    // Initial validation
    validateHex();
    
    // Ensure all content is visible
    setTimeout(() => {
      editor.revealLine(1);
      editor.setScrollTop(0);
    }, 100);
  };

  const handleEditorChange = (newValue: string | undefined) => {
    if (newValue !== undefined) {
      // Clean up the input - remove whitespace and convert to lowercase
      const cleaned = newValue.replace(/\s/g, '').toLowerCase();
      onChange(cleaned);
    }
  };

  // Format hex for display with line breaks and byte offsets
  const formatHexForDisplay = (hex: string): string => {
    if (!hex) return '';
    
    // Remove any existing whitespace
    const cleaned = hex.replace(/\s/g, '');
    
    // Split into chunks of 32 characters (16 bytes) per line
    const chunks = [];
    for (let i = 0; i < cleaned.length; i += 32) {
      const chunk = cleaned.slice(i, i + 32);
      const byteOffset = (i / 2).toString(16).padStart(8, '0').toUpperCase();
      chunks.push(`${byteOffset}: ${chunk}`);
    }
    
    return chunks.join('\n');
  };

  // Get the formatted value for display
  const displayValue = formatHexForDisplay(value);

  return (
    <div className={`border rounded-lg overflow-hidden ${className}`}>
      <Editor
        height="300px"
        defaultLanguage="plaintext"
        value={displayValue}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          theme: 'vs-dark',
          readOnly: false,
          contextmenu: true,
          selectOnLineNumbers: true,
          roundedSelection: false,
          cursorStyle: 'line',
          cursorBlinking: 'blink',
          cursorWidth: 1,
          folding: false,
          wordWrap: 'off',
          scrollBeyondLastLine: false,
          minimap: { enabled: false },
          // Disable any content truncation
          domReadOnly: false,
        }}
      />
    </div>
  );
}
