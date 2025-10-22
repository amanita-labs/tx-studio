// src/app/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, FileText, Search, Zap, Shield, Code, Eye } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <Badge variant="outline" className="mb-4">
            Cardano Transaction Inspector
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Decode, Inspect, and Understand
            <span className="text-primary"> Cardano Transactions</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            A zero-backend, delightful web app that accepts hex-encoded Cardano transactions,
            decodes their CBOR, and renders human-friendly transaction views.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/tx">
                <FileText className="mr-2 h-5 w-5" />
                Start Inspecting
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/build">
                <Code className="mr-2 h-5 w-5" />
                Build Transactions
                <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Why Choose Our Inspector?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Unlike existing tools, we provide a comprehensive yet accessible way to understand Cardano transactions.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Deep Analysis</CardTitle>
              <CardDescription>
                Unlike shallow tools, we provide comprehensive transaction analysis with detailed CBOR annotation.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Eye className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Human-Friendly</CardTitle>
              <CardDescription>
                Clean, compact, and explorable interface that makes complex transaction data accessible to everyone.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Zero Backend</CardTitle>
              <CardDescription>
                Everything runs in your browser. No data sent to servers, ensuring privacy and security.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Secure & Private</CardTitle>
              <CardDescription>
                Your transaction data never leaves your device. Complete privacy and security guaranteed.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Code className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Developer Friendly</CardTitle>
              <CardDescription>
                Built with modern web technologies and designed for both users and developers.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Comprehensive Coverage</CardTitle>
              <CardDescription>
                Support for all Cardano eras, governance actions, scripts, and advanced transaction features.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Comparison Section */}
      <div className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How We Compare</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              See how we stack up against existing Cardano transaction tools.
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">CQuisitor</CardTitle>
                  <CardDescription>Too technical for most users</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Complex interface</li>
                    <li>• Requires deep technical knowledge</li>
                    <li>• Limited user guidance</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">cbor.me</CardTitle>
                  <CardDescription>Raw CBOR view only</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Raw data display</li>
                    <li>• No Cardano-specific context</li>
                    <li>• Limited annotation</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="text-lg text-primary">Our Inspector</CardTitle>
                  <CardDescription>Perfect balance of depth and accessibility</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center">
                      <ArrowRight className="h-4 w-4 text-green-500 mr-2" />
                      Human-friendly interface
                    </li>
                    <li className="flex items-center">
                      <ArrowRight className="h-4 w-4 text-green-500 mr-2" />
                      Deep CBOR annotation
                    </li>
                    <li className="flex items-center">
                      <ArrowRight className="h-4 w-4 text-green-500 mr-2" />
                      Cardano-specific context
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-8">
            Paste your first Cardano transaction and see the magic happen.
          </p>
          <Button asChild size="lg">
            <Link href="/tx">
              <FileText className="mr-2 h-5 w-5" />
              Start Inspecting Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}