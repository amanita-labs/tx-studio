# Transaction Studio

A web app for inspecting and building Cardano Transactions.

Building part, is still todo.

## Features

- **Transaction Inspection**: Parse and inspect Cardano transactions from hex data
- **Blockfrost Integration**: Fetch transactions directly from Cardano networks via Blockfrost API
- **Multi-Network Support**: Works with Mainnet, Preprod, and Preview networks
- **Transaction Analysis**: Detailed breakdown of transaction components, metadata, scripts, and more

## Blockfrost Integration

This app uses [Blockfrost](https://blockfrost.io) to fetch transaction data from Cardano networks. Blockfrost provides a free tier with generous rate limits.

### Setup for Local Development

1. **Get Blockfrost API Keys**:
   - Sign up at [blockfrost.io](https://blockfrost.io) (free account available)
   - Create projects for each network you want to use:
     - Mainnet
     - Preprod (testnet)
     - Preview (testnet)

2. **Configure Environment Variables**:
   ```bash
   # Copy the example file
   cp .env.local.example .env.local
   
   # Edit .env.local and add your Blockfrost project IDs
   BLOCKFROST_MAINNET_PROJECT_ID=your_mainnet_project_id_here
   BLOCKFROST_PREPROD_PROJECT_ID=your_preprod_project_id_here
   BLOCKFROST_PREVIEW_PROJECT_ID=your_preview_project_id_here
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

### Deployment

#### Vercel (Recommended for Blockfrost Features)

Vercel supports Next.js API routes, which are required for Blockfrost integration:

1. **Connect Repository to Vercel**:
   - Import your GitHub repository in Vercel dashboard
   - Vercel will auto-detect Next.js configuration

2. **Configure Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add the following variables:
     - `BLOCKFROST_MAINNET_PROJECT_ID`
     - `BLOCKFROST_PREPROD_PROJECT_ID`
     - `BLOCKFROST_PREVIEW_PROJECT_ID`
   - Set values for Production, Preview, and Development environments

3. **Deploy**:
   - Vercel will automatically deploy on push to main branch
   - API routes will be available at `/api/blockfrost/transactions/[hash]`

#### GitHub Pages (Static Export Only)

GitHub Pages deployment works but **does not support API routes**. The Blockfrost fetch feature will not work in this deployment mode. To deploy:

1. The existing GitHub Actions workflow will build and deploy automatically
2. The app will work for manual hex input, but Blockfrost fetching will be disabled

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Type check
npm run type-check

# Lint
npm run lint
```

## Project Structure

- `src/app/` - Next.js app router pages and API routes
- `src/components/` - Reusable UI components
- `src/features/` - Feature-specific components
- `src/lib/` - Utility functions and libraries
  - `blockfrost/` - Blockfrost API integration
- `src/hooks/` - React hooks
- `src/workers/` - Web workers for heavy computation

## Security Notes

- **API Keys**: Blockfrost API keys are stored in environment variables and never exposed to the client
- **Server-Side Only**: All Blockfrost API calls are made server-side through Next.js API routes
- **Input Validation**: Transaction hashes are validated before API calls
- **Error Handling**: API errors are handled gracefully without exposing sensitive information

## License

[Add your license here]
