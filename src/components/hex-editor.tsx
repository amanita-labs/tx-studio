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

  // Helper function to clean hex from various formats
  const cleanHexString = (text: string): string => {
    // Remove common hex prefixes
    let cleaned = text.replace(/^0x/gi, '');
    
    // Remove byte offsets (e.g., "00000000: " or "0x0000: ")
    cleaned = cleaned.replace(/^[0-9a-fA-F]{1,8}:\s*/gm, '');
    
    // Remove all whitespace (spaces, newlines, tabs)
    cleaned = cleaned.replace(/\s/g, '');
    
    // Convert to lowercase
    cleaned = cleaned.toLowerCase();
    
    // Remove any non-hex characters
    cleaned = cleaned.replace(/[^0-9a-f]/g, '');
    
    return cleaned;
  };

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

    // Handle paste events to clean hex automatically
    editor.onDidPaste((e: any) => {
      const clipboardText = e.text;
      const cleanedHex = cleanHexString(clipboardText);
      
      // If the pasted text looks like hex (has hex characters), replace with cleaned version
      if (cleanedHex.length > 0 && /[0-9a-fA-F]/.test(clipboardText) && cleanedHex !== clipboardText.replace(/\s/g, '').toLowerCase()) {
        // Use setTimeout to ensure paste has completed
        setTimeout(() => {
          const model = editor.getModel();
          const selection = editor.getSelection();
          
          if (model && selection) {
            // Get the current value
            const currentValue = model.getValue();
            
            // Find where the paste happened (selection end)
            const pasteEnd = selection.endLineNumber;
            const pasteEndCol = selection.endColumn;
            
            // Replace the pasted content with cleaned hex
            // Monaco has already inserted the text, so we need to undo and replace
            editor.executeEdits('clean-paste', [{
              range: {
                startLineNumber: selection.startLineNumber,
                startColumn: selection.startColumn,
                endLineNumber: pasteEnd,
                endColumn: pasteEndCol,
              },
              text: cleanedHex,
            }]);
            
            // Trigger change event with cleaned value
            const newValue = model.getValue();
            const finalCleaned = cleanHexString(newValue);
            onChange(finalCleaned);
            
            // Scroll to show the content after paste
            setTimeout(() => {
              editor.revealLine(1);
              editor.setScrollTop(0);
            }, 10);
          }
        }, 0);
      }
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
    editor.onDidChangeModelContent(() => {
      validateHex();
      
      // Auto-scroll to show content when it changes
      const model = editor.getModel();
      if (model) {
        const lineCount = model.getLineCount();
        if (lineCount > 0) {
          // Scroll to top to show the beginning of the hex
          editor.revealLine(1);
          editor.setScrollTop(0);
        }
      }
    });
    
    // Initial validation
    validateHex();
    
    // Ensure all content is visible on mount
    setTimeout(() => {
      const model = editor.getModel();
      if (model) {
        const lineCount = model.getLineCount();
        if (lineCount > 0) {
          editor.revealLine(1);
          editor.setScrollTop(0);
        }
      }
    }, 100);
  };

  const handleEditorChange = (newValue: string | undefined) => {
    if (newValue !== undefined) {
      // Clean up the input - handle both formatted (with offsets) and raw hex
      const cleaned = cleanHexString(newValue);
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

  // Auto-scroll to show hex content when value changes
  useEffect(() => {
    if (editorRef.current && displayValue) {
      const editor = editorRef.current;
      const model = editor.getModel();
      
      if (model) {
        const lineCount = model.getLineCount();
        
        if (lineCount > 0) {
          // Scroll to top to show the beginning of the hex
          // This ensures users can always see the start of the transaction
          editor.revealLine(1);
          editor.setScrollTop(0);
        }
      }
    }
  }, [displayValue]);

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
