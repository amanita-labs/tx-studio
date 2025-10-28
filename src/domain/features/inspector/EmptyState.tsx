// src/features/inspector/EmptyState.tsx
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ArrowRight } from 'lucide-react';

export function EmptyState() {
  return (
    <Card className="h-full">
      <CardContent className="flex flex-col items-center justify-center h-full text-center p-8">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">Welcome to Transaction Studio</h3>
        <p className="text-muted-foreground mb-4 max-w-md">
          Paste a hex-encoded Cardano transaction in the left panel to start inspecting it. 
          Try the sample transaction to see how it works!
        </p>
        <div className="flex items-center text-sm text-muted-foreground">
          <ArrowRight className="h-4 w-4 mr-2" />
          Click on a sample transaction or paste your own hex
        </div>
      </CardContent>
    </Card>
  );
}
