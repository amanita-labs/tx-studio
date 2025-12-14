// src/components/hex-editor.tsx
'use client';

import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface HexEditorProps {
  value: string;
  onChange: (value: string) => void;
  onPaste?: (pastedValue: string) => void;
  placeholder?: string;
  className?: string;
}

export function HexEditor({ value, onChange, onPaste, placeholder, className }: HexEditorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    // Clean up the input - remove whitespace and convert to lowercase
    const cleaned = newValue.replace(/\s/g, '').toLowerCase();
    onChange(cleaned);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // Get the pasted text from clipboard
    const pastedText = e.clipboardData.getData('text');
    // Clean it up the same way we do in handleChange
    const cleaned = pastedText.replace(/\s/g, '').toLowerCase();
    
    // Prevent default paste behavior - we'll handle it ourselves
    e.preventDefault();
    
    // Set the cleaned value directly
    onChange(cleaned);
    
    // Notify parent with the cleaned pasted value for auto-dissect
    if (onPaste && cleaned) {
      onPaste(cleaned);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <Textarea
        value={value}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder={placeholder}
        className={cn(
          'font-mono text-sm min-h-[300px] max-h-[400px] resize-y overflow-y-auto',
          'focus-visible:ring-2 focus-visible:ring-ring'
        )}
        style={{ wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}
      />
    </div>
  );
}
