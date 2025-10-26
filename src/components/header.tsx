// src/components/header.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { BlockExplorerSelector } from '@/components/block-explorer-selector';
import { FileText, Code, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Inspector', icon: FileText },
    { href: '/build', label: 'Builder', icon: Code },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <FileText className="h-6 w-6" />
              <span className="font-bold">Transaction Studio</span>
            </Link>
            
            <nav className="flex items-center space-x-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                
                return (
                  <Button
                    key={item.href}
                    asChild
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                  >
                    <Link href={item.href} className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <BlockExplorerSelector />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
