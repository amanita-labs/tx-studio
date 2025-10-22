// src/features/inspector/ErrorState.tsx
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';

interface ErrorStateProps {
  error: string;
}

export function ErrorState({ error }: ErrorStateProps) {
  const { clearTx } = useAppStore();

  return (
    <Card className="h-full">
      <CardContent className="flex flex-col items-center justify-center h-full text-center p-8">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to Parse Transaction</h3>
        <p className="text-muted-foreground mb-4 max-w-md">
          {error}
        </p>
        <Button onClick={clearTx} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}
